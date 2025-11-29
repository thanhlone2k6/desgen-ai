import type { Env, RegisterRequest, LoginRequest, AuthResponse } from '../types';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { signJWT } from '../utils/jwt';
import { getUserByEmail, saveUser, generateUserId, getVipEmails, getDevice, saveDevice, getIpRegCount, incrementIpRegCount } from '../utils/kv';
import { checkRateLimit } from '../utils/rateLimit';

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

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  try {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(`register:${clientIp}`)) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429);
    }
    
    const body: RegisterRequest = await request.json();
    
    if (!body.email || !body.password) {
      return jsonResponse({ error: 'Email and password are required' }, 400);
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
    const existingUser = await getUserByEmail(env.DESGEN_KV, body.email);
    if (existingUser) {
      return jsonResponse({ error: 'User already exists' }, 409);
    }
    
    // Check device if provided
    let freeEligible = true;
    if (body.device_id) {
      const device = await getDevice(env.DESGEN_KV, body.device_id);
      freeEligible = !device?.free_claimed;
    }
    
    // Check VIP emails
    const vipEmails = await getVipEmails(env.DESGEN_KV);
    const role = vipEmails.includes(body.email.toLowerCase()) ? 'vip' : 'free';
    
    // Hash password
    const password_hash = await hashPassword(body.password);
    
    const banana_pro_free_total = freeEligible ? 20 : 0;
    
    // Create user
    const user_id = generateUserId();
    const user = {
      user_id,
      email: body.email.toLowerCase(),
      password_hash,
      role,
      created_at: new Date().toISOString(),
      banana_pro_free_used: 0,
      banana_pro_free_total
    };
    
    await saveUser(env.DESGEN_KV, user);
    
    // Mark device as claimed if freeEligible and device_id provided
    if (freeEligible && body.device_id) {
      await saveDevice(env.DESGEN_KV, body.device_id, {
        first_email: body.email.toLowerCase(),
        free_claimed: true,
        created_at: new Date().toISOString()
      });
    }
    
    // Increment IP count
    await incrementIpRegCount(env.DESGEN_KV, clientIp, day);
    
    // Generate JWT
    const token = await signJWT(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role
      },
      env.JWT_SECRET
    );
    
    const response: AuthResponse = {
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
    
    return jsonResponse(response, 201);
  } catch (error) {
    console.error('Register error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    // Rate limit: 5 per minute for login
    const loginKey = `login:${clientIp}`;
    if (!checkRateLimit(loginKey)) {
      return jsonResponse({ error: 'Rate limit exceeded. Please try again later.' }, 429);
    }
    
    const body: LoginRequest = await request.json();
    
    if (!body.email || !body.password) {
      return jsonResponse({ error: 'Email and password are required' }, 400);
    }
    
    // Get user by email
    const user = await getUserByEmail(env.DESGEN_KV, body.email.toLowerCase());
    if (!user) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }
    
    // Verify password
    const isValid = await verifyPassword(body.password, user.password_hash);
    if (!isValid) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }
    
    // User must be a real user (not just verified email without complete-register)
    // This is already checked by getUserByEmail - if user exists, it's a real user
    
    // Generate JWT
    const token = await signJWT(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role
      },
      env.JWT_SECRET
    );
    
    const response: AuthResponse = {
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
    
    return jsonResponse(response, 200);
  } catch (error) {
    console.error('Login error:', error);
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

