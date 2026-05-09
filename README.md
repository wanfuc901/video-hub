# 🎬 Video Hub (Termux Optimized)

[![CI/CD](https://github.com/wanfuc901/video-hub/actions/workflows/deploy.yml/badge.svg)](https://github.com/wanfuc901/video-hub/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PHP Version](https://img.shields.io/badge/PHP-8.1+-777bb4.svg)](https://www.php.net/)

**Video Hub** là một trung tâm giải trí đa phương tiện cá nhân, gọn nhẹ, được tối ưu hóa đặc biệt để chạy trên **Android (Termux)** và các máy chủ có tài nguyên thấp. Với giao diện tối giản theo phong cách thiết kế hiện đại, Video Hub cho phép bạn quản lý, xem và chia sẻ kho video cá nhân một cách mượt mà nhất qua mạng nội bộ hoặc Internet (via Cloudflare/Ngrok).

---

## ✨ Tính năng nổi bật

-   **🎨 UI/UX Hiện đại:** Thiết kế theo phong cách Minimalist, sử dụng typography **Syne** & **DM Sans**, hỗ trợ Dark mode mặc định.
-   **📱 Tối ưu hóa Termux:** Khả năng xử lý 4-worker mượt mà trên điện thoại Android, tự động nhận diện bộ nhớ ngoài (`/storage/emulated/0/Videos`).
-   **🖼️ Smart Thumbnails:** Tự động tạo ảnh thu nhỏ (thumbnails) cực nhanh bằng logic Canvas ngầm hoặc Server-side (FFmpeg).
-   **⏯️ Player Chuyên nghiệp:** Trình phát video tùy chỉnh hỗ trợ Seek, điều chỉnh tốc độ (0.5x - 2.0x), Picture-in-Picture (PIP) và ghi nhớ tiến trình xem.
-   **📂 Quản lý thông minh:** Các tab chế độ xem: Tất cả, Yêu thích, Lịch sử và Gợi ý. Cho phép đổi tên video trực tiếp trên giao diện web.
-   **🚀 Upload siêu lớn:** Hỗ trợ tải lên các tệp tin cực lớn (lên đến **10GB**) trực tiếp qua trình duyệt.
-   **⚙️ Tự động hóa CI/CD:** Tích hợp sẵn GitHub Actions giúp tự động Deploy code lên điện thoại qua Tailscale SSH ngay khi bạn nhấn Push.

---

## 🛠️ Yêu cầu hệ thống

-   **Hệ điều hành:** Linux, Windows, macOS hoặc Android (Termux).
-   **Môi trường:** PHP 8.1 trở lên.
-   **Tùy chọn:** FFmpeg (để tạo thumbnail chuyên sâu hơn).

---

## 🚀 Hướng dẫn cài đặt nhanh trên Termux

Mở ứng dụng Termux trên Android và chạy chuỗi lệnh sau:

```bash
# Cập nhật hệ thống
pkg update && pkg upgrade -y

# Cài đặt PHP và Git
pkg install php git ffmpeg -y

# Clone dự án
git clone https://github.com/wanfuc901/video-hub.git
cd video-hub

# Cấp quyền bộ nhớ (để web thấy được video trong máy)
termux-setup-storage

# Khởi động server (Mặc định cổng 8080)
nohup php -d upload_max_filesize=10000M -d post_max_size=10000M -d memory_limit=512M -S 0.0.0.0:8080 -t . > server.log 2>&1 &
```

Bây giờ hãy mở trình duyệt và truy cập: `http://localhost:8080`

---

## 📂 Cấu trúc dự án

-   `index.php`: Giao diện thư viện video chính.
-   `player.php`: Trình phát video tùy chỉnh.
-   `api.php`: Backend xử lý danh sách, luồng video, thumbnails và quản lý tệp.
-   `config.php`: Cấu hình đường dẫn, giới hạn dung lượng và bảo mật.
-   `scanner.php`: Công cụ quét video hiệu năng cao chạy dưới nền.
-   `assets/`: Chứa các file CSS/JS và loader.
-   `.github/`: Chứa workflow CI/CD tự động hóa.

---

## 🛡️ Bảo mật

Bạn có thể cấu hình mật khẩu truy cập trong file `config.php`:
```php
define('VHHUB_PASSWORD', 'mat-khau-cua-ban');
```

---

## 🤝 Đóng góp

Mọi đóng góp nhằm cải thiện giao diện hoặc tính năng đều được hoan nghênh. Vui lòng Fork dự án và tạo Pull Request.

---

## 📄 Giấy phép

Dự án được phát hành dưới giấy phép **MIT**. Tự do sử dụng cho mục đích cá nhân và thương mại.

---
*Dự án được phát triển và duy trì bởi [Hoàng Phúc](https://github.com/wanfuc901).*
