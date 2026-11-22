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

$body = json_decode((string)file_get_contents('php://input'), true) ?: [];
$token = (string)($body['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
if ($token === '' || !hash_equals(csrf_token(), $token)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Invalid CSRF token']);
    exit;
}

// Weighted outcomes: 500 RWF wedge (index 8) has 0% weight; max payout <= 200 RWF
$segments = [
    ['index' => 0, 'reward' => 10,  'weight' => 24],
    ['index' => 1, 'reward' => 20,  'weight' => 22],
    ['index' => 2, 'reward' => 40,  'weight' => 18],
    ['index' => 3, 'reward' => 50,  'weight' => 14],
    ['index' => 4, 'reward' => 80,  'weight' => 9],
    ['index' => 5, 'reward' => 100, 'weight' => 7],
    ['index' => 6, 'reward' => 150, 'weight' => 4],
    ['index' => 7, 'reward' => 200, 'weight' => 2],
    ['index' => 8, 'reward' => 500, 'weight' => 0],
];

$totalWeight = array_sum(array_column($segments, 'weight'));
$roll = random_int(1, $totalWeight);
$chosen = $segments[0];
$acc = 0;
foreach ($segments as $seg) {
    if ($seg['weight'] <= 0) {
        continue;
    }
    $acc += $seg['weight'];
    if ($roll <= $acc) {
        $chosen = $seg;
        break;
    }
}

$rewardRwf = min(200, (int)$chosen['reward']);

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT spin_credits FROM users WHERE id = :id FOR UPDATE');
    $stmt->execute([':id' => $user['id']]);
    $row = $stmt->fetch();

    if (!$row || (int)$row['spin_credits'] < 1) {
        $pdo->rollBack();
        echo json_encode(['ok' => false, 'error' => 'No spin credits available. Invite friends to earn free spins!']);
        exit;
    }

    $upd = $pdo->prepare(
        'UPDATE users
         SET spin_credits = spin_credits - 1,
             wallet_balance_rwf = wallet_balance_rwf + :reward
         WHERE id = :id'
    );
    $upd->execute([':reward' => $rewardRwf, ':id' => $user['id']]);

    $histStmt = $pdo->prepare('INSERT INTO spin_history (user_id, reward_rwf) VALUES (:uid, :reward)');
    $histStmt->execute([':uid' => $user['id'], ':reward' => $rewardRwf]);

    log_transaction(
        $pdo,
        (int)$user['id'],
        'Lucky Spin Wheel Reward (' . $rewardRwf . ' RWF)',
        'Spin Win',
        'E-Finance Lucky Wheel',
        (float)$rewardRwf,
        'credit',
        'Completed',
        0.0,
        'SPN'
    );

    $pdo->commit();
    echo json_encode([
        'ok' => true,
        'segment_index' => $chosen['index'],
        'reward_rwf' => $rewardRwf,
    ]);
} catch (Throwable $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Spin processing failed.']);
}
