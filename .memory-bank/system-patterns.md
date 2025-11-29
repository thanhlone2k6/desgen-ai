# System Patterns - DesGen AI

## Error Handling Pattern

### Frontend (geminiService.ts)
```typescript
// Helper to format API errors
const handleApiError = (error: any) => {
  // Check for specific error types
  if (message.includes("LOCATION") && message.includes("NOT SUPPORTED")) {
    throw new Error("Vị trí địa lý không được hỗ trợ...");
  }
  if (status === 403) {
    throw new Error("Lỗi quyền truy cập...");
  }
  // ... other error types
};

// Retry logic for transient errors
const isRetryableError = (error: any) => {
  return status === 429 || status === 503 || 
         message.includes("RESOURCE_EXHAUSTED");
};
```

### Backend (worker handlers)
```typescript
// Check for specific error types in API responses
if (!response.ok && responseData.error) {
  const errorMessage = responseData.error.message;
  if (errorMessage.includes('location') && errorMessage.includes('not supported')) {
    return jsonResponse({ 
      error: 'Vị trí địa lý không được hỗ trợ...',
      code: 'location_not_supported'
    }, response.status);
  }
}
```

## Authentication Flow Pattern

1. **Register Request**: User submits name, email, password
   - Server validates, creates pending registration
   - Sends verification email via Resend
   - Returns success message

2. **Email Verification**: User clicks link in email
   - Server marks email as verified in KV
   - Returns HTML success page

3. **Complete Registration**: User clicks "I verified email"
   - Server checks verification status
   - Creates actual user account
   - Issues JWT token
   - Returns token + user data

4. **Login**: User submits email + password
   - Server checks email is verified
   - Verifies password
   - Issues JWT token
   - Returns token + user data

## Storage Pattern

### Storage Keys

#### LocalStorage (Persistent)
- `desgen_tasks` - Completed/failed/cancelled tasks (max 50)
- `desgen_device_id` - Unique device identifier
- `desgen_token` - JWT authentication token
- `desgen_user` - User data (user_id, email, name, role)
- `desgen_saved_email` - Saved login email
- `desgen_saved_password` - Saved login password (base64 encoded)

#### SessionStorage (Temporary - Cleared on App Close)
- `gemini_api_key` - User's Gemini API key (auto-cleared on app close, auto-removed when input cleared)

### KV Storage Pattern
- User data: `user:<user_id>`
- Email mapping: `email_to_user:<email>`
- Pending registration: `pending:<token>` (30min TTL)
- Email verification: `verified:<email>` (permanent)
- Device tracking: `device:<device_id>`
- Rate limiting: `ip_reg_count:<ip>:<date>`

## API Request Pattern

### Image Generation Request Flow (Hybrid Mode with Validation)
1. **Frontend Validation**: User clicks Generate
   - Check if API key exists in sessionStorage
   - If no API key → Alert and stop
   - If has API key → Continue
2. Frontend constructs prompt with all instructions (style, aspect ratio, resolution, etc.)
3. Frontend calls `callWorkerProxy()` with model and contents
4. **Fallback Logic**:
   - If token exists → Try Worker proxy
     - Worker verifies JWT
     - Worker checks user entitlements (currently unlimited - temporary)
     - Worker constructs Google API request (removes unsupported fields)
     - Worker forwards to Google Gemini API
     - If location error → Fallback to direct API (with API key)
   - If no token but has API key → Direct API call
   - If no token and no API key → Error (should not reach here due to validation)
5. Frontend extracts image from response

### Direct API Call Pattern
```typescript
// Direct API call (fallback)
const callDirectAPI = async (model: string, payload: any, apiKey: string) => {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(googleApiBody)
  });
  return await response.json();
};
```

### Request Structure
```typescript
// Frontend → Worker
{
  model: "gemini-3-pro-image-preview",
  contents: [{ role: "user", parts: [...] }],
  config: {
    imageConfig: {
      aspectRatio: "16:9",  // Only in frontend, not sent to Google
      imageSize: "2K"      // Only in frontend, not sent to Google
    },
    systemInstruction: "..." // Sent to Google
  }
}

// Worker → Google API
{
  contents: [{ role: "user", parts: [...] }],
  systemInstruction: { parts: [{ text: "..." }] }
  // aspectRatio and imageSize NOT included
}
```

## Retry Pattern

```typescript
const MAX_RETRIES = 3;
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    // Make API call
    return result;
  } catch (error) {
    if (isRetryableError(error) && attempt < MAX_RETRIES) {
      const delay = 2000 * Math.pow(2, attempt - 1); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    throw error; // Non-retryable or max retries reached
  }
}
```

## Rate Limiting Pattern

### Registration Rate Limit
```typescript
const day = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
const ipCount = await getIpRegCount(kv, clientIp, day);
if (ipCount >= 100) {
  return jsonResponse({ error: 'Bạn đăng ký quá nhiều lần hôm nay...' }, 429);
}
```

### Login Rate Limit
```typescript
if (!checkRateLimit(`login:${clientIp}`)) {
  return jsonResponse({ error: 'Rate limit exceeded' }, 429);
}
```

## Task Management Pattern

### Task States
- `pending` - Just created, not yet started
- `processing` - Currently generating
- `completed` - Successfully generated
- `failed` - Generation failed
- `cancelled` - User cancelled

### Task Storage
- Active tasks: In React state
- Completed tasks: Saved to LocalStorage (max 50)
- Task cleanup: Only completed/failed/cancelled tasks are persisted

### Progress Simulation
```typescript
// Simulate progress for better UX
const progressInterval = setInterval(() => {
  let increment = 0;
  if (progress < 30) increment = Math.random() * 8 + 4;
  else if (progress < 70) increment = Math.random() * 4 + 2;
  else if (progress < 90) increment = Math.random() * 1.5;
  // Update task progress
}, 1500);
```

