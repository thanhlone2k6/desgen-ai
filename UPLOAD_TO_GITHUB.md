# Hướng dẫn Upload v8.1.0 lên GitHub

## Bước 1: Commit và Push code

```bash
# Nếu chưa có git trong PATH, mở Git Bash hoặc CMD với Git
git add .
git commit -m "Release v8.1.0: API Key Management & Unlimited Mode

- Added API key input field (replaces API Connected status)
- Removed auto-set default API key
- Added Clear API Key button
- Added API key validation (required)
- Temporarily unlimited Banana Pro
- Improved error handling"

git push origin main
```

Hoặc chạy script PowerShell:
```powershell
.\deploy-to-github.ps1
```

## Bước 2: Tạo Tag

```bash
git tag -a v8.1.0 -m "Release v8.1.0: API Key Management & Unlimited Mode"
git push origin v8.1.0
```

## Bước 3: Tạo Release trên GitHub

1. Vào https://github.com/thanhlone2k6/desgen-ai/releases
2. Click "Draft a new release"
3. Chọn tag: `v8.1.0`
4. Title: `v8.1.0 - API Key Management & Unlimited Mode`
5. Description: Copy nội dung từ `RELEASE_v8.1.0.md`
6. Upload files:
   - `dist-electron/DesignGen Pro Setup 8.1.0.exe`
   - `dist-electron/DesignGen Pro Setup 8.1.0.exe.blockmap`
7. Click "Publish release"

## Hoặc dùng GitHub CLI (nếu có)

```bash
gh release create v8.1.0 \
  "dist-electron/DesignGen Pro Setup 8.1.0.exe" \
  "dist-electron/DesignGen Pro Setup 8.1.0.exe.blockmap" \
  --title "v8.1.0 - API Key Management & Unlimited Mode" \
  --notes-file RELEASE_v8.1.0.md
```

## Files đã build

- ✅ `dist-electron/DesignGen Pro Setup 8.1.0.exe` - Windows installer
- ✅ `dist-electron/DesignGen Pro Setup 8.1.0.exe.blockmap` - Block map for updates
- ✅ `dist-electron/latest.yml` - Auto-update configuration

## Notes

- Version đã được update trong `package.json`: 8.1.0
- Release notes: `RELEASE_v8.1.0.md`
- Build files sẵn sàng trong `dist-electron/`
