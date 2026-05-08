<?php
// api.php
header('Content-Type: application/json');

$config = require 'config.php';
$videoDir = $config['video_dir'];
$supportedExts = $config['supported_extensions'];

$action = $_GET['action'] ?? 'list';

if ($action === 'upload') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed.']);
        exit;
    }

    if (!isset($_FILES['video']) || $_FILES['video']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        $errMsg = isset($_FILES['video']) ? 'Upload error code: ' . $_FILES['video']['error'] : 'No file uploaded or file exceeds server limits.';
        echo json_encode(['error' => $errMsg]);
        exit;
    }

    $file = $_FILES['video'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    
    if (!in_array($ext, $supportedExts)) {
        http_response_code(400);
        echo json_encode(['error' => 'Unsupported file type: ' . $ext]);
        exit;
    }

    // Ensure directory exists
    if (!is_dir($videoDir)) {
        @mkdir($videoDir, 0777, true);
    }

    $fileName = basename($file['name']);
    $targetPath = $videoDir . DIRECTORY_SEPARATOR . $fileName;

    if (file_exists($targetPath)) {
        $fileName = time() . '_' . $fileName;
        $targetPath = $videoDir . DIRECTORY_SEPARATOR . $fileName;
    }

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        echo json_encode(['success' => true, 'message' => 'Upload successful.', 'file' => $fileName]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save the uploaded file.']);
    }
    exit;
}

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
