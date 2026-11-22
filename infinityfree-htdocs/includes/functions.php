<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';

function e(?string $value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function format_rwf(float|int|string $amount): string
{
    return number_format((float)$amount, 0, '.', ',') . ' RWF';
}

function get_settings(PDO $pdo): array
{
    static $cached = null;
    if (is_array($cached)) {
        return $cached;
    }
    $stmt = $pdo->query('SELECT * FROM system_settings WHERE id = 1 LIMIT 1');
    $row = $stmt->fetch();
    if (!$row) {
        $row = [
            'activation_fee_rwf' => 200,
            'welcome_bonus_rwf' => 200,
            'daily_checkin_rwf' => 20,
            'withdrawal_fee_percent' => 25.00,
            'subsequent_min_withdrawal_rwf' => 1000,
            'subsequent_max_withdrawal_rwf' => 5000,
            'referral_commission_percent' => 10.00,
            'min_video_reward_rwf' => 50,
            'momo_pay_code' => '1880554',
            'platform_tagline' => 'Digital savings, verified credit, and paid community tasks for Rwanda.',
            'maintenance_mode' => 0,
        ];
    }
    $cached = $row;
    return $cached;
}

function build_ussd_code(string $merchantCode, int|float $amountRwf): string
{
    $cleanAmount = max(1, (int)round((float)$amountRwf));
    return '*182*8*1*' . $merchantCode . '*' . $cleanAmount . '#';
}

function build_ussd_href(string $merchantCode, int|float $amountRwf): string
{
    $cleanAmount = max(1, (int)round((float)$amountRwf));
    return 'tel:*182*8*1*' . rawurlencode($merchantCode) . '*' . $cleanAmount . '%23';
}

function valid_rwanda_phone(string $phone): bool
{
    $cleaned = preg_replace('/[\s-]+/', '', $phone) ?? '';
    return (bool)preg_match('/^(\+?250)?0?7[2389]\d{7}$/', $cleaned);
}

function valid_rwanda_id(string $nationalId): bool
{
    $digits = preg_replace('/\s+/', '', $nationalId) ?? '';
    return (bool)preg_match('/^\d{16}$/', $digits);
}

function generate_ref(string $prefix = 'EFN'): string
{
    return $prefix . '-' . random_int(100000, 999999);
}

function generate_account_number(): string
{
    return 'EF-RW-' . random_int(100000, 999999);
}

function generate_referral_code(string $firstName): string
{
    $clean = strtoupper(preg_replace('/[^A-Za-z]/', '', $firstName) ?? '');
    $prefix = substr($clean, 0, 3) ?: 'RW';
    return 'EF-' . $prefix . random_int(100, 999);
}

function log_transaction(
    PDO $pdo,
    int $userId,
    string $title,
    string $category,
    string $channel,
    float $amountRwf,
    string $direction,
    string $status = 'Completed',
    float $feeRwf = 0.0,
    string $refPrefix = 'EFN'
): void {
    $stmt = $pdo->prepare(
        'INSERT INTO transactions (user_id, reference, title, category, channel, amount_rwf, fee_rwf, direction, status)
         VALUES (:user_id, :reference, :title, :category, :channel, :amount_rwf, :fee_rwf, :direction, :status)'
    );
    $stmt->execute([
        ':user_id' => $userId,
        ':reference' => generate_ref($refPrefix),
        ':title' => $title,
        ':category' => $category,
        ':channel' => $channel,
        ':amount_rwf' => $amountRwf,
        ':fee_rwf' => $feeRwf,
        ':direction' => $direction,
        ':status' => $status,
    ]);
}

function upload_secure_file(array $file, string $subDir, array $allowedMimeMap, int $maxBytes): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('File upload failed or was not provided.');
    }
    if (($file['size'] ?? 0) <= 0 || ($file['size'] ?? 0) > $maxBytes) {
        throw new RuntimeException('File size exceeds allowed limit.');
    }

    $tmpPath = (string)($file['tmp_name'] ?? '');
    if (!is_uploaded_file($tmpPath)) {
        throw new RuntimeException('Invalid upload source.');
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = (string)$finfo->file($tmpPath);
    if (!isset($allowedMimeMap[$mime])) {
        throw new RuntimeException('Unsupported file format.');
    }

    $ext = $allowedMimeMap[$mime];
    $targetDir = BASE_PATH . '/uploads/' . trim($subDir, '/');
    if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
        throw new RuntimeException('Unable to prepare upload folder.');
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $ext;
    $destination = $targetDir . '/' . $filename;
    if (!move_uploaded_file($tmpPath, $destination)) {
        throw new RuntimeException('Failed to store uploaded file.');
    }

    return 'uploads/' . trim($subDir, '/') . '/' . $filename;
}

/**
 * Automated 24-hour Investment ROI Distribution Engine.
 * Safe to call via cron_roi.php or opportunistically on dashboard requests.
 */
function run_daily_roi_engine(PDO $pdo): int
{
    $creditedCount = 0;
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->query(
            "SELECT * FROM user_investments
             WHERE status = 'active' AND last_roi_credited_at IS NOT NULL
             FOR UPDATE"
        );
        $activeInvestments = $stmt->fetchAll();
        $nowTs = time();

        foreach ($activeInvestments as $inv) {
            $lastTs = strtotime((string)$inv['last_roi_credited_at']);
            if ($lastTs === false) {
                continue;
            }
            $daysDue = (int)floor(($nowTs - $lastTs) / 86400);
            if ($daysDue < 1) {
                continue;
            }

            $durationDays = (int)$inv['duration_days'];
            $daysCredited = (int)$inv['days_credited'];
            $remainingDays = max(0, $durationDays - $daysCredited);
            $actualDays = min($daysDue, $remainingDays);

            if ($actualDays <= 0) {
                $doneStmt = $pdo->prepare("UPDATE user_investments SET status = 'completed' WHERE id = :id");
                $doneStmt->execute([':id' => $inv['id']]);
                continue;
            }

            $payout = $actualDays * (int)$inv['daily_return_rwf'];
            $newDaysCredited = $daysCredited + $actualDays;
            $newStatus = $newDaysCredited >= $durationDays ? 'completed' : 'active';
            $nextCreditedAt = date('Y-m-d H:i:s', $lastTs + ($actualDays * 86400));

            $updUser = $pdo->prepare(
                'UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + :amt WHERE id = :uid'
            );
            $updUser->execute([
                ':amt' => $payout,
                ':uid' => $inv['user_id'],
            ]);

            $updInv = $pdo->prepare(
                'UPDATE user_investments
                 SET total_earned_rwf = total_earned_rwf + :payout,
                     days_credited = :days_credited,
                     last_roi_credited_at = :next_at,
                     status = :status
                 WHERE id = :id'
            );
            $updInv->execute([
                ':payout' => $payout,
                ':days_credited' => $newDaysCredited,
                ':next_at' => $nextCreditedAt,
                ':status' => $newStatus,
                ':id' => $inv['id'],
            ]);

            log_transaction(
                $pdo,
                (int)$inv['user_id'],
                'Daily Plan Return (' . $inv['plan_name'] . ' x ' . $actualDays . 'd)',
                'Investment ROI',
                'Automated 24h Yield Engine',
                (float)$payout,
                'credit',
                'Completed',
                0.0,
                'ROI'
            );

            $creditedCount++;
        }

        $pdo->commit();
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('ROI Engine error: ' . $ex->getMessage());
    }
    return $creditedCount;
}
