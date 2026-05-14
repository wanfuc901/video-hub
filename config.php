<?php
// config.php

$pwdEnv = getenv('VHHUB_PASSWORD');
if (!defined('VHHUB_PASSWORD')) {
    define('VHHUB_PASSWORD', $pwdEnv !== false ? $pwdEnv : 'changeme');
}

define('APP_VER', @filemtime(__DIR__ . '/assets/app.js') ?: '1');

$uploadDir = __DIR__ . '/videos';
if (!is_dir($uploadDir)) @mkdir($uploadDir, 0777, true);

$scanDirs = [$uploadDir];
if (is_dir('/storage/emulated/0/Videos')) {
    $scanDirs[] = '/storage/emulated/0/Videos';
}

return [
    'video_dir'  => $uploadDir,
    'scan_dirs'  => $scanDirs,
    'thumb_dir'  => __DIR__ . '/thumbnails',
    'titles_file'=> __DIR__ . '/titles.json',
    'share_salt' => 'vhhub_' . substr(md5(__DIR__), 0, 16),
    'supported_extensions' => ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v']
];
