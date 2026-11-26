<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function investment_plan_tiers(): array {
    return [
        ['id' => 'plan-500', 'name' => 'Starter 500 Plan', 'depositRwf' => 500, 'dailyReturnRwf' => 20, 'durationDays' => 60],
        ['id' => 'plan-1000', 'name' => 'Micro 1,000 Plan', 'depositRwf' => 1000, 'dailyReturnRwf' => 50, 'durationDays' => 60],
        ['id' => 'plan-1500', 'name' => 'Basic 1,500 Plan', 'depositRwf' => 1500, 'dailyReturnRwf' => 70, 'durationDays' => 60],
        ['id' => 'plan-2000', 'name' => 'Growth 2,000 Plan', 'depositRwf' => 2000, 'dailyReturnRwf' => 100, 'durationDays' => 60],
        ['id' => 'plan-3000', 'name' => 'Builder 3,000 Plan', 'depositRwf' => 3000, 'dailyReturnRwf' => 200, 'durationDays' => 60],
        ['id' => 'plan-5000', 'name' => 'Silver 5,000 Plan', 'depositRwf' => 5000, 'dailyReturnRwf' => 400, 'durationDays' => 60],
        ['id' => 'plan-8000', 'name' => 'Gold 8,000 Plan', 'depositRwf' => 8000, 'dailyReturnRwf' => 700, 'durationDays' => 60],
        ['id' => 'plan-10000', 'name' => 'Platinum 10,000 Plan', 'depositRwf' => 10000, 'dailyReturnRwf' => 1000, 'durationDays' => 60],
        ['id' => 'plan-15000', 'name' => 'Executive 15,000 Plan', 'depositRwf' => 15000, 'dailyReturnRwf' => 1600, 'durationDays' => 60],
        ['id' => 'plan-20000', 'name' => 'Premier 20,000 Plan', 'depositRwf' => 20000, 'dailyReturnRwf' => 2200, 'durationDays' => 60],
    ];
}

function safe_json_decode(?string $raw, $fallback) {
    if ($raw === null || $raw === '') {
        return $fallback;
    }
    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return $fallback;
    }
    return $decoded;
}

function json_response(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function get_json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function map_user_row(array $row): array {
    $education = safe_json_decode($row['education'] ?? null, [
        'type' => 'University',
        'institutionName' => '',
        'levelOrClass' => '',
        'facultyOrCombination' => '',
    ]);
    $residence = safe_json_decode($row['residence'] ?? null, [
        'placeOfBirth' => '',
    ]);
    $kycData = !empty($row['kyc_data']) ? safe_json_decode((string)$row['kyc_data'], null) : null;

    $out = [
        'id' => (string)$row['id'],
        'firstName' => (string)$row['first_name'],
        'secondName' => (string)$row['second_name'],
        'email' => (string)$row['email'],
        'phone' => (string)$row['phone'],
        'gender' => (string)$row['gender'],
        'dateOfBirth' => (string)$row['date_of_birth'],
        'idNumber' => (string)$row['id_number'],
        'photoDataUrl' => (string)$row['photo_data_url'],
        'education' => $education,
        'residence' => $residence,
        'passwordHash' => '',
        'accountNumber' => (string)$row['account_number'],
        'referralCode' => (string)$row['referral_code'],
        'spinCredits' => (int)($row['spin_credits'] ?? 0),
        'hasCompletedFirstWithdrawal' => (bool)((int)($row['has_completed_first_withdrawal'] ?? 0)),
        'accountStatus' => (string)$row['account_status'],
        'walletBalanceRwf' => (float)($row['wallet_balance_rwf'] ?? 0),
        'bonusBalanceRwf' => (float)($row['bonus_balance_rwf'] ?? 0),
        'savingsBalanceRwf' => (float)($row['savings_balance_rwf'] ?? 0),
        'walletBalanceUsd' => (float)($row['wallet_balance_usd'] ?? 0),
        'usdtBalance' => (float)($row['usdt_balance'] ?? 0),
        'usdtSavingsBalance' => (float)($row['usdt_savings_balance'] ?? 0),
        'lastCheckInAt' => !empty($row['last_check_in_at']) ? (string)$row['last_check_in_at'] : null,
        'checkInStreak' => (int)($row['check_in_streak'] ?? 0),
        'kycStatus' => (string)$row['kyc_status'],
        'createdAt' => (string)$row['created_at'],
    ];

    if (!empty($row['referred_by_user_id'])) {
        $out['referredByUserId'] = (string)$row['referred_by_user_id'];
    }
    if (!empty($row['activation_payment_ref'])) {
        $out['activationPaymentRef'] = (string)$row['activation_payment_ref'];
    }
    if (!empty($row['activation_paid_phone'])) {
        $out['activationPaidPhone'] = (string)$row['activation_paid_phone'];
    }
    if ($kycData !== null) {
        $out['kycData'] = $kycData;
    }

    return $out;
}

function map_savings_goal_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'title' => (string)$row['title'],
        'planType' => (string)$row['plan_type'],
        'targetRwf' => (float)($row['target_rwf'] ?? 0),
        'currentRwf' => (float)($row['current_rwf'] ?? 0),
        'targetDate' => (string)$row['target_date'],
        'createdAt' => (string)$row['created_at'],
    ];
}

function map_loan_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'userName' => (string)$row['user_name'],
        'product' => (string)$row['product'],
        'reason' => (string)$row['reason'],
        'principalRwf' => (float)($row['principal_rwf'] ?? 0),
        'termMonths' => (int)($row['term_months'] ?? 1),
        'annualRatePercent' => (float)($row['annual_rate_percent'] ?? 0),
        'monthlyPaymentRwf' => (float)($row['monthly_payment_rwf'] ?? 0),
        'totalRepayableRwf' => (float)($row['total_repayable_rwf'] ?? 0),
        'repaidRwf' => (float)($row['repaid_rwf'] ?? 0),
        'status' => (string)$row['status'],
        'createdAt' => (string)$row['created_at'],
    ];
}

function map_investment_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'userName' => (string)$row['user_name'],
        'tierId' => (string)$row['tier_id'],
        'planName' => (string)$row['plan_name'],
        'depositRwf' => (float)($row['deposit_rwf'] ?? 0),
        'dailyReturnRwf' => (float)($row['daily_return_rwf'] ?? 0),
        'paymentCode' => (string)$row['payment_code'],
        'paymentRef' => (string)$row['payment_ref'],
        'status' => (string)$row['status'],
        'totalEarnedRwf' => (float)($row['total_earned_rwf'] ?? 0),
        'lastRoiCreditedAt' => !empty($row['last_roi_credited_at']) ? (string)$row['last_roi_credited_at'] : null,
        'createdAt' => (string)$row['created_at'],
    ];
}

function map_spin_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'rewardRwf' => (float)($row['reward_rwf'] ?? 0),
        'spunAt' => (string)$row['spun_at'],
    ];
}

function map_withdrawal_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'userName' => (string)$row['user_name'],
        'network' => (string)$row['network'],
        'destinationType' => (string)$row['destination_type'],
        'destinationValue' => (string)$row['destination_value'],
        'accountRegisteredNames' => (string)$row['account_registered_names'],
        'grossAmountRwf' => (float)($row['gross_amount_rwf'] ?? 0),
        'feePercent' => (float)($row['fee_percent'] ?? 0),
        'feeRwf' => (float)($row['fee_rwf'] ?? 0),
        'netAmountRwf' => (float)($row['net_amount_rwf'] ?? 0),
        'isFirstBonusWithdrawal' => (bool)((int)($row['is_first_bonus_withdrawal'] ?? 0)),
        'status' => (string)$row['status'],
        'createdAt' => (string)$row['created_at'],
    ];
}

function map_video_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'creatorId' => (string)$row['creator_id'],
        'creatorName' => (string)$row['creator_name'],
        'title' => (string)$row['title'],
        'description' => (string)$row['description'],
        'videoUrl' => (string)$row['video_url'],
        'rewardPerViewRwf' => (float)($row['reward_per_view_rwf'] ?? 0),
        'targetViewers' => (int)($row['target_viewers'] ?? 0),
        'totalBudgetRwf' => (float)($row['total_budget_rwf'] ?? 0),
        'paymentCode' => (string)$row['payment_code'],
        'paymentRef' => (string)$row['payment_ref'],
        'watchedByUserIds' => safe_json_decode((string)($row['watched_by_user_ids'] ?? '[]'), []),
        'status' => (string)$row['status'],
        'createdAt' => (string)$row['created_at'],
    ];
}

function map_task_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'creatorId' => (string)$row['creator_id'],
        'creatorName' => (string)$row['creator_name'],
        'title' => (string)$row['title'],
        'requirements' => (string)$row['requirements'],
        'rewardPerCompletionRwf' => (float)($row['reward_per_completion_rwf'] ?? 0),
        'targetCompletions' => (int)($row['target_completions'] ?? 0),
        'totalBudgetRwf' => (float)($row['total_budget_rwf'] ?? 0),
        'paymentCode' => (string)$row['payment_code'],
        'paymentRef' => (string)$row['payment_ref'],
        'approvedWorkerIds' => safe_json_decode((string)($row['approved_worker_ids'] ?? '[]'), []),
        'status' => (string)$row['status'],
        'createdAt' => (string)$row['created_at'],
    ];
}

function map_submission_row(array $row): array {
    $out = [
        'id' => (string)$row['id'],
        'taskId' => (string)$row['task_id'],
        'taskTitle' => (string)$row['task_title'],
        'workerId' => (string)$row['worker_id'],
        'workerName' => (string)$row['worker_name'],
        'proofText' => (string)$row['proof_text'],
        'rewardRwf' => (float)($row['reward_rwf'] ?? 0),
        'status' => (string)$row['status'],
        'submittedAt' => (string)$row['submitted_at'],
    ];
    if (!empty($row['proof_url'])) {
        $out['proofUrl'] = (string)$row['proof_url'];
    }
    if (!empty($row['admin_note'])) {
        $out['adminNote'] = (string)$row['admin_note'];
    }
    if (!empty($row['reviewed_at'])) {
        $out['reviewedAt'] = (string)$row['reviewed_at'];
    }
    return $out;
}

function map_bet_session_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'userName' => (string)$row['user_name'],
        'category' => (string)$row['category'],
        'stakeRwf' => (float)($row['stake_rwf'] ?? 0),
        'questionsAnswered' => (int)($row['questions_answered'] ?? 0),
        'multiplier' => (float)($row['multiplier'] ?? 0),
        'payoutRwf' => (float)($row['payout_rwf'] ?? 0),
        'status' => (string)$row['status'],
        'endedReason' => (string)$row['ended_reason'],
        'createdAt' => (string)$row['created_at'],
    ];
}

function map_airtime_row(array $row): array {
    $out = [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'userName' => (string)$row['user_name'],
        'network' => (string)$row['network'],
        'serviceType' => (string)$row['service_type'],
        'phoneNumber' => (string)$row['phone_number'],
        'amountRwf' => (float)($row['amount_rwf'] ?? 0),
        'status' => (string)$row['status'],
        'createdAt' => (string)$row['created_at'],
    ];
    if (!empty($row['bundle_label'])) {
        $out['bundleLabel'] = (string)$row['bundle_label'];
    }
    if (!empty($row['admin_note'])) {
        $out['adminNote'] = (string)$row['admin_note'];
    }
    if (!empty($row['updated_at'])) {
        $out['updatedAt'] = (string)$row['updated_at'];
    }
    return $out;
}

function map_p2p_row(array $row): array {
    $out = [
        'id' => (string)$row['id'],
        'senderId' => (string)$row['sender_id'],
        'senderName' => (string)$row['sender_name'],
        'senderAddress' => (string)$row['sender_address'],
        'receiverId' => (string)$row['receiver_id'],
        'receiverName' => (string)$row['receiver_name'],
        'receiverAddress' => (string)$row['receiver_address'],
        'grossAmountRwf' => (float)($row['gross_amount_rwf'] ?? 0),
        'taxPercent' => (float)($row['tax_percent'] ?? 10),
        'taxRwf' => (float)($row['tax_rwf'] ?? 0),
        'netAmountRwf' => (float)($row['net_amount_rwf'] ?? 0),
        'status' => 'completed',
        'claimedByReceiver' => (bool)((int)($row['claimed_by_receiver'] ?? 1)),
        'createdAt' => (string)$row['created_at'],
    ];
    if (!empty($row['note'])) {
        $out['note'] = (string)$row['note'];
    }
    return $out;
}

function map_fx_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'userName' => (string)$row['user_name'],
        'direction' => (string)$row['direction'],
        'fromAmount' => (float)($row['from_amount'] ?? 0),
        'toAmount' => (float)($row['to_amount'] ?? 0),
        'rateApplied' => (float)($row['rate_applied'] ?? 1),
        'createdAt' => (string)$row['created_at'],
    ];
}

function map_usdt_row(array $row): array {
    $out = [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'userName' => (string)$row['user_name'],
        'actionType' => (string)$row['action_type'],
        'amountUsdt' => (float)($row['amount_usdt'] ?? 0),
        'network' => (string)$row['network'],
        'destinationOrTxRef' => (string)$row['destination_or_tx_ref'],
        'status' => (string)$row['status'],
        'createdAt' => (string)$row['created_at'],
    ];
    if (!empty($row['note'])) {
        $out['note'] = (string)$row['note'];
    }
    if (!empty($row['admin_note'])) {
        $out['adminNote'] = (string)$row['admin_note'];
    }
    if (!empty($row['updated_at'])) {
        $out['updatedAt'] = (string)$row['updated_at'];
    }
    return $out;
}

function map_transaction_row(array $row): array {
    $out = [
        'id' => (string)$row['id'],
        'userId' => (string)$row['user_id'],
        'reference' => (string)$row['reference'],
        'title' => (string)$row['title'],
        'category' => (string)$row['category'],
        'channel' => (string)$row['channel'],
        'amountRwf' => (float)($row['amount_rwf'] ?? 0),
        'direction' => (string)$row['direction'],
        'status' => (string)$row['status'],
        'timestamp' => (string)$row['timestamp'],
    ];
    if ($row['fee_rwf'] !== null && $row['fee_rwf'] !== '') {
        $out['feeRwf'] = (float)$row['fee_rwf'];
    }
    return $out;
}

function map_promotion_row(array $row): array {
    return [
        'id' => (string)$row['id'],
        'title' => (string)$row['title'],
        'summary' => (string)$row['summary'],
        'category' => (string)$row['category'],
        'active' => (bool)((int)($row['active'] ?? 0)),
        'createdAt' => (string)$row['created_at'],
    ];
}

function get_platform_settings(): array {
    $defaults = efinance_default_settings();
    $row = db_query_one("SELECT `data` FROM `settings` WHERE `key` = ?", ['platform']);
    if (!$row) {
        return $defaults;
    }
    $parsed = safe_json_decode((string)$row['data'], []);
    if (!is_array($parsed)) {
        return $defaults;
    }
    return array_merge($defaults, $parsed);
}

function insert_transaction(array $tx): void {
    db_execute(
        "INSERT INTO `transactions` (`id`, `user_id`, `reference`, `title`, `category`, `channel`, `amount_rwf`, `fee_rwf`, `direction`, `status`, `timestamp`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            $tx['id'],
            $tx['userId'],
            $tx['reference'],
            $tx['title'],
            $tx['category'],
            $tx['channel'],
            $tx['amountRwf'],
            $tx['feeRwf'] ?? null,
            $tx['direction'],
            $tx['status'],
            $tx['timestamp'],
        ]
    );
}

function build_ussd_code(string $payCode, float $amountRwf): string {
    $cleanCode = preg_replace('/[^0-9*#]/', '', $payCode) ?? '';
    $cleanCode = rtrim($cleanCode, '#');
    $rounded = (int)round($amountRwf);
    if (strpos($cleanCode, '*182*8*1*') === 0) {
        return $cleanCode . '*' . $rounded . '#';
    }
    return '*182*8*1*' . $cleanCode . '*' . $rounded . '#';
}

function process_due_investment_roi(?string $scopeUserId = null): void {
    $activeRows = $scopeUserId !== null
        ? db_query_all("SELECT * FROM `investments` WHERE `status` = 'active' AND `user_id` = ?", [$scopeUserId])
        : db_query_all("SELECT * FROM `investments` WHERE `status` = 'active'");

    if (count($activeRows) === 0) {
        return;
    }

    $tiersById = [];
    foreach (investment_plan_tiers() as $t) {
        $tiersById[$t['id']] = $t;
    }

    $nowSec = time();
    $daySec = 86400;

    foreach ($activeRows as $row) {
        $inv = map_investment_row($row);
        if (empty($inv['lastRoiCreditedAt'])) {
            continue;
        }
        $lastSec = strtotime((string)$inv['lastRoiCreditedAt']);
        if ($lastSec === false) {
            continue;
        }

        $daysDue = (int)floor(($nowSec - $lastSec) / $daySec);
        if ($daysDue < 1) {
            continue;
        }

        $tier = $tiersById[$inv['tierId']] ?? null;
        $durationDays = $tier ? (int)$tier['durationDays'] : 60;
        $maxTotal = $durationDays * $inv['dailyReturnRwf'];
        $daysCreditedSoFar = $inv['dailyReturnRwf'] > 0
            ? (int)floor($inv['totalEarnedRwf'] / $inv['dailyReturnRwf'])
            : 0;
        $remainingDays = max(0, $durationDays - $daysCreditedSoFar);
        $actualDays = min($daysDue, $remainingDays);
        $nowIso = utcIsoNow();

        if ($actualDays <= 0) {
            db_execute("UPDATE `investments` SET `status` = 'completed', `updated_at` = ? WHERE `id` = ?", [$nowIso, $inv['id']]);
            continue;
        }

        $payout = $actualDays * $inv['dailyReturnRwf'];
        $nextEarned = min($maxTotal, $inv['totalEarnedRwf'] + $payout);
        $completed = $nextEarned >= $maxTotal;
        $creditIso = utcIsoFromTimestamp($lastSec + ($actualDays * $daySec));

        db_execute(
            "UPDATE `investments` SET `total_earned_rwf` = ?, `last_roi_credited_at` = ?, `status` = ?, `updated_at` = ? WHERE `id` = ?",
            [$nextEarned, $creditIso, $completed ? 'completed' : 'active', $nowIso, $inv['id']]
        );
        db_execute(
            "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
            [$payout, $nowIso, $inv['userId']]
        );

        insert_transaction([
            'id' => generateSafeId('tx-roi'),
            'userId' => $inv['userId'],
            'reference' => generateReference('ROI'),
            'title' => "Daily Plan Return ({$inv['planName']} × {$actualDays}d)",
            'category' => 'Investment ROI',
            'channel' => 'Automated 24h Yield Engine',
            'amountRwf' => $payout,
            'direction' => 'credit',
            'status' => 'Completed',
            'timestamp' => $creditIso,
        ]);
    }
}

function get_bearer_token(): ?string {
    $candidates = [];
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $candidates[] = (string)$_SERVER['HTTP_AUTHORIZATION'];
    }
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $candidates[] = (string)$_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('getallheaders')) {
        $hdrs = getallheaders();
        if (is_array($hdrs)) {
            foreach ($hdrs as $k => $v) {
                $lk = strtolower((string)$k);
                if ($lk === 'authorization') {
                    $candidates[] = (string)$v;
                } elseif ($lk === 'x-auth-token' && trim((string)$v) !== '') {
                    return trim((string)$v);
                }
            }
        }
    }
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return trim((string)$_SERVER['HTTP_X_AUTH_TOKEN']);
    }

    foreach ($candidates as $header) {
        $trimmed = trim($header);
        if (stripos($trimmed, 'Bearer ') === 0) {
            $token = trim(substr($trimmed, 7));
            if ($token !== '') {
                return $token;
            }
        }
    }

    return null;
}

function create_session(string $role, ?string $userId, string $email): string {
    $token = generateSessionToken();
    $nowIso = utcIsoNow();
    $expiresIso = utcIsoFromTimestamp(time() + (7 * 24 * 60 * 60));

    db_execute(
        "INSERT INTO `sessions` (`token`, `role`, `user_id`, `email`, `expires_at`, `created_at`) VALUES (?, ?, ?, ?, ?, ?)",
        [$token, $role, $userId, $email, $expiresIso, $nowIso]
    );
    db_execute("DELETE FROM `sessions` WHERE `expires_at` < ?", [$nowIso]);

    return $token;
}

function resolve_session(): ?array {
    $token = get_bearer_token();
    if ($token === null) {
        return null;
    }

    $row = db_query_one(
        "SELECT `token`, `role`, `user_id`, `email`, `expires_at` FROM `sessions` WHERE `token` = ?",
        [$token]
    );
    if (!$row) {
        return null;
    }

    if (strtotime((string)$row['expires_at']) < time()) {
        db_execute("DELETE FROM `sessions` WHERE `token` = ?", [$token]);
        return null;
    }

    return [
        'token' => (string)$row['token'],
        'role' => (string)$row['role'],
        'userId' => !empty($row['user_id']) ? (string)$row['user_id'] : null,
        'email' => (string)$row['email'],
    ];
}

function require_member(): array {
    $auth = resolve_session();
    if (!$auth || $auth['role'] !== 'user' || empty($auth['userId'])) {
        json_response(['error' => 'Authentication required. Please sign in again.'], 401);
    }

    $userRow = db_query_one("SELECT `id`, `account_status` FROM `users` WHERE `id` = ?", [$auth['userId']]);
    if (!$userRow) {
        json_response(['error' => 'Account not found.'], 401);
    }
    if ((string)$userRow['account_status'] === 'suspended') {
        json_response(['error' => 'Your account has been suspended by E-Finance Admin.'], 403);
    }

    return $auth;
}

function require_admin(): array {
    $auth = resolve_session();
    if (!$auth || $auth['role'] !== 'admin') {
        json_response(['error' => 'Administrator authorization required.'], 403);
    }
    return $auth;
}
