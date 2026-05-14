<?php
declare(strict_types=1);

const AUTH_SESSION_KEY = 'vhhub_authenticated';

require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) session_start();

if (isset($_SESSION[AUTH_SESSION_KEY]) && $_SESSION[AUTH_SESSION_KEY] === true) return;

// Handle login POST before any output
$authError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $submitted = $_POST['password'] ?? '';
    if (hash_equals((string)VHHUB_PASSWORD, $submitted)) {
        $_SESSION[AUTH_SESSION_KEY] = true;
        $rawRedirect = $_POST['redirect'] ?? 'index.php';
        // Allow only same-origin paths — no protocol, no double-slash
        $safeRedirect = preg_match('/^[\w\-\.\/\?\=\&\%]+$/', $rawRedirect) ? $rawRedirect : 'index.php';
        header('Location: ' . $safeRedirect);
        exit;
    }
    $authError = 'Sai mật khẩu.';
}

// API context → 401 JSON, no HTML page
if (basename($_SERVER['SCRIPT_FILENAME']) === 'api.php') {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$redirectUri = htmlspecialchars($_SERVER['REQUEST_URI'] ?? 'index.php', ENT_QUOTES);
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VHHub — Đăng nhập</title>
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
  <link rel="stylesheet" href="assets/style.css?v=<?= APP_VER ?>">
  <style>
    .login-wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .login-card {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 40px 36px;
      width: 100%;
      max-width: 380px;
    }
    .login-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 32px;
      font-size: 22px;
      font-weight: 700;
    }
    .login-error {
      background: rgba(239,68,68,.15);
      border: 1px solid rgba(239,68,68,.4);
      color: #f87171;
      padding: 10px 14px;
      font-size: 13px;
      margin-bottom: 16px;
    }
    .login-field-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-gray);
      text-transform: uppercase;
      letter-spacing: .06em;
      margin-bottom: 8px;
    }
    .login-card input[type=password] {
      width: 100%;
      box-sizing: border-box;
    }
    .login-card .btn {
      width: 100%;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <script src="assets/loader.js"></script>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--accent)"><path d="M12 2L2 22h20L12 2zm0 6l5 10H7l5-10z"/></svg>
        <span class="syne-font">VH<span style="color:var(--accent)">Hub</span></span>
      </div>
      <?php if ($authError): ?>
        <div class="login-error"><?= htmlspecialchars($authError) ?></div>
      <?php endif; ?>
      <form method="post">
        <input type="hidden" name="redirect" value="<?= $redirectUri ?>">
        <label class="login-field-label" for="loginPwd">Mật khẩu</label>
        <input type="password" id="loginPwd" name="password" class="form-input" autofocus autocomplete="current-password" required>
        <button type="submit" class="btn btn-accent">Đăng nhập</button>
      </form>
    </div>
  </div>
</body>
</html>
<?php
exit;
