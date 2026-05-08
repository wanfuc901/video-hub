<?php
// config.php — auto-detect environment

if (!defined('VHHUB_PASSWORD')) {
    define('VHHUB_PASSWORD', 'changeme');
}

// Upload dir: luôn dùng videos/ trong project (writable)
$uploadDir = __DIR__ . '/videos';
if (!is_dir($uploadDir)) @mkdir($uploadDir, 0777, true);

// Scan dirs: quét thêm /storage nếu có
$scanDirs = [$uploadDir];
if (is_dir('/storage/emulated/0/Videos')) {
    $scanDirs[] = '/storage/emulated/0/Videos';
}

return [
    'video_dir'  => $uploadDir,          // nơi upload lưu vào
    'scan_dirs'  => $scanDirs,            // nơi list video từ
    'thumb_dir'  => __DIR__ . '/thumbnails',
    'titles_file'=> __DIR__ . '/titles.json',
    'supported_extensions' => ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v']
];