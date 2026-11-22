<?php
declare(strict_types=1);

require_once __DIR__ . '/functions.php';

if (session_status() === PHP_SESSION_NONE) {
    $isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return (string)$_SESSION['csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

function verify_csrf(): void
{
    $posted = (string)($_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($posted === '' || !hash_equals(csrf_token(), $posted)) {
        http_response_code(403);
        exit('Invalid or expired security token. Please refresh and try again.');
    }
}

function flash_set(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function flash_get(): ?array
{
    if (!isset($_SESSION['flash'])) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return is_array($flash) ? $flash : null;
}

function current_user(PDO $pdo): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => (int)$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user) {
        unset($_SESSION['user_id'], $_SESSION['user_role']);
        return null;
    }
    return $user;
}

function require_user(PDO $pdo, bool $mustBeActive = true): array
{
    $user = current_user($pdo);
    if (!$user) {
        header('Location: /login.php');
        exit;
    }
    if (($user['role'] ?? 'member') === 'admin') {
        header('Location: /admin/dashboard.php');
        exit;
    }

    $settings = get_settings($pdo);
    if ((int)$settings['maintenance_mode'] === 1) {
        http_response_code(503);
        exit('E-Finance Rwanda is currently undergoing scheduled maintenance. Please check back shortly.');
    }

    if ($user['account_status'] === 'suspended') {
        session_destroy();
        header('Location: /login.php?error=suspended');
        exit;
    }

    if ($mustBeActive) {
        if ($user['account_status'] === 'pending_approval') {
            header('Location: /user/pending.php');
            exit;
        }
        if ($user['account_status'] === 'awaiting_payment' || $user['account_status'] === 'payment_submitted') {
            header('Location: /user/activate.php');
            exit;
        }
    }

    run_daily_roi_engine($pdo);
    // Refresh row after possible ROI payout
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => (int)$user['id']]);
    return $stmt->fetch() ?: $user;
}

function require_admin(PDO $pdo): array
{
    $user = current_user($pdo);
    if (!$user || ($user['role'] ?? '') !== 'admin') {
        header('Location: /login.php');
        exit;
    }
    return $user;
}
