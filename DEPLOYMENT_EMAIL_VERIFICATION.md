# Hướng dẫn Deploy Email Verification Flow

## Tổng quan

Flow xác nhận email đã được implement với các tính năng:
- User đăng ký với Name, Email, Password
- Server gửi email xác nhận qua Resend
- User click link verify → server mark verified
- User quay lại app → complete-register → tạo user thật + JWT

## Secrets cần cấu hình

### 1. RESEND_API_KEY

```bash
cd worker
npx wrangler secret put RESEND_API_KEY
```

Nhập API key từ Resend dashboard: https://resend.com/api-keys

**Lưu ý**: Nếu chưa có Resend account:
1. Đăng ký tại https://resend.com
2. Tạo API key mới
3. Domain mặc định: `onboarding@resend.dev` (có thể dùng ngay)
4. Để dùng custom domain, cần verify domain trong Resend dashboard

### 2. JWT_SECRET (nếu chưa có)

```bash
cd worker
npx wrangler secret put JWT_SECRET
```

Nhập một secret string ngẫu nhiên (ví dụ: generate bằng `openssl rand -base64 32`)

### 3. FREE_API_KEY và VIP_API_KEY (nếu chưa có)

```bash
cd worker
npx wrangler secret put FREE_API_KEY
npx wrangler secret put VIP_API_KEY
```

## Deploy Worker

```bash
cd worker
npm install
npx wrangler deploy
```

## Kiểm tra sau khi deploy

### 1. Test register-request endpoint

```bash
curl -X POST https://desgen-ai-worker.thanhnguyenphotowork.workers.dev/auth/register-request \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected response**:
```json
{
  "ok": true,
  "message": "Verification email sent"
}
```

### 2. Kiểm tra email inbox

- Email sẽ được gửi đến địa chỉ đã đăng ký
- Subject: "Xác nhận email DesGen AI Pro"
- Click link verify trong email

### 3. Test verify-email endpoint

Mở link verify trong email (hoặc test trực tiếp):
```
https://desgen-ai-worker.thanhnguyenphotowork.workers.dev/auth/verify-email?token=<token>
```

**Expected**: HTML page hiển thị "Xác nhận thành công!"

### 4. Test complete-register endpoint

```bash
curl -X POST https://desgen-ai-worker.thanhnguyenphotowork.workers.dev/auth/complete-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected response**:
```json
{
  "token": "<jwt_token>",
  "user": {
    "user_id": "...",
    "email": "test@example.com",
    "name": "Test User",
    "role": "free"
  }
}
```

## Rate Limits

- **register-request**: 100 lần/ngày/IP (đã implement trong code)
- **login**: 10 lần/phút/IP (có thể điều chỉnh trong `rateLimit.ts`)

## KV Schema

Các keys được sử dụng:

1. `pending:<token>` → JSON pending registration (TTL 30 phút)
2. `pending_email_to_token:<email>` → `<token>` (TTL 30 phút)
3. `verified:<email>` → timestamp (permanent, không TTL)
4. `user:<user_id>` → JSON user data
5. `email_to_user:<email>` → `<user_id>`
6. `ip_reg_count:<ip>:<date>` → count (TTL 24h)

## Troubleshooting

### Email không được gửi

1. Kiểm tra RESEND_API_KEY đã được set đúng chưa:
   ```bash
   npx wrangler secret list
   ```

2. Kiểm tra logs trong Cloudflare Dashboard:
   - Vào Workers dashboard
   - Xem logs của worker
   - Tìm lỗi từ Resend API

3. Kiểm tra Resend dashboard:
   - Vào https://resend.com/emails
   - Xem logs email đã gửi
   - Kiểm tra status (delivered/bounced/failed)

### Token verify không hoạt động

1. Kiểm tra token có trong KV:
   ```bash
   # Sử dụng wrangler CLI hoặc Cloudflare Dashboard
   ```

2. Kiểm tra TTL: token chỉ valid trong 30 phút

3. Kiểm tra email đã được verify chưa:
   - Key `verified:<email>` phải tồn tại

### Complete-register báo lỗi "Email not verified"

1. Đảm bảo user đã click link verify trong email
2. Kiểm tra key `verified:<email>` trong KV
3. Nếu cần, có thể manually set:
   ```bash
   # Sử dụng wrangler KV hoặc Cloudflare Dashboard
   ```

## Custom Domain cho Email (Optional)

Để dùng custom domain thay vì `onboarding@resend.dev`:

1. Vào Resend dashboard → Domains
2. Add domain và verify DNS records
3. Update `from` field trong `worker/src/utils/email.ts`:
   ```typescript
   from: 'DesGen AI <noreply@yourdomain.com>',
   ```

## Backward Compatibility

Endpoint `/auth/register` cũ vẫn hoạt động (backward compat) nhưng app mới sẽ dùng flow mới:
- `/auth/register-request` → gửi email
- `/auth/verify-email` → verify email
- `/auth/complete-register` → tạo user thật

