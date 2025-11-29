import type { Env } from '../types';
import { verifyJWT } from '../utils/jwt';
import { getUserById, updateUser } from '../utils/kv';
import { checkRateLimit } from '../utils/rateLimit';

const GEMINI_IMAGE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function handleProxyImage(request: Request, env: Env): Promise<Response> {
  try {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(`proxy:${clientIp}`)) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429);
    }
    
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    
    if (!payload) {
      return jsonResponse({ error: 'Invalid token' }, 401);
    }
    
    const user = await getUserById(env.DESGEN_KV, payload.user_id);
    if (!user) {
      return jsonResponse({ error: 'User not found' }, 404);
    }
    
    // Get request body
    const body = await request.json();
    const model = body.model || '';
    
    if (!model) {
      return jsonResponse({ error: 'Model is required' }, 400);
    }
    
    // Check if free user trying to use gemini-3-pro-image-preview
    if (user.role === 'free' && model === 'gemini-3-pro-image-preview') {
      const total = user.banana_pro_free_total ?? 20;
      if (user.banana_pro_free_used >= total) {
        return jsonResponse(
          { error: 'Upgrade required', code: 'upgrade_required' },
          403
        );
      }
      
      // Increment usage
      user.banana_pro_free_used += 1;
      await updateUser(env.DESGEN_KV, user);
    }
    
    // Select API key based on role
    const apiKey = user.role === 'vip' ? env.VIP_API_KEY : env.FREE_API_KEY;
    
    // Remove model from body since it goes in the URL
    const { model: _ignored, config, ...restBody } = body;
    
    // Restructure payload for Google API
    // Google API accepts: contents, generationConfig, systemInstruction, safetySettings
    // NOTE: aspectRatio and imageSize are NOT supported as direct fields in the API
    // They must be handled via prompt instructions in the contents
    const googleApiBody: any = {
      contents: restBody.contents
    };
    
    // Do NOT send aspectRatio or imageSize - they are not supported by Google API
    // These should be handled via prompt instructions in the frontend
    
    // Map config.systemInstruction if present (for chat/assistant)
    if (config?.systemInstruction) {
      googleApiBody.systemInstruction = {
        parts: [{ text: config.systemInstruction }]
      };
    }
    
    // Add safetySettings if needed (optional)
    if (restBody.safetySettings) {
      googleApiBody.safetySettings = restBody.safetySettings;
    }
    
    // Forward request to Google GenAI API with retry logic for location errors
    const apiUrl = `${GEMINI_IMAGE_API_URL}/${model}:generateContent?key=${apiKey}`;
    
    // Retry logic for location errors (Cloudflare Worker may run from different edge locations)
    // Increased retries and improved strategy
    const MAX_LOCATION_RETRIES = 8; // Increased from 5 to 8
    let lastLocationError: any = null;
    let lastResponse: Response | null = null;
    let lastResponseData: any = null;
    
    for (let attempt = 1; attempt <= MAX_LOCATION_RETRIES; attempt++) {
      try {
        // Add random jitter to avoid thundering herd
        const baseDelay = 1000 * Math.pow(1.5, attempt - 1); // Exponential backoff: 1s, 1.5s, 2.25s, 3.375s, etc.
        const jitter = Math.random() * 500; // Random 0-500ms
        if (attempt > 1) {
          const delay = baseDelay + jitter;
          console.log(`Location retry attempt ${attempt}/${MAX_LOCATION_RETRIES}, waiting ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Try to force different edge location by adding cache-busting headers
        const proxyRequest = new Request(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add cache-busting to potentially route to different edge
            'Cache-Control': 'no-cache',
            'X-Request-ID': `${Date.now()}-${attempt}-${Math.random().toString(36).substring(7)}`
          },
          body: JSON.stringify(googleApiBody),
          // Force fresh request
          cf: {
            cacheTtl: 0,
            cacheEverything: false
          }
        });
        
        lastResponse = await fetch(proxyRequest);
        lastResponseData = await lastResponse.json();

        // Check for location/geographic restriction errors
        if (!lastResponse.ok && lastResponseData.error) {
          const errorMessage = lastResponseData.error.message || JSON.stringify(lastResponseData.error);
          const errorString = errorMessage.toLowerCase();
          
          // Check if it's a location error
          if ((errorString.includes('location') && errorString.includes('not supported')) ||
              (errorString.includes('user location') && errorString.includes('not supported')) ||
              (errorString.includes('geographic') && errorString.includes('not supported')) ||
              (errorString.includes('region') && errorString.includes('not available'))) {
            
            lastLocationError = {
              error: 'Vị trí địa lý không được hỗ trợ bởi Google Gemini API. Đang thử lại tự động...',
              code: 'location_not_supported',
              details: errorMessage,
              attempt: attempt,
              maxAttempts: MAX_LOCATION_RETRIES
            };
            
            // Continue retrying
            if (attempt < MAX_LOCATION_RETRIES) {
              continue; // Retry from potentially different edge location
            }
            
            // All retries failed - return user-friendly error
            console.error(`All ${MAX_LOCATION_RETRIES} location retry attempts failed`);
            return jsonResponse({
              error: 'Vị trí địa lý không được hỗ trợ bởi Google Gemini API. Hệ thống đã thử lại nhiều lần nhưng vẫn gặp lỗi. Vui lòng thử lại sau vài phút hoặc kiểm tra cấu hình API key trong Google Cloud Console.',
              code: 'location_not_supported',
              details: errorMessage,
              retries: MAX_LOCATION_RETRIES,
              suggestion: 'Giải pháp: 1) Đợi vài phút rồi thử lại, 2) Kiểm tra Google Cloud Console để đảm bảo API key không có giới hạn địa lý, 3) Đảm bảo Project đã bật billing và đúng region.'
            }, lastResponse.status);
          }
          
          // Non-location error - return immediately
          return new Response(JSON.stringify(lastResponseData), {
            status: lastResponse.status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
          });
        }

        // Success - return immediately
        return new Response(JSON.stringify(lastResponseData), {
          status: lastResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
      } catch (fetchError: any) {
        // Network or fetch error - retry if not last attempt
        console.error(`Fetch error on attempt ${attempt}:`, fetchError);
        if (attempt < MAX_LOCATION_RETRIES) {
          continue;
        }
        // Last attempt failed
        return jsonResponse({
          error: 'Lỗi kết nối đến Google API. Vui lòng thử lại sau.',
          code: 'network_error',
          details: fetchError.message || String(fetchError)
        }, 500);
      }
    }

    // Fallback (should not reach here, but just in case)
    if (lastLocationError) {
      return jsonResponse({ 
        error: 'Vị trí địa lý không được hỗ trợ bởi Google Gemini API. Vui lòng kiểm tra cấu hình API key trong Google Cloud Console (API restrictions, Quotas) hoặc thử lại sau.',
        code: 'location_not_supported',
        details: lastLocationError.details || 'Unknown location error',
        retries: MAX_LOCATION_RETRIES
      }, 403);
    }

    // Should not reach here
    return jsonResponse({ error: 'Unexpected error' }, 500);
  } catch (error) {
    console.error('Proxy error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

