# Video Hub

Your minimalist local video streaming center. UI redesigned following D2K Shop Design System.

## Features
- Minimalist, clean UI with Syne & DM Sans typography.
- Tab views: All, Favorites, History, Suggestions.
- Edit video titles seamlessly.
- Custom video player with seeking, speed control, and PIP.
- Automatically generates missing thumbnails via hidden canvas logic.
- Upload large files up to 10GB directly from the browser.
- Saves watch progress.

## Structure
- `config.php`: Configuration (paths, limits).
- `api.php`: Handles listing, streaming, uploading, thumbnails, and title modifications.
- `index.php`: Main gallery interface.
- `player.php`: Custom video streaming player.
- `titles.json`: Auto-created file for overriding video display titles.
- `thumbnails/`: Auto-created directory for storing generated thumbnails.

## Deployment on Termux
Clone and start the PHP server with specific upload flags:
```bash
git clone https://github.com/wanfuc901/video-hub.git
cd video-hub
nohup php -d upload_max_filesize=10000M -d post_max_size=10000M -S 0.0.0.0:8080 > server.log 2>&1 &
```
