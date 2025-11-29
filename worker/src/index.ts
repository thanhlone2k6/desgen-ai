import type { Env } from './types';
import { handleRegister, handleLogin } from './handlers/auth';
import { handleRegisterRequest, handleCompleteRegister, handleVerifyEmail } from './handlers/auth-register';
import { handleMe } from './handlers/me';
import { handleProxyImage } from './handlers/proxy';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    // Route handling
    if (path === '/auth/register-request' && request.method === 'POST') {
      return handleRegisterRequest(request, env);
    }
    
    if (path === '/auth/verify-email' && request.method === 'GET') {
      return handleVerifyEmail(request, env);
    }
    
    if (path === '/auth/complete-register' && request.method === 'POST') {
      return handleCompleteRegister(request, env);
    }
    
    if (path === '/auth/register' && request.method === 'POST') {
      return handleRegister(request, env);
    }
    
    if (path === '/auth/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }
    
    if (path === '/me' && request.method === 'GET') {
      return handleMe(request, env);
    }
    
    if (path === '/proxy/image' && request.method === 'POST') {
      return handleProxyImage(request, env);
    }
    
    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

