# 📖 AI_GUIDE — Video Hub Project

> Đọc file này **trước tiên** trước khi làm bất cứ thứ gì với project này.  
> Repo: https://github.com/wanfuc901/video-hub.git

---

## 🗺️ Project là gì?

**Video Hub** là một web app PHP thuần — không có framework, không build step, không node_modules.  
Người dùng chạy nó trên **Termux (Android)** hoặc **VPS/server PHP** để stream và quản lý video cá nhân.

**Stack:** PHP 8+ · Vanilla JS · CSS thuần · Không có React/Vue/Laravel/Composer

---

## 🗂️ Cấu trúc file — Vai trò từng file

| File | Vai trò | Sửa được? |
|------|---------|-----------|
| `index.php` | Giao diện chính: gallery video, upload modal, dialog | ✅ Thường xuyên |
| `player.php` | Trang xem video, custom player | ✅ Khi cần |
| `api.php` | Backend API: list/upload/stream/thumbnail/title | ✅ Cẩn thận |
| `config.php` | Cấu hình đường dẫn, extensions hỗ trợ | ✅ Khi đổi môi trường |
| `assets/app.js` | Logic JS toàn bộ frontend (upload, UI, player control) | ✅ Cẩn thận |
| `assets/style.css` | CSS toàn bộ giao diện | ✅ |
| `assets/loader.js` | Script loader nhỏ | ⚠️ Ít đụng |
| `assets/favicon.svg` | Icon tab | ✅ |

### ❌ File/thư mục KHÔNG có trong repo (bị gitignore)

```
videos/          ← thư mục video thật — TỒN TẠI TRÊN SERVER, không có trong git
thumbnails/      ← ảnh thumbnail — TỒN TẠI TRÊN SERVER, không có trong git  
titles.json      ← tên custom của video — TỒN TẠI TRÊN SERVER, không có trong git
server.log       ← log Termux
*.log
```

> ⚠️ **Quan trọng:** Khi clone về máy local, các thư mục trên sẽ KHÔNG có. Đó là bình thường.  
> Trên server thật, chúng được tạo tự động khi app chạy lần đầu.

---

## 🚀 Cách deploy lên server

### Termux (Android) — Nginx + PHP-FPM (Khuyến nghị)

> Nginx serve video trực tiếp từ disk, nhanh hơn `php -S` rất nhiều cho file lớn.

```bash
git clone https://github.com/wanfuc901/video-hub.git
cd video-hub
bash setup-nginx-termux.sh      # cài nginx + php-fpm, tự động cấu hình, khởi động
```

Dừng server:
```bash
bash stop-nginx-termux.sh
```

### Termux (Android) — PHP built-in (đơn giản, chậm hơn)

> Chỉ dùng khi không thể cài nginx. Single-threaded, không phù hợp cho file lớn.

```bash
nohup php -d upload_max_filesize=10000M -d post_max_size=10000M -S 0.0.0.0:8080 > server.log 2>&1 &
```

### VPS / cPanel
- Upload tất cả file PHP/JS/CSS lên thư mục web root
- Đảm bảo PHP 8+ và extension `fileinfo`, `gd` được bật
- Thư mục `videos/` và `thumbnails/` cần quyền **writable (755/777)**

### Khi có code mới
```bash
# Trên server (nếu dùng git)
git pull origin main

# Hoặc upload thủ công file đã thay đổi qua FTP/cPanel
```

---

## ⚙️ config.php — Đường dẫn quan trọng

```php
$uploadDir = __DIR__ . '/videos';        // video upload vào đây
$scanDirs  = [$uploadDir];               // quét video từ đây
                                         // + /storage/emulated/0/Videos nếu là Termux Android

'thumb_dir'   => __DIR__ . '/thumbnails'
'titles_file' => __DIR__ . '/titles.json'
'supported_extensions' => ['mp4','mkv','avi','mov','webm','m4v']
```

> Nếu đổi môi trường (ví dụ: VPS có thư mục riêng), chỉ cần sửa `config.php` — không đụng file khác.

---

## 🔗 Quan hệ giữa index.php ↔ app.js

`app.js` dùng `document.getElementById()` để lấy các element HTML từ `index.php`.  
**Nếu thêm tính năng mới vào `app.js` mà cần element HTML mới → phải thêm element đó vào `index.php` luôn.**

### Danh sách element quan trọng (app.js phụ thuộc vào index.php)

| Element ID | Loại | Dùng để |
|------------|------|---------|
| `uploadModal` | div | Modal upload |
| `uploadStartBtn` | button | Bắt đầu upload |
| `uploadClearBtn` | button | Xóa danh sách upload |
| `uploadStopBtn` | button | Dừng tất cả upload đang chạy |
| `uploadMinimizeBtn` | button | Thu nhỏ modal upload |
| `uploadQueue` | div | Hiển thị danh sách file chờ upload |
| `uploadSummary` | div | Tóm tắt kết quả upload |
| `conflictDialog` | div | Dialog xử lý file trùng tên |
| `videoGrid` | div | Grid hiển thị video |
| `searchInput` | input | Ô tìm kiếm |
| `tabBtns` | các button | Tab All/Favorites/History/Suggestions |

> ⚠️ Nếu `getElementById(...)` trả về `null` → lỗi `Cannot read properties of null` ngay lập tức.

---

## 🐛 Lỗi phổ biến & cách fix

### Lỗi 1: `Cannot read properties of null (reading 'addEventListener')`
**Nguyên nhân:** `app.js` gọi `.addEventListener()` trên một element không tồn tại trong `index.php`  
**Cách fix:** Tìm element ID bị thiếu trong `app.js`, sau đó thêm element đó vào `index.php`  
**KHÔNG** thêm null-check vào `app.js` như giải pháp tạm — hãy sửa đúng gốc rễ ở `index.php`

### Lỗi 2: Dòng rác `="assets/app.js?v=...">` ở cuối index.php
**Nguyên nhân:** Script tag bị duplicate khi AI sửa file — thẻ `<script>` bị viết dở  
**Cách fix:** Xóa dòng thừa, giữ lại đúng 1 dòng:
```html
<script src="assets/app.js?v=<?= time() ?>"></script>
</body>
</html>
```

### Lỗi 3: Video không load / thumbnail không hiện
**Nguyên nhân:** Thư mục `videos/` hoặc `thumbnails/` không có quyền write  
**Cách fix:** `chmod 755 videos/ thumbnails/` trên server

---

## 📋 Quy trình làm việc với AI

### Trước khi sửa bất cứ thứ gì:
1. **Clone repo mới nhất** để xem code thực tế
2. **Đọc lỗi cụ thể** — lỗi dòng mấy, file nào
3. **Kiểm tra cặp đôi** index.php ↔ app.js nếu lỗi liên quan đến DOM

### Khi sửa xong:
1. Verify lại bằng `grep` — đảm bảo element đã có trong index.php
2. Verify cuối file index.php không có dòng rác thừa
3. Chỉ sửa **đúng file cần thiết** — thường chỉ 1 file
4. **Không sửa cả 2 file** (index.php + app.js) cùng lúc trừ khi thật sự cần

### File nào deploy lên server:
- Chỉ upload **file đã thay đổi** — không cần upload lại toàn bộ
- `videos/`, `thumbnails/`, `titles.json` **không bao giờ** upload từ local lên server (dữ liệu thật của user)

---

## 💡 Tóm tắt nhanh cho AI mới vào việc

```
1. Đây là PHP thuần — không build, không compile, không npm
2. index.php = HTML shell  |  app.js = JS logic  (2 cái phải khớp nhau)
3. videos/ và thumbnails/ chỉ tồn tại trên server, không có trong git
4. Lỗi addEventListener null → thiếu element trong index.php → sửa index.php
5. Sau khi sửa: kiểm tra cuối index.php không có dòng script thừa
6. Deploy = upload file PHP/JS/CSS lên server, không đụng videos/thumbnails
```

---

## 🎞️ Tối ưu hóa Video đầu vào (Rất quan trọng cho Mobile)

Để video dung lượng lớn (10GB+) có thể phát ngay lập tức và tua (seek) mượt mà trên trình duyệt di động, bạn **NÊN** xử lý video qua FFmpeg với flag `+faststart`. Flag này sẽ đẩy metadata (moov atom) lên đầu file.

**Lệnh thực thi:**
```bash
ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4
```

