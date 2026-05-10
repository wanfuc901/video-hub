# Deploy Guide — Video Hub trên Termux

## Cách hoạt động

Push code lên `main` → GitHub Actions tự động:
1. **CI**: lint toàn bộ file PHP (bắt lỗi syntax trước khi deploy)
2. **CD**: SSH vào Termux, `git reset --hard origin/main`, xoá list cache, restart PHP server 4-worker

---

## Yêu cầu bắt buộc: GitHub Actions phải reach được Termux

GitHub Actions runner chạy trên cloud — **không thể SSH vào IP nội bộ** (`192.168.x.x`).  
Bạn cần một trong hai cách sau:

### Cách 1 — Port forwarding (đơn giản nhất)
Vào router, forward port `8022` → IP điện thoại (`100.127.9.63`).
Sau đó dùng IP public của mạng nhà làm `SSH_HOST`.
### Cách 2 — Tailscale (khuyến nghị, không cần đụng router)
1. Cài Tailscale trên điện thoại Termux:
   ```bash
   pkg install tailscale
   tailscale up
   ```
2. Cài Tailscale trên máy tính hoặc thêm GitHub Actions vào Tailscale network (dùng OAuth key).
3. Dùng Tailscale IP của điện thoại làm `SSH_HOST`.

---

## GitHub Secrets cần thiết

Vào **repo → Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Giá trị | Ví dụ |
|---|---|---|
| `SSH_HOST` | IP public hoặc Tailscale IP của điện thoại | `203.x.x.x` hoặc `100.x.x.x` |
| `SSH_PORT` | Port SSH của Termux (mặc định 8022) | `8022` |
| `SSH_USER` | Username Termux | `u0_a293` |
| `SSH_PRIVATE_KEY` | Nội dung file private key (xem hướng dẫn bên dưới) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `APP_PATH` | Đường dẫn tuyệt đối tới project trên Termux | `/data/data/com.termux/files/home/video-hub` |

---

## Tạo SSH Key pair cho GitHub Actions

Chạy trên **máy tính** (hoặc trong Termux):

```bash
# Tạo key pair không passphrase
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# Copy public key vào Termux authorized_keys
cat ~/.ssh/github_actions.pub
```

Paste nội dung `github_actions.pub` vào file `~/.ssh/authorized_keys` trên Termux:
```bash
# Chạy trong Termux
echo "ssh-ed25519 AAAA... github-actions" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Paste nội dung `github_actions` (private key) vào secret `SSH_PRIVATE_KEY`:
```bash
cat ~/.ssh/github_actions
# Copy toàn bộ output kể cả dòng BEGIN và END
```

---

## Kiểm tra sau khi setup

Push một commit nhỏ lên `main` và vào **Actions tab** trên GitHub để xem log.

Nếu CD thành công, log sẽ có:
```
✓ Code updated
✓ Cache cleared
✓ Server restarted with 4 workers
```
