# 📋 Quy Trình Cập Nhật Tính Năng - DesignGen Pro

## 🎯 Tổng Quan

Tài liệu này hướng dẫn từng bước để cập nhật tính năng mới và phát hành bản cập nhật cho người dùng.

---

## ✅ BƯỚC 1: Phát Triển Tính Năng

### 1.1. Làm việc với AI Assistant (Auto/Cursor)

Khi bạn muốn thêm tính năng mới:

1. **Mô tả rõ ràng yêu cầu**:
   ```
   Ví dụ: "Tôi muốn thêm tính năng export ảnh sang PDF"
   ```

2. **AI sẽ giúp bạn**:
   - Viết code
   - Tạo components mới
   - Cập nhật logic
   - Fix bugs

3. **Test ngay trong dev mode**:
   ```bash
   npm run dev          # Chạy Vite dev server
   npm run electron:dev # Mở Electron app để test
   ```

### 1.2. Kiểm Tra Kỹ Trước Khi Build

- ✅ Test tất cả tính năng mới
- ✅ Test các tính năng cũ vẫn hoạt động
- ✅ Kiểm tra không có lỗi console
- ✅ UI/UX hoạt động đúng

---

## 📦 BƯỚC 2: Cập Nhật Version

### 2.1. Quy Tắc Version (Semantic Versioning)

- **PATCH** (3.1.0 → 3.1.1): Sửa lỗi nhỏ, không thay đổi tính năng
- **MINOR** (3.1.0 → 3.2.0): Thêm tính năng mới, tương thích ngược
- **MAJOR** (3.1.0 → 4.0.0): Thay đổi lớn, có thể không tương thích

### 2.2. Cập Nhật Files

**File 1: `package.json`**
```json
"version": "3.2.0"  // Tăng version lên
```

**File 2: `App.tsx`** (dòng ~968)
```tsx
<div className="text-[10px] text-slate-400 font-medium">By ThanhNguyen v3.2</div>
```

---

## 🏗️ BƯỚC 3: Build File EXE

### 3.1. Build Local (Không publish)

```bash
npm run electron:build:win
```

File sẽ được tạo tại: `dist-electron\DesignGen Pro Setup 3.2.0.exe`

### 3.2. Test File EXE

1. Chạy file `.exe` vừa build
2. Cài đặt và test lại tất cả tính năng
3. Đảm bảo mọi thứ hoạt động đúng

---

## 🚀 BƯỚC 4: Publish Lên GitHub Releases

### 4.1. Set GitHub Token

**PowerShell:**
```powershell
$env:GH_TOKEN="YOUR_GITHUB_TOKEN_HERE"
```

**Lưu ý**: Token chỉ cần set 1 lần trong session PowerShell hiện tại.

### 4.2. Build và Publish

```bash
# Cách 1: Build trước, publish sau
npm run electron:build:win
npx electron-builder --win --publish always

# Cách 2: Build và publish cùng lúc (nếu đã build rồi)
npx electron-builder --win --publish always
```

### 4.3. Kiểm Tra GitHub Releases

Vào: https://github.com/thanhlone2k6/desgen-ai/releases

Bạn sẽ thấy:
- ✅ Release mới với tag `v3.2.0`
- ✅ File `DesignGen-Pro-Setup-3.2.0.exe`
- ✅ File `.blockmap` (dùng cho auto-update)

---

## 👥 BƯỚC 5: Phát Hành Cho Người Dùng

### 5.1. Cách 1: Người Dùng Tải Thủ Công

1. **Chia sẻ link GitHub Releases**:
   ```
   https://github.com/thanhlone2k6/desgen-ai/releases
   ```

2. **Hoặc link trực tiếp đến file**:
   ```
   https://github.com/thanhlone2k6/desgen-ai/releases/download/v3.2.0/DesignGen-Pro-Setup-3.2.0.exe
   ```

3. **Người dùng**:
   - Tải file `.exe`
   - Chạy và cài đặt
   - Ghi đè lên bản cũ

### 5.2. Cách 2: Auto-Update (Tự Động)

**Người dùng đã cài app từ trước:**

1. **App tự động kiểm tra** khi khởi động (mỗi 4 giờ)
2. **Hoặc người dùng click** "Kiểm Tra Cập Nhật" trong sidebar
3. **Dialog hiện lên** với thông tin version mới
4. **Bấm "Tải Xuống"** → Đợi download
5. **Bấm "Cài Đặt Ngay"** → App tự động cài đặt và khởi động lại

**Không cần tải thủ công!** 🎉

---

## 📝 Checklist Trước Khi Phát Hành

- [ ] Đã test kỹ tất cả tính năng
- [ ] Đã cập nhật version trong `package.json`
- [ ] Đã cập nhật version hiển thị trong `App.tsx`
- [ ] Đã build và test file `.exe` local
- [ ] Đã publish lên GitHub Releases
- [ ] Đã kiểm tra file trên GitHub
- [ ] Đã test auto-update (nếu có người dùng cũ)

---

## 🔄 Quy Trình Nhanh (Tóm Tắt)

```
1. Phát triển tính năng → Test
2. Cập nhật version (package.json + App.tsx)
3. Build: npm run electron:build:win
4. Test file .exe
5. Set token: $env:GH_TOKEN="..."
6. Publish: npx electron-builder --win --publish always
7. Kiểm tra GitHub Releases
8. Chia sẻ link hoặc để auto-update hoạt động
```

---

## 💡 Tips

### Lần Đầu Phát Hành

- **Version 3.1.0** (hoặc bất kỳ version nào) là bản **PHÁT HÀNH CHÍNH THỨC**
- Người dùng tải file `.exe` từ GitHub Releases
- Cài đặt như bình thường

### Các Lần Update Sau

- Người dùng đã cài app → **Auto-update tự động**
- Người dùng mới → Tải từ GitHub Releases (version mới nhất)

### Version Hiện Tại

- **Version phát hành**: `3.1.0`
- **File**: `DesignGen Pro Setup 3.1.0.exe`
- **Location**: `dist-electron\DesignGen Pro Setup 3.1.0.exe`

---

## ❓ FAQ

**Q: Có thể phát hành ngay bây giờ không?**  
A: ✅ **CÓ!** File `DesignGen Pro Setup 3.1.0.exe` đã sẵn sàng. Bạn có thể:
- Chia sẻ file trực tiếp
- Upload lên Google Drive/Dropbox
- Hoặc publish lên GitHub Releases để auto-update hoạt động

**Q: Người dùng cần làm gì để nhận update?**  
A: 
- **Lần đầu**: Tải và cài đặt file `.exe`
- **Lần sau**: App tự động thông báo, chỉ cần bấm "Tải Xuống" và "Cài Đặt Ngay"

**Q: Có cần publish lên GitHub không?**  
A: 
- **Không bắt buộc** nếu chỉ muốn chia sẻ file thủ công
- **Nên publish** nếu muốn auto-update hoạt động tự động

---

## 🎉 Kết Luận

**Bạn đã sẵn sàng phát hành!**

File `DesignGen Pro Setup 3.1.0.exe` đã được build và sẵn sàng phân phối cho người dùng.

**Lần sau khi có tính năng mới**, chỉ cần làm theo quy trình trên! 🚀

