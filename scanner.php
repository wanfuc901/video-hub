<?php
/**
 * scanner.php - Server-side thumbnail generator using FFmpeg
 */

set_time_limit(0);
$config = require __DIR__ . '/config.php';
$videoDir      = $config['video_dir'];
$scanDirs      = $config['scan_dirs'];
$thumbDir      = $config['thumb_dir'];
$supportedExts = $config['supported_extensions'];
$metadataFile  = __DIR__ . '/metadata.json';
$titlesFile    = $config['titles_file'];

if (!is_dir($thumbDir)) @mkdir($thumbDir, 0777, true);

// Load titles
$titles = [];
if (file_exists($titlesFile)) {
    $titles = json_decode(file_get_contents($titlesFile), true) ?? [];
}

$newMetadata = [];
$processedCount = 0;
$skippedCount = 0;

echo "Scanning videos...\n";

foreach ($scanDirs as $dir) {
    if (!is_dir($dir)) continue;
    
    $iter = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iter as $file) {
        if (!$file->isFile()) continue;
        
        $ext = strtolower($file->getExtension());
        if (!in_array($ext, $supportedExts)) continue;

        $fileName = $file->getFilename();
        $filePath = $file->getPathname();
        $key = md5($fileName);
        $thumbName = $key . '.webp';
        $thumbPath = $thumbDir . DIRECTORY_SEPARATOR . $thumbName;

        // Also check if old .jpg exists - if so, maybe we don't need to re-extract? 
        // But WebP is better. Let's only skip if .webp exists.
        $hasThumb = file_exists($thumbPath);

        if (!$hasThumb) {
            echo "Generating thumbnail for: $fileName... ";
            
            $cmd = sprintf(
                'ffmpeg -ss 00:00:05 -i %s -frames:v 1 -vf "scale=480:-1" -q:v 75 %s -y 2>&1',
                escapeshellarg($filePath),
                escapeshellarg($thumbPath)
            );

            exec($cmd, $output, $returnCode);

            if ($returnCode === 0) {
                echo "Done.\n";
                $hasThumb = true;
                $processedCount++;
            } else {
                echo "Failed (5s). Trying 1s... ";
                $cmd = sprintf(
                    'ffmpeg -ss 00:00:01 -i %s -frames:v 1 -vf "scale=480:-1" -q:v 75 %s -y 2>&1',
                    escapeshellarg($filePath),
                    escapeshellarg($thumbPath)
                );
                exec($cmd, $output, $returnCode);
                if ($returnCode === 0) {
                    echo "Done.\n";
                    $hasThumb = true;
                    $processedCount++;
                } else {
                    echo "Permanent Failure.\n";
                }
            }
        } else {
            $skippedCount++;
        }

        $newMetadata[] = [
            'name' => $fileName,
            'path' => $filePath,
            'size' => $file->getSize(),
            'ext'  => $ext,
            'title_custom' => $titles[$fileName] ?? null,
            'thumbnail_exists' => $hasThumb,
            'thumbnail_file' => $hasThumb ? $thumbName : null,
            'mtime' => $file->getMTime()
        ];
    }
}

// Bust list cache
$cacheFile = $thumbDir . DIRECTORY_SEPARATOR . '_list_cache.json';
if (file_exists($cacheFile)) @unlink($cacheFile);

// Save metadata just in case, but API will scan too
file_put_contents($metadataFile, json_encode($newMetadata, JSON_PRETTY_PRINT));

echo "\n--- Summary ---\n";
echo "Processed: $processedCount\n";
echo "Skipped: $skippedCount\n";
echo "Total: " . count($newMetadata) . "\n";
echo "Metadata saved to metadata.json\n";
