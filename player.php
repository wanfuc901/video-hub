<?php
require __DIR__ . '/auth.php';
$path = $_GET['path'] ?? '';
$filename = basename($path);
if (empty($path)) die("No video specified.");

$extMime = [
    'mp4' => 'video/mp4',   'mov' => 'video/quicktime',
    'mkv' => 'video/x-matroska', 'avi' => 'video/x-msvideo',
    'webm' => 'video/webm', 'm4v' => 'video/mp4',
];
$fileExt  = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
$mimeType = $extMime[$fileExt] ?? 'video/mp4';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playing: <?= htmlspecialchars($filename) ?> - VHHub</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <link rel="stylesheet" href="assets/style.css?v=<?= time() ?>">
</head>
<body class="player-page">
    <script src="assets/loader.js?v=<?= time() ?>"></script>
    <div id="toastContainer"></div>
    <header>
        <a href="index.php" class="logo" style="padding-left:24px;">
            <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 6l5 10H7l5-10z"/></svg>
            <span class="syne-font">VH<span style="color:white">Hub</span></span>
        </a>
    </header>

    <div class="player-layout">
        <div class="main-player-area">
            <div class="custom-player-wrapper" id="playerWrapper">
                <video id="videoPlayer"
                    src="api.php?action=stream&path=<?= urlencode($path) ?>"
                    type="<?= htmlspecialchars($mimeType) ?>"
                    preload="metadata"
                    playsinline></video>
                <div class="player-controls" id="playerControls">
                    <div class="seek-bar-container" id="seekBarContainer">
                        <div class="seek-bar-fill" id="seekBarFill"></div>
                    </div>
                    <div class="controls-row">
                        <div class="controls-left">
                            <button class="control-btn" id="playPauseBtn">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </button>
                            <button class="control-btn" id="muteBtn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                            </button>
                            <input type="range" id="volumeSlider" min="0" max="1" step="0.05" value="1" style="width: 80px;">
                            <span class="time-display"><span id="currentTimeDisplay">00:00</span> / <span id="durationDisplay">00:00</span></span>
                        </div>
                        <div class="controls-right">
                            <button class="control-btn" id="speedBtn" style="font-family:'DM Mono'; font-size:14px;">1x</button>
                            <button class="control-btn" id="pipBtn" title="Picture in Picture">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="12" y="14" width="7" height="5" rx="1" ry="1"/></svg>
                            </button>
                            <button class="control-btn" id="fullscreenBtn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="player-info-bar">
                <div>
                    <div style="font-family:'DM Mono'; color:var(--text-gray); font-size:12px; margin-bottom:8px;">Video Hub > <span id="breadcrumbTitle"><?= htmlspecialchars($filename) ?></span></div>
                    <h1 class="syne-font" id="mainTitleDisplay">
                        <span id="titleText"><?= htmlspecialchars($filename) ?></span>
                        <button class="edit-title-btn" id="editTitleBtn" title="Edit Title" style="display:inline-flex; align-items:center; gap:6px; font-size:14px; font-family:'DM Sans'; padding:4px 8px; border:1px solid #333; border-radius:4px; margin-left:12px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Sửa Tên
                        </button>
                    </h1>
                </div>
                <button class="btn btn-outline fav-toggle-btn" id="playerFavBtn" style="border-color:#333; color:white;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    Yêu thích
                </button>
            </div>
        </div>
        <div class="sidebar">
            <h3>Đề xuất cho bạn</h3>
            <div id="sidebarSuggests"></div>
        </div>
    </div>

    <script>
        const CURRENT_FILE = <?= json_encode($filename) ?>;
        const CURRENT_PATH = <?= json_encode($path) ?>;
        const CURRENT_EXT  = <?= json_encode($fileExt) ?>;
        const CURRENT_MIME = <?= json_encode($mimeType) ?>;

        // CẮT ĐUÔI: Giải phóng Socket ngay lập tức khi rời trang để không nghẽn mạng
        window.addEventListener('beforeunload', () => {
            const v = document.getElementById('videoPlayer');
            if (v) {
                v.pause();
                v.src = "";
                v.load();
                v.remove();
            }
        });
    </script>
    <script src="assets/app.js?v=<?= time() ?>"></script>
</body>
</html>
