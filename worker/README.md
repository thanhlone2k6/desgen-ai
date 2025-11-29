# DesGen AI Cloudflare Worker

Cloudflare Worker for authentication and API proxying for the DesGen AI Electron app.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create KV namespace:
```bash
wrangler kv:namespace create "USERS"
wrangler kv:namespace create "USERS" --preview
```

Update the namespace IDs in `wrangler.toml`.

3. Set secrets:
```bash
wrangler secret put FREE_API_KEY
wrangler secret put VIP_API_KEY
wrangler secret put JWT_SECRET
```

4. (Optional) Set VIP emails in KV:
```bash
wrangler kv:key put --binding=USERS "vip_emails" '["admin@example.com","vip@example.com"]'
```

## Development

```bash
npm run dev
```

## Deployment

```bash
npm run deploy
```

## Endpoints

### POST /auth/register
Register a new user.

Request:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "jwt_token_here",
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "role": "free"
  }
}
```

### POST /auth/login
Login with email and password.

Request:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response: Same as register.

### GET /me
Get current user info and entitlements.

Headers:
```
Authorization: Bearer <token>
```

Response:
```json
{
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "role": "free",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "entitlements": {
    "can_use_banana_pro": false,
    "can_use_video": false,
    "banana_pro_remaining": 20
  }
}
```

### POST /proxy/image
Proxy image generation requests to Google GenAI API.

Headers:
```
Authorization: Bearer <token>
```

Request: Forwarded to Google GenAI API.

Response: Response from Google GenAI API.

## KV Structure

- `user:<user_id>` - User object (JSON)
- `email_to_user:<email>` - User ID (string)
- `vip_emails` - Array of VIP email addresses (JSON, optional)

