# DesGen AI - Project Brief

## Project Overview
DesGen AI Pro is a desktop application for AI-powered image and video generation using Google Gemini models. The application uses Electron + React + TypeScript for the frontend and Cloudflare Workers + Workers KV for the backend.

**Current Version**: 8.2.0 (UI Fixes & Improvements)

## Tech Stack

### Frontend
- **Framework**: Electron + React + TypeScript
- **State Management**: React Hooks (useState, useEffect, useMemo, useCallback)
- **Storage**: 
  - `sessionStorage`: API keys (temporary, cleared on app close)
  - `localStorage`: Tasks, tokens, user data, device IDs, login credentials
- **UI**: Tailwind CSS with dark theme
- **Build Tool**: Vite

### Backend
- **Platform**: Cloudflare Workers (TypeScript)
- **Database**: Workers KV (key-value store)
- **Authentication**: JWT tokens (7-day expiration) - *Currently disabled*
- **Email Service**: Resend API for email verification
- **Password Hashing**: PBKDF2

## Key Features

### Authentication & User Management
- **Current Mode**: API key-based (temporary, manual entry required)
- **API Key Management**:
  - Input field in sidebar (replaces "API Connected" status)
  - No auto-set default API key
  - Stored in sessionStorage (auto-clear on app close)
  - Required validation before generation
  - "Clear API Key" button for easy removal
- **Normal Mode**: Email verification flow (register-request → verify-email → complete-register)
- JWT-based authentication (currently disabled)
- User roles: `free` and `vip`
- Device-based free tier eligibility (20 free Banana Pro generations per device) - *Currently unlimited (temporary)*
- Saved login credentials (email + base64 encoded password)

### Image Generation Modes
1. **Creative Mode**: Text-to-image with reference images
2. **Copy Idea Mode**: Style transfer using concept and subject images
3. **Video Mode**: Text-to-video, image-to-video, frames-to-video
4. **Edit Mode**: Inpaint, Outpaint, Upscale, Super Zoom

### Supported Models
- `gemini-3-pro-image-preview` (Nano Banana Pro) - Supports aspectRatio and imageSize via prompt
- `gemini-2.5-flash-image` (Nano Banana Flash) - Does NOT support aspectRatio/imageSize
- `imagen-4.0-generate-001` (Imagen 4 Ultra) - Supports aspectRatio and imageSize
- `veo-3.1-fast-generate-preview` (Veo 3.1 Fast) - For video generation

### Generation Features
- Multiple artistic styles (AUTO, TSHIRT_DESIGN, IPHONE_PHOTO, IPHONE_RAW, REALISTIC, CINEMATIC, etc.)
- Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
- Resolutions: 1K, 2K, 4K (for Pro model)
- Camera angles: NONE, EYE_LEVEL, LOW_ANGLE, HIGH_ANGLE, TOP_DOWN, DUTCH_ANGLE, CLOSE_UP, WIDE_SHOT, SELFIE
- Preservation flags: keepFace, preservePose, preserveExpression, preserveStructure, keepOutfit, keepBackground
- Skin beauty enhancement (levels 1-10)

## Architecture

### API Call Strategy (Hybrid Mode)
1. **Primary**: Cloudflare Worker proxy (if JWT token available)
   - Handles user entitlements
   - Rate limiting
   - API key management
2. **Fallback**: Direct API call (if Worker fails or no token)
   - Uses API key from `sessionStorage`
   - Bypasses Worker completely
   - No user management

### API Endpoints (Cloudflare Worker)
- `POST /auth/register-request` - Request email verification
- `GET /auth/verify-email?token=...` - Verify email via link
- `POST /auth/complete-register` - Complete registration after verification
- `POST /auth/register` - Legacy registration (backward compatibility)
- `POST /auth/login` - User login (requires verified email)
- `GET /me` - Get user info and entitlements
- `POST /proxy/image` - Proxy image generation requests to Google Gemini API

### KV Schema
- `user:<user_id>` - User data
- `email_to_user:<email>` - Email to user ID mapping
- `pending:<token>` - Pending registration data (30min TTL)
- `pending_email_to_token:<email>` - Email to pending token mapping (30min TTL)
- `verified:<email>` - Email verification status (permanent)
- `device:<device_id>` - Device data (free tier eligibility)
- `vip_emails` - List of VIP email addresses
- `ip_reg_count:<ip>:<date>` - Rate limiting for registrations

### Frontend Services
- `storageService.ts` - LocalStorage/SessionStorage management
- `geminiService.ts` - API calls with fallback logic (Worker → Direct API)

## Important Configurations

### Rate Limiting
- Registration requests: 100 per day per IP
- Login: 5 per minute per IP
- Proxy requests: Rate limited per IP

### Security
- Blocked temp mail domains (10minutemail.com, tempmailo.com, etc.)
- Password hashing with PBKDF2
- JWT tokens with 7-day expiration
- Device ID tracking for free tier
- **API keys**: Stored in sessionStorage (not persistent)

### Email Verification
- Verification token expires in 30 minutes
- Verification status stored permanently in KV
- Email sent via Resend API

## Recent Fixes & Changes

### v8.2.0 (Current - Latest Updates)
- ✅ **Update Dialog Scrollbar**: Fixed changelog scrollbar in update dialog (max-height + overflow-y-auto + custom styling)
- ✅ **Image Preview Modal Fix**: Fixed z-index issue (z-[10000]) to ensure modal displays above all elements including UpdateDialog
- ✅ **GitHub Release Deployment**: Fixed latest.yml file naming to match GitHub upload format (DesignGen.Pro.Setup.8.2.0.exe)
- ✅ **Release Documentation**: Created RELEASE_v8.2.0.md with comprehensive changelog
- ✅ **Build Process**: Successfully built and prepared v8.2.0 for GitHub release

### v8.1.0 (Previous)
- ✅ **API Key Input Field**: Replaced "API Connected" status with API key input in sidebar
- ✅ **No Auto-Set API Key**: Removed default API key auto-set, user must manually enter
- ✅ **Unlimited Banana Pro**: Temporarily disabled Banana Pro limits (all users unlimited)
- ✅ **API Key Validation**: Required validation before generation (frontend + backend)
- ✅ **Clear API Key Button**: Added button to easily clear API key from sessionStorage
- ✅ **Direct API Fallback**: Automatic fallback when Worker fails
- ✅ **SessionStorage for API keys**: Auto-clear on app close, auto-remove when input cleared
- ✅ **AuthScreen disabled**: Temporarily using API key mode
- ✅ **Improved Worker retry**: 8 retries with exponential backoff + jitter
- ✅ Fixed `aspectRatio` and `imageSize` errors for Gemini 3 Pro
- ✅ Removed unsupported fields from API request body
- ✅ Added aspect ratio and resolution instructions to prompts (for Pro model)
- ✅ Improved error handling for location/geographic restrictions
- ✅ Added user info display (name, email, avatar, role badge) in top-left sidebar
- ✅ Auto-fill login credentials on subsequent visits
- ✅ Added "Clear saved info" button

### Known Issues
- `aspectRatio` and `imageSize` are NOT supported as API fields - handled via prompt instructions only
- Location restrictions may occur if Cloudflare Worker runs from unsupported regions (now has fallback)
- Banana Flash model does not support aspectRatio/imageSize at all
- AuthScreen currently disabled (temporary)
- API key must be re-entered each session (by design, stored in sessionStorage)

## Deployment

### Worker Deployment
```bash
cd worker
npx wrangler deploy
```

### Worker URL
https://desgen-ai-worker.thanhnguyenphotowork.workers.dev

### Required Secrets (Cloudflare Workers)
- `FREE_API_KEY` - Google Gemini API key for free users
- `VIP_API_KEY` - Google Gemini API key for VIP users
- `JWT_SECRET` - Secret for JWT token signing
- `RESEND_API_KEY` - Resend API key for email verification

## File Structure
```
DESGEN AI/
├── worker/              # Cloudflare Worker backend
│   └── src/
│       ├── handlers/    # API route handlers
│       ├── utils/       # Utilities (KV, JWT, crypto, email, rateLimit)
│       └── types.ts     # TypeScript types
├── components/          # React components
│   ├── ApiKeyChecker.tsx
│   ├── AuthScreen.tsx (temporarily disabled)
│   └── ...
├── services/            # Frontend services
│   ├── storageService.ts
│   └── geminiService.ts (with fallback logic)
├── App.tsx              # Main application component
└── types.ts             # Frontend TypeScript types
```

## Notes
- Image generation uses prompt instructions for aspect ratio and resolution (not API fields)
- Free users get 20 Banana Pro generations per device (first email registered on device)
- VIP users have unlimited access to all models
- Tasks are stored in LocalStorage (max 50 completed tasks)
- User authentication persists across app restarts via LocalStorage (when enabled)
- **API keys are stored in sessionStorage and cleared on app close**

## Version History

### v6.2.2 (Previous)
- Direct API calls only (no Worker)
- API keys in localStorage
- No location errors

### v8.0.0
- Hybrid mode: Worker proxy + Direct API fallback
- API keys in sessionStorage
- Automatic fallback on location errors

### v8.1.0
- All v8.0.0 features
- Enhanced update dialog with scrollable changelog
- Fixed image preview modal z-index
- GitHub release deployment fixes

### v8.2.0 (Current)
- All v8.1.0 features
- Improved update dialog scrollbar styling
- Enhanced image preview modal visibility
- GitHub release deployment improvements
