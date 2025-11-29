
import { GenerationConfig, GenerationStyle, GenerationMode, GenerationModel, VideoType, EditType, TokenUsage, UploadedImage } from "../types";
import { TSHIRT_SYSTEM_PROMPT, IPHONE_SYSTEM_PROMPT, IPHONE_RAW_SYSTEM_PROMPT, COPY_IDEA_SYSTEM_PROMPT, DEFAULT_VIDEO_PROMPT, EDIT_INPAINT_PROMPT, EDIT_OUTPAINT_PROMPT, EDIT_UPSCALE_PROMPT, EDIT_SUPER_ZOOM_PROMPT, PROMPT_ASSISTANT_SYSTEM_PROMPT } from "../constants";
import { getToken } from "./storageService";

const MAX_RETRIES = 3;

// Helper to check if error is retryable
const isRetryableError = (error: any): boolean => {
  const status = error.status || error.code || (error.response && error.response.status);
  const message = (error.message || JSON.stringify(error)).toUpperCase();

  return (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("OVERLOADED") ||
    message.includes("INTERNAL") ||
    message.includes("QUOTA")
  );
};

// Helper to check if error is location-related (retryable)
const isLocationError = (error: any): boolean => {
  const message = (error.message || JSON.stringify(error)).toUpperCase();
  const errorString = JSON.stringify(error).toUpperCase();
  
  return (
    message.includes("LOCATION") && message.includes("NOT SUPPORTED") ||
    errorString.includes("LOCATION") && errorString.includes("NOT SUPPORTED") ||
    message.includes("USER LOCATION") && message.includes("NOT SUPPORTED")
  );
};

// Helper to format 403 errors
const handleApiError = (error: any) => {
  const status = error.status || error.code || (error.response && error.response.status);
  const message = (error.message || "").toUpperCase();
  const errorString = JSON.stringify(error).toUpperCase();

  // Check for location/geographic restriction
  if (message.includes("LOCATION") && message.includes("NOT SUPPORTED") || 
      errorString.includes("LOCATION") && errorString.includes("NOT SUPPORTED") ||
      error.code === 'location_not_supported') {
    // Provide more helpful error message with suggestions
    const suggestion = error.suggestion || 'Vui lòng đợi vài phút rồi thử lại, hoặc kiểm tra cấu hình API key trong Google Cloud Console.';
    throw new Error(`Vị trí địa lý không được hỗ trợ bởi Google Gemini API.\n\n${suggestion}\n\nHệ thống đã tự động thử lại nhiều lần nhưng vẫn gặp lỗi. Lỗi này thường do:\n• API key có giới hạn địa lý\n• Project chưa bật đúng region\n• Google API tạm thời không hỗ trợ vị trí này`);
  }

  if (status === 403 || message.includes("PERMISSION_DENIED")) {
    throw new Error("Lỗi quyền truy cập (403): Vui lòng đảm bảo Project trên Google Cloud đã bật Billing (Thanh toán) và API Key hợp lệ.");
  }
  if (message.includes("RESOURCE_EXHAUSTED") || status === 429) {
    throw new Error("Hệ thống đang quá tải hoặc hết hạn ngạch (Quota). Vui lòng thử lại sau.");
  }
  throw error;
};

// Worker base URL
const WORKER_BASE_URL = "https://desgen-ai-worker.thanhnguyenphotowork.workers.dev";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Helper to get API key from sessionStorage (temporary, cleared on app close)
const getApiKey = (): string | null => {
  try {
    return sessionStorage.getItem('gemini_api_key');
  } catch {
    return null;
  }
};

// Helper to get auth token
const getAuthToken = (): string | null => {
  try {
    return getToken();
  } catch {
    return null;
  }
};

// Helper to call Google Gemini API directly (fallback)
const callDirectAPI = async (model: string, payload: any, apiKey: string): Promise<any> => {
  // Restructure payload for Google API
  const googleApiBody: any = {
    contents: payload.contents
  };

  // Map config.systemInstruction if present
  if (payload.config?.systemInstruction) {
    googleApiBody.systemInstruction = {
      parts: [{ text: payload.config.systemInstruction }]
    };
  }

  // Add safetySettings if needed
  if (payload.safetySettings) {
    googleApiBody.safetySettings = payload.safetySettings;
  }

  const apiUrl = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(googleApiBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.error?.message || JSON.stringify(errorData.error) || 'API call failed';
    throw new Error(errorMessage);
  }

  return await response.json();
};

// Helper to call worker proxy with fallback to direct API
const callWorkerProxy = async (model: string, payload: any): Promise<any> => {
  const token = getAuthToken();
  const apiKey = getApiKey();
  
  // If no token, require API key
  if (!token) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("Vui lòng nhập API key để sử dụng dịch vụ. API key là bắt buộc.");
    }
    console.log('No auth token, using direct API call with user-provided API key...');
    return await callDirectAPI(model, payload, apiKey);
  }
  
  // If have token but Worker fails, fallback to API key if available
  // (This is handled in the catch block below)
  
  try {
    const response = await fetch(`${WORKER_BASE_URL}/proxy/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model,
        ...payload
      })
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errorCode: string | undefined;
      
      try {
        const errorData = await response.json();
        
      // TEMPORARILY DISABLED - Unlimited Banana Pro
      /*
      if (response.status === 403 && errorData.code === 'upgrade_required') {
        throw new Error('Bạn đã sử dụng hết lượt miễn phí. Vui lòng nâng cấp để tiếp tục sử dụng.');
      }
      */
        
        if (response.status === 401) {
          // If 401 and have API key, fallback to direct API
          if (apiKey) {
            console.log('Auth failed, falling back to direct API call...');
            return await callDirectAPI(model, payload, apiKey);
          }
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        
        // Check for location error code - FALLBACK to direct API
        if (errorData.code === 'location_not_supported') {
          if (apiKey) {
            console.log('Worker location error detected, falling back to direct API call...');
            return await callDirectAPI(model, payload, apiKey);
          }
          errorCode = 'location_not_supported';
          if (errorData.suggestion) {
            errorMessage = errorData.error || errorMessage;
          }
        }
        
        // Extract error message from various possible structures
        if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else if (errorData.error?.message) {
          errorMessage = String(errorData.error.message);
        } else if (errorData.message) {
          errorMessage = String(errorData.message);
        } else if (errorData.error) {
          // If error is an object, try to extract meaningful info
          if (errorData.error.details && Array.isArray(errorData.error.details)) {
            const detailMessages = errorData.error.details
              .map((d: any) => d.message || JSON.stringify(d))
              .filter(Boolean)
              .join('; ');
            errorMessage = detailMessages || String(errorData.error);
          } else {
            errorMessage = String(errorData.error);
          }
        }
      } catch (parseError) {
        // If JSON parse fails, try direct API if available
        if (apiKey && apiKey.trim().length > 0) {
          console.log('Worker error, falling back to direct API call...');
          return await callDirectAPI(model, payload, apiKey);
        }
        // If no API key available, throw error
        if (!apiKey || apiKey.trim().length === 0) {
          throw new Error("Vui lòng nhập API key để sử dụng dịch vụ. API key là bắt buộc.");
        }
        // If JSON parse fails, use default
        if (parseError instanceof Error && parseError.message) {
          throw parseError; // Re-throw our custom errors
        }
      }
      
      const error = new Error(errorMessage) as any;
      if (errorCode) {
        error.code = errorCode;
      }
      throw error;
    }

    return await response.json();
  } catch (networkError: any) {
    // Network error or worker unavailable - try direct API if available
    if (apiKey && apiKey.trim().length > 0) {
      console.log('Worker unavailable, falling back to direct API call...');
      return await callDirectAPI(model, payload, apiKey);
    }
    // If no API key, throw clear error
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("Vui lòng nhập API key để sử dụng dịch vụ. API key là bắt buộc.");
    }
    throw networkError;
  }
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: UploadedImage;
}

// --- PROMPT ASSISTANT CHAT ---
export const chatWithAssistant = async (history: ChatMessage[], newMessage: string, image?: UploadedImage): Promise<string> => {
  // Construct the chat history + new message
  const contents = history.map(msg => {
    const parts: any[] = [];
    if (msg.image) {
      parts.push({ inlineData: { data: msg.image.base64, mimeType: msg.image.mimeType } });
    }
    if (msg.text) {
      parts.push({ text: msg.text });
    }
    return { role: msg.role, parts };
  });

  // Add the new message
  const newParts: any[] = [];
  if (image) {
    newParts.push({ inlineData: { data: image.base64, mimeType: image.mimeType } });
    newParts.push({ text: "Describe this image in detail for a prompt." }); // Implicit instruction if image is dropped
  }
  if (newMessage) {
    newParts.push({ text: newMessage });
  }

  contents.push({ role: 'user', parts: newParts });

  try {
    const response = await callWorkerProxy(GenerationModel.GEMINI_FLASH, {
      contents: contents,
      config: {
        systemInstruction: PROMPT_ASSISTANT_SYSTEM_PROMPT,
      }
    });

    // Extract text from response (Google GenAI format)
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        const textParts = candidate.content.parts
          .filter((part: any) => part.text)
          .map((part: any) => part.text);
        return textParts.join('') || "Tôi không thể phản hồi yêu cầu này.";
      }
    }
    
    return "Tôi không thể phản hồi yêu cầu này.";
  } catch (error) {
    console.error("Assistant Error:", error);
    throw error;
  }
};

// --- VIDEO GENERATION ---
// NOTE: Video generation is not yet supported through the worker proxy
// TODO: Add video proxy endpoint to worker when needed
export const generateVideoContent = async (config: GenerationConfig): Promise<{ url: string, usage?: TokenUsage }> => {
  throw new Error("Video generation is not yet supported through the worker. This feature will be available soon.");
};

// --- EDIT GENERATION (INPAINT/OUTPAINT/UPSCALE) ---
export const generateEditContent = async (config: GenerationConfig): Promise<{ url: string, usage?: TokenUsage }> => {
  const parts: any[] = [];

  // 1. Select Prompt based on Edit Type
  let systemPrompt = "";
  if (config.editType === EditType.OUTPAINT) systemPrompt = EDIT_OUTPAINT_PROMPT;
  else if (config.editType === EditType.UPSCALE) systemPrompt = EDIT_UPSCALE_PROMPT;
  else if (config.editType === EditType.SUPER_ZOOM) systemPrompt = EDIT_SUPER_ZOOM_PROMPT;
  else systemPrompt = EDIT_INPAINT_PROMPT; // Default to Inpaint

  const userPrompt = config.prompt || (config.editType === EditType.UPSCALE ? "Upscale and enhance details." : "Edit the image.");

  // Thêm instruction về không để nền đen cho tất cả Edit types
  const fillInstruction = "\n\nCRITICAL REQUIREMENT: Do NOT leave any black background, empty areas, or transparent spaces. You MUST fill the entire canvas completely with appropriate content that matches the scene. No black borders, no empty spaces, no transparent areas. The entire image must be completely filled.";

  const finalPrompt = `${systemPrompt}\n\nUSER INSTRUCTIONS: ${userPrompt}${fillInstruction}`;

  // 2. Add Images (Original + Mask)
  if (config.editImage) {
    parts.push({
      inlineData: { data: config.editImage.base64, mimeType: config.editImage.mimeType }
    });
  }

  if (config.maskImage) {
    parts.push({
      inlineData: { data: config.maskImage.base64, mimeType: config.maskImage.mimeType }
    });
    parts.push({ text: "The second image provided is the MASK. White pixels = generate/edit. Black pixels = keep original." });
  }

  parts.push({ text: finalPrompt });

  // 3. Execute with Retry
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWorkerProxy(GenerationModel.GEMINI_PRO, {
        contents: [{ role: 'user', parts: parts }],
        config: {
          // Optional configs
        }
      });

      if (response.candidates && response.candidates.length > 0) {
        const content = response.candidates[0].content;
        const usage = response.usageMetadata as TokenUsage;
        if (content && content.parts) {
          for (const part of content.parts) {
            if (part.inlineData && part.inlineData.data) {
              return {
                url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
                usage: usage
              };
            }
          }
        }
      }
      throw new Error("Không nhận được hình ảnh chỉnh sửa.");
    } catch (error: any) {
      console.warn(`Edit generation attempt ${attempt} failed:`, error);
      lastError = error;

      try { handleApiError(error); } catch (e) { throw e; }

      // Retry for location errors (worker may retry from different edge location)
      if (error.code === 'location_not_supported' && attempt < MAX_RETRIES) {
        const delay = 2000 * Math.pow(2, attempt - 1);
        console.log(`Location error detected, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const delay = 2000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

// --- IMAGE GENERATION ---
export const generateImageContent = async (
  config: GenerationConfig
): Promise<{ url: string, usage?: TokenUsage }> => {
  // If Mode is EDIT, redirect to edit handler
  if (config.mode === GenerationMode.EDIT) {
    return generateEditContent(config);
  }
  let finalPrompt = "";
  const parts: any[] = [];

  // =========================================================
  // 1. CONSTRUCT PROMPT (Shared Logic)
  // =========================================================

  // --- STYLE INSTRUCTIONS ---
  let stylePrompt = "";
  switch (config.style) {
    case GenerationStyle.AUTO:
      stylePrompt = `Analyze the user request and generate the image in the most suitable artistic style. Ensure high quality, aesthetics, and detail. \nUser Request: ${config.prompt}`;
      break;
    case GenerationStyle.TSHIRT_DESIGN:
      let bgInstruction = "";
      if (config.backgroundColor) {
        bgInstruction = `\nCRITICAL BACKGROUND INSTRUCTION: The final output image MUST have a solid ${config.backgroundColor} background. Do NOT use a white background. The design must be placed on top of this ${config.backgroundColor} background.`;
      } else {
        bgInstruction = "\nBackground: Pure WHITE (unless specified otherwise in prompt).";
      }
      stylePrompt = `${TSHIRT_SYSTEM_PROMPT}${bgInstruction}\n\nYÊU CẦU CỦA NGƯỜI DÙNG:\n${config.prompt}`;
      break;
    case GenerationStyle.IPHONE_PHOTO:
      stylePrompt = `${IPHONE_SYSTEM_PROMPT}\n\nUSER SCENE DESCRIPTION:\n${config.prompt}`;
      break;
    case GenerationStyle.IPHONE_RAW:
      stylePrompt = `${IPHONE_RAW_SYSTEM_PROMPT}\n\nUSER SNAPSHOT DESCRIPTION:\n${config.prompt}`;
      break;
    case GenerationStyle.REALISTIC:
      stylePrompt = `Hyper-realistic photograph, 8k resolution, highly detailed, cinematic lighting. ${config.prompt}`;
      break;
    case GenerationStyle.CINEMATIC:
      stylePrompt = `Cinematic shot, movie scene, dramatic lighting, shallow depth of field, color graded, 8k. ${config.prompt}`;
      break;
    case GenerationStyle.VECTOR:
      stylePrompt = `Flat vector art, clean lines, illustrator style, svg style, minimal gradients, white background. ${config.prompt}`;
      break;
    case GenerationStyle.ANIME:
      stylePrompt = `High quality anime art style, Japanese animation, vibrant colors, detailed character design, Studio Ghibli inspired. ${config.prompt}`;
      break;
    case GenerationStyle.CYBERPUNK:
      stylePrompt = `Cyberpunk style, neon lights, night city, futuristic high-tech, dark atmosphere, glowing accents. ${config.prompt}`;
      break;
    case GenerationStyle.RENDER_3D:
      stylePrompt = `3D render, Octane render, Unreal Engine 5, ray tracing, highly detailed materials, studio lighting. ${config.prompt}`;
      break;
    case GenerationStyle.COMIC_BOOK:
      stylePrompt = `Comic book style, bold outlines, halftone patterns, vibrant colors, dynamic action, graphic novel aesthetic. ${config.prompt}`;
      break;
    case GenerationStyle.PIXEL_ART:
      stylePrompt = `Pixel art, 8-bit style, retro gaming aesthetic, blocky details, limited color palette. ${config.prompt}`;
      break;
    case GenerationStyle.STEAMPUNK:
      stylePrompt = `Steampunk aesthetic, victorian sci-fi, brass and copper gears, steam powered machinery, vintage sepia tones. ${config.prompt}`;
      break;
    case GenerationStyle.GLITCH_ART:
      stylePrompt = `Glitch art, digital distortion, chromatic aberration, data moshing, VHS static, cyber error aesthetic. ${config.prompt}`;
      break;
    case GenerationStyle.LINE_ART:
      stylePrompt = `Line art drawing, black and white, continuous line, contour drawing, minimalist, clean strokes. ${config.prompt}`;
      break;
    case GenerationStyle.POP_ART:
      stylePrompt = `Pop art style, Andy Warhol inspired, bold solid colors, repetitive patterns, comic strip aesthetic. ${config.prompt}`;
      break;
    case GenerationStyle.SURREALISM:
      stylePrompt = `Surrealism art, dreamlike atmosphere, Salvador Dali inspired, bizarre shapes, melting objects, mysterious. ${config.prompt}`;
      break;
    case GenerationStyle.MINIMALIST:
      stylePrompt = `Minimalist design, simple shapes, plenty of negative space, soft colors, clean composition. ${config.prompt}`;
      break;
    case GenerationStyle.RETRO_WAVE:
      stylePrompt = `Retrowave/Synthwave style, 80s aesthetic, neon sunset, grid landscape, purple and cyan color palette. ${config.prompt}`;
      break;
    default:
      stylePrompt = config.prompt;
  }

  // --- MODE SPECIFIC LOGIC ---
  if (config.mode === GenerationMode.COPY_IDEA) {
    finalPrompt = `${COPY_IDEA_SYSTEM_PROMPT}\n\n`;

    let conceptCount = 0;
    // Add Concept Images
    if (config.conceptImages && config.conceptImages.length > 0) {
      config.conceptImages.forEach((img, index) => {
        parts.push({
          inlineData: { data: img.base64, mimeType: img.mimeType },
        });
        conceptCount++;
      });

      const imageRefs = Array.from({ length: conceptCount }, (_, i) => `[IMAGE ${i + 1}]`).join(', ');
      finalPrompt += `${imageRefs} are the CONCEPT/STYLE REFERENCES.\n`;
    }

    // Add Subject Images
    if (config.subjectImages && config.subjectImages.length > 0) {
      config.subjectImages.forEach((img) => {
        parts.push({
          inlineData: { data: img.base64, mimeType: img.mimeType },
        });
      });

      const subjectStartIndex = conceptCount + 1;
      const subjectRefs = config.subjectImages.map((_, i) => `[IMAGE ${subjectStartIndex + i}]`).join(', ');

      finalPrompt += `${subjectRefs} are the SUBJECT REFERENCES.\n`;
      finalPrompt += `\nINSTRUCTIONS:
      - Transfer the visual style of the CONCEPT images to the SUBJECT images.
      - CONCEPT STYLE PRESERVATION: ${config.conceptStrength}%.
      - SUBJECT STRUCTURE PRESERVATION: ${config.subjectStrength}%.`;
    } else {
      finalPrompt += `\nINSTRUCTIONS:
      - Transfer the visual style of the CONCEPT images to the subject described below.
      - CONCEPT STYLE PRESERVATION: ${config.conceptStrength}%.`;
    }

    finalPrompt += `\n
    - USER DESCRIPTION (SUBJECT): ${config.prompt || 'Generate a subject based on common sense or creative interpretation'}
    - USER DESCRIPTION (CONCEPT): ${config.conceptPrompt || 'Keep style unchanged'}
    `;
  } else {
    // Creative Mode
    finalPrompt = stylePrompt;

    // Add Reference Images
    if (config.referenceImages && config.referenceImages.length > 0) {
      config.referenceImages.forEach((img) => {
        parts.push({
          inlineData: { data: img.base64, mimeType: img.mimeType },
        });
      });
      finalPrompt += `\n\nUse the provided image(s) as visual reference.`;
    }
  }

  // --- CONSTRAINTS ---
  const preservationConstraints: string[] = [];
  if (config.keepFace) preservationConstraints.push("EXACTLY preserve facial identity and features of the subject.");
  if (config.preservePose) preservationConstraints.push("Strictly maintain the body pose and gesture of the subject.");
  if (config.preserveExpression) preservationConstraints.push("Keep the facial expression (emotion) exactly the same.");
  if (config.preserveStructure) preservationConstraints.push("Maintain the structural lines, perspective, and object placement of the original image.");

  if (preservationConstraints.length > 0) {
    finalPrompt += `\n\nCRITICAL CONSTRAINTS:\n- ${preservationConstraints.join('\n- ')}`;
  }

  if (config.cameraAngle && config.cameraAngle !== 'NONE') {
    let angleText = config.cameraAngle.replace('_', ' ');
    // Special handling for SELFIE
    if (config.cameraAngle === 'SELFIE') {
      angleText = 'Selfie angle (front-facing, arm\'s length, typical selfie perspective)';
    }
    finalPrompt += `\n\nCAMERA ANGLE: ${angleText}`;
  }

  // --- ASPECT RATIO & RESOLUTION INSTRUCTIONS ---
  // Add aspect ratio instruction (only for Pro model supports it via prompt)
  if (config.model === GenerationModel.GEMINI_PRO) {
    const aspectRatioText = config.aspectRatio === '1:1' ? 'square (1:1)' :
                           config.aspectRatio === '16:9' ? 'landscape (16:9)' :
                           config.aspectRatio === '9:16' ? 'portrait (9:16)' :
                           config.aspectRatio === '4:3' ? '4:3 landscape' :
                           config.aspectRatio === '3:4' ? '3:4 portrait' :
                           config.aspectRatio;
    finalPrompt += `\n\nASPECT RATIO: ${aspectRatioText}`;
    
    // Add resolution instruction
    const resolutionText = config.resolution === '1K' ? '1024x1024 (1K resolution)' :
                          config.resolution === '2K' ? '2048x2048 (2K resolution)' :
                          config.resolution === '4K' ? '4096x4096 (4K resolution)' :
                          config.resolution;
    finalPrompt += `\nRESOLUTION: ${resolutionText}`;
  }

  // --- SKIN BEAUTY ---
  if (config.skinBeautyEnabled && config.skinBeautyLevel) {
    const level = config.skinBeautyLevel;
    let skinInstruction = '';
    
    if (level <= 3) {
      skinInstruction = `SKIN QUALITY: Natural skin with minimal retouching. Keep natural skin texture, minor imperfections are acceptable. Skin smoothness level: ${level}/10 (natural look).`;
    } else if (level <= 6) {
      skinInstruction = `SKIN QUALITY: Smooth and refined skin. Reduce visible pores, minor blemishes, and imperfections while maintaining realistic texture. Skin should look healthy and well-maintained. Skin smoothness level: ${level}/10 (medium beauty).`;
    } else {
      skinInstruction = `SKIN QUALITY: Flawless, porcelain-like skin. Perfect, glass-smooth skin with no visible pores, blemishes, or imperfections. Skin should appear luminous, glowing, and magazine-quality perfect. Apply professional beauty retouching. Skin smoothness level: ${level}/10 (maximum beauty/glass skin).`;
    }
    
    finalPrompt += `\n\n${skinInstruction}`;
  }

  // Push text to parts
  parts.push({ text: finalPrompt });

  // =========================================================
  // EXECUTION
  // =========================================================

  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (config.model === GenerationModel.IMAGEN_ULTRA) {
        // TODO: Add Imagen proxy endpoint to worker
        throw new Error("Imagen Ultra generation is not yet supported through the worker.");
      }
      else {
        // --- FIX FOR GEMINI NANO BANANA (FLASH IMAGE) ---
        // 'imageSize' is NOT supported by gemini-2.5-flash-image, only by gemini-3-pro-image-preview
        const imageConfig: any = {
          aspectRatio: config.aspectRatio,
        };

        if (config.model === GenerationModel.GEMINI_PRO) {
          imageConfig.imageSize = config.resolution;
        }

        const response = await callWorkerProxy(config.model, {
          contents: [{
            role: 'user',
            parts: parts,
          }],
          config: {
            imageConfig: imageConfig
          },
        });

        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];

          if (candidate.finishReason === 'SAFETY') {
            throw new Error("Yêu cầu bị từ chối do vi phạm quy tắc an toàn của Google (Safety Filter). Hãy thử điều chỉnh prompt.");
          }

          const content = candidate.content;
          const usage = response.usageMetadata as TokenUsage;

          if (content && content.parts) {
            let textFallback = "";
            for (const part of content.parts) {
              if (part.inlineData && part.inlineData.data) {
                return {
                  url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
                  usage: usage
                };
              }
              if (part.text) {
                textFallback += part.text;
              }
            }
            if (textFallback.trim()) {
              throw new Error(`AI không tạo ảnh mà phản hồi: "${textFallback.trim()}"`);
            }
          }
        }
        throw new Error("Không tìm thấy hình ảnh trong phản hồi của Gemini.");
      }

    } catch (error: any) {
      console.warn(`Image generation attempt ${attempt} failed:`, error);
      lastError = error;

      try { handleApiError(error); } catch (e) { throw e; }

      // Retry for location errors (worker may retry from different edge location)
      if (error.code === 'location_not_supported' && attempt < MAX_RETRIES) {
        const delay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        console.log(`Location error detected, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const delay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Stop retrying if not a transient error
      break;
    }
  }

  console.error("Generation Failed after retries:", lastError);
  throw lastError || new Error("Hệ thống đang bận hoặc gặp lỗi, vui lòng thử lại sau.");
};
