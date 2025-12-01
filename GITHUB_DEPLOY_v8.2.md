# Hướng dẫn Upload v8.2.0 lên GitHub

## Bước 1: Cập nhật Version

### 1.1. Cập nhật package.json
Mở file `package.json` và thay đổi version:
```json
{
  "version": "8.2.0"
}
```

### 1.2. Cập nhật version trong components (nếu có)
- `components/ApiKeyChecker.tsx`: Tìm và cập nhật version display (nếu có)

## Bước 2: Build App

### 2.1. Build Web App
```bash
npm run build
```

### 2.2. Build Electron App (tạo file .exe)
```bash
npm run electron:build:win
```

**Kết quả**: File sẽ được tạo trong `dist-electron/`:
- `DesignGen Pro Setup 8.2.0.exe`
- `DesignGen Pro Setup 8.2.0.exe.blockmap`
- `latest.yml`

## Bước 3: Kiểm tra latest.yml

### 3.1. Mở file `dist-electron/latest.yml`
Kiểm tra tên file có đúng format không:
```yaml
version: 8.2.0
files:
  - url: DesignGen.Pro.Setup.8.2.0.exe  # ⚠️ QUAN TRỌNG: Phải khớp với tên file trên GitHub
    sha512: <hash>
    size: <bytes>
path: DesignGen.Pro.Setup.8.2.0.exe  # ⚠️ Phải khớp với url
sha512: <hash>
releaseDate: '<timestamp>'
```

**Lưu ý**: 
- GitHub có thể tự động đổi tên file khi upload (dấu cách → dấu chấm)
- Sau khi upload lên GitHub, kiểm tra tên file thực tế và sửa `latest.yml` cho khớp
- Nếu file trên GitHub là `DesignGen Pro Setup 8.2.0.exe` (có dấu cách) → sửa thành `DesignGen Pro Setup 8.2.0.exe`
- Nếu file trên GitHub là `DesignGen.Pro.Setup.8.2.0.exe` (có dấu chấm) → giữ nguyên

## Bước 4: Commit và Push Code

### 4.1. Kiểm tra Git status
```bash
git status
```

### 4.2. Add và Commit
```bash
git add .
git commit -m "Release v8.2.0: [Mô tả thay đổi]"
```

**Ví dụ commit message:**
```bash
git commit -m "Release v8.2.0: Bug fixes and improvements" -m "- Fixed image preview modal" -m "- Improved update dialog" -m "- Enhanced error handling"
```

### 4.3. Push lên GitHub
```bash
git push origin master
```

### 4.4. Tạo và Push Tag
```bash
git tag -a v8.2.0 -m "Release v8.2.0"
git push origin v8.2.0
```

## Bước 5: Tạo Release trên GitHub

### 5.1. Truy cập GitHub Releases
Vào: https://github.com/thanhlone2k6/desgen-ai/releases

### 5.2. Tạo Release mới
1. Click **"Draft a new release"** hoặc **"New release"**
2. **Choose a tag**: Chọn `v8.2.0` (hoặc tạo mới nếu chưa có)
3. **Release title**: `v8.2.0 - [Mô tả ngắn]`
   - Ví dụ: `v8.2.0 - Bug Fixes & Improvements`

### 5.3. Description
Copy nội dung từ file `RELEASE_v8.2.0.md` (tạo file này trước) hoặc viết mô tả:

**Template:**
```markdown
# Release v8.2.0 - DesignGen AI Pro

## 🎉 Tính năng mới
- [Liệt kê tính năng mới]

## 🔧 Cải tiến
- [Liệt kê cải tiến]

## 🐛 Bug Fixes
- [Liệt kê bug fixes]

## 📦 Files
- `DesignGen Pro Setup 8.2.0.exe` - Windows installer
- `DesignGen Pro Setup 8.2.0.exe.blockmap` - Block map for updates

## 📝 Notes
- [Ghi chú quan trọng]

---
**By ThanhNg • v8.2.0**
```

### 5.4. Upload Files
**QUAN TRỌNG**: Upload 3 file sau từ thư mục `dist-electron`:
1. ✅ `DesignGen Pro Setup 8.2.0.exe` (khoảng 80-85 MB)
2. ✅ `DesignGen Pro Setup 8.2.0.exe.blockmap` (khoảng 80-90 KB)
3. ✅ `latest.yml` (khoảng 1 KB)

**Cách upload:**
- Kéo thả 3 file vào phần "Attach binaries by dropping them here or selecting them"
- Hoặc click "Add binaries" và chọn 3 file

### 5.5. Publish Release
1. Đảm bảo **"Set as a pre-release"** KHÔNG được chọn (trừ khi là bản beta)
2. Click **"Publish release"**

## Bước 6: Kiểm tra Auto-Update

### 6.1. Kiểm tra File Naming
Sau khi upload, kiểm tra tên file thực tế trên GitHub:
- Vào Release page
- Xem tên file `.exe` hiển thị trên GitHub
- So sánh với tên trong `latest.yml`

### 6.2. Sửa latest.yml nếu cần
Nếu tên file không khớp:
1. Download `latest.yml` từ GitHub Release
2. Sửa tên file trong `latest.yml` cho khớp với tên file trên GitHub
3. Upload lại `latest.yml` lên GitHub Release

### 6.3. Test Auto-Update
1. Mở app version cũ (ví dụ v8.1.0)
2. Click "Kiểm Tra Cập Nhật"
3. App sẽ tự động tải và cài đặt v8.2.0

## Troubleshooting

### Lỗi 404 khi auto-update
**Nguyên nhân**: Tên file trong `latest.yml` không khớp với tên file trên GitHub

**Giải pháp**:
1. Kiểm tra tên file trên GitHub Release
2. Sửa `latest.yml` cho khớp
3. Upload lại `latest.yml`

### File quá lớn không upload được
**Giải pháp**: 
- File `.exe` khoảng 80MB là bình thường
- GitHub cho phép file lên đến 100MB
- Nếu vượt quá, cần dùng Git LFS hoặc chia nhỏ file

### Git push bị reject
**Nguyên nhân**: Có thể do file lớn trong commit history

**Giải pháp**:
- Đảm bảo `.gitignore` đã loại bỏ `dist-electron` và `release`
- Nếu vẫn lỗi, xóa commit history và tạo lại:
  ```bash
  Remove-Item -Recurse -Force .git
  git init
  git remote add origin https://github.com/thanhlone2k6/desgen-ai.git
  git add .
  git commit -m "Release v8.2.0"
  git push -u origin master --force
  ```

## Checklist

Trước khi publish:
- [ ] Version đã cập nhật trong `package.json`
- [ ] App đã build thành công
- [ ] File `.exe`, `.blockmap`, và `latest.yml` đã có trong `dist-electron`
- [ ] Code đã commit và push lên GitHub
- [ ] Tag `v8.2.0` đã được tạo và push
- [ ] File `RELEASE_v8.2.0.md` đã được tạo (nếu cần)
- [ ] Đã sẵn sàng upload 3 file lên GitHub Release

Sau khi publish:
- [ ] Release đã được publish trên GitHub
- [ ] 3 file đã được upload thành công
- [ ] Tên file trong `latest.yml` khớp với tên file trên GitHub
- [ ] Auto-update đã được test và hoạt động

---

**Lưu ý quan trọng:**
- ⚠️ **Tên file trong latest.yml PHẢI khớp với tên file trên GitHub** (quan trọng nhất!)
- ⚠️ **Upload đủ 3 file**: .exe, .blockmap, và latest.yml
- ⚠️ **Kiểm tra auto-update** sau khi publish để đảm bảo hoạt động

