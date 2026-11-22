<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$pdo = db();
$user = require_user($pdo);
$settings = get_settings($pdo);

$body = json_decode((string)file_get_contents('php://input'), true) ?: [];
$token = (string)($body['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
if ($token === '' || !hash_equals(csrf_token(), $token)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Invalid CSRF token']);
    exit;
}

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT last_checkin_at, checkin_streak FROM users WHERE id = :id FOR UPDATE');
    $stmt->execute([':id' => $user['id']]);
    $row = $stmt->fetch();

    if ($row && !empty($row['last_checkin_at'])) {
        $lastTs = strtotime((string)$row['last_checkin_at']);
        if ($lastTs !== false && (time() - $lastTs) < 86400) {
            $pdo->rollBack();
            echo json_encode(['ok' => false, 'error' => '24 hours have not elapsed since your last check-in.']);
            exit;
        }
    }

    $reward = (float)$settings['daily_checkin_rwf'];
    $upd = $pdo->prepare(
        'UPDATE users
         SET wallet_balance_rwf = wallet_balance_rwf + :reward,
             last_checkin_at = NOW(),
             checkin_streak = checkin_streak + 1
         WHERE id = :id'
    );
    $upd->execute([':reward' => $reward, ':id' => $user['id']]);

    log_transaction(
        $pdo,
        (int)$user['id'],
        'Daily 24h Check-In Reward',
        'Check-In',
        'E-Finance Daily Check-In',
        $reward,
        'credit',
        'Completed',
        0.0,
        'CHK'
    );

    $pdo->commit();
    echo json_encode(['ok' => true, 'reward_rwf' => $reward]);
} catch (Throwable $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Unable to process check-in.']);
}
