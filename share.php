<?php
$config = require 'config.php';
$path   = $_GET['path'] ?? '';
$key    = $_GET['k'] ?? '';
$salt   = $config['share_salt'] ?? 'vhhub_default_salt';

// Verify link integrity
if (empty($path) || empty($key) || $key !== hash_hmac('sha256', $path, $salt)) {
    die("Liên kết không hợp lệ hoặc đã hết hạn.");
}

if (!file_exists($path)) {
    die("Video không tồn tại.");
}

$filename = basename($path);
$extMime = [
    'mp4' => 'video/mp4', 'mov' => 'video/quicktime', 'mkv' => 'video/x-matroska', 
    'avi' => 'video/x-msvideo', 'webm' => 'video/webm', 'm4v' => 'video/mp4'
];
$fileExt  = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
$mimeType = $extMime[$fileExt] ?? 'video/mp4';

// Get custom title if exists
$titlesFile = $config['titles_file'];
$titles = [];
if (file_exists($titlesFile)) {
    $titles = json_decode(file_get_contents($titlesFile), true) ?? [];
}
$displayTitle = $titles[$filename] ?? $filename;
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($displayTitle) ?> - VHHub Share</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <link rel="stylesheet" href="assets/style.css">
    <style>
        body { background: #000; color: #fff; margin: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .share-header { padding: 15px 20px; background: #111; border-bottom: 1px solid #222; display: flex; align-items: center; gap: 10px; }
        .share-header .logo { font-size: 18px; font-weight: 700; color: var(--accent); text-decoration: none; display: flex; align-items: center; gap: 8px; }
        .main-container { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
        .video-wrapper { width: 100%; max-width: 1000px; aspect-ratio: 16/9; background: #000; border-radius: 8px; overflow: hidden; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        video { width: 100%; height: 100%; }
        .video-info { margin-top: 20px; width: 100%; max-width: 1000px; text-align: left; }
        .video-info h1 { font-size: 20px; margin: 0 0 5px 0; color: #fff; }
        .video-info p { color: #888; font-size: 14px; margin: 0; }
        @media (max-width: 600px) {
            .main-container { padding: 10px; }
            .video-info h1 { font-size: 16px; }
        }
    </style>
</head>
<body class="player-page">
    <header class="share-header">
        <div class="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 6l5 10H7l5-10z"/></svg>
            <span class="syne-font">VHHub <span style="color:#666; font-size:12px; font-weight:400;">Shared Clip</span></span>
        </div>
    </header>

    <div class="main-container">
        <div class="video-wrapper custom-player-wrapper" id="playerWrapper">
            <!-- Sử dụng trực tiếp controls mặc định cho bản share để nhẹ nhàng và ổn định -->
            <video id="videoPlayer" preload="metadata" playsinline controls>
                <source src="api.php?action=stream&path=<?= urlencode($path) ?>&k=<?= $key ?>" type="<?= htmlspecialchars($mimeType) ?>">
                Trình duyệt của bạn không hỗ trợ phát video này.
            </video>
        </div>
        
        <div class="video-info">
            <h1 class="syne-font"><?= htmlspecialchars($displayTitle) ?></h1>
            <p>Được chia sẻ từ VHHub riêng tư</p>
        </div>
    </div>

    <script>
        // Giải phóng socket khi đóng trang
        window.addEventListener('beforeunload', () => {
            const v = document.getElementById('videoPlayer');
            if (v) {
                v.pause();
                v.querySelectorAll('source').forEach(s => s.removeAttribute('src'));
                v.load();
                v.remove();
            }
        });
    </script>
</body>
</html>
