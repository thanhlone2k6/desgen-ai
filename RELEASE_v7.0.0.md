# Release v7.0.0 - DesignGen AI Pro

## 🎉 Tính năng mới

### 1. Email Verification Flow
- Đăng ký tài khoản với xác nhận email qua Resend
- Flow: Register Request → Verify Email → Complete Register
- Email xác nhận đẹp với HTML template
- Rate limit: 100 lần/ngày/IP

### 2. Auto-fill Login Credentials
- Tự động lưu email/password sau khi đăng nhập thành công
- Tự động điền thông tin khi mở màn hình đăng nhập lần sau
- Không tự động đăng nhập, user phải bấm nút "Đăng nhập"
- Có nút "Xóa thông tin đã lưu" để xóa credentials

### 3. User Info Display
- Hiển thị thông tin user ở góc trái trên, ngay dưới tên app
- Avatar với initials từ tên người dùng
- Hiển thị tên, email, và badge gói (Free/VIP)
- Styling đẹp với gradient và backdrop blur

### 4. Enhanced Sign Up Form
- Thêm field "Tên" (Name) - tối thiểu 2 ký tự
- Xác nhận mật khẩu (password confirmation)
- Nút show/hide password cho cả 2 field password
- Validation đầy đủ

## 🔧 Cải tiến

- Cải thiện UX flow đăng ký
- User info hiển thị rõ ràng hơn
- Auto-fill giúp đăng nhập nhanh hơn

## 📦 Files

- `DesignGen Pro Setup 7.0.0.exe` - Windows installer
- `DesignGen Pro Setup 7.0.0.exe.blockmap` - Block map for updates

## 📝 Notes

- Worker đã được deploy với email verification
- Cần set secret `RESEND_API_KEY` trong Cloudflare Worker
- Xem `DEPLOYMENT_EMAIL_VERIFICATION.md` để biết chi tiết

