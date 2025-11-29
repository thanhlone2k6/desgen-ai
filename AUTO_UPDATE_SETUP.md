# Hướng Dẫn Setup Auto-Update cho DesignGen Pro

## 📋 Tổng Quan

App đã được tích hợp tính năng **Auto-Update** sử dụng `electron-updater`. Người dùng sẽ được thông báo khi có phiên bản mới và có thể tự động tải xuống và cài đặt.

## 🚀 Cách Hoạt Động

1. **Kiểm tra tự động**: App tự động kiểm tra update khi khởi động và mỗi 4 giờ
2. **Thông báo**: Khi có update, dialog sẽ hiện lên với thông tin phiên bản mới
3. **Tải xuống**: Người dùng bấm "Tải Xuống" để tải file update
4. **Cài đặt**: Sau khi tải xong, bấm "Cài Đặt Ngay" để cài đặt và khởi động lại app

## ⚙️ Setup GitHub Releases (Khuyến nghị)

### Bước 1: Tạo GitHub Repository

1. Tạo repository mới trên GitHub (public hoặc private)
2. Lưu tên repository và username

### Bước 2: Cập nhật package.json

✅ **Đã được cấu hình sẵn!**

Repository: `thanhlone2k6/desgen-ai`  
URL: https://github.com/thanhlone2k6/desgen-ai

Cấu hình hiện tại trong `package.json`:
```json
"publish": {
  "provider": "github",
  "owner": "thanhlone2k6",
  "repo": "desgen-ai",
  "private": false
}
```

### Bước 3: Tạo GitHub Personal Access Token

1. Vào GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Đặt tên: `electron-updater-token`
4. Chọn scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Lưu token lại** (chỉ hiện 1 lần!)

### Bước 4: Set Environment Variable

**Windows (PowerShell):**
```powershell
$env:GH_TOKEN="your_github_token_here"
```

**Windows (CMD):**
```cmd
set GH_TOKEN=your_github_token_here
```

**Hoặc tạo file `.env` trong project root:**
```
GH_TOKEN=your_github_token_here
```

### Bước 5: Build và Publish

```bash
# Build và publish lên GitHub Releases
npm run electron:build:win

# Hoặc nếu đã set GH_TOKEN:
electron-builder --publish always
```

File `.exe` sẽ được upload tự động lên GitHub Releases!

## 📦 Cách Publish Update Mới

### Khi có phiên bản mới:

1. **Cập nhật version** trong `package.json`:
   ```json
   "version": "2.0.1"  // Tăng version lên
   ```

2. **Build và publish**:
   ```bash
   npm run electron:build:win
   ```

3. **Tạo GitHub Release** (nếu chưa tự động):
   - Vào GitHub repository
   - Click "Releases" → "Create a new release"
   - Tag: `v2.0.1` (khớp với version trong package.json)
   - Title: `DesignGen Pro v2.0.1`
   - Description: Ghi chú về các thay đổi
   - Upload file `.exe` nếu cần

## 🔧 Cấu Hình Khác

### Sử dụng Custom Server

Nếu không dùng GitHub, bạn có thể host files trên server riêng:

```json
"publish": {
  "provider": "generic",
  "url": "https://your-server.com/updates"
}
```

Trên server, cần có structure:
```
/updates/
  latest.yml
  DesignGen Pro Setup 2.0.1.exe
  DesignGen Pro Setup 2.0.1.exe.blockmap
```

### Tắt Auto-Update trong Development

Auto-update chỉ chạy trong production mode. Trong development (`npm run electron:dev`), tính năng này sẽ không hoạt động.

## ✅ Kiểm Tra

1. Build app với version mới
2. Cài đặt app cũ (version cũ)
3. Mở app → Click "Kiểm Tra Cập Nhật" trong sidebar
4. App sẽ phát hiện version mới và hiển thị dialog

## 🐛 Troubleshooting

### Lỗi: "Cannot find module 'electron-updater'"
```bash
npm install electron-updater --save
```

### Lỗi: "GH_TOKEN not set"
- Đảm bảo đã set environment variable `GH_TOKEN`
- Hoặc thêm vào `.env` file

### Update không hiện
- Kiểm tra version trong `package.json` phải cao hơn version hiện tại
- Kiểm tra GitHub Releases có file `.exe` chưa
- Kiểm tra console log trong DevTools

### Update download nhưng không install
- Đảm bảo app có quyền ghi vào thư mục cài đặt
- Thử chạy app với quyền Administrator

## 📝 Notes

- **Version format**: Phải tuân theo [Semantic Versioning](https://semver.org/) (x.y.z)
- **File size**: GitHub có giới hạn 2GB cho mỗi file release
- **Private repo**: Cần token với quyền `repo` scope
- **Auto-install**: App sẽ tự động cài đặt khi đóng (nếu đã tải xong)

