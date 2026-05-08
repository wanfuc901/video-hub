<?php
header('Content-Type: application/json');
$config = require 'config.php';
$videoDir      = $config['video_dir'];
$scanDirs      = $config['scan_dirs'] ?? [$videoDir];
$thumbDir      = $config['thumb_dir'];
$titlesFile    = $config['titles_file'];
$supportedExts = $config['supported_extensions'];

if (!is_dir($videoDir))  @mkdir($videoDir, 0777, true);
if (!is_dir($thumbDir))  @mkdir($thumbDir, 0777, true);
if (!file_exists($titlesFile)) @file_put_contents($titlesFile, json_encode([]));

$action = $_GET['action'] ?? 'list';

function getTitles() { global $titlesFile; if(file_exists($titlesFile)){$d=file_get_contents($titlesFile);return json_decode($d,true)??[];}return []; }
function saveTitles($t) { global $titlesFile; file_put_contents($titlesFile, json_encode($t, JSON_PRETTY_PRINT)); }

if ($action === 'list') {
    $titles=$getTitles=getTitles(); $videos=[]; $seen=[];
    foreach ($scanDirs as $dir) {
        if (!is_dir($dir)) continue;
        $iter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($iter as $file) {
            if (!$file->isFile()) continue;
            $ext = strtolower($file->getExtension());
            if (!in_array($ext, $supportedExts)) continue;
            $fn = $file->getFilename();
            if (isset($seen[$fn])) continue; $seen[$fn]=true;
            $key = md5($fn);
            $videos[] = ['name'=>$fn,'path'=>$file->getPathname(),'size'=>$file->getSize(),'ext'=>$ext,'title_custom'=>$titles[$fn]??null,'thumbnail_exists'=>file_exists($thumbDir.DIRECTORY_SEPARATOR.$key.'.jpg'),'blur_exists'=>file_exists($thumbDir.DIRECTORY_SEPARATOR.$key.'_blur.jpg'),'mtime'=>$file->getMTime()];
        }
    }
    usort($videos, fn($a,$b)=>$b['mtime']<=>$a['mtime']);
    echo json_encode($videos); exit;
}

if ($action === 'check_exists') {
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
    $arrived=glob($tmpDir.DIRECTORY_SEPARATOR.'chunk_*');
    if(count($arrived)<$totalChunks){echo json_encode(['success'=>true,'done'=>false,'received'=>count($arrived)]);exit;}
    
    $lockFile = $tmpDir . DIRECTORY_SEPARATOR . 'merge.lock';
    $lock = fopen($lockFile, 'w');
    if (!flock($lock, LOCK_EX | LOCK_NB)) {
        fclose($lock);
        echo json_encode(['success'=>true, 'done'=>false, 'received'=>count($arrived)]);
        exit;
    }

    $finalName=$fileName; $targetPath=$videoDir.DIRECTORY_SEPARATOR.$finalName;
    if(file_exists($targetPath)){
        if($keepBoth){$base=pathinfo($fileName,PATHINFO_FILENAME);$finalName=$base.'_'.date('Ymd_His').'.'.$ext;$targetPath=$videoDir.DIRECTORY_SEPARATOR.$finalName;}
        elseif(!$overwrite){flock($lock, LOCK_UN); fclose($lock); @unlink($lockFile); http_response_code(409); echo json_encode(['error'=>'conflict']); exit;}
    }
    sort($arrived); $out=fopen($targetPath,'wb');
    if(!$out){flock($lock, LOCK_UN); fclose($lock); @unlink($lockFile); http_response_code(500); echo json_encode(['error'=>'Cannot write']); exit;}
    foreach($arrived as $chunk){$in=fopen($chunk,'rb');while(!feof($in))fwrite($out,fread($in,2*1024*1024));fclose($in);@unlink($chunk);}
    fclose($out);
    flock($lock, LOCK_UN); fclose($lock); @unlink($lockFile);
    @rmdir($tmpDir);
    echo json_encode(['success'=>true,'done'=>true,'file'=>$finalName]); exit;
}

if ($action === 'update_title') {
    $data=json_decode(file_get_contents('php://input'),true); $file=$data['file']??''; $title=$data['title']??'';
    if($file&&$title!==''){$t=getTitles();$t[$file]=$title;saveTitles($t);echo json_encode(['success'=>true]);}
    else{http_response_code(400);echo json_encode(['error'=>'Invalid']);} exit;
}

if ($action === 'upload_thumbnail') {
    $file=$_POST['file']??''; $imageData=$_POST['image']??'';
    if($file&&$imageData){
        list($type,$imageData)=explode(';',$imageData); list(,$imageData)=explode(',',$imageData); $imageData=base64_decode($imageData);
        file_put_contents($thumbDir.DIRECTORY_SEPARATOR.md5($file).'.jpg',$imageData);
        echo json_encode(['success'=>true]);
    }else{http_response_code(400);echo json_encode(['error'=>'No image']);} exit;
}

if ($action === 'blur_thumbnail') {
    $data=json_decode(file_get_contents('php://input'),true);
    $file=$data['file']??''; $imageData=$data['image']??'';
    if(!$file){http_response_code(400);echo json_encode(['error'=>'No file']);exit;}
    $blurPath=$thumbDir.DIRECTORY_SEPARATOR.md5($file).'_blur.jpg';
    if($imageData){
        $raw=base64_decode(preg_replace('/^data:image\/\w+;base64,/','',$imageData));
        file_put_contents($blurPath,$raw);
        echo json_encode(['success'=>true]);
    } else {
        $srcPath=$thumbDir.DIRECTORY_SEPARATOR.md5($file).'.jpg';
        if(!file_exists($srcPath)){http_response_code(404);echo json_encode(['error'=>'No thumb']);exit;}
        $img=@imagecreatefromjpeg($srcPath);
        if(!$img){http_response_code(500);echo json_encode(['error'=>'GD fail']);exit;}
        for($i=0;$i<15;$i++)imagefilter($img,IMG_FILTER_GAUSSIAN_BLUR);
        imagejpeg($img,$blurPath,80);imagedestroy($img);
        echo json_encode(['success'=>true]);
    }
    exit;
}

if ($action === 'remove_blur') {
    $data=json_decode(file_get_contents('php://input'),true); $file=$data['file']??'';
    if($file){$p=$thumbDir.DIRECTORY_SEPARATOR.md5($file).'_blur.jpg';if(file_exists($p))@unlink($p);echo json_encode(['success'=>true]);}
    else{http_response_code(400);echo json_encode(['error'=>'No file']);} exit;
}

if ($action === 'thumbnail') {
    $file=$_GET['file']??''; $p=$thumbDir.DIRECTORY_SEPARATOR.md5($file).'.jpg';
    if(file_exists($p)){header('Content-Type: image/jpeg');header('Cache-Control: public, max-age=86400');readfile($p);}else http_response_code(404); exit;
}

if ($action === 'thumbnail_blur') {
    $file=$_GET['file']??''; $p=$thumbDir.DIRECTORY_SEPARATOR.md5($file).'_blur.jpg';
    if(file_exists($p)){header('Content-Type: image/jpeg');header('Cache-Control: public, max-age=86400');readfile($p);}else http_response_code(404); exit;
}

if ($action === 'delete') {
    $data=json_decode(file_get_contents('php://input'),true); $file=$data['file']??'';
    if($file){$fn=basename($file);$key=md5($fn);@unlink($videoDir.DIRECTORY_SEPARATOR.$fn);@unlink($thumbDir.DIRECTORY_SEPARATOR.$key.'.jpg');@unlink($thumbDir.DIRECTORY_SEPARATOR.$key.'_blur.jpg');$t=getTitles();unset($t[$fn]);saveTitles($t);echo json_encode(['success'=>true]);}
    else{http_response_code(400);echo json_encode(['error'=>'Invalid']);} exit;
}

if ($action === 'delete_many') {
    $data=json_decode(file_get_contents('php://input'),true); $files=$data['files']??[];
    $deleted=0;$errors=[];$t=getTitles();
    foreach($files as $file){$fn=basename($file);if(!$fn)continue;$key=md5($fn);$tp=$videoDir.DIRECTORY_SEPARATOR.$fn;if(file_exists($tp)){@unlink($tp);@unlink($thumbDir.DIRECTORY_SEPARATOR.$key.'.jpg');@unlink($thumbDir.DIRECTORY_SEPARATOR.$key.'_blur.jpg');$deleted++;}else{$errors[]=$fn;}unset($t[$fn]);}
    saveTitles($t);echo json_encode(['success'=>true,'deleted'=>$deleted,'errors'=>$errors]); exit;
}

if ($action === 'stream') {
    $path=$_GET['path']??'';
    if(empty($path)||!file_exists($path)){http_response_code(404);exit;}
    $size=filesize($path);$fm=@fopen($path,'rb');if(!$fm){http_response_code(500);exit;}
    $begin=0;$end=$size-1;
    if(isset($_SERVER['HTTP_RANGE'])&&preg_match('/bytes=\h*(\d+)-(\d*)[\D.*]?/i',$_SERVER['HTTP_RANGE'],$m)){$begin=intval($m[1]);if(!empty($m[2]))$end=intval($m[2]);}
    header(isset($_SERVER['HTTP_RANGE'])?'HTTP/1.1 206 Partial Content':'HTTP/1.1 200 OK');
    header('Access-Control-Allow-Origin: *');header('Cross-Origin-Resource-Policy: cross-origin');header('Accept-Ranges: bytes');
    $ext=strtolower(pathinfo($path,PATHINFO_EXTENSION));
    $mm=['mp4'=>'video/mp4','mkv'=>'video/x-matroska','avi'=>'video/x-msvideo','mov'=>'video/quicktime','webm'=>'video/webm','m4v'=>'video/mp4'];
    header('Content-Type: '.($mm[$ext]??'video/mp4'));
    header('Cache-Control: public, max-age=3600');
    header('Content-Length: '.(($end-$begin)+1));
    if(isset($_SERVER['HTTP_RANGE']))header("Content-Range: bytes $begin-$end/$size");
    header('Content-Disposition: inline; filename='.basename($path));
    fseek($fm,$begin);$cur=$begin;
    while(!feof($fm)&&$cur<=$end&&connection_status()==0){print fread($fm,min(256*1024,($end-$cur)+1));$cur+=256*1024;@ob_flush();flush();}
    fclose($fm);exit;
}
