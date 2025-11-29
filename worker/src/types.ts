export interface User {
  user_id: string;
  email: string;
  name?: string;
  password_hash: string;
  role: "free" | "vip";
  created_at: string;
  banana_pro_free_used: number;
  banana_pro_free_total: number;
}

export interface JWTPayload {
  user_id: string;
  email: string;
  role: "free" | "vip";
  iat?: number;
  exp?: number;
}

export interface RegisterRequestRequest {
  name: string;
  email: string;
  password: string;
  device_id?: string;
}

export interface PendingRegistration {
  email: string;
  name: string;
  password_hash: string;
  role: "free" | "vip";
  created_at: string;
  expires_at: string;
}

export interface CompleteRegisterRequest {
  email: string;
  password: string;
  device_id?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  device_id?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    user_id: string;
    email: string;
    name?: string;
    role: "free" | "vip";
  };
}

export interface MeResponse {
  user: {
    user_id: string;
    email: string;
    name?: string;
    role: "free" | "vip";
    created_at: string;
  };
  entitlements: {
    can_use_banana_pro: boolean;
    can_use_video: boolean;
    banana_pro_remaining: number;
    banana_pro_total: number;
    free_eligible: boolean;
  };
}

export interface Env {
  DESGEN_KV: KVNamespace;
  FREE_API_KEY: string;
  VIP_API_KEY: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
}

