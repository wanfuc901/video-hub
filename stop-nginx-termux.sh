#!/data/data/com.termux/files/usr/bin/bash
# stop-nginx-termux.sh — Dừng Nginx + PHP-FPM

nginx -s quit 2>/dev/null \
    && echo "✓ nginx đã dừng" \
    || echo "  nginx không chạy"

pkill -x php-fpm 2>/dev/null \
    && echo "✓ php-fpm đã dừng" \
    || echo "  php-fpm không chạy"
