<?php
$path = $_GET['path'] ?? '';
$name = basename($path);
if (empty($path)) {
    die("No video specified.");
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playing: <?= htmlspecialchars($name) ?></title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body class="player-page">
    <header>
        <a href="index.php" class="back-btn">&larr; Back to Hub</a>
        <h2><?= htmlspecialchars($name) ?></h2>
    </header>
    <main>
        <div class="video-container">
            <video id="videoPlayer" controls>
                <source src="api.php?action=stream&path=<?= urlencode($path) ?>" type="video/mp4">
                Your browser does not support HTML video.
            </video>
        </div>
    </main>
    <script>
        const videoPlayer = document.getElementById('videoPlayer');
        const videoPath = <?= json_encode($path) ?>;
        const progressKey = 'video_progress_' + videoPath;

        // Load saved progress
        const savedProgress = localStorage.getItem(progressKey);
        if (savedProgress) {
            videoPlayer.currentTime = parseFloat(savedProgress);
        }

        // Save progress periodically
        videoPlayer.addEventListener('timeupdate', () => {
            if (videoPlayer.currentTime > 0 && !videoPlayer.ended) {
                localStorage.setItem(progressKey, videoPlayer.currentTime);
            }
        });

        // Clear progress when ended
        videoPlayer.addEventListener('ended', () => {
            localStorage.removeItem(progressKey);
        });
    </script>
</body>
</html>
