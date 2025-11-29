import type { Env, MeResponse } from '../types';
import { verifyJWT } from '../utils/jwt';
import { getUserById } from '../utils/kv';

export async function handleMe(request: Request, env: Env): Promise<Response> {
  try {
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
    
    // Calculate entitlements
    const total = user.banana_pro_free_total ?? 20;
    const used = user.banana_pro_free_used ?? 0;
    
    const entitlements = {
      can_use_banana_pro: user.role === 'vip',
      can_use_video: user.role === 'vip',
      banana_pro_remaining: Math.max(0, total - used),
      banana_pro_total: total,
      free_eligible: total > 0
    };
    
    const response: MeResponse = {
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at
      },
      entitlements
    };
    
    return jsonResponse(response, 200);
  } catch (error) {
    console.error('Me error:', error);
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

