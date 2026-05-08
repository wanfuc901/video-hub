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
                $thumbPath = $thumbDir . DIRECTORY_SEPARATOR . md5($filename) . '.jpg';
                
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

    usort($videos, function($a, $b) {
        return $b['mtime'] <=> $a['mtime'];
    });

    echo json_encode($videos);
    exit;
}

if ($action === 'check_exists') {
    $fileName = basename($_GET['file'] ?? '');
    if (!$fileName) { echo json_encode(['error' => 'No file']); exit; }
    $targetPath = $videoDir . DIRECTORY_SEPARATOR . $fileName;
    echo json_encode(['exists' => file_exists($targetPath)]);
    exit;
}

if ($action === 'upload_chunk') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

    set_time_limit(0);
    ini_set('memory_limit', '256M');

    $fileName  = basename($_POST['fileName']  ?? '');
    $chunkIdx  = (int)($_POST['chunkIndex']   ?? 0);
    $totalChunks = (int)($_POST['totalChunks'] ?? 1);
    $uploadId  = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['uploadId'] ?? '');
    $overwrite = ($_POST['overwrite'] ?? 'false') === 'true';
    $keepBoth  = ($_POST['keepBoth']  ?? 'false') === 'true';

    if (!$fileName || !$uploadId) {
        http_response_code(400); echo json_encode(['error' => 'Missing params']); exit;
    }

    $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    if (!in_array($ext, $supportedExts)) {
        http_response_code(400); echo json_encode(['error' => 'Unsupported type']); exit;
    }

    if (!isset($_FILES['chunk']) || $_FILES['chunk']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400); echo json_encode(['error' => 'Chunk error: ' . ($_FILES['chunk']['error'] ?? 'unknown')]); exit;
    }

    // Temp dir per uploadId
    $tmpDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'vhhub_' . $uploadId;
    if (!is_dir($tmpDir)) @mkdir($tmpDir, 0777, true);

    $chunkPath = $tmpDir . DIRECTORY_SEPARATOR . 'chunk_' . str_pad($chunkIdx, 6, '0', STR_PAD_LEFT);
    if (!move_uploaded_file($_FILES['chunk']['tmp_name'], $chunkPath)) {
        http_response_code(500); echo json_encode(['error' => 'Chunk save failed']); exit;
    }

    // Check if all chunks arrived
    $arrived = glob($tmpDir . DIRECTORY_SEPARATOR . 'chunk_*');
    if (count($arrived) < $totalChunks) {
        echo json_encode(['success' => true, 'done' => false, 'received' => count($arrived)]);
        exit;
    }

    // Determine final filename
    $finalName = $fileName;
    $targetPath = $videoDir . DIRECTORY_SEPARATOR . $finalName;

    if (file_exists($targetPath)) {
        if ($keepBoth) {
            $base = pathinfo($fileName, PATHINFO_FILENAME);
            $finalName = $base . '_' . date('Ymd_His') . '.' . $ext;
            $targetPath = $videoDir . DIRECTORY_SEPARATOR . $finalName;
        } elseif (!$overwrite) {
            // Shouldn't happen — client always sends one of the flags
            http_response_code(409); echo json_encode(['error' => 'conflict']); exit;
        }
        // overwrite: just write to same path
    }

    // Assemble chunks
    sort($arrived);
    $out = fopen($targetPath, 'wb');
    if (!$out) { http_response_code(500); echo json_encode(['error' => 'Cannot write destination']); exit; }

    foreach ($arrived as $chunk) {
        $in = fopen($chunk, 'rb');
        while (!feof($in)) { fwrite($out, fread($in, 1024 * 1024)); }
        fclose($in);
        @unlink($chunk);
    }
    fclose($out);
    @rmdir($tmpDir);

    echo json_encode(['success' => true, 'done' => true, 'file' => $finalName]);
    exit;
}


    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405); exit;
    }
    
    set_time_limit(0);
    ini_set('memory_limit', '10240M');
    ini_set('post_max_size', '10240M');
    ini_set('upload_max_filesize', '10240M');

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
        $thumbPath = $thumbDir . DIRECTORY_SEPARATOR . md5($file) . '.jpg';
        file_put_contents($thumbPath, $imageData);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400); echo json_encode(['error' => 'No image data']);
    }
    exit;
}

if ($action === 'thumbnail') {
    $file = $_GET['file'] ?? '';
    $thumbPath = $thumbDir . DIRECTORY_SEPARATOR . md5($file) . '.jpg';
    if (file_exists($thumbPath)) {
        header('Content-Type: image/jpeg');
        readfile($thumbPath);
    } else {
        http_response_code(404);
    }
    exit;
}

if ($action === 'delete') {
    $data = json_decode(file_get_contents('php://input'), true);
    $file = $data['file'] ?? '';
    if ($file) {
        $targetPath = $videoDir . DIRECTORY_SEPARATOR . basename($file);
        $thumbPath = $thumbDir . DIRECTORY_SEPARATOR . md5($file) . '.jpg';
        
        if (file_exists($targetPath)) @unlink($targetPath);
        if (file_exists($thumbPath)) @unlink($thumbPath);
        
        $titles = getTitles();
        if (isset($titles[$file])) {
            unset($titles[$file]);
            saveTitles($titles);
        }
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400); echo json_encode(['error' => 'Invalid file']);
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

    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Range');
    header('Cross-Origin-Resource-Policy: cross-origin');
    header('Timing-Allow-Origin: *');
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mimeMap = ['mp4'=>'video/mp4','mkv'=>'video/x-matroska','avi'=>'video/x-msvideo','mov'=>'video/quicktime','webm'=>'video/webm','m4v'=>'video/mp4'];
    $mime = $mimeMap[$ext] ?? 'video/mp4';
    header("Content-Type: $mime");
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
