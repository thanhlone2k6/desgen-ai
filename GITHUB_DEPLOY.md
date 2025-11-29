# 🚀 Hướng dẫn Deploy v8.1.0 lên GitHub

## ⚠️ Lưu ý
Git chưa được cài đặt hoặc chưa có trong PATH. Bạn cần:

### Option 1: Cài Git for Windows
1. Download: https://git-scm.com/download/win
2. Cài đặt với tùy chọn "Add to PATH"
3. Mở lại terminal và chạy script

### Option 2: Dùng GitHub Desktop
1. Download: https://desktop.github.com/
2. Mở GitHub Desktop
3. File → Add Local Repository → Chọn folder này
4. Commit và Push từ GUI

### Option 3: Dùng Git Bash (nếu đã cài)
1. Mở Git Bash
2. cd đến folder này
3. Chạy các lệnh bên dưới

---

## 📋 Các bước thực hiện

### Bước 1: Khởi tạo Git Repository (nếu chưa có)

```bash
git init
git remote add origin https://github.com/thanhlone2k6/desgen-ai.git
```

### Bước 2: Add và Commit

```bash
git add .
git commit -m "Release v8.1.0: API Key Management & Unlimited Mode

- Added API key input field (replaces API Connected status)
- Removed auto-set default API key
- Added Clear API Key button
- Added API key validation (required)
- Temporarily unlimited Banana Pro
- Improved error handling"
```

### Bước 3: Push lên GitHub

```bash
# Nếu lần đầu push
git push -u origin main

# Hoặc nếu branch là master
git push -u origin master

# Nếu đã có remote
git push origin main
```

### Bước 4: Tạo Tag

```bash
git tag -a v8.1.0 -m "Release v8.1.0: API Key Management & Unlimited Mode"
git push origin v8.1.0
```

### Bước 5: Tạo Release trên GitHub

1. Vào: https://github.com/thanhlone2k6/desgen-ai/releases
2. Click **"Draft a new release"**
3. Chọn tag: `v8.1.0`
4. Title: `v8.1.0 - API Key Management & Unlimited Mode`
5. Description: Copy toàn bộ nội dung từ file `RELEASE_v8.1.0.md`
6. Upload files:
   - `dist-electron/DesignGen Pro Setup 8.1.0.exe`
   - `dist-electron/DesignGen Pro Setup 8.1.0.exe.blockmap`
7. Click **"Publish release"**

---

## 📦 Files đã sẵn sàng

✅ `dist-electron/DesignGen Pro Setup 8.1.0.exe` - Windows installer  
✅ `dist-electron/DesignGen Pro Setup 8.1.0.exe.blockmap` - Block map  
✅ `RELEASE_v8.1.0.md` - Release notes  
✅ Version đã update: 8.1.0

---

## 🔧 Nếu gặp lỗi

### Lỗi: "remote origin already exists"
```bash
git remote set-url origin https://github.com/thanhlone2k6/desgen-ai.git
```

### Lỗi: "branch main does not exist"
```bash
git branch -M main
git push -u origin main
```

### Lỗi: Authentication required
- Cần setup GitHub Personal Access Token
- Hoặc dùng GitHub Desktop để login tự động

---

## ✅ Checklist

- [ ] Git đã được cài đặt
- [ ] Đã khởi tạo git repository
- [ ] Đã add và commit code
- [ ] Đã push lên GitHub
- [ ] Đã tạo tag v8.1.0
- [ ] Đã tạo release trên GitHub
- [ ] Đã upload installer files

