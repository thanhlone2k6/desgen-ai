import type { User, Env } from '../types';

export async function getUserById(kv: KVNamespace, user_id: string): Promise<User | null> {
  const data = await kv.get(`user:${user_id}`);
  if (!data) return null;
  return JSON.parse(data) as User;
}

export async function getUserByEmail(kv: KVNamespace, email: string): Promise<User | null> {
  const user_id = await kv.get(`email_to_user:${email}`);
  if (!user_id) return null;
  return getUserById(kv, user_id);
}

export async function saveUser(kv: KVNamespace, user: User): Promise<void> {
  await kv.put(`user:${user.user_id}`, JSON.stringify(user));
  await kv.put(`email_to_user:${user.email}`, user.user_id);
}

export async function updateUser(kv: KVNamespace, user: User): Promise<void> {
  await kv.put(`user:${user.user_id}`, JSON.stringify(user));
}

export async function getVipEmails(kv: KVNamespace): Promise<string[]> {
  const data = await kv.get('vip_emails');
  if (!data) return [];
  return JSON.parse(data) as string[];
}

export function generateUserId(): string {
  // Generate a unique user ID
  return crypto.randomUUID();
}

export async function getDevice(kv: KVNamespace, device_id: string): Promise<{ first_email: string; free_claimed: boolean; created_at: string } | null> {
  const data = await kv.get(`device:${device_id}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function saveDevice(kv: KVNamespace, device_id: string, device: { first_email: string; free_claimed: boolean; created_at: string }): Promise<void> {
  await kv.put(`device:${device_id}`, JSON.stringify(device));
}

export async function getIpRegCount(kv: KVNamespace, ip: string, day: string): Promise<number> {
  const data = await kv.get(`ip_reg_count:${ip}:${day}`);
  return data ? parseInt(data, 10) : 0;
}

export async function incrementIpRegCount(kv: KVNamespace, ip: string, day: string): Promise<void> {
  const count = await getIpRegCount(kv, ip, day);
  await kv.put(`ip_reg_count:${ip}:${day}`, String(count + 1), { expirationTtl: 86400 }); // 24 hours
}

export async function getPending(kv: KVNamespace, token: string): Promise<any | null> {
  const data = await kv.get(`pending:${token}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function savePending(kv: KVNamespace, token: string, pending: any): Promise<void> {
  // TTL 30 minutes = 1800 seconds
  const ttl = 1800;
  await kv.put(`pending:${token}`, JSON.stringify(pending), { expirationTtl: ttl });
  await kv.put(`pending_email_to_token:${pending.email}`, token, { expirationTtl: ttl });
}

export async function getPendingByEmail(kv: KVNamespace, email: string): Promise<{ token: string; pending: any } | null> {
  const token = await kv.get(`pending_email_to_token:${email}`);
  if (!token) return null;
  const pending = await getPending(kv, token);
  if (!pending) return null;
  return { token, pending };
}

export async function deletePending(kv: KVNamespace, token: string, email: string): Promise<void> {
  await kv.delete(`pending:${token}`);
  await kv.delete(`pending_email_to_token:${email}`);
}

export async function isEmailVerified(kv: KVNamespace, email: string): Promise<boolean> {
  const data = await kv.get(`verified:${email}`);
  // Returns true if data exists (timestamp or 'true' for backward compat)
  return !!data;
}

export async function markEmailVerified(kv: KVNamespace, email: string): Promise<void> {
  // Store verification timestamp, no expiration (permanent)
  await kv.put(`verified:${email}`, new Date().toISOString());
}

