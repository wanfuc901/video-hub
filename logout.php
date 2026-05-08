<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) session_start();

$_SESSION = [];
session_destroy();

header('Location: index.php');
exit;
