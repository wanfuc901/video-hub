<?php
require __DIR__ . '/auth.php';
$config = require 'config.php';
$videoDir      = $config['video_dir'];
$scanDirs      = $config['scan_dirs'] ?? [$videoDir];
$thumbDir      = $config['thumb_dir'];
$titlesFile    = $config['titles_file'];
$supportedExts = $config['supported_extensions'];

if (!is_dir($videoDir))  @mkdir($videoDir, 0777, true);
if (!is_dir($thumbDir))  @mkdir($thumbDir, 0777, true);
if (!file_exists($titlesFile)) @file_put_contents($titlesFile, json_encode([]));

$action    = $_GET['action'] ?? 'list';
$cacheFile = $thumbDir . DIRECTORY_SEPARATOR . '_list_cache.json';

function getTitles() { global $titlesFile; if(file_exists($titlesFile)){$d=file_get_contents($titlesFile);return json_decode($d,true)??[];}return []; }
function saveTitles($t) { global $titlesFile; file_put_contents($titlesFile, json_encode($t, JSON_PRETTY_PRINT)); }
function bustListCache() { global $cacheFile; @unlink($cacheFile); }

if ($action === 'list') {
    header('Content-Type: application/json');
    
    if (file_exists($cacheFile)) {
        $etag = md5(filemtime($cacheFile) . filesize($cacheFile));
        header("ETag: \"$etag\"");
        header('Cache-Control: public, max-age=5');

        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH'], '"') === $etag) {
            http_response_code(304);
            exit;
        }

        if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
            ob_start('ob_gzhandler');
        }
        readfile($cacheFile);
        exit;
    }

    // FALLBACK
    $titles = getTitles(); $videos = []; $seen = [];
    foreach ($scanDirs as $dir) {
        if (!is_dir($dir)) continue;
        try {
            $iter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
            foreach ($iter as $file) {
                if (!$file->isFile()) continue;
                $ext = strtolower($file->getExtension());
                if (!in_array($ext, $supportedExts)) continue;
                $fn = $file->getFilename();
                if (isset($seen[$fn])) continue; $seen[$fn] = true;
                $key = md5($fn);
                $hasThumb = file_exists($thumbDir.DIRECTORY_SEPARATOR.$key.'.webp') || file_exists($thumbDir.DIRECTORY_SEPARATOR.$key.'.jpg');
                $videos[] = [
                    'name'=>$fn, 'path'=>$file->getPathname(), 'size'=>$file->getSize(), 'ext'=>$ext,
                    'title_custom'=>$titles[$fn]??null, 'thumbnail_exists'=>$hasThumb, 'mtime'=>$file->getMTime()
                ];
            }
        } catch (Exception $e) {}
    }
    usort($videos, fn($a,$b) => $b['mtime'] <=> $a['mtime']);
    $json = json_encode($videos);
    file_put_contents($cacheFile, $json);
    
    if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
        ob_start('ob_gzhandler');
    }
    echo $json;
    exit;
}

if ($action === 'check_exists') {
    header('Content-Type: application/json');
    $fn=basename($_GET['file']??'');
    echo json_encode(['exists'=>file_exists($videoDir.DIRECTORY_SEPARATOR.$fn)]); exit;
}

if ($action === 'upload_chunk') {
    if ($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);exit;}
    set_time_limit(0); ini_set('memory_limit','512M');
    $fileName=basename($_POST['fileName']??''); $chunkIdx=(int)($_POST['chunkIndex']??0); $totalChunks=(int)($_POST['totalChunks']??1);
    $uploadId=preg_replace('/[^a-zA-Z0-9_-]/','', $_POST['uploadId']??'');
    $overwrite=($_POST['overwrite']??'false')==='true'; $keepBoth=($_POST['keepBoth']??'false')==='true';
    if(!$fileName||!$uploadId){http_response_code(400);echo json_encode(['error'=>'Missing params']);exit;}
    $ext=strtolower(pathinfo($fileName,PATHINFO_EXTENSION));
    if(!in_array($ext,$supportedExts)){http_response_code(400);echo json_encode(['error'=>'Unsupported']);exit;}
    if(!isset($_FILES['chunk'])||$_FILES['chunk']['error']!==UPLOAD_ERR_OK){http_response_code(400);echo json_encode(['error'=>'Chunk error']);exit;}
    $tmpDir=sys_get_temp_dir().DIRECTORY_SEPARATOR.'vhhub_'.$uploadId;
    if(!is_dir($tmpDir))@mkdir($tmpDir,0777,true);
    $chunkPath=$tmpDir.DIRECTORY_SEPARATOR.'chunk_'.str_pad($chunkIdx,6,'0',STR_PAD_LEFT);
    if(!move_uploaded_file($_FILES['chunk']['tmp_name'],$chunkPath)){http_response_code(500);echo json_encode(['error'=>'Save failed']);exit;}
    $lockFile = $tmpDir . DIRECTORY_SEPARATOR . 'merge.lock';
    $lock = fopen($lockFile, 'w');
    flock($lock, LOCK_EX); // Wait for exclusive lock

    $arrived = glob($tmpDir . DIRECTORY_SEPARATOR . 'chunk_*');
    if (count($arrived) < $totalChunks) {
        flock($lock, LOCK_UN); fclose($lock);
        echo json_encode(['success' => true, 'done' => false, 'received' => count($arrived)]);
        exit;
    }

    $finalName = $fileName; $targetPath = $videoDir . DIRECTORY_SEPARATOR . $finalName;
    if (file_exists($targetPath)) {
        if ($keepBoth) {
            $base = pathinfo($fileName, PATHINFO_FILENAME);
            $finalName = $base . '_' . date('Ymd_His') . '.' . $ext;
            $targetPath = $videoDir . DIRECTORY_SEPARATOR . $finalName;
        } elseif (!$overwrite) {
            flock($lock, LOCK_UN); fclose($lock);
            http_response_code(409); echo json_encode(['error' => 'conflict']); exit;
        }
    }
    
    sort($arrived); $out = fopen($targetPath, 'wb');
    if (!$out) {
        flock($lock, LOCK_UN); fclose($lock);
        http_response_code(500); echo json_encode(['error' => 'Cannot write']); exit;
    }
    foreach ($arrived as $chunk) {
        $in = fopen($chunk, 'rb');
        while (!feof($in)) fwrite($out, fread($in, 2 * 1024 * 1024));
        fclose($in); @unlink($chunk);
    }
    fclose($out);
    flock($lock, LOCK_UN); fclose($lock); @unlink($lockFile);
    @rmdir($tmpDir);
    bustListCache();
    echo json_encode(['success' => true, 'done' => true, 'file' => $finalName]); exit;
}

if ($action === 'update_title') {
    $data=json_decode(file_get_contents('php://input'),true); $file=$data['file']??''; $title=$data['title']??'';
    if($file&&$title!==''){$t=getTitles();$t[$file]=$title;saveTitles($t);bustListCache();echo json_encode(['success'=>true]);}
    else{http_response_code(400);echo json_encode(['error'=>'Invalid']);} exit;
}

if ($action === 'upload_thumbnail') {
    $file=$_POST['file']??''; $imageData=$_POST['image']??'';
    if($file&&$imageData){
        list($type,$imageData)=explode(';',$imageData); list(,$imageData)=explode(',',$imageData); $imageData=base64_decode($imageData);
        file_put_contents($thumbDir.DIRECTORY_SEPARATOR.md5($file).'.jpg',$imageData);
        bustListCache();
        echo json_encode(['success'=>true]);
    }else{http_response_code(400);echo json_encode(['error'=>'No image']);} exit;
}

if ($action === 'thumbnail') {
    $file=$_GET['file']??''; $key=md5($file);
    $p = $thumbDir.DIRECTORY_SEPARATOR.$key.'.webp';
    if (!file_exists($p)) $p = $thumbDir.DIRECTORY_SEPARATOR.$key.'.jpg';
    
    if(file_exists($p)){
        $etag='"'.filemtime($p).'"';
        header('Content-Type: ' . (str_ends_with($p, '.webp') ? 'image/webp' : 'image/jpeg'));
        header('Cache-Control: public, max-age=604800');
        header('ETag: '.$etag);
        if(($_SERVER['HTTP_IF_NONE_MATCH']??'') === $etag){http_response_code(304);exit;}
        readfile($p);
    }else http_response_code(404); exit;
}

if ($action === 'delete') {
    $data=json_decode(file_get_contents('php://input'),true); $file=$data['file']??'';
    if($file){$fn=basename($file);$key=md5($fn);@unlink($videoDir.DIRECTORY_SEPARATOR.$fn);@unlink($thumbDir.DIRECTORY_SEPARATOR.$key.'.jpg');@unlink($thumbDir.DIRECTORY_SEPARATOR.$key.'.webp');$t=getTitles();unset($t[$fn]);saveTitles($t);bustListCache();echo json_encode(['success'=>true]);}
    else{http_response_code(400);echo json_encode(['error'=>'Invalid']);} exit;
}

if ($action === 'delete_many') {
    $data=json_decode(file_get_contents('php://input'),true); $files=$data['files']??[];
    $deleted=0;$errors=[];$t=getTitles();
    foreach($files as $file){$fn=basename($file);if(!$fn)continue;$key=md5($fn);$tp=$videoDir.DIRECTORY_SEPARATOR.$fn;if(file_exists($tp)){@unlink($tp);@unlink($thumbDir.DIRECTORY_SEPARATOR.$key.'.jpg');@unlink($thumbDir.DIRECTORY_SEPARATOR.$key.'.webp');$deleted++;}else{$errors[]=$fn;}unset($t[$fn]);}
    saveTitles($t);bustListCache();echo json_encode(['success'=>true,'deleted'=>$deleted,'errors'=>$errors]); exit;
}

if ($action === 'stream') {
    $path = $_GET['path'] ?? '';
    if (empty($path) || !file_exists($path)) {
        http_response_code(404);
        exit;
    }

    // 1. Dọn dẹp tuyệt đối mọi bộ đệm để tránh độ trễ (Latency)
    while (ob_get_level() > 0) ob_end_clean();

    $size = filesize($path);
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mm = ['mp4' => 'video/mp4', 'mkv' => 'video/x-matroska', 'avi' => 'video/x-msvideo', 'mov' => 'video/quicktime', 'webm' => 'video/webm', 'm4v' => 'video/mp4'];
    $contentType = $mm[$ext] ?? 'video/mp4';

    // 2. Nginx Offloading — api.php chỉ xác thực, Nginx serve file trực tiếp
    if (getenv('USE_NGINX') === '1') {
        $realPath     = realpath($path);
        $realVideoDir = realpath($videoDir);
        $accelPath    = null;

        if ($realVideoDir && $realPath &&
            str_starts_with($realPath, $realVideoDir . DIRECTORY_SEPARATOR)) {
            $sub       = substr($realPath, strlen($realVideoDir));
            $accelPath = '/internal_videos' . str_replace(DIRECTORY_SEPARATOR, '/', $sub);
        } elseif ($realPath &&
                  str_starts_with($realPath, '/storage/emulated/0/Videos/')) {
            $sub       = substr($realPath, strlen('/storage/emulated/0/Videos'));
            $accelPath = '/internal_storage' . $sub;
        }

        if ($accelPath) {
            header("X-Accel-Redirect: $accelPath");
            header("Content-Type: $contentType");
            header('Accept-Ranges: bytes');
            header('Cache-Control: public, max-age=3600');
            exit;
        }
    }

    $fm = @fopen($path, 'rb');
    if (!$fm) {
        http_response_code(500);
        exit;
    }

    set_time_limit(0);
    ignore_user_abort(false);

    // Tắt mọi lớp nén
    @ini_set('zlib.output_compression', 'Off');
    if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');

    $begin = 0;
    $end   = $size - 1;

    if (isset($_SERVER['HTTP_RANGE']) && preg_match('/bytes=\h*(\d+)-(\d*)[\D.*]?/i', $_SERVER['HTTP_RANGE'], $m)) {
        $begin = intval($m[1]);
        if (!empty($m[2])) $end = intval($m[2]);
    }

    $isRange = isset($_SERVER['HTTP_RANGE']);
    if ($isRange) {
        header('HTTP/1.1 206 Partial Content');
        header("Content-Range: bytes $begin-$end/$size");
    } else {
        header('HTTP/1.1 200 OK');
    }

    header('Access-Control-Allow-Origin: *');
    header('Cross-Origin-Resource-Policy: cross-origin');
    header('Accept-Ranges: bytes');
    header("Content-Type: $contentType");
    header('Content-Encoding: identity');
    header('Cache-Control: public, max-age=3600');
    header('Content-Length: ' . ($end - $begin + 1));
    header('Content-Disposition: inline; filename="' . addslashes(basename($path)) . '"');
    header('X-Content-Type-Options: nosniff');

    fseek($fm, $begin);
    $remaining = ($end - $begin) + 1;
    $bufSize   = 128 * 1024; // Giảm xuống 128KB để phản hồi nhạy hơn

    while ($remaining > 0 && !feof($fm) && connection_status() === 0) {
        $chunk = fread($fm, min($bufSize, $remaining));
        if ($chunk === false) break;
        echo $chunk;
        flush();
        $remaining -= strlen($chunk);
    }

    fclose($fm);
    exit;
}
