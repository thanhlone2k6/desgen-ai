# Hướng dẫn Build DesignGen Pro thành file .exe

## Bước 1: Cài đặt Dependencies

```bash
npm install
```

## Bước 2: Build Web App

```bash
npm run build
```

## Bước 3: Build Electron App (tạo file .exe)

### Windows:
```bash
npm run electron:build:win
```

Hoặc build tất cả platforms:
```bash
npm run dist
```

## Kết quả

File installer sẽ được tạo trong thư mục `release/`:
- `DesignGen Pro Setup 2.0.0.exe` - Installer cho Windows

## Lưu ý

- File .exe sẽ có kích thước khoảng 100-200MB (bao gồm Electron runtime)
- Người dùng cần cài đặt .exe để sử dụng
- API key sẽ được lưu trong localStorage của app (không chia sẻ giữa các máy)

## Development

Chạy app trong chế độ development:
```bash
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Electron
npm run electron:dev
```

