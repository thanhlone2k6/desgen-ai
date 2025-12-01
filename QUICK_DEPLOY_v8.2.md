# Quick Deploy v8.2.0 - Tóm tắt nhanh

## 1. Cập nhật Version
```bash
# Sửa package.json: "version": "8.2.0"
```

## 2. Build
```bash
npm run build
npm run electron:build:win
```

## 3. Git Push
```bash
git add .
git commit -m "Release v8.2.0"
git push origin master
git tag -a v8.2.0 -m "Release v8.2.0"
git push origin v8.2.0
```

## 4. GitHub Release
1. Vào: https://github.com/thanhlone2k6/desgen-ai/releases/new
2. Chọn tag: `v8.2.0`
3. Title: `v8.2.0 - [Mô tả]`
4. Upload 3 file từ `dist-electron`:
   - `DesignGen Pro Setup 8.2.0.exe`
   - `DesignGen Pro Setup 8.2.0.exe.blockmap`
   - `latest.yml`
5. **QUAN TRỌNG**: Kiểm tra tên file trên GitHub và sửa `latest.yml` cho khớp
6. Click "Publish release"

## ⚠️ Lưu ý
- Tên file trong `latest.yml` PHẢI khớp với tên file trên GitHub
- GitHub có thể đổi dấu cách thành dấu chấm khi upload
- Sau khi upload, kiểm tra và sửa `latest.yml` nếu cần

