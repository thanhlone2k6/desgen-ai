# Release v8.1.0 - DesignGen AI Pro

## 🎉 Tính năng mới

### 1. API Key Input Field
- Thay thế "API Connected" status bằng input field để nhập API key
- Input field trong sidebar với auto-save vào sessionStorage
- Hiển thị trạng thái "API Key đã lưu" khi có API key
- Nút X để xóa nhanh trong input

### 2. Clear API Key Button
- Thêm nút "Clear API Key" bên cạnh label
- Confirmation dialog trước khi xóa
- Dễ dàng xóa API key để test validation

### 3. API Key Validation
- Validation bắt buộc API key trước khi generate
- Check ở cả frontend và backend
- Error message rõ ràng khi thiếu API key

## 🔧 Cải tiến

### 1. Removed Auto-Set Default API Key
- Xóa hoàn toàn auto-set default API key
- Xóa secret passcode
- User phải tự nhập API key thủ công
- Không còn tự động kết nối

### 2. Unlimited Banana Pro (Temporary)
- Tạm thời bỏ giới hạn Banana Pro
- Tất cả user có thể dùng unlimited
- Code vẫn còn, dễ bật lại sau

### 3. Improved API Key Management
- Auto-save khi nhập (>10 ký tự)
- Auto-remove khi xóa input
- SessionStorage (tự xóa khi tắt app)

### 4. Enhanced Error Handling
- Improved location error handling
- Better fallback to direct API calls
- Clearer error messages

## 🐛 Bug Fixes

- Fixed: App có thể chạy mà không cần API key (đã thêm validation)
- Fixed: API key còn trong sessionStorage từ lần chạy trước
- Improved: Error messages rõ ràng hơn khi thiếu API key
- Fixed: Location error handling với retry mechanism

## 📦 Files

- `DesignGen Pro Setup 8.1.0.exe` - Windows installer
- `DesignGen Pro Setup 8.1.0.exe.blockmap` - Block map for updates

## 📝 Notes

- API key bây giờ là bắt buộc
- Không còn auto-set default API key
- API key tự động xóa khi tắt app (sessionStorage)
- Banana Pro unlimited (temporary)
- Login window tạm thời bị ẩn (có thể bật lại sau)

## 🔄 Migration từ v8.0.0

- User cần nhập lại API key (không còn auto-set)
- API key sẽ tự động xóa khi tắt app
- Cần nhập lại mỗi lần mở app

## 🚀 Installation

1. Download `DesignGen Pro Setup 8.1.0.exe`
2. Run installer
3. Launch app
4. Nhập Google Gemini API key khi được yêu cầu
5. Bắt đầu sử dụng!

---

**By ThanhNg • v8.1.0**

