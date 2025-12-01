# Hướng dẫn Upload v7.0.0 lên GitHub

## Bước 1: Commit và Push code

```bash
# Nếu chưa có git trong PATH, mở Git Bash hoặc CMD với Git
git add .
git commit -m "Release v7.0.0: Email verification, auto-fill login, user info display"
git push origin main
```

## Bước 2: Tạo Tag

```bash
git tag -a v7.0.0 -m "Release v7.0.0"
git push origin v7.0.0
```

## Bước 3: Tạo Release trên GitHub

1. Vào https://github.com/thanhlone2k6/desgen-ai/releases
2. Click "Draft a new release"
3. Chọn tag: `v7.0.0`
4. Title: `v7.0.0 - Email Verification & Auto-fill Login`
5. Description: Copy nội dung từ `RELEASE_v7.0.0.md`
6. Upload files:
   - `dist-electron/DesignGen Pro Setup 7.0.0.exe`
   - `dist-electron/DesignGen Pro Setup 7.0.0.exe.blockmap`
7. Click "Publish release"

## Hoặc dùng GitHub CLI (nếu có)

```bash
gh release create v7.0.0 \
  "dist-electron/DesignGen Pro Setup 7.0.0.exe" \
  "dist-electron/DesignGen Pro Setup 7.0.0.exe.blockmap" \
  --title "v7.0.0 - Email Verification & Auto-fill Login" \
  --notes-file RELEASE_v7.0.0.md
```



