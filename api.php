<?php
// api.php
header('Content-Type: application/json');

$config = require 'config.php';
$videoDir = $config['video_dir'];
$thumbDir = $config['thumb_dir'];
$titlesFile = $config['titles_file'];
$supportedExts = $config['supported_extensions'];

// Ensure directories exist
if (!is_dir($videoDir)) @mkdir($videoDir, 0777, true);
if (!is_dir($thumbDir)) @mkdir($thumbDir, 0777, true);
if (!file_exists($titlesFile)) @file_put_contents($titlesFile, json_encode([]));

$action = $_GET['action'] ?? 'list';

function getTitles() {
    global $titlesFile;
    if (file_exists($titlesFile)) {
        $data = file_get_contents($titlesFile);
        return json_decode($data, true) ?: [];
    }
    return [];
}

function saveTitles($titles) {
    global $titlesFile;
    file_put_contents($titlesFile, json_encode($titles, JSON_PRETTY_PRINT));
}

if ($action === 'list') {
    if (!is_dir($videoDir)) {
        echo json_encode(['error' => 'Video directory not found.']);
        exit;
    }

    $titles = getTitles();
    $videos = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($videoDir));
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $ext = strtolower($file->getExtension());
            if (in_array($ext, $supportedExts)) {
                $filename = $file->getFilename();
                $path = $file->getPathname();
                $customTitle = $titles[$filename] ?? null;
                $thumbPath = $thumbDir . DIRECTORY_SEPARATOR . $filename . '.jpg';
                
                $videos[] = [
                    'name' => $filename,
                    'path' => $path,
                    'size' => $file->getSize(),
                    'ext' => $ext,
                    'title_custom' => $customTitle,
                    'thumbnail_exists' => file_exists($thumbPath),
                    'mtime' => $file->getMTime()
                ];
            }
        }
    }

    // Sort by modified time (newest first)
    usort($videos, function($a, $b) {
        return $b['mtime'] <=> $a['mtime'];
    });

    echo json_encode($videos);
    exit;
}

if ($action === 'upload') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405); exit;
    }
    if (!isset($_FILES['video']) || $_FILES['video']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'Upload error: ' . ($_FILES['video']['error'] ?? 'Unknown')]);
        exit;
    }

    $file = $_FILES['video'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $supportedExts)) {
        http_response_code(400); echo json_encode(['error' => 'Unsupported type']); exit;
    }

    $fileName = basename($file['name']);
    $targetPath = $videoDir . DIRECTORY_SEPARATOR . $fileName;

    if (file_exists($targetPath)) {
        $fileName = time() . '_' . $fileName;
        $targetPath = $videoDir . DIRECTORY_SEPARATOR . $fileName;
    }

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        echo json_encode(['success' => true, 'file' => $fileName]);
    } else {
        http_response_code(500); echo json_encode(['error' => 'Save failed']);
    }
    exit;
}

if ($action === 'update_title') {
    $data = json_decode(file_get_contents('php://input'), true);
    $file = $data['file'] ?? '';
    $title = $data['title'] ?? '';
    if ($file && $title !== '') {
        $titles = getTitles();
        $titles[$file] = $title;
        saveTitles($titles);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400); echo json_encode(['error' => 'Invalid data']);
    }
    exit;
}

if ($action === 'upload_thumbnail') {
    $file = $_POST['file'] ?? '';
    $imageData = $_POST['image'] ?? '';
    if ($file && $imageData) {
        list($type, $imageData) = explode(';', $imageData);
        list(, $imageData)      = explode(',', $imageData);
        $imageData = base64_decode($imageData);
        $thumbPath = $thumbDir . DIRECTORY_SEPARATOR . basename($file) . '.jpg';
        file_put_contents($thumbPath, $imageData);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400); echo json_encode(['error' => 'No image data']);
    }
    exit;
}

if ($action === 'thumbnail') {
    $file = $_GET['file'] ?? '';
    $thumbPath = $thumbDir . DIRECTORY_SEPARATOR . basename($file) . '.jpg';
    if (file_exists($thumbPath)) {
        header('Content-Type: image/jpeg');
        readfile($thumbPath);
    } else {
        http_response_code(404);
    }
    exit;
}

if ($action === 'stream') {
    $path = $_GET['path'] ?? '';
    if (empty($path) || !file_exists($path)) {
        http_response_code(404); exit;
    }

    $size = filesize($path);
    $time = date('r', filemtime($path));
    $fm = @fopen($path, 'rb');
    if (!$fm) { http_response_code(500); exit; }

    $begin = 0; $end = $size - 1;

    if (isset($_SERVER['HTTP_RANGE'])) {
        if (preg_match('/bytes=\h*(\d+)-(\d*)[\D.*]?/i', $_SERVER['HTTP_RANGE'], $matches)) {
            $begin = intval($matches[1]);
            if (!empty($matches[2])) $end = intval($matches[2]);
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
