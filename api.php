<?php
// api.php
header('Content-Type: application/json');

$config = require 'config.php';
$videoDir = $config['video_dir'];
$supportedExts = $config['supported_extensions'];

$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    if (!is_dir($videoDir)) {
        echo json_encode(['error' => 'Video directory not found or not accessible.']);
        exit;
    }

    $videos = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($videoDir));
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $ext = strtolower($file->getExtension());
            if (in_array($ext, $supportedExts)) {
                $videos[] = [
                    'name' => $file->getFilename(),
                    'path' => $file->getPathname(),
                    'size' => $file->getSize(),
                    'ext' => $ext
                ];
            }
        }
    }

    // Sort by name
    usort($videos, function($a, $b) {
        return strcasecmp($a['name'], $b['name']);
    });

    echo json_encode($videos);
    exit;
}

if ($action === 'stream') {
    $path = $_GET['path'] ?? '';
    if (empty($path) || !file_exists($path)) {
        http_response_code(404);
        exit;
    }

    $size = filesize($path);
    $time = date('r', filemtime($path));
    
    $fm = @fopen($path, 'rb');
    if (!$fm) {
        http_response_code(500);
        exit;
    }

    $begin = 0;
    $end = $size - 1;

    if (isset($_SERVER['HTTP_RANGE'])) {
        if (preg_match('/bytes=\h*(\d+)-(\d*)[\D.*]?/i', $_SERVER['HTTP_RANGE'], $matches)) {
            $begin = intval($matches[1]);
            if (!empty($matches[2])) {
                $end = intval($matches[2]);
            }
        }
    }

    if (isset($_SERVER['HTTP_RANGE'])) {
        header('HTTP/1.1 206 Partial Content');
    } else {
        header('HTTP/1.1 200 OK');
    }

    header("Content-Type: video/mp4"); 
    header('Cache-Control: public, must-revalidate, max-age=0');
    header('Pragma: no-cache');  
    header('Accept-Ranges: bytes');
    header('Content-Length:' . (($end - $begin) + 1));
    if (isset($_SERVER['HTTP_RANGE'])) {
        header("Content-Range: bytes $begin-$end/$size");
    }
    header("Content-Disposition: inline; filename=".basename($path));
    header("Content-Transfer-Encoding: binary");
    header("Last-Modified: $time");

    $cur = $begin;
    fseek($fm, $begin, 0);

    while(!feof($fm) && $cur <= $end && (connection_status() == 0)) {
        print fread($fm, min(1024 * 16, ($end - $cur) + 1));
        $cur += 1024 * 16;
    }
    fclose($fm);
    exit;
}
