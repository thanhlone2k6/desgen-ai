import type { Env, RegisterRequestRequest, CompleteRegisterRequest, PendingRegistration } from '../types';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { signJWT } from '../utils/jwt';
import { getUserByEmail, saveUser, generateUserId, getVipEmails, getDevice, saveDevice, getIpRegCount, incrementIpRegCount, savePending, getPending, deletePending, isEmailVerified, markEmailVerified, getPendingByEmail } from '../utils/kv';
import { checkRateLimit } from '../utils/rateLimit';
import { sendVerificationEmail } from '../utils/email';

// Blocked temp mail domains
const BLOCKED_DOMAINS = [
  "10minutemail.com",
  "tempmailo.com",
  "guerrillamail.com",
  "mailinator.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "mintemail.com"
];

export async function handleRegisterRequest(request: Request, env: Env): Promise<Response> {
  try {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(`register:${clientIp}`)) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429);
    }
    
    const body: RegisterRequestRequest = await request.json();
    
    // Validate inputs
    if (!body.name || !body.email || !body.password) {
      return jsonResponse({ error: 'Name, email, and password are required' }, 400);
    }
    
    // Validate name length
    if (body.name.trim().length < 2) {
      return jsonResponse({ error: 'Name must be at least 2 characters' }, 400);
    }
    
    // Validate password length
    if (body.password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return jsonResponse({ error: 'Invalid email format' }, 400);
    }
    
    // Check blocked domains
    const domain = body.email.split('@')[1]?.toLowerCase();
    if (!domain) {
      return jsonResponse({ error: 'Invalid email' }, 400);
    }
    
    if (BLOCKED_DOMAINS.includes(domain)) {
      return jsonResponse({ 
        error: 'Email tạm thời không được hỗ trợ. Vui lòng dùng Gmail/Yahoo/Outlook.' 
      }, 400);
    }
    
    // Rate limit by IP (100 per day)
    const day = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
    const ipCount = await getIpRegCount(env.DESGEN_KV, clientIp, day);
    if (ipCount >= 100) {
      return jsonResponse({ 
        error: 'Bạn đăng ký quá nhiều lần hôm nay. Thử lại sau 24h.' 
      }, 429);
    }
    
    // Check if user already exists
    const existingUser = await getUserByEmail(env.DESGEN_KV, body.email.toLowerCase());
    if (existingUser) {
      return jsonResponse({ error: 'User already exists' }, 409);
    }
    
    // Check if there's an active pending registration for this email
    const existingPending = await getPendingByEmail(env.DESGEN_KV, body.email.toLowerCase());
    if (existingPending) {
      // Overwrite existing pending (allow resending email)
      // Delete old pending first
      await deletePending(env.DESGEN_KV, existingPending.token, body.email.toLowerCase());
    }
    
    // Check device record (optional)
    let freeEligible = true;
    if (body.device_id) {
      const device = await getDevice(env.DESGEN_KV, body.device_id);
      freeEligible = !device?.free_claimed;
    }
    
    // Hash password
    const password_hash = await hashPassword(body.password);
    
    // Determine role
    const vipEmails = await getVipEmails(env.DESGEN_KV);
    const role = vipEmails.includes(body.email.toLowerCase()) ? 'vip' : 'free';
    
    // Generate verification token
    const verifyToken = crypto.randomUUID();
    
    // Save pending registration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
    const pending: PendingRegistration = {
      name: body.name.trim(),
      email: body.email.toLowerCase(),
      password_hash,
      role,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    };
    
    await savePending(env.DESGEN_KV, verifyToken, pending);
    
    // Increment IP count
    await incrementIpRegCount(env.DESGEN_KV, clientIp, day);
    
    // Send verification email
    try {
      const workerBaseUrl = new URL(request.url).origin;
      await sendVerificationEmail(env, workerBaseUrl, body.email.toLowerCase(), body.name.trim(), verifyToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Still return success, but log the error
      // In production, you might want to return an error or queue for retry
    }
    
    return jsonResponse({ 
      ok: true,
      message: 'Verification email sent'
    }, 201);
  } catch (error) {
    console.error('Register request error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

export async function handleCompleteRegister(request: Request, env: Env): Promise<Response> {
  try {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(`register:${clientIp}`)) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429);
    }
    
    const body: CompleteRegisterRequest = await request.json();
    
    if (!body.email || !body.password) {
      return jsonResponse({ error: 'Email and password are required' }, 400);
    }
    
    // Check if email is verified
    const verified = await isEmailVerified(env.DESGEN_KV, body.email.toLowerCase());
    if (!verified) {
      return jsonResponse({ error: 'Email not verified. Please verify your email first.' }, 400);
    }
    
    // Get pending registration by email
    const pendingData = await getPendingByEmail(env.DESGEN_KV, body.email.toLowerCase());
    if (!pendingData) {
      return jsonResponse({ error: 'No pending registration found. Please register again.' }, 404);
    }
    
    const { token: pendingToken, pending } = pendingData;
    
    // Verify password matches
    const isValid = await verifyPassword(body.password, pending.password_hash);
    if (!isValid) {
      return jsonResponse({ error: 'Invalid password' }, 401);
    }
    
    // Check if user already exists (race condition check)
    const existingUser = await getUserByEmail(env.DESGEN_KV, body.email.toLowerCase());
    if (existingUser) {
      // User already created, delete pending and return existing user
      await deletePending(env.DESGEN_KV, pendingToken, body.email.toLowerCase());
      const token = await signJWT(
        {
          user_id: existingUser.user_id,
          email: existingUser.email,
          role: existingUser.role
        },
        env.JWT_SECRET
      );
      return jsonResponse({
        token,
        user: {
          user_id: existingUser.user_id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role
        }
      }, 200);
    }
    
    // Check device record (optional)
    let freeEligible = true;
    if (body.device_id) {
      const device = await getDevice(env.DESGEN_KV, body.device_id);
      freeEligible = !device?.free_claimed;
    }
    
    const banana_pro_free_total = freeEligible ? 20 : 0;
    
    // Create user
    const user_id = generateUserId();
    const user = {
      user_id,
      name: pending.name,
      email: body.email.toLowerCase(),
      password_hash: pending.password_hash,
      role: pending.role,
      created_at: new Date().toISOString(),
      banana_pro_free_used: 0,
      banana_pro_free_total
    };
    
    await saveUser(env.DESGEN_KV, user);
    
    // Mark device as claimed if freeEligible
    if (freeEligible && body.device_id) {
      await saveDevice(env.DESGEN_KV, body.device_id, {
        first_email: body.email.toLowerCase(),
        free_claimed: true,
        created_at: new Date().toISOString()
      });
    }
    
    // Delete pending
    await deletePending(env.DESGEN_KV, pendingToken, body.email.toLowerCase());
    
    // Generate JWT
    const token = await signJWT(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role
      },
      env.JWT_SECRET
    );
    
    return jsonResponse({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    }, 201);
  } catch (error) {
    console.error('Complete register error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

export async function handleVerifyEmail(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return htmlResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Xác nhận email</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
            h1 { color: #333; margin-top: 0; }
            p { color: #666; line-height: 1.6; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Token không hợp lệ</h1>
            <p class="error">Link xác nhận không hợp lệ hoặc đã hết hạn.</p>
          </div>
        </body>
        </html>
      `, 400);
    }
    
    // Get pending registration
    const pending = await getPending(env.DESGEN_KV, token);
    if (!pending) {
      return htmlResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Xác nhận email</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
            h1 { color: #333; margin-top: 0; }
            p { color: #666; line-height: 1.6; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Token không hợp lệ hoặc đã hết hạn</h1>
            <p class="error">Link xác nhận đã hết hạn (30 phút) hoặc không hợp lệ. Vui lòng đăng ký lại.</p>
          </div>
        </body>
        </html>
      `, 400);
    }
    
    // Mark email as verified
    await markEmailVerified(env.DESGEN_KV, pending.email);
    
    return htmlResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác nhận thành công</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
          h1 { color: #333; margin-top: 0; }
          p { color: #666; line-height: 1.6; }
          .success { color: #27ae60; font-weight: bold; }
          .icon { font-size: 64px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✓</div>
          <h1>Xác nhận thành công!</h1>
          <p class="success">Email của bạn đã được xác nhận.</p>
          <p>Quay lại app và bấm "Tôi đã xác nhận email" để hoàn tất đăng ký.</p>
        </div>
      </body>
      </html>
    `, 200);
  } catch (error) {
    console.error('Verify email error:', error);
    return htmlResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lỗi</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
          h1 { color: #333; margin-top: 0; }
          p { color: #666; line-height: 1.6; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Đã xảy ra lỗi</h1>
          <p class="error">Vui lòng thử lại sau.</p>
        </div>
      </body>
      </html>
    `, 500);
  }
}

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
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

