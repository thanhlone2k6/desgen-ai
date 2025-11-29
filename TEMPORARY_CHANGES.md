# Thay đổi tạm thời - Direct API Fallback Mode

## 📝 Tổng quan
Đã implement Option 1 với fallback mechanism để tránh lỗi location error từ Cloudflare Worker.

## ✅ Những thay đổi đã thực hiện

### 1. **services/geminiService.ts**
- ✅ Thêm function `callDirectAPI()` để gọi trực tiếp Google Gemini API
- ✅ Sửa `callWorkerProxy()` để có fallback tự động:
  - Ưu tiên dùng Worker proxy (nếu có token)
  - Nếu Worker fail với location error → tự động fallback về direct API
  - Nếu không có token nhưng có API key → dùng direct API
  - Nếu Worker network error → fallback về direct API

### 2. **components/ApiKeyChecker.tsx**
- ✅ Đổi từ `localStorage` sang `sessionStorage`
- ✅ API key sẽ tự động xóa khi tắt app (sessionStorage chỉ tồn tại trong session)

### 3. **App.tsx**
- ✅ Tạm thời ẩn AuthScreen (đã comment code)
- ✅ App sẽ chỉ hiển thị ApiKeyChecker để nhập API key
- ✅ Code AuthScreen vẫn còn, chỉ cần uncomment để bật lại

## 🔄 Cách bật lại AuthScreen

Để bật lại cửa sổ đăng nhập, mở `App.tsx` và tìm dòng:

```typescript
// TEMPORARILY DISABLED - AuthScreen hidden (can be re-enabled later)
// To re-enable: uncomment the code below and remove this comment block
/*
if (!isAuthed) {
  return <AuthScreen onAuthed={() => {
    // Reload user info after authentication
    fetchUserInfo();
  }} />;
}
*/
```

Xóa comment và uncomment code:

```typescript
// Check authentication
if (!isAuthed) {
  return <AuthScreen onAuthed={() => {
    // Reload user info after authentication
    fetchUserInfo();
  }} />;
}
```

## 🎯 Cách hoạt động

1. **User nhập API key** → Lưu vào `sessionStorage` (tự xóa khi tắt app)
2. **App gọi API**:
   - Nếu có token → thử Worker proxy trước
   - Nếu Worker fail (location error) → tự động fallback về direct API
   - Nếu không có token → dùng direct API với API key từ sessionStorage

## ⚠️ Lưu ý

- API key chỉ tồn tại trong session (tự xóa khi tắt app)
- Worker proxy vẫn được ưu tiên nếu có token
- Fallback chỉ xảy ra khi Worker fail hoặc không có token
- AuthScreen đã được ẩn nhưng code vẫn còn, dễ bật lại

## 🔧 Để quay lại Worker-only mode

1. Xóa function `callDirectAPI()` trong `geminiService.ts`
2. Sửa `callWorkerProxy()` để không có fallback
3. Bật lại AuthScreen (uncomment code)
4. Đổi `sessionStorage` về `localStorage` trong `ApiKeyChecker.tsx` (nếu muốn)

