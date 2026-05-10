#!/data/data/com.termux/files/usr/bin/bash
# setup-nginx-termux.sh — Cài và cấu hình Nginx + PHP-FPM cho Video Hub
# Chạy từ thư mục project: bash setup-nginx-termux.sh

set -e

TERMUX_USR="/data/data/com.termux/files/usr"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PHP_FPM_SOCK="$TERMUX_USR/var/run/php-fpm.sock"
NGINX_CONF="$TERMUX_USR/etc/nginx/nginx.conf"
PHP_FPM_CONF="$TERMUX_USR/etc/php-fpm.d/www.conf"

echo "=== Video Hub — Nginx Setup ==="
echo "Project: $SCRIPT_DIR"
echo ""

# ── 1. Cài packages ─────────────────────────────────────────────────────────
echo "📦 Cài nginx và php-fpm..."
pkg install -y nginx php-fpm 2>/dev/null || {
    echo "❌ pkg install thất bại. Thử: pkg update && pkg install nginx php-fpm"
    exit 1
}

# ── 2. Tạo thư mục cần thiết ────────────────────────────────────────────────
mkdir -p "$TERMUX_USR/var/run"
mkdir -p "$TERMUX_USR/var/log/nginx"
mkdir -p "$SCRIPT_DIR/videos"
mkdir -p "$SCRIPT_DIR/thumbnails"

# ── 3. Sinh nginx.conf từ template ──────────────────────────────────────────
echo "⚙️  Cấu hình nginx..."
sed \
  -e "s|\[PROJECT_DIR\]|$SCRIPT_DIR|g" \
  -e "s|\[PHP_FPM_SOCK\]|$PHP_FPM_SOCK|g" \
  "$SCRIPT_DIR/nginx.conf.example" > "$NGINX_CONF"
echo "   → $NGINX_CONF"

# ── 4. Cấu hình PHP-FPM ─────────────────────────────────────────────────────
echo "⚙️  Cấu hình php-fpm..."
if [ -f "$PHP_FPM_CONF" ]; then
    cp "$PHP_FPM_CONF" "$PHP_FPM_CONF.bak"

    # Đổi listen sang Unix socket (nhanh hơn TCP)
    sed -i "s|^listen = .*|listen = $PHP_FPM_SOCK|" "$PHP_FPM_CONF"

    # Số worker phù hợp với Termux (không cần quá nhiều)
    sed -i "s|^pm.max_children.*|pm.max_children = 4|" "$PHP_FPM_CONF"
    sed -i "s|^pm.start_servers.*|pm.start_servers = 2|" "$PHP_FPM_CONF"
    sed -i "s|^pm.min_spare_servers.*|pm.min_spare_servers = 1|" "$PHP_FPM_CONF"
    sed -i "s|^pm.max_spare_servers.*|pm.max_spare_servers = 3|" "$PHP_FPM_CONF"

    # PHP ini cho upload lớn (thêm nếu chưa có)
    grep -q "upload_max_filesize" "$PHP_FPM_CONF" || \
        printf "\nphp_admin_value[upload_max_filesize] = 10000M\n" >> "$PHP_FPM_CONF"
    grep -q "post_max_size" "$PHP_FPM_CONF" || \
        printf "php_admin_value[post_max_size] = 10000M\n" >> "$PHP_FPM_CONF"
    grep -q "memory_limit" "$PHP_FPM_CONF" || \
        printf "php_admin_value[memory_limit] = 512M\n" >> "$PHP_FPM_CONF"
    grep -q "max_execution_time" "$PHP_FPM_CONF" || \
        printf "php_admin_value[max_execution_time] = 0\n" >> "$PHP_FPM_CONF"

    echo "   → $PHP_FPM_CONF (backup: $PHP_FPM_CONF.bak)"
else
    echo "   ⚠️  Không tìm thấy $PHP_FPM_CONF — bỏ qua bước này"
fi

# ── 5. Kiểm tra nginx config ────────────────────────────────────────────────
echo "🔍 Kiểm tra nginx config..."
nginx -t 2>&1 && echo "   → Config hợp lệ" || {
    echo "❌ Nginx config lỗi — kiểm tra lại $NGINX_CONF"
    exit 1
}

# ── 6. Khởi động services ───────────────────────────────────────────────────
echo "🚀 Khởi động php-fpm..."
pkill -x php-fpm 2>/dev/null; sleep 1
php-fpm || { echo "❌ php-fpm không khởi động được"; exit 1; }

echo "🚀 Khởi động nginx..."
nginx -s quit 2>/dev/null; sleep 1
nginx || { echo "❌ nginx không khởi động được"; exit 1; }

# ── 7. Kiểm tra kết quả ─────────────────────────────────────────────────────
sleep 1
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ | grep -q "200\|302\|301"; then
    IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
    echo ""
    echo "✅ Video Hub đang chạy!"
    echo "   Local:   http://localhost:8080"
    [ -n "$IP" ] && echo "   LAN:     http://$IP:8080"
    echo ""
    echo "   Dừng server: bash stop-nginx-termux.sh"
    echo "   Khởi động lại: bash setup-nginx-termux.sh"
else
    echo "⚠️  Server có thể chưa sẵn sàng — thử mở http://localhost:8080 thủ công"
fi
