<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

setcookie(AUTH_COOKIE, '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Strict',
]);

header('Location: index.php');
exit;
