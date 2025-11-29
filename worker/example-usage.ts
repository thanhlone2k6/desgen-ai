// Example usage from Electron app

const WORKER_URL = 'https://desgen-ai-worker.your-subdomain.workers.dev';

// Register a new user
async function register(email: string, password: string) {
  const response = await fetch(`${WORKER_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (response.ok) {
    // Store token in secure storage
    localStorage.setItem('auth_token', data.token);
    return data;
  }
  throw new Error(data.error);
}

// Login
async function login(email: string, password: string) {
  const response = await fetch(`${WORKER_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('auth_token', data.token);
    return data;
  }
  throw new Error(data.error);
}

// Get current user info
async function getMe() {
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('Not authenticated');
  
  const response = await fetch(`${WORKER_URL}/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  throw new Error(data.error);
}

// Proxy image generation request
async function generateImage(model: string, prompt: string, options: any = {}) {
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('Not authenticated');
  
  const response = await fetch(`${WORKER_URL}/proxy/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model,
      contents: [{
        parts: [{ text: prompt }]
      }],
      ...options
    })
  });
  
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  
  if (response.status === 403 && data.code === 'upgrade_required') {
    // Show upgrade prompt to user
    throw new Error('Upgrade required: You have used all free credits');
  }
  
  throw new Error(data.error || 'Generation failed');
}

// Usage example:
// await register('user@example.com', 'password123');
// await login('user@example.com', 'password123');
// const me = await getMe();
// console.log(me.entitlements);
// const result = await generateImage('gemini-3-pro-image-preview', 'A beautiful sunset');

