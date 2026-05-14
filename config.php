<?php
declare(strict_types=1);

$pwdEnv = getenv('VHHUB_PASSWORD');
if (!defined('VHHUB_PASSWORD')) {
    define('VHHUB_PASSWORD', $pwdEnv !== false ? $pwdEnv : 'changeme');
}

// Secret key for HMAC cookie signing — change this to a random string
$secretEnv = getenv('VHHUB_SECRET');
if (!defined('AUTH_SECRET')) {
    define('AUTH_SECRET', $secretEnv !== false ? $secretEnv : 'vhhub_' . substr(sha1(__DIR__ . filemtime(__FILE__)), 0, 32));
}

define('AUTH_COOKIE', 'vhhub_tok');
define('AUTH_TTL', 60 * 60 * 24 * 30); // 30 days
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
