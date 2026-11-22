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

$campaignId = (int)($body['campaign_id'] ?? 0);
if ($campaignId <= 0) {
    echo json_encode(['ok' => false, 'error' => 'Invalid campaign ID']);
    exit;
}

try {
    $pdo->beginTransaction();

    $campStmt = $pdo->prepare("SELECT * FROM video_campaigns WHERE id = :id AND status = 'active' FOR UPDATE");
    $campStmt->execute([':id' => $campaignId]);
    $camp = $campStmt->fetch();

    if (!$camp || (int)$camp['views_count'] >= (int)$camp['target_viewers']) {
        $pdo->rollBack();
        echo json_encode(['ok' => false, 'error' => 'This video campaign has reached its viewer target.']);
        exit;
    }

    // Strict 1-view-per-user enforcement
    $insView = $pdo->prepare('INSERT INTO user_video_views (user_id, campaign_id) VALUES (:uid, :cid)');
    try {
        $insView->execute([':uid' => $user['id'], ':cid' => $campaignId]);
    } catch (PDOException $dupEx) {
        $pdo->rollBack();
        echo json_encode(['ok' => false, 'error' => 'You have already watched and claimed this video.']);
        exit;
    }

    $reward = (int)$camp['reward_per_view_rwf'];
    $newCount = (int)$camp['views_count'] + 1;
    $nextStatus = $newCount >= (int)$camp['target_viewers'] ? 'completed' : 'active';

    $updCamp = $pdo->prepare('UPDATE video_campaigns SET views_count = :vc, status = :st WHERE id = :id');
    $updCamp->execute([':vc' => $newCount, ':st' => $nextStatus, ':id' => $campaignId]);

    $updUser = $pdo->prepare('UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + :reward WHERE id = :uid');
    $updUser->execute([':reward' => $reward, ':uid' => $user['id']]);

    log_transaction(
        $pdo,
        (int)$user['id'],
        'Short Video Reward: ' . $camp['title'],
        'Video Reward',
        'Watch-to-Earn',
        (float)$reward,
        'credit',
        'Completed',
        0.0,
        'VID'
    );

    $pdo->commit();
    echo json_encode(['ok' => true, 'reward_rwf' => $reward]);
} catch (Throwable $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Unable to credit video reward.']);
}
