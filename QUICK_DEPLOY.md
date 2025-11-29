# 🚀 Cách nhanh nhất để Upload v8.1.0 lên GitHub

## ⚡ Option 1: Dùng GitHub Desktop (Dễ nhất - Khuyến nghị)

1. **Download GitHub Desktop**: https://desktop.github.com/
2. **Cài đặt** và đăng nhập với tài khoản GitHub
3. **Mở GitHub Desktop**:
   - File → Add Local Repository
   - Chọn folder: `E:\Coding\DESGEN AI`
   - Click "Add"
4. **Commit**:
   - Ở tab "Changes", bạn sẽ thấy tất cả files đã thay đổi
   - Nhập commit message: `Release v8.1.0: API Key Management & Unlimited Mode`
   - Click "Commit to main"
5. **Push**:
   - Click "Publish repository" (nếu lần đầu)
   - Hoặc click "Push origin" (nếu đã có remote)
6. **Tạo Release**:
   - Vào: https://github.com/thanhlone2k6/desgen-ai/releases
   - Click "Draft a new release"
   - Chọn tag: `v8.1.0` (hoặc tạo mới)
   - Upload files từ `dist-electron/`

---

## ⚡ Option 2: Cài Git và chạy lại script

1. **Download Git**: https://git-scm.com/download/win
2. **Cài đặt** với tùy chọn "Add Git to PATH"
3. **Mở lại CMD** và chạy: `deploy.bat`

---

## ⚡ Option 3: Upload Manual qua GitHub Web

1. **Vào GitHub**: https://github.com/thanhlone2k6/desgen-ai
2. **Upload files**:
   - Click "Add file" → "Upload files"
   - Kéo thả các files đã thay đổi
   - Commit message: `Release v8.1.0: API Key Management & Unlimited Mode`
   - Click "Commit changes"
3. **Tạo Release**:
   - Vào Releases → "Draft a new release"
   - Tag: `v8.1.0`
   - Upload installer files

---

## 📦 Files cần upload cho Release

Khi tạo release trên GitHub, upload 2 files này:
- `dist-electron/DesignGen Pro Setup 8.1.0.exe`
- `dist-electron/DesignGen Pro Setup 8.1.0.exe.blockmap`

Copy release notes từ: `RELEASE_v8.1.0.md`

---

## ✅ Checklist

- [ ] Code đã được commit và push
- [ ] Tag v8.1.0 đã được tạo
- [ ] Release đã được tạo trên GitHub
- [ ] Installer files đã được upload
- [ ] Release notes đã được thêm

