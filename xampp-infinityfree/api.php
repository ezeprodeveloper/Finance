<?php
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/config/helpers.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-HTTP-Method-Override');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

$rawMethod = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($rawMethod === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $rawMethod;
if ($rawMethod === 'POST') {
    $override = strtoupper((string)($_GET['_method'] ?? $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? ''));
    if (in_array($override, ['PUT', 'DELETE', 'PATCH'], true)) {
        $method = $override;
    }
}

$route = (string)($_GET['route'] ?? '');
if ($route === '' && !empty($_SERVER['PATH_INFO'])) {
    $route = (string)$_SERVER['PATH_INFO'];
}
if ($route === '') {
    $uriPath = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    $pos = strpos($uriPath, '/api/');
    if ($pos !== false) {
        $route = substr($uriPath, $pos);
    }
}
$route = '/' . ltrim(trim($route), '/');

try {
    // 1. Health & Setup Status
    if ($method === 'GET' && $route === '/api/health') {
        $dbStatus = check_database_status();
        if (!$dbStatus['connected']) {
            json_response([
                'ok' => false,
                'connected' => false,
                'engine' => 'mysql',
                'error' => $dbStatus['error'],
                'setupRequired' => !empty($dbStatus['setupRequired']),
            ], 503);
        }
        json_response([
            'ok' => true,
            'connected' => true,
            'engine' => 'mysql',
            'migrationsApplied' => $dbStatus['migrationSummary']['appliedVersions'] ?? [],
        ]);
    }

    if ($method === 'GET' && $route === '/api/setup/status') {
        $dbStatus = check_database_status();
        if (!$dbStatus['connected']) {
            json_response([
                'dbReady' => false,
                'engine' => 'mysql',
                'error' => $dbStatus['error'],
                'setupRequired' => !empty($dbStatus['setupRequired']),
                'adminConfigured' => false,
                'migrationsApplied' => [],
                'newlyApplied' => [],
            ]);
        }

        $adminConfigured = efinance_get_admin_passcode() !== '';
        if (!$adminConfigured) {
            $credRow = db_query_one("SELECT `id` FROM `admin_credentials` WHERE `id` = ?", ['primary']);
            $adminConfigured = $credRow !== null;
        }

        $summary = $dbStatus['migrationSummary'] ?? [];
        json_response([
            'dbReady' => true,
            'engine' => 'mysql',
            'error' => null,
            'adminConfigured' => $adminConfigured,
            'migrationsApplied' => $summary['appliedVersions'] ?? [],
            'newlyApplied' => $summary['newlyApplied'] ?? [],
            'alreadyInitialized' => $summary['alreadyInitialized'] ?? false,
        ]);
    }

    // Ensure DB & pending migrations are ready for all remaining routes
    get_pdo();

    // 2. Public Bootstrap
    if ($method === 'GET' && $route === '/api/public/bootstrap') {
        $settings = get_platform_settings();
        $promoRows = db_query_all("SELECT * FROM `promotions` WHERE `active` = 1 ORDER BY `created_at` DESC");
        $vidCountRow = db_query_one("SELECT COUNT(*) AS cnt FROM `video_campaigns` WHERE `status` = 'active'");
        $taskCountRow = db_query_one("SELECT COUNT(*) AS cnt FROM `custom_tasks` WHERE `status` = 'active'");

        json_response([
            'settings' => $settings,
            'promotions' => array_map('map_promotion_row', $promoRows),
            'totalActiveVideos' => (int)($vidCountRow['cnt'] ?? 0),
            'totalActiveTasks' => (int)($taskCountRow['cnt'] ?? 0),
        ]);
    }

    // 3. Auth Endpoints
    if ($method === 'GET' && $route === '/api/auth/admin-status') {
        $envPass = efinance_get_admin_passcode();
        $row = db_query_one("SELECT `id` FROM `admin_credentials` WHERE `id` = ?", ['primary']);
        json_response([
            'adminEmail' => EFINANCE_ADMIN_EMAIL,
            'configured' => $envPass !== '' || $row !== null,
        ]);
    }

    if ($method === 'POST' && $route === '/api/auth/admin-claim') {
        $body = get_json_body();
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        $expectedEmail = EFINANCE_ADMIN_EMAIL;

        if ($email !== $expectedEmail) {
            json_response(['error' => 'Unauthorized email for administrator bootstrap.'], 403);
        }
        if (strlen($password) < 6) {
            json_response(['error' => 'Administrator password must be at least 6 characters.'], 400);
        }
        if (efinance_get_admin_passcode() !== '') {
            json_response(['error' => 'Administrator passcode is already configured via environment secret.'], 409);
        }
        $existing = db_query_one("SELECT `id` FROM `admin_credentials` WHERE `id` = ?", ['primary']);
        if ($existing) {
            json_response(['error' => 'Administrator password is already claimed. Sign in normally.'], 409);
        }

        $nowIso = utcIsoNow();
        $hash = hashSecret($password);
        db_execute(
            "INSERT INTO `admin_credentials` (`id`, `email`, `password_hash`, `created_at`) VALUES (?, ?, ?, ?)",
            ['primary', $expectedEmail, $hash, $nowIso]
        );
        $token = create_session('admin', null, $expectedEmail);
        json_response(['token' => $token, 'role' => 'admin']);
    }

    if ($method === 'POST' && $route === '/api/auth/login') {
        $body = get_json_body();
        $identifier = trim((string)($body['identifier'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $normalized = strtolower($identifier);

        if ($identifier === '' || $password === '') {
            json_response(['error' => 'Enter your email or phone number and password.'], 400);
        }

        if ($normalized === EFINANCE_ADMIN_EMAIL) {
            $envPass = efinance_get_admin_passcode();
            if ($envPass !== '') {
                if (!constantTimeEqual($password, $envPass)) {
                    json_response(['error' => 'Invalid email/phone or password.'], 401);
                }
                $token = create_session('admin', null, EFINANCE_ADMIN_EMAIL);
                json_response(['token' => $token, 'role' => 'admin']);
            }

            $credRow = db_query_one("SELECT `password_hash` FROM `admin_credentials` WHERE `id` = ?", ['primary']);
            if (!$credRow) {
                json_response([
                    'needsAdminSetup' => true,
                    'error' => 'First-run setup: create your administrator password to lock the Admin account.',
                ], 428);
            }
            if (!verifySecret($password, (string)$credRow['password_hash'])) {
                json_response(['error' => 'Invalid email/phone or password.'], 401);
            }
            $token = create_session('admin', null, EFINANCE_ADMIN_EMAIL);
            json_response(['token' => $token, 'role' => 'admin']);
        }

        $variants = getRwandaPhoneVariants($identifier);
        $pv0 = $variants[0] ?? $normalized;
        $pv1 = $variants[1] ?? $pv0;
        $pv2 = $variants[2] ?? $pv0;
        $pv3 = $variants[3] ?? $pv0;

        $userRow = db_query_one(
            "SELECT * FROM `users`
             WHERE LOWER(`email`) = ?
                OR REPLACE(REPLACE(`phone`, ' ', ''), '-', '') IN (?, ?, ?, ?)
             LIMIT 1",
            [$normalized, $pv0, $pv1, $pv2, $pv3]
        );
        if (!$userRow) {
            json_response(['error' => 'No matching account found, or incorrect password.'], 401);
        }
        if (!verifySecret($password, (string)($userRow['password_hash'] ?? ''))) {
            json_response(['error' => 'Incorrect password. Please check and try again.'], 401);
        }

        $user = map_user_row($userRow);
        if ($user['accountStatus'] === 'suspended') {
            json_response(['error' => 'This account has been suspended by E-Finance Admin.'], 403);
        }

        $token = create_session('user', $user['id'], $user['email']);
        json_response(['token' => $token, 'role' => 'user', 'user' => $user]);
    }

    if ($method === 'POST' && $route === '/api/auth/register') {
        $body = get_json_body();
        $firstName = trim((string)($body['firstName'] ?? ''));
        $secondName = trim((string)($body['secondName'] ?? ''));
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $phone = trim((string)($body['phone'] ?? ''));
        $gender = (string)($body['gender'] ?? 'Male');
        $dateOfBirth = trim((string)($body['dateOfBirth'] ?? ''));
        $idNumber = preg_replace('/\s+/', '', (string)($body['idNumber'] ?? '')) ?? '';
        $photoDataUrl = (string)($body['photoDataUrl'] ?? '');
        $education = $body['education'] ?? [];
        $residence = $body['residence'] ?? [];
        $password = (string)($body['rawPassword'] ?? '');
        $referralCodeInput = strtoupper(trim((string)($body['referralCodeInput'] ?? '')));

        if (strlen($firstName) < 2 || strlen($secondName) < 2) {
            json_response(['error' => 'Enter both first name and second name.'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_response(['error' => 'Enter a valid email address.'], 400);
        }
        if (!isValidRwandaPhone($phone)) {
            json_response(['error' => 'Enter a valid Rwanda phone number.'], 400);
        }
        if (!isValidRwandaId($idNumber)) {
            json_response(['error' => 'Enter a valid 16-digit Rwanda National ID number.'], 400);
        }
        if (strpos($photoDataUrl, 'data:image/') !== 0) {
            json_response(['error' => 'Upload a valid profile photo.'], 400);
        }
        if (strlen($password) < 8) {
            json_response(['error' => 'Password must be at least 8 characters.'], 400);
        }
        if ($email === EFINANCE_ADMIN_EMAIL) {
            json_response(['error' => 'This email address is reserved.'], 400);
        }

        $variants = getRwandaPhoneVariants($phone);
        $cleanRaw = preg_replace('/[\s\-]/', '', $phone) ?? $phone;
        $rv0 = $variants[0] ?? $cleanRaw;
        $rv1 = $variants[1] ?? $rv0;
        $rv2 = $variants[2] ?? $rv0;
        $rv3 = $variants[3] ?? $rv0;

        $dup = db_query_one(
            "SELECT `email`, `id_number` FROM `users`
             WHERE LOWER(`email`) = ?
                OR REPLACE(REPLACE(`phone`, ' ', ''), '-', '') IN (?, ?, ?, ?)
                OR `id_number` = ?
             LIMIT 1",
            [$email, $rv0, $rv1, $rv2, $rv3, $idNumber]
        );
        if ($dup) {
            if (strtolower((string)$dup['email']) === $email) {
                json_response(['error' => 'An account with this email already exists. Please sign in.'], 409);
            }
            if ((string)$dup['id_number'] === $idNumber) {
                json_response(['error' => 'An account with this Rwanda National ID already exists.'], 409);
            }
            json_response(['error' => 'An account with this phone number already exists.'], 409);
        }

        $referredByUserId = null;
        if ($referralCodeInput !== '') {
            $refRow = db_query_one("SELECT `id` FROM `users` WHERE UPPER(`referral_code`) = ? LIMIT 1", [$referralCodeInput]);
            if ($refRow) {
                $referredByUserId = (string)$refRow['id'];
            }
        }

        $id = generateSafeId('usr');
        $nowIso = utcIsoNow();
        $accountNumber = generateAccountNumber();
        $referralCode = generateReferralCode($firstName);
        $passwordHash = hashSecret($password);

        db_execute(
            "INSERT INTO `users` (
                `id`, `first_name`, `second_name`, `email`, `phone`, `gender`, `date_of_birth`, `id_number`,
                `photo_data_url`, `education`, `residence`, `password_hash`, `account_number`, `referral_code`,
                `referred_by_user_id`, `spin_credits`, `has_completed_first_withdrawal`, `account_status`,
                `wallet_balance_rwf`, `bonus_balance_rwf`, `savings_balance_rwf`, `wallet_balance_usd`,
                `usdt_balance`, `usdt_savings_balance`, `last_check_in_at`, `check_in_streak`, `kyc_status`,
                `created_at`, `updated_at`
             ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, 0, 0, 'pending_approval',
                0, 0, 0, 0,
                0, 0, NULL, 0, 'not_submitted',
                ?, ?
             )",
            [
                $id,
                $firstName,
                $secondName,
                $email,
                $phone,
                $gender,
                $dateOfBirth,
                $idNumber,
                substr($photoDataUrl, 0, 1500000),
                json_encode($education, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode($residence, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                $passwordHash,
                $accountNumber,
                $referralCode,
                $referredByUserId,
                $nowIso,
                $nowIso,
            ]
        );

        $createdRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$id]);
        $user = map_user_row($createdRow);
        $token = create_session('user', $user['id'], $user['email']);
        json_response(['token' => $token, 'role' => 'user', 'user' => $user], 201);
    }

    if ($method === 'POST' && $route === '/api/auth/logout') {
        $token = get_bearer_token();
        if ($token !== null) {
            db_execute("DELETE FROM `sessions` WHERE `token` = ?", [$token]);
        }
        json_response(['ok' => true]);
    }

    // 4. Member Endpoints
    if (strpos($route, '/api/member/') === 0) {
        $auth = require_member();
        $uid = (string)$auth['userId'];

        if ($method === 'GET' && $route === '/api/member/state') {
            process_due_investment_roi($uid);

            $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$uid]);
            if (!$userRow) {
                json_response(['error' => 'Account not found.'], 404);
            }

            $settings = get_platform_settings();
            $refCountRow = db_query_one(
                "SELECT COUNT(*) AS cnt FROM `users` WHERE `referred_by_user_id` = ? AND `account_status` = 'active'",
                [$uid]
            );
            $savingsRows = db_query_all("SELECT * FROM `savings_goals` WHERE `user_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $loanRows = db_query_all("SELECT * FROM `loans` WHERE `user_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $invRows = db_query_all("SELECT * FROM `investments` WHERE `user_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $spinRows = db_query_all("SELECT * FROM `spin_history` WHERE `user_id` = ? ORDER BY `spun_at` DESC", [$uid]);
            $wdRows = db_query_all("SELECT * FROM `withdrawals` WHERE `user_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $vidRows = db_query_all("SELECT * FROM `video_campaigns` WHERE `status` = 'active' OR `creator_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $taskRows = db_query_all("SELECT * FROM `custom_tasks` WHERE `status` = 'active' OR `creator_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $subRows = db_query_all("SELECT * FROM `task_submissions` WHERE `worker_id` = ? ORDER BY `submitted_at` DESC", [$uid]);
            $betRows = db_query_all("SELECT * FROM `bet_sessions` WHERE `user_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $airRows = db_query_all("SELECT * FROM `airtime_requests` WHERE `user_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $p2pRows = db_query_all("SELECT * FROM `p2p_transfers` WHERE `sender_id` = ? OR `receiver_id` = ? ORDER BY `created_at` DESC", [$uid, $uid]);
            $fxRows = db_query_all("SELECT * FROM `fx_exchanges` WHERE `user_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $usdtRows = db_query_all("SELECT * FROM `usdt_requests` WHERE `user_id` = ? ORDER BY `created_at` DESC", [$uid]);
            $txRows = db_query_all("SELECT * FROM `transactions` WHERE `user_id` = ? ORDER BY `timestamp` DESC", [$uid]);

            json_response([
                'user' => map_user_row($userRow),
                'referredUsersCount' => (int)($refCountRow['cnt'] ?? 0),
                'settings' => $settings,
                'savingsGoals' => array_map('map_savings_goal_row', $savingsRows),
                'loans' => array_map('map_loan_row', $loanRows),
                'investments' => array_map('map_investment_row', $invRows),
                'spinHistory' => array_map('map_spin_row', $spinRows),
                'withdrawals' => array_map('map_withdrawal_row', $wdRows),
                'videoCampaigns' => array_map('map_video_row', $vidRows),
                'customTasks' => array_map('map_task_row', $taskRows),
                'taskSubmissions' => array_map('map_submission_row', $subRows),
                'betSessions' => array_map('map_bet_session_row', $betRows),
                'airtimeRequests' => array_map('map_airtime_row', $airRows),
                'p2pTransfers' => array_map('map_p2p_row', $p2pRows),
                'fxExchanges' => array_map('map_fx_row', $fxRows),
                'usdtRequests' => array_map('map_usdt_row', $usdtRows),
                'transactions' => array_map('map_transaction_row', $txRows),
            ]);
        }

        if ($method === 'POST' && $route === '/api/member/activation') {
            $body = get_json_body();
            $phone = trim((string)($body['phone'] ?? ''));
            $ref = trim((string)($body['ref'] ?? ''));
            if ($phone === '' || strlen($ref) < 3) {
                json_response(['error' => 'Valid payment phone and Mobile Money reference required.'], 400);
            }
            $settings = get_platform_settings();
            $nowIso = utcIsoNow();
            db_execute(
                "UPDATE `users` SET `account_status` = 'payment_submitted', `activation_paid_phone` = ?, `activation_payment_ref` = ?, `updated_at` = ? WHERE `id` = ?",
                [$phone, $ref, $nowIso, $uid]
            );
            insert_transaction([
                'id' => generateSafeId('tx'),
                'userId' => $uid,
                'reference' => generateReference('ACT'),
                'title' => "System Activation Fee ({$settings['activationFeeRwf']} RWF)",
                'category' => 'Activation',
                'channel' => "{$settings['momoPayCode']}*{$settings['activationFeeRwf']}# · Ref {$ref}",
                'amountRwf' => $settings['activationFeeRwf'],
                'direction' => 'debit',
                'status' => 'Pending Review',
                'timestamp' => $nowIso,
            ]);
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/member/check-in') {
            $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$uid]);
            if (!$userRow) {
                json_response(['error' => 'User not found.'], 404);
            }
            $user = map_user_row($userRow);
            $nowSec = time();
            if (!empty($user['lastCheckInAt'])) {
                $lastSec = strtotime((string)$user['lastCheckInAt']);
                if ($lastSec !== false && ($nowSec - $lastSec) < 86400) {
                    json_response(['error' => 'Daily check-in already claimed within the last 24 hours.'], 400);
                }
            }
            $settings = get_platform_settings();
            $reward = $settings['dailyCheckInRwf'];
            $nowIso = utcIsoFromTimestamp($nowSec);

            db_execute(
                "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `last_check_in_at` = ?, `check_in_streak` = `check_in_streak` + 1, `updated_at` = ? WHERE `id` = ?",
                [$reward, $nowIso, $nowIso, $uid]
            );
            insert_transaction([
                'id' => generateSafeId('tx-chk'),
                'userId' => $uid,
                'reference' => generateReference('CHK'),
                'title' => 'Daily 24h Check-In Reward',
                'category' => 'Check-In',
                'channel' => 'E-Finance Daily Check-In',
                'amountRwf' => $reward,
                'direction' => 'credit',
                'status' => 'Completed',
                'timestamp' => $nowIso,
            ]);
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/member/kyc') {
            $data = get_json_body();
            if (empty($data) || !isValidRwandaId((string)($data['nationalId'] ?? '')) || !isValidRwandaPhone((string)($data['nextOfKinPhone'] ?? ''))) {
                json_response(['error' => 'Provide a valid 16-digit National ID and Next-of-Kin Rwanda phone.'], 400);
            }
            $nowIso = utcIsoNow();
            $data['nationalId'] = preg_replace('/\s+/', '', (string)$data['nationalId']) ?? '';
            $data['submittedAt'] = !empty($data['submittedAt']) ? (string)$data['submittedAt'] : $nowIso;
            db_execute(
                "UPDATE `users` SET `kyc_status` = 'pending', `kyc_data` = ?, `updated_at` = ? WHERE `id` = ?",
                [json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $nowIso, $uid]
            );
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/member/savings/goals') {
            $userRow = db_query_one("SELECT `kyc_status` FROM `users` WHERE `id` = ?", [$uid]);
            if (!$userRow || (string)$userRow['kyc_status'] !== 'approved') {
                json_response(['error' => 'Complete Rwanda KYC approval before creating savings goals.'], 403);
            }
            $body = get_json_body();
            $title = trim((string)($body['title'] ?? ''));
            $planType = (string)($body['planType'] ?? 'Flexible');
            $targetRwf = (float)($body['targetRwf'] ?? 0);
            $targetDate = (string)($body['targetDate'] ?? '');
            if (strlen($title) < 2 || !is_finite($targetRwf) || $targetRwf <= 0) {
                json_response(['error' => 'Provide a valid goal title and target amount.'], 400);
            }
            $nowIso = utcIsoNow();
            db_execute(
                "INSERT INTO `savings_goals` (`id`, `user_id`, `title`, `plan_type`, `target_rwf`, `current_rwf`, `target_date`, `created_at`, `updated_at`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [generateSafeId('sav'), $uid, $title, $planType, round($targetRwf), 0, $targetDate, $nowIso, $nowIso]
            );
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/member/savings/deposit') {
            $body = get_json_body();
            $goalId = (string)($body['goalId'] ?? '');
            $amountRwf = (int)round((float)($body['amountRwf'] ?? 0));

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                $goalRow = db_query_one("SELECT * FROM `savings_goals` WHERE `id` = ? AND `user_id` = ? FOR UPDATE", [$goalId, $uid]);
                if (!$userRow || !$goalRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Savings goal or account not found.'], 404);
                }
                $user = map_user_row($userRow);
                $goal = map_savings_goal_row($goalRow);
                if ($user['kycStatus'] !== 'approved') {
                    $pdo->rollBack();
                    json_response(['error' => 'KYC approval required.'], 403);
                }
                if ($amountRwf <= 0 || $amountRwf > $user['walletBalanceRwf']) {
                    $pdo->rollBack();
                    json_response(['error' => 'Invalid amount or insufficient wallet balance.'], 400);
                }
                $nowIso = utcIsoNow();
                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` - ?, `savings_balance_rwf` = `savings_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                    [$amountRwf, $amountRwf, $nowIso, $uid]
                );
                db_execute(
                    "UPDATE `savings_goals` SET `current_rwf` = `current_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                    [$amountRwf, $nowIso, $goalId]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-sav'),
                    'userId' => $uid,
                    'reference' => generateReference('SAV'),
                    'title' => "Saved to {$goal['title']}",
                    'category' => 'Savings',
                    'channel' => "Smart Savings · {$goal['planType']}",
                    'amountRwf' => $amountRwf,
                    'direction' => 'debit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/savings/withdraw') {
            $body = get_json_body();
            $goalId = (string)($body['goalId'] ?? '');
            $amountRwf = (int)round((float)($body['amountRwf'] ?? 0));

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                $goalRow = db_query_one("SELECT * FROM `savings_goals` WHERE `id` = ? AND `user_id` = ? FOR UPDATE", [$goalId, $uid]);
                if (!$userRow || !$goalRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Savings goal not found.'], 404);
                }
                $user = map_user_row($userRow);
                $goal = map_savings_goal_row($goalRow);
                if ($user['kycStatus'] !== 'approved') {
                    $pdo->rollBack();
                    json_response(['error' => 'KYC approval required.'], 403);
                }
                if ($amountRwf <= 0 || $amountRwf > $goal['currentRwf'] || $amountRwf > $user['savingsBalanceRwf']) {
                    $pdo->rollBack();
                    json_response(['error' => 'Amount exceeds savings balance.'], 400);
                }
                $nowIso = utcIsoNow();
                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `savings_balance_rwf` = CASE WHEN `savings_balance_rwf` - ? < 0 THEN 0 ELSE `savings_balance_rwf` - ? END, `updated_at` = ? WHERE `id` = ?",
                    [$amountRwf, $amountRwf, $amountRwf, $nowIso, $uid]
                );
                db_execute(
                    "UPDATE `savings_goals` SET `current_rwf` = `current_rwf` - ?, `updated_at` = ? WHERE `id` = ?",
                    [$amountRwf, $nowIso, $goalId]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-sav'),
                    'userId' => $uid,
                    'reference' => generateReference('SAV'),
                    'title' => "Moved from {$goal['title']} to Wallet",
                    'category' => 'Savings',
                    'channel' => 'Smart Savings Retrieval',
                    'amountRwf' => $amountRwf,
                    'direction' => 'credit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/loans/request') {
            $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$uid]);
            if (!$userRow) {
                json_response(['error' => 'User not found.'], 404);
            }
            $user = map_user_row($userRow);
            $body = get_json_body();
            $principalRwf = (int)round((float)($body['principalRwf'] ?? 0));
            $termMonths = max(1, (int)round((float)($body['termMonths'] ?? 1)));
            $annualRatePercent = (float)($body['annualRatePercent'] ?? 0);
            $monthlyPaymentRwf = (int)round((float)($body['monthlyPaymentRwf'] ?? 0));
            $totalRepayableRwf = (int)round((float)($body['totalRepayableRwf'] ?? 0));
            $product = trim((string)($body['product'] ?? ''));
            $reason = trim((string)($body['reason'] ?? ''));

            if ($principalRwf <= 0 || $product === '' || $reason === '') {
                json_response(['error' => 'Complete all loan fields.'], 400);
            }
            if ($user['savingsBalanceRwf'] <= $principalRwf) {
                json_response([
                    'error' => "Loan denied: Your savings balance ({$user['savingsBalanceRwf']} RWF) must be strictly greater than the requested loan ({$principalRwf} RWF).",
                ], 400);
            }
            $nowIso = utcIsoNow();
            db_execute(
                "INSERT INTO `loans` (`id`, `user_id`, `user_name`, `product`, `reason`, `principal_rwf`, `term_months`, `annual_rate_percent`, `monthly_payment_rwf`, `total_repayable_rwf`, `repaid_rwf`, `status`, `created_at`, `updated_at`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    generateSafeId('loan'),
                    $uid,
                    "{$user['firstName']} {$user['secondName']}",
                    $product,
                    $reason,
                    $principalRwf,
                    $termMonths,
                    $annualRatePercent,
                    $monthlyPaymentRwf,
                    $totalRepayableRwf,
                    0,
                    'pending_admin',
                    $nowIso,
                    $nowIso,
                ]
            );
            insert_transaction([
                'id' => generateSafeId('tx-ln'),
                'userId' => $uid,
                'reference' => generateReference('LN'),
                'title' => "Loan Request: {$product}",
                'category' => 'Loan',
                'channel' => "{$termMonths} months · {$reason}",
                'amountRwf' => $principalRwf,
                'direction' => 'credit',
                'status' => 'Pending Review',
                'timestamp' => $nowIso,
            ]);
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/member/loans/repay') {
            $body = get_json_body();
            $loanId = (string)($body['loanId'] ?? '');
            $amountRwf = (int)round((float)($body['amountRwf'] ?? 0));

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                $loanRow = db_query_one("SELECT * FROM `loans` WHERE `id` = ? AND `user_id` = ? FOR UPDATE", [$loanId, $uid]);
                if (!$userRow || !$loanRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Loan not found.'], 404);
                }
                $user = map_user_row($userRow);
                $loan = map_loan_row($loanRow);
                if ($amountRwf <= 0 || $amountRwf > $user['walletBalanceRwf']) {
                    $pdo->rollBack();
                    json_response(['error' => 'Insufficient wallet balance.'], 400);
                }
                $nowIso = utcIsoNow();
                $nextRepaid = $loan['repaidRwf'] + $amountRwf;
                $isFullyRepaid = $nextRepaid >= $loan['totalRepayableRwf'];

                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` - ?, `updated_at` = ? WHERE `id` = ?",
                    [$amountRwf, $nowIso, $uid]
                );
                db_execute(
                    "UPDATE `loans` SET `repaid_rwf` = ?, `status` = ?, `updated_at` = ? WHERE `id` = ?",
                    [$nextRepaid, $isFullyRepaid ? 'repaid' : $loan['status'], $nowIso, $loanId]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-rep'),
                    'userId' => $uid,
                    'reference' => generateReference('REP'),
                    'title' => "Loan Repayment: {$loan['product']}",
                    'category' => 'Loan',
                    'channel' => 'Wallet Repayment',
                    'amountRwf' => $amountRwf,
                    'direction' => 'debit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/investments/purchase') {
            $body = get_json_body();
            $tierId = (string)($body['tierId'] ?? '');
            $paymentRef = trim((string)($body['paymentRef'] ?? ''));

            $tier = null;
            foreach (investment_plan_tiers() as $t) {
                if ($t['id'] === $tierId) {
                    $tier = $t;
                    break;
                }
            }
            $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$uid]);
            if (!$tier || !$userRow || strlen($paymentRef) < 3) {
                json_response(['error' => 'Valid investment tier and payment reference required.'], 400);
            }
            $user = map_user_row($userRow);
            $settings = get_platform_settings();
            $payCode = build_ussd_code((string)$settings['momoPayCode'], (float)$tier['depositRwf']);
            $nowIso = utcIsoNow();

            db_execute(
                "INSERT INTO `investments` (`id`, `user_id`, `user_name`, `tier_id`, `plan_name`, `deposit_rwf`, `daily_return_rwf`, `payment_code`, `payment_ref`, `status`, `total_earned_rwf`, `last_roi_credited_at`, `created_at`, `updated_at`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    generateSafeId('inv'),
                    $uid,
                    "{$user['firstName']} {$user['secondName']}",
                    $tier['id'],
                    $tier['name'],
                    $tier['depositRwf'],
                    $tier['dailyReturnRwf'],
                    $payCode,
                    $paymentRef,
                    'pending_admin',
                    0,
                    null,
                    $nowIso,
                    $nowIso,
                ]
            );
            insert_transaction([
                'id' => generateSafeId('tx-inv'),
                'userId' => $uid,
                'reference' => generateReference('INV'),
                'title' => "Investment Plan Deposit: {$tier['name']}",
                'category' => 'Investment Deposit',
                'channel' => "{$payCode} · Ref {$paymentRef}",
                'amountRwf' => $tier['depositRwf'],
                'direction' => 'debit',
                'status' => 'Pending Review',
                'timestamp' => $nowIso,
            ]);
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/member/spin/complete') {
            $body = get_json_body();
            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                if (!$userRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'User not found.'], 404);
                }
                $user = map_user_row($userRow);
                if ($user['spinCredits'] <= 0) {
                    $pdo->rollBack();
                    json_response(['error' => 'No spin credits remaining.'], 400);
                }
                $safeReward = max(0, min(200, (int)round((float)($body['rewardRwf'] ?? 0))));
                $nowIso = utcIsoNow();

                db_execute(
                    "UPDATE `users` SET `spin_credits` = `spin_credits` - 1, `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ? AND `spin_credits` > 0",
                    [$safeReward, $nowIso, $uid]
                );
                db_execute(
                    "INSERT INTO `spin_history` (`id`, `user_id`, `reward_rwf`, `spun_at`) VALUES (?, ?, ?, ?)",
                    [generateSafeId('sp'), $uid, $safeReward, $nowIso]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-spn'),
                    'userId' => $uid,
                    'reference' => generateReference('SPN'),
                    'title' => "Lucky Spin Wheel Reward ({$safeReward} RWF)",
                    'category' => 'Spin Win',
                    'channel' => 'E-Finance Lucky Wheel',
                    'amountRwf' => $safeReward,
                    'direction' => 'credit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/withdrawals/request') {
            $body = get_json_body();
            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                if (!$userRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'User not found.'], 404);
                }
                $user = map_user_row($userRow);
                if ($user['kycStatus'] !== 'approved') {
                    $pdo->rollBack();
                    json_response(['error' => 'Rwanda KYC approval is required before withdrawing.'], 403);
                }
                $grossAmountRwf = (int)round((float)($body['grossAmountRwf'] ?? 0));
                $network = (string)($body['network'] ?? 'MTN Rwanda');
                $destinationType = (string)($body['destinationType'] ?? 'Phone Number');
                $destinationValue = trim((string)($body['destinationValue'] ?? ''));
                $accountRegisteredNames = trim((string)($body['accountRegisteredNames'] ?? ''));

                if ($grossAmountRwf <= 0 || $grossAmountRwf > $user['walletBalanceRwf'] || $destinationValue === '' || $accountRegisteredNames === '') {
                    $pdo->rollBack();
                    json_response(['error' => 'Invalid withdrawal details or insufficient balance.'], 400);
                }

                $settings = get_platform_settings();
                $feePercent = (float)($settings['withdrawalFeePercent'] ?? 25);
                $feeRwf = (int)round(($grossAmountRwf * $feePercent) / 100);
                $netAmountRwf = max(0, $grossAmountRwf - $feeRwf);
                $isFirstBonusWithdrawal = !$user['hasCompletedFirstWithdrawal'];
                $nowIso = utcIsoNow();

                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` - ?, `updated_at` = ? WHERE `id` = ?",
                    [$grossAmountRwf, $nowIso, $uid]
                );
                db_execute(
                    "INSERT INTO `withdrawals` (`id`, `user_id`, `user_name`, `network`, `destination_type`, `destination_value`, `account_registered_names`, `gross_amount_rwf`, `fee_percent`, `fee_rwf`, `net_amount_rwf`, `is_first_bonus_withdrawal`, `status`, `created_at`, `updated_at`)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        generateSafeId('wd'),
                        $uid,
                        "{$user['firstName']} {$user['secondName']}",
                        $network,
                        $destinationType,
                        $destinationValue,
                        $accountRegisteredNames,
                        $grossAmountRwf,
                        $feePercent,
                        $feeRwf,
                        $netAmountRwf,
                        $isFirstBonusWithdrawal ? 1 : 0,
                        'pending_admin',
                        $nowIso,
                        $nowIso,
                    ]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-wd'),
                    'userId' => $uid,
                    'reference' => generateReference('WDR'),
                    'title' => "Withdrawal ({$network}) — Net {$netAmountRwf} RWF",
                    'category' => 'Withdrawal',
                    'channel' => "{$network} · {$destinationType}: {$destinationValue} ({$accountRegisteredNames}) · {$feePercent}% fee",
                    'amountRwf' => $grossAmountRwf,
                    'feeRwf' => $feeRwf,
                    'direction' => 'debit',
                    'status' => 'Pending Review',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/videos/watch') {
            $body = get_json_body();
            $campaignId = (string)($body['campaignId'] ?? '');

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $campRow = db_query_one("SELECT * FROM `video_campaigns` WHERE `id` = ? FOR UPDATE", [$campaignId]);
                if (!$campRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Video campaign not found.'], 404);
                }
                $camp = map_video_row($campRow);
                if ($camp['status'] !== 'active') {
                    $pdo->rollBack();
                    json_response(['error' => 'Video campaign is not active.'], 400);
                }
                if (in_array($uid, $camp['watchedByUserIds'], true)) {
                    $pdo->rollBack();
                    json_response(['error' => 'You already watched this video campaign.'], 400);
                }
                if (count($camp['watchedByUserIds']) >= $camp['targetViewers']) {
                    $pdo->rollBack();
                    json_response(['error' => 'Video campaign view target has been reached.'], 400);
                }

                $nowIso = utcIsoNow();
                $updatedWatchers = $camp['watchedByUserIds'];
                $updatedWatchers[] = $uid;
                $completed = count($updatedWatchers) >= $camp['targetViewers'];

                db_execute(
                    "UPDATE `video_campaigns` SET `watched_by_user_ids` = ?, `status` = ?, `updated_at` = ? WHERE `id` = ?",
                    [json_encode($updatedWatchers), $completed ? 'completed' : $camp['status'], $nowIso, $campaignId]
                );
                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                    [$camp['rewardPerViewRwf'], $nowIso, $uid]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-vid'),
                    'userId' => $uid,
                    'reference' => generateReference('VID'),
                    'title' => "Short Video Reward: {$camp['title']}",
                    'category' => 'Video Reward',
                    'channel' => 'Watch-to-Earn',
                    'amountRwf' => $camp['rewardPerViewRwf'],
                    'direction' => 'credit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/videos/create') {
            $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$uid]);
            if (!$userRow) {
                json_response(['error' => 'User not found.'], 404);
            }
            $user = map_user_row($userRow);
            $settings = get_platform_settings();
            $body = get_json_body();

            $title = trim((string)($body['title'] ?? ''));
            $description = trim((string)($body['description'] ?? ''));
            $videoUrl = trim((string)($body['videoUrl'] ?? ''));
            $rewardPerViewRwf = (int)round((float)($body['rewardPerViewRwf'] ?? 0));
            $targetViewers = (int)round((float)($body['targetViewers'] ?? 0));
            $paymentRef = trim((string)($body['paymentRef'] ?? ''));

            if ($title === '' || !isSafeMediaOrHttpUrl($videoUrl) || $targetViewers < 1 || strlen($paymentRef) < 3) {
                json_response(['error' => 'Valid video details, safe video URL, and payment reference required.'], 400);
            }
            if ($rewardPerViewRwf < $settings['minVideoRewardRwf']) {
                json_response(['error' => "Minimum reward per view is {$settings['minVideoRewardRwf']} RWF."], 400);
            }

            $nowIso = utcIsoNow();
            $totalBudgetRwf = $rewardPerViewRwf * $targetViewers;
            $paymentCode = build_ussd_code((string)$settings['momoPayCode'], (float)$totalBudgetRwf);

            db_execute(
                "INSERT INTO `video_campaigns` (`id`, `creator_id`, `creator_name`, `title`, `description`, `video_url`, `reward_per_view_rwf`, `target_viewers`, `total_budget_rwf`, `payment_code`, `payment_ref`, `watched_by_user_ids`, `status`, `created_at`, `updated_at`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    generateSafeId('vid'),
                    $uid,
                    "{$user['firstName']} {$user['secondName']}",
                    $title,
                    $description,
                    $videoUrl,
                    $rewardPerViewRwf,
                    $targetViewers,
                    $totalBudgetRwf,
                    $paymentCode,
                    $paymentRef,
                    '[]',
                    'pending_admin',
                    $nowIso,
                    $nowIso,
                ]
            );
            insert_transaction([
                'id' => generateSafeId('tx-cmp'),
                'userId' => $uid,
                'reference' => generateReference('CMP'),
                'title' => "Video Campaign Deposit: {$title}",
                'category' => 'Campaign Payment',
                'channel' => "{$paymentCode} · Ref {$paymentRef}",
                'amountRwf' => $totalBudgetRwf,
                'direction' => 'debit',
                'status' => 'Pending Review',
                'timestamp' => $nowIso,
            ]);
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/member/tasks/submit') {
            $body = get_json_body();
            $taskId = (string)($body['taskId'] ?? '');
            $proofText = trim((string)($body['proofText'] ?? ''));
            $rawProofUrl = trim((string)($body['proofUrl'] ?? ''));
            $proofUrl = strlen($rawProofUrl) >= 4 ? $rawProofUrl : null;

            if ($proofUrl !== null && !isSafeHttpUrl($proofUrl)) {
                json_response(['error' => 'Proof URL must start with http:// or https://.'], 400);
            }

            $taskRow = db_query_one("SELECT * FROM `custom_tasks` WHERE `id` = ? AND `status` = 'active'", [$taskId]);
            $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$uid]);
            if (!$taskRow || !$userRow || strlen($proofText) < 3) {
                json_response(['error' => 'Active task and completion proof required.'], 400);
            }
            $existingSub = db_query_one("SELECT `id` FROM `task_submissions` WHERE `task_id` = ? AND `worker_id` = ?", [$taskId, $uid]);
            if ($existingSub) {
                json_response(['error' => 'You already submitted proof for this task.'], 400);
            }

            $task = map_task_row($taskRow);
            $user = map_user_row($userRow);
            $nowIso = utcIsoNow();

            db_execute(
                "INSERT INTO `task_submissions` (`id`, `task_id`, `task_title`, `worker_id`, `worker_name`, `proof_text`, `proof_url`, `reward_rwf`, `status`, `submitted_at`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    generateSafeId('sub'),
                    $task['id'],
                    $task['title'],
                    $uid,
                    "{$user['firstName']} {$user['secondName']}",
                    $proofText,
                    $proofUrl,
                    $task['rewardPerCompletionRwf'],
                    'pending_admin',
                    $nowIso,
                ]
            );
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/member/tasks/create') {
            $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$uid]);
            if (!$userRow) {
                json_response(['error' => 'User not found.'], 404);
            }
            $user = map_user_row($userRow);
            $settings = get_platform_settings();
            $body = get_json_body();

            $title = trim((string)($body['title'] ?? ''));
            $requirements = trim((string)($body['requirements'] ?? ''));
            $rewardPerCompletionRwf = (int)round((float)($body['rewardPerCompletionRwf'] ?? 0));
            $targetCompletions = (int)round((float)($body['targetCompletions'] ?? 0));
            $paymentRef = trim((string)($body['paymentRef'] ?? ''));

            if ($title === '' || $requirements === '' || $rewardPerCompletionRwf < 20 || $targetCompletions < 1 || strlen($paymentRef) < 3) {
                json_response(['error' => 'Valid task details and payment reference required.'], 400);
            }

            $nowIso = utcIsoNow();
            $totalBudgetRwf = $rewardPerCompletionRwf * $targetCompletions;
            $paymentCode = build_ussd_code((string)$settings['momoPayCode'], (float)$totalBudgetRwf);

            db_execute(
                "INSERT INTO `custom_tasks` (`id`, `creator_id`, `creator_name`, `title`, `requirements`, `reward_per_completion_rwf`, `target_completions`, `total_budget_rwf`, `payment_code`, `payment_ref`, `approved_worker_ids`, `status`, `created_at`, `updated_at`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    generateSafeId('tsk'),
                    $uid,
                    "{$user['firstName']} {$user['secondName']}",
                    $title,
                    $requirements,
                    $rewardPerCompletionRwf,
                    $targetCompletions,
                    $totalBudgetRwf,
                    $paymentCode,
                    $paymentRef,
                    '[]',
                    'pending_admin',
                    $nowIso,
                    $nowIso,
                ]
            );
            insert_transaction([
                'id' => generateSafeId('tx-tsk'),
                'userId' => $uid,
                'reference' => generateReference('TSK'),
                'title' => "Custom Task Funding: {$title}",
                'category' => 'Campaign Payment',
                'channel' => "{$paymentCode} · Ref {$paymentRef}",
                'amountRwf' => $totalBudgetRwf,
                'direction' => 'debit',
                'status' => 'Pending Review',
                'timestamp' => $nowIso,
            ]);
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/member/quiz-bet/start') {
            $body = get_json_body();
            $stakeRwf = (int)round((float)($body['stakeRwf'] ?? 0));

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                if (!$userRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'User not found.'], 404);
                }
                $user = map_user_row($userRow);
                if ($stakeRwf < 100 || $stakeRwf > $user['walletBalanceRwf']) {
                    $pdo->rollBack();
                    json_response(['error' => 'Minimum bet stake is 100 RWF and must not exceed wallet balance.'], 400);
                }

                $nowIso = utcIsoNow();
                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` - ?, `updated_at` = ? WHERE `id` = ?",
                    [$stakeRwf, $nowIso, $uid]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-bet'),
                    'userId' => $uid,
                    'reference' => generateReference('BET'),
                    'title' => "Quiz Bet Stake ({$stakeRwf} RWF)",
                    'category' => 'Quiz Bet',
                    'channel' => '10s Quiz Bet Arena',
                    'amountRwf' => $stakeRwf,
                    'direction' => 'debit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/quiz-bet/finish') {
            $body = get_json_body();
            $session = $body['session'] ?? null;

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                if (!$userRow || !is_array($session)) {
                    $pdo->rollBack();
                    json_response(['error' => 'Invalid bet session payload.'], 400);
                }
                $user = map_user_row($userRow);
                $questionsAnswered = max(0, min(20, (int)round((float)($session['questionsAnswered'] ?? 0))));
                $stakeRwf = max(100, (int)round((float)($session['stakeRwf'] ?? 0)));
                $multiplier = (float)($session['multiplier'] ?? 0);
                $won = ($session['status'] ?? '') === 'won_cashed_out';
                $payoutRwf = $won ? max(0, min($stakeRwf * 10, (int)round((float)($session['payoutRwf'] ?? 0)))) : 0;
                $createdAt = !empty($session['createdAt']) ? (string)$session['createdAt'] : utcIsoNow();

                db_execute(
                    "INSERT INTO `bet_sessions` (`id`, `user_id`, `user_name`, `category`, `stake_rwf`, `questions_answered`, `multiplier`, `payout_rwf`, `status`, `ended_reason`, `created_at`)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        generateSafeId('bet'),
                        $uid,
                        "{$user['firstName']} {$user['secondName']}",
                        (string)($session['category'] ?? 'mixed'),
                        $stakeRwf,
                        $questionsAnswered,
                        $multiplier,
                        $payoutRwf,
                        $won ? 'won_cashed_out' : 'lost',
                        (string)($session['endedReason'] ?? ''),
                        $createdAt,
                    ]
                );

                if ($won && $payoutRwf > 0) {
                    db_execute(
                        "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                        [$payoutRwf, utcIsoNow(), $uid]
                    );
                    insert_transaction([
                        'id' => generateSafeId('tx-win'),
                        'userId' => $uid,
                        'reference' => generateReference('WIN'),
                        'title' => "Quiz Bet Cashout ({$questionsAnswered} Qs · {$multiplier}x)",
                        'category' => 'Quiz Win',
                        'channel' => '10s Quiz Bet Arena',
                        'amountRwf' => $payoutRwf,
                        'direction' => 'credit',
                        'status' => 'Completed',
                        'timestamp' => $createdAt,
                    ]);
                }

                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/airtime/request') {
            $body = get_json_body();
            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                if (!$userRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'User not found.'], 404);
                }
                $user = map_user_row($userRow);
                $network = (string)($body['network'] ?? 'MTN Rwanda');
                $serviceType = (string)($body['serviceType'] ?? 'Airtime');
                $phoneNumber = trim((string)($body['phoneNumber'] ?? ''));
                $amountRwf = (int)round((float)($body['amountRwf'] ?? 0));
                $bundleLabel = !empty($body['bundleLabel']) ? trim((string)$body['bundleLabel']) : null;

                if ($phoneNumber === '' || $amountRwf < 100 || $amountRwf > $user['walletBalanceRwf']) {
                    $pdo->rollBack();
                    json_response(['error' => 'Valid phone number, minimum 100 RWF, and sufficient balance required.'], 400);
                }

                $nowIso = utcIsoNow();
                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` - ?, `updated_at` = ? WHERE `id` = ?",
                    [$amountRwf, $nowIso, $uid]
                );
                db_execute(
                    "INSERT INTO `airtime_requests` (`id`, `user_id`, `user_name`, `network`, `service_type`, `phone_number`, `amount_rwf`, `bundle_label`, `status`, `created_at`, `updated_at`)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        generateSafeId('air'),
                        $uid,
                        "{$user['firstName']} {$user['secondName']}",
                        $network,
                        $serviceType,
                        $phoneNumber,
                        $amountRwf,
                        $bundleLabel,
                        'pending_admin',
                        $nowIso,
                        $nowIso,
                    ]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-air'),
                    'userId' => $uid,
                    'reference' => generateReference('AIR'),
                    'title' => "{$network} {$serviceType}: {$phoneNumber}",
                    'category' => 'Airtime & Data',
                    'channel' => $bundleLabel ? "{$network} · {$bundleLabel}" : $network,
                    'amountRwf' => $amountRwf,
                    'direction' => 'debit',
                    'status' => 'Pending Review',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'GET' && $route === '/api/member/wallet-lookup') {
            $address = strtoupper(trim((string)($_GET['address'] ?? '')));
            if (strlen($address) < 4) {
                json_response(['error' => 'Enter a valid receiver wallet address.'], 400);
            }
            $row = db_query_one(
                "SELECT `id`, `account_number`, `first_name`, `second_name`, `created_at` FROM `users` WHERE UPPER(`account_number`) = ?",
                [$address]
            );
            if (!$row) {
                json_response(['error' => 'Receiver wallet address not found.'], 404);
            }
            json_response([
                'record' => [
                    'address' => (string)$row['account_number'],
                    'userId' => (string)$row['id'],
                    'fullName' => "{$row['first_name']} {$row['second_name']}",
                    'createdAt' => (string)$row['created_at'],
                ],
            ]);
        }

        if ($method === 'POST' && $route === '/api/member/p2p/send') {
            $body = get_json_body();
            $receiverAddress = strtoupper(trim((string)($body['receiverAddress'] ?? '')));
            $grossAmountRwf = (int)round((float)($body['grossAmountRwf'] ?? 0));
            $note = !empty($body['note']) ? trim((string)$body['note']) : null;

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $senderRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                $receiverRow = db_query_one("SELECT * FROM `users` WHERE UPPER(`account_number`) = ? FOR UPDATE", [$receiverAddress]);
                if (!$senderRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Sender account not found.'], 404);
                }
                if (!$receiverRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Receiver wallet address not found.'], 404);
                }
                $sender = map_user_row($senderRow);
                $receiver = map_user_row($receiverRow);

                if ($sender['id'] === $receiver['id']) {
                    $pdo->rollBack();
                    json_response(['error' => 'Cannot send money to your own wallet address.'], 400);
                }
                if ($grossAmountRwf < 100) {
                    $pdo->rollBack();
                    json_response(['error' => 'Minimum P2P transfer is 100 RWF.'], 400);
                }
                if ($grossAmountRwf > $sender['walletBalanceRwf']) {
                    $pdo->rollBack();
                    json_response(['error' => 'Insufficient wallet balance.'], 400);
                }

                $settings = get_platform_settings();
                $taxPercent = (float)($settings['sendMoneyTaxPercent'] ?? 10);
                $taxRwf = (int)round(($grossAmountRwf * $taxPercent) / 100);
                $netAmountRwf = max(0, $grossAmountRwf - $taxRwf);
                $nowIso = utcIsoNow();
                $senderFullName = "{$sender['firstName']} {$sender['secondName']}";
                $receiverFullName = "{$receiver['firstName']} {$receiver['secondName']}";

                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` - ?, `updated_at` = ? WHERE `id` = ?",
                    [$grossAmountRwf, $nowIso, $sender['id']]
                );
                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                    [$netAmountRwf, $nowIso, $receiver['id']]
                );
                db_execute(
                    "INSERT INTO `p2p_transfers` (`id`, `sender_id`, `sender_name`, `sender_address`, `receiver_id`, `receiver_name`, `receiver_address`, `gross_amount_rwf`, `tax_percent`, `tax_rwf`, `net_amount_rwf`, `note`, `status`, `claimed_by_receiver`, `created_at`)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        generateSafeId('p2p'),
                        $sender['id'],
                        $senderFullName,
                        $sender['accountNumber'],
                        $receiver['id'],
                        $receiverFullName,
                        $receiver['accountNumber'],
                        $grossAmountRwf,
                        $taxPercent,
                        $taxRwf,
                        $netAmountRwf,
                        $note,
                        'completed',
                        1,
                        $nowIso,
                    ]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-snd'),
                    'userId' => $sender['id'],
                    'reference' => generateReference('SND'),
                    'title' => "Sent to {$receiverFullName} ({$receiver['accountNumber']})",
                    'category' => 'Transfer Sent',
                    'channel' => "{$taxPercent}% system tax ({$taxRwf} RWF) · Net {$netAmountRwf} RWF",
                    'amountRwf' => $grossAmountRwf,
                    'feeRwf' => $taxRwf,
                    'direction' => 'debit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                insert_transaction([
                    'id' => generateSafeId('tx-rcv'),
                    'userId' => $receiver['id'],
                    'reference' => generateReference('RCV'),
                    'title' => "Received from {$senderFullName} ({$sender['accountNumber']})",
                    'category' => 'Transfer Received',
                    'channel' => "P2P Wallet Transfer ({$taxPercent}% tax paid by sender)",
                    'amountRwf' => $netAmountRwf,
                    'direction' => 'credit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/fx/exchange') {
            $body = get_json_body();
            $direction = (string)($body['direction'] ?? '');
            $fromAmount = (float)($body['fromAmount'] ?? 0);

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                if (!$userRow || !is_finite($fromAmount) || $fromAmount <= 0) {
                    $pdo->rollBack();
                    json_response(['error' => 'Enter a valid positive exchange amount.'], 400);
                }
                $user = map_user_row($userRow);
                $settings = get_platform_settings();
                $rate = max(100, (float)($settings['rwfPerUsdRate'] ?? 1380));
                $usdBal = (float)$user['walletBalanceUsd'];
                $usdtBal = (float)$user['usdtBalance'];

                $nextRwf = (float)$user['walletBalanceRwf'];
                $nextUsd = $usdBal;
                $nextUsdt = $usdtBal;
                $toAmount = 0.0;
                $rateApplied = 1.0;
                $rwfEquivalent = 0;

                if ($direction === 'RWF_TO_USD') {
                    $fromRwf = (int)round($fromAmount);
                    if ($fromRwf < 100) {
                        $pdo->rollBack();
                        json_response(['error' => 'Minimum RWF exchange is 100 RWF.'], 400);
                    }
                    if ($fromRwf > $user['walletBalanceRwf']) {
                        $pdo->rollBack();
                        json_response(['error' => 'Insufficient RWF wallet balance.'], 400);
                    }
                    $toAmount = round($fromRwf / $rate, 2);
                    if ($toAmount <= 0) {
                        $pdo->rollBack();
                        json_response(['error' => 'Amount too small for USD conversion.'], 400);
                    }
                    $nextRwf = $user['walletBalanceRwf'] - $fromRwf;
                    $nextUsd = round($usdBal + $toAmount, 2);
                    $rateApplied = $rate;
                    $rwfEquivalent = $fromRwf;
                } elseif ($direction === 'USD_TO_RWF') {
                    if ($fromAmount > $usdBal) {
                        $pdo->rollBack();
                        json_response(['error' => 'Insufficient USD wallet balance.'], 400);
                    }
                    $toAmount = (float)round($fromAmount * $rate);
                    $nextUsd = round($usdBal - $fromAmount, 2);
                    $nextRwf = $user['walletBalanceRwf'] + $toAmount;
                    $rateApplied = $rate;
                    $rwfEquivalent = (int)$toAmount;
                } elseif ($direction === 'USD_TO_USDT') {
                    if ($fromAmount > $usdBal) {
                        $pdo->rollBack();
                        json_response(['error' => 'Insufficient USD wallet balance.'], 400);
                    }
                    $toAmount = round($fromAmount, 2);
                    $nextUsd = round($usdBal - $fromAmount, 2);
                    $nextUsdt = round($usdtBal + $toAmount, 2);
                    $rwfEquivalent = (int)round($toAmount * $rate);
                } elseif ($direction === 'USDT_TO_USD') {
                    if ($fromAmount > $usdtBal) {
                        $pdo->rollBack();
                        json_response(['error' => 'Insufficient USDT wallet balance.'], 400);
                    }
                    $toAmount = round($fromAmount, 2);
                    $nextUsdt = round($usdtBal - $fromAmount, 2);
                    $nextUsd = round($usdBal + $toAmount, 2);
                    $rwfEquivalent = (int)round($toAmount * $rate);
                } else {
                    $pdo->rollBack();
                    json_response(['error' => 'Invalid conversion direction.'], 400);
                }

                $nowIso = utcIsoNow();
                db_execute(
                    "UPDATE `users` SET `wallet_balance_rwf` = ?, `wallet_balance_usd` = ?, `usdt_balance` = ?, `updated_at` = ? WHERE `id` = ?",
                    [$nextRwf, $nextUsd, $nextUsdt, $nowIso, $uid]
                );
                db_execute(
                    "INSERT INTO `fx_exchanges` (`id`, `user_id`, `user_name`, `direction`, `from_amount`, `to_amount`, `rate_applied`, `created_at`)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        generateSafeId('fx'),
                        $uid,
                        "{$user['firstName']} {$user['secondName']}",
                        $direction,
                        $fromAmount,
                        $toAmount,
                        $rateApplied,
                        $nowIso,
                    ]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-fx'),
                    'userId' => $uid,
                    'reference' => generateReference('FX'),
                    'title' => 'FX ' . str_replace('_', ' ', $direction) . ": {$fromAmount} → {$toAmount}",
                    'category' => 'Currency Exchange',
                    'channel' => "Rate {$rateApplied}",
                    'amountRwf' => $rwfEquivalent,
                    'direction' => $direction === 'USD_TO_RWF' ? 'credit' : 'debit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/usdt/savings') {
            $body = get_json_body();
            $action = ($body['action'] ?? '') === 'withdraw' ? 'withdraw' : 'deposit';
            $amountUsdt = (float)($body['amountUsdt'] ?? 0);

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                if (!$userRow || !is_finite($amountUsdt) || $amountUsdt <= 0) {
                    $pdo->rollBack();
                    json_response(['error' => 'Enter a valid USDT amount.'], 400);
                }
                $user = map_user_row($userRow);
                $usdtBal = (float)$user['usdtBalance'];
                $usdtSav = (float)$user['usdtSavingsBalance'];
                $settings = get_platform_settings();
                $rate = max(100, (float)($settings['rwfPerUsdRate'] ?? 1380));

                if ($action === 'deposit' && $amountUsdt > $usdtBal) {
                    $pdo->rollBack();
                    json_response(['error' => 'Insufficient USDT wallet balance.'], 400);
                }
                if ($action === 'withdraw' && $amountUsdt > $usdtSav) {
                    $pdo->rollBack();
                    json_response(['error' => 'Amount exceeds USDT Savings Vault balance.'], 400);
                }

                $nextUsdt = $action === 'deposit' ? round($usdtBal - $amountUsdt, 2) : round($usdtBal + $amountUsdt, 2);
                $nextSav = $action === 'deposit' ? round($usdtSav + $amountUsdt, 2) : round($usdtSav - $amountUsdt, 2);
                $nowIso = utcIsoNow();

                db_execute(
                    "UPDATE `users` SET `usdt_balance` = ?, `usdt_savings_balance` = ?, `updated_at` = ? WHERE `id` = ?",
                    [$nextUsdt, $nextSav, $nowIso, $uid]
                );
                $amtFormatted = number_format($amountUsdt, 2, '.', '');
                insert_transaction([
                    'id' => generateSafeId('tx-usav'),
                    'userId' => $uid,
                    'reference' => generateReference('USAV'),
                    'title' => $action === 'deposit'
                        ? "Saved {$amtFormatted} USDT to Vault"
                        : "Moved {$amtFormatted} USDT from Vault to Wallet",
                    'category' => 'USDT Savings',
                    'channel' => 'USDT Smart Savings',
                    'amountRwf' => (int)round($amountUsdt * $rate),
                    'direction' => $action === 'deposit' ? 'debit' : 'credit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/member/usdt/request') {
            $body = get_json_body();
            $actionType = (string)($body['actionType'] ?? '');
            $amountUsdt = (float)($body['amountUsdt'] ?? 0);
            $network = (string)($body['network'] ?? 'BEP20 (BSC)');
            $destinationOrTxRef = trim((string)($body['destinationOrTxRef'] ?? ''));
            $note = !empty($body['note']) ? trim((string)$body['note']) : null;

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$uid]);
                if (!$userRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'User not found.'], 404);
                }
                if (!in_array($actionType, ['deposit', 'withdraw', 'send_binance'], true)) {
                    $pdo->rollBack();
                    json_response(['error' => 'Invalid USDT action type.'], 400);
                }
                if (!is_finite($amountUsdt) || $amountUsdt < 1) {
                    $pdo->rollBack();
                    json_response(['error' => 'Minimum USDT operation is 1.00 USDT.'], 400);
                }
                if (strlen($destinationOrTxRef) < 4) {
                    $pdo->rollBack();
                    json_response(['error' => 'Enter a valid Binance Pay ID, USDT address, or TxHash.'], 400);
                }

                $user = map_user_row($userRow);
                $usdtBal = (float)$user['usdtBalance'];
                $isDebit = $actionType === 'withdraw' || $actionType === 'send_binance';
                if ($isDebit && $amountUsdt > $usdtBal) {
                    $pdo->rollBack();
                    $avail = number_format($usdtBal, 2, '.', '');
                    json_response(['error' => "Insufficient USDT balance ({$avail} USDT available)."], 400);
                }

                $nextUsdt = $isDebit ? round($usdtBal - $amountUsdt, 2) : $usdtBal;
                $settings = get_platform_settings();
                $rate = max(100, (float)($settings['rwfPerUsdRate'] ?? 1380));
                $nowIso = utcIsoNow();

                if ($isDebit) {
                    db_execute(
                        "UPDATE `users` SET `usdt_balance` = ?, `updated_at` = ? WHERE `id` = ?",
                        [$nextUsdt, $nowIso, $uid]
                    );
                }

                $amtClean = round($amountUsdt, 2);
                $amtFormatted = number_format($amtClean, 2, '.', '');
                db_execute(
                    "INSERT INTO `usdt_requests` (`id`, `user_id`, `user_name`, `action_type`, `amount_usdt`, `network`, `destination_or_tx_ref`, `note`, `status`, `created_at`, `updated_at`)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        generateSafeId('usdt'),
                        $uid,
                        "{$user['firstName']} {$user['secondName']}",
                        $actionType,
                        $amtClean,
                        $network,
                        $destinationOrTxRef,
                        $note,
                        'pending_admin',
                        $nowIso,
                        $nowIso,
                    ]
                );

                insert_transaction([
                    'id' => generateSafeId('tx-usdt'),
                    'userId' => $uid,
                    'reference' => generateReference('USDT'),
                    'title' => $actionType === 'deposit'
                        ? "USDT Deposit ({$amtFormatted} USDT)"
                        : ($actionType === 'send_binance'
                            ? "Send {$amtFormatted} USDT to Binance"
                            : "Withdraw {$amtFormatted} USDT"),
                    'category' => $actionType === 'deposit' ? 'USDT Deposit' : 'USDT Send / Withdraw',
                    'channel' => "{$network} · {$destinationOrTxRef}",
                    'amountRwf' => (int)round($amtClean * $rate),
                    'direction' => $actionType === 'deposit' ? 'credit' : 'debit',
                    'status' => 'Pending Review',
                    'timestamp' => $nowIso,
                ]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }
    }

    // 5. Admin Endpoints
    if (strpos($route, '/api/admin/') === 0) {
        require_admin();

        if ($method === 'GET' && $route === '/api/admin/state') {
            process_due_investment_roi();

            $settings = get_platform_settings();
            $userRows = db_query_all("SELECT * FROM `users` ORDER BY `created_at` DESC");
            $savingsRows = db_query_all("SELECT * FROM `savings_goals` ORDER BY `created_at` DESC");
            $loanRows = db_query_all("SELECT * FROM `loans` ORDER BY `created_at` DESC");
            $invRows = db_query_all("SELECT * FROM `investments` ORDER BY `created_at` DESC");
            $spinRows = db_query_all("SELECT * FROM `spin_history` ORDER BY `spun_at` DESC");
            $wdRows = db_query_all("SELECT * FROM `withdrawals` ORDER BY `created_at` DESC");
            $vidRows = db_query_all("SELECT * FROM `video_campaigns` ORDER BY `created_at` DESC");
            $taskRows = db_query_all("SELECT * FROM `custom_tasks` ORDER BY `created_at` DESC");
            $subRows = db_query_all("SELECT * FROM `task_submissions` ORDER BY `submitted_at` DESC");
            $betRows = db_query_all("SELECT * FROM `bet_sessions` ORDER BY `created_at` DESC");
            $airRows = db_query_all("SELECT * FROM `airtime_requests` ORDER BY `created_at` DESC");
            $p2pRows = db_query_all("SELECT * FROM `p2p_transfers` ORDER BY `created_at` DESC");
            $fxRows = db_query_all("SELECT * FROM `fx_exchanges` ORDER BY `created_at` DESC");
            $usdtRows = db_query_all("SELECT * FROM `usdt_requests` ORDER BY `created_at` DESC");
            $txRows = db_query_all("SELECT * FROM `transactions` ORDER BY `timestamp` DESC");
            $promoRows = db_query_all("SELECT * FROM `promotions` ORDER BY `created_at` DESC");

            json_response([
                'settings' => $settings,
                'users' => array_map('map_user_row', $userRows),
                'savingsGoals' => array_map('map_savings_goal_row', $savingsRows),
                'loans' => array_map('map_loan_row', $loanRows),
                'investments' => array_map('map_investment_row', $invRows),
                'spinHistory' => array_map('map_spin_row', $spinRows),
                'withdrawals' => array_map('map_withdrawal_row', $wdRows),
                'videoCampaigns' => array_map('map_video_row', $vidRows),
                'customTasks' => array_map('map_task_row', $taskRows),
                'taskSubmissions' => array_map('map_submission_row', $subRows),
                'betSessions' => array_map('map_bet_session_row', $betRows),
                'airtimeRequests' => array_map('map_airtime_row', $airRows),
                'p2pTransfers' => array_map('map_p2p_row', $p2pRows),
                'fxExchanges' => array_map('map_fx_row', $fxRows),
                'usdtRequests' => array_map('map_usdt_row', $usdtRows),
                'transactions' => array_map('map_transaction_row', $txRows),
                'promotions' => array_map('map_promotion_row', $promoRows),
            ]);
        }

        if ($method === 'POST' && preg_match('#^/api/admin/users/([^/]+)/approve$#', $route, $m)) {
            $userId = urldecode($m[1]);
            db_execute(
                "UPDATE `users` SET `account_status` = 'awaiting_payment', `updated_at` = ? WHERE `id` = ?",
                [utcIsoNow(), $userId]
            );
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && preg_match('#^/api/admin/users/([^/]+)/activate$#', $route, $m)) {
            $userId = urldecode($m[1]);
            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$userId]);
                if (!$userRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'User not found.'], 404);
                }
                $targetUser = map_user_row($userRow);
                $settings = get_platform_settings();
                $bonus = $settings['welcomeBonusRwf'];
                $nowIso = utcIsoNow();

                db_execute(
                    "UPDATE `users` SET `account_status` = 'active', `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `bonus_balance_rwf` = `bonus_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                    [$bonus, $bonus, $nowIso, $userId]
                );
                db_execute(
                    "UPDATE `transactions` SET `status` = 'Completed' WHERE `user_id` = ? AND `category` = 'Activation' AND `status` = 'Pending Review'",
                    [$userId]
                );
                insert_transaction([
                    'id' => generateSafeId('tx-bns'),
                    'userId' => $userId,
                    'reference' => generateReference('BNS'),
                    'title' => "Welcome Bonus ({$bonus} RWF)",
                    'category' => 'Bonus',
                    'channel' => 'E-Finance System Activation',
                    'amountRwf' => $bonus,
                    'direction' => 'credit',
                    'status' => 'Completed',
                    'timestamp' => $nowIso,
                ]);

                if (!empty($targetUser['referredByUserId'])) {
                    $refRow = db_query_one("SELECT * FROM `users` WHERE `id` = ? FOR UPDATE", [$targetUser['referredByUserId']]);
                    if ($refRow) {
                        $referralCommRwf = (int)round(($settings['activationFeeRwf'] * $settings['referralCommissionPercent']) / 100);
                        db_execute(
                            "UPDATE `users` SET `spin_credits` = `spin_credits` + 1, `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                            [$referralCommRwf, $nowIso, (string)$refRow['id']]
                        );
                        insert_transaction([
                            'id' => generateSafeId('tx-ref'),
                            'userId' => (string)$refRow['id'],
                            'reference' => generateReference('REF'),
                            'title' => "Referral Bonus +1 Spin ({$targetUser['firstName']} activated)",
                            'category' => 'Referral Commission',
                            'channel' => "{$settings['referralCommissionPercent']}% Activation Commission",
                            'amountRwf' => $referralCommRwf,
                            'direction' => 'credit',
                            'status' => 'Completed',
                            'timestamp' => $nowIso,
                        ]);
                    }
                }
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && preg_match('#^/api/admin/users/([^/]+)/toggle-suspend$#', $route, $m)) {
            $userId = urldecode($m[1]);
            $userRow = db_query_one("SELECT `account_status` FROM `users` WHERE `id` = ?", [$userId]);
            if (!$userRow) {
                json_response(['error' => 'User not found.'], 404);
            }
            $nextStatus = (string)$userRow['account_status'] === 'suspended' ? 'active' : 'suspended';
            db_execute(
                "UPDATE `users` SET `account_status` = ?, `updated_at` = ? WHERE `id` = ?",
                [$nextStatus, utcIsoNow(), $userId]
            );
            if ($nextStatus === 'suspended') {
                db_execute("DELETE FROM `sessions` WHERE `user_id` = ?", [$userId]);
            }
            json_response(['ok' => true]);
        }

        if ($method === 'PUT' && preg_match('#^/api/admin/users/([^/]+)$#', $route, $m)) {
            $userId = urldecode($m[1]);
            $u = get_json_body();
            $nowIso = utcIsoNow();
            db_execute(
                "UPDATE `users` SET
                    `first_name` = ?, `second_name` = ?, `email` = ?, `phone` = ?, `gender` = ?,
                    `date_of_birth` = ?, `id_number` = ?, `photo_data_url` = ?, `education` = ?, `residence` = ?,
                    `account_status` = ?, `wallet_balance_rwf` = ?, `bonus_balance_rwf` = ?, `savings_balance_rwf` = ?,
                    `wallet_balance_usd` = ?, `usdt_balance` = ?, `usdt_savings_balance` = ?,
                    `kyc_status` = ?, `kyc_data` = ?, `updated_at` = ?
                 WHERE `id` = ?",
                [
                    (string)($u['firstName'] ?? ''),
                    (string)($u['secondName'] ?? ''),
                    strtolower((string)($u['email'] ?? '')),
                    (string)($u['phone'] ?? ''),
                    (string)($u['gender'] ?? 'Male'),
                    (string)($u['dateOfBirth'] ?? ''),
                    (string)($u['idNumber'] ?? ''),
                    (string)($u['photoDataUrl'] ?? ''),
                    json_encode($u['education'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    json_encode($u['residence'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    (string)($u['accountStatus'] ?? 'pending_approval'),
                    (float)($u['walletBalanceRwf'] ?? 0),
                    (float)($u['bonusBalanceRwf'] ?? 0),
                    (float)($u['savingsBalanceRwf'] ?? 0),
                    (float)($u['walletBalanceUsd'] ?? 0),
                    (float)($u['usdtBalance'] ?? 0),
                    (float)($u['usdtSavingsBalance'] ?? 0),
                    (string)($u['kycStatus'] ?? 'not_submitted'),
                    !empty($u['kycData']) ? json_encode($u['kycData'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null,
                    $nowIso,
                    $userId,
                ]
            );
            json_response(['ok' => true]);
        }

        if ($method === 'DELETE' && preg_match('#^/api/admin/users/([^/]+)$#', $route, $m)) {
            $userId = urldecode($m[1]);
            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                db_execute("DELETE FROM `sessions` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `savings_goals` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `loans` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `investments` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `spin_history` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `withdrawals` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `task_submissions` WHERE `worker_id` = ?", [$userId]);
                db_execute("DELETE FROM `bet_sessions` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `airtime_requests` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `p2p_transfers` WHERE `sender_id` = ? OR `receiver_id` = ?", [$userId, $userId]);
                db_execute("DELETE FROM `fx_exchanges` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `usdt_requests` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `transactions` WHERE `user_id` = ?", [$userId]);
                db_execute("DELETE FROM `users` WHERE `id` = ?", [$userId]);
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && preg_match('#^/api/admin/users/([^/]+)/kyc$#', $route, $m)) {
            $userId = urldecode($m[1]);
            $body = get_json_body();
            $decision = ($body['decision'] ?? '') === 'approved' ? 'approved' : 'rejected';
            $note = trim((string)($body['note'] ?? ''));

            $userRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$userId]);
            if (!$userRow) {
                json_response(['error' => 'User not found.'], 404);
            }
            $user = map_user_row($userRow);
            $nextKycData = $user['kycData'] ?? null;
            if (is_array($nextKycData) && $note !== '') {
                $nextKycData['reviewNote'] = $note;
            }
            db_execute(
                "UPDATE `users` SET `kyc_status` = ?, `kyc_data` = ?, `updated_at` = ? WHERE `id` = ?",
                [
                    $decision,
                    $nextKycData !== null ? json_encode($nextKycData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null,
                    utcIsoNow(),
                    $userId,
                ]
            );
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/admin/videos/create') {
            $body = get_json_body();
            $title = trim((string)($body['title'] ?? ''));
            $description = trim((string)($body['description'] ?? ''));
            $videoUrl = trim((string)($body['videoUrl'] ?? ''));
            $rewardPerViewRwf = (int)round((float)($body['rewardPerViewRwf'] ?? 0));
            $targetViewers = (int)round((float)($body['targetViewers'] ?? 0));

            if ($title === '' || !isSafeMediaOrHttpUrl($videoUrl) || $rewardPerViewRwf < 1 || $targetViewers < 1) {
                json_response(['error' => 'Provide valid title, video URL/upload, reward, and target viewers.'], 400);
            }
            $nowIso = utcIsoNow();
            $totalBudgetRwf = $rewardPerViewRwf * $targetViewers;
            db_execute(
                "INSERT INTO `video_campaigns` (`id`, `creator_id`, `creator_name`, `title`, `description`, `video_url`, `reward_per_view_rwf`, `target_viewers`, `total_budget_rwf`, `payment_code`, `payment_ref`, `watched_by_user_ids`, `status`, `created_at`, `updated_at`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    generateSafeId('vid'),
                    'admin',
                    'E-Finance Admin',
                    $title,
                    $description,
                    $videoUrl,
                    $rewardPerViewRwf,
                    $targetViewers,
                    $totalBudgetRwf,
                    'ADMIN-DIRECT',
                    'ADMIN-PUBLISHED',
                    '[]',
                    'active',
                    $nowIso,
                    $nowIso,
                ]
            );
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && preg_match('#^/api/admin/videos/([^/]+)/review$#', $route, $m)) {
            $id = urldecode($m[1]);
            $body = get_json_body();
            $decision = ($body['decision'] ?? '') === 'active' ? 'active' : 'rejected';
            db_execute("UPDATE `video_campaigns` SET `status` = ?, `updated_at` = ? WHERE `id` = ?", [$decision, utcIsoNow(), $id]);
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && $route === '/api/admin/tasks/create') {
            $body = get_json_body();
            $title = trim((string)($body['title'] ?? ''));
            $requirements = trim((string)($body['requirements'] ?? ''));
            $rewardPerCompletionRwf = (int)round((float)($body['rewardPerCompletionRwf'] ?? 0));
            $targetCompletions = (int)round((float)($body['targetCompletions'] ?? 0));

            if ($title === '' || $requirements === '' || $rewardPerCompletionRwf < 1 || $targetCompletions < 1) {
                json_response(['error' => 'Provide valid task title, requirements, reward, and target.'], 400);
            }
            $nowIso = utcIsoNow();
            $totalBudgetRwf = $rewardPerCompletionRwf * $targetCompletions;
            db_execute(
                "INSERT INTO `custom_tasks` (`id`, `creator_id`, `creator_name`, `title`, `requirements`, `reward_per_completion_rwf`, `target_completions`, `total_budget_rwf`, `payment_code`, `payment_ref`, `approved_worker_ids`, `status`, `created_at`, `updated_at`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    generateSafeId('tsk'),
                    'admin',
                    'E-Finance Admin',
                    $title,
                    $requirements,
                    $rewardPerCompletionRwf,
                    $targetCompletions,
                    $totalBudgetRwf,
                    'ADMIN-DIRECT',
                    'ADMIN-PUBLISHED',
                    '[]',
                    'active',
                    $nowIso,
                    $nowIso,
                ]
            );
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && preg_match('#^/api/admin/tasks/([^/]+)/review$#', $route, $m)) {
            $id = urldecode($m[1]);
            $body = get_json_body();
            $decision = ($body['decision'] ?? '') === 'active' ? 'active' : 'rejected';
            db_execute("UPDATE `custom_tasks` SET `status` = ?, `updated_at` = ? WHERE `id` = ?", [$decision, utcIsoNow(), $id]);
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && preg_match('#^/api/admin/submissions/([^/]+)/review$#', $route, $m)) {
            $submissionId = urldecode($m[1]);
            $body = get_json_body();
            $decision = ($body['decision'] ?? '') === 'approved' ? 'approved' : 'rejected';
            $note = trim((string)($body['note'] ?? ''));

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $subRow = db_query_one("SELECT * FROM `task_submissions` WHERE `id` = ? FOR UPDATE", [$submissionId]);
                if (!$subRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Submission not found.'], 404);
                }
                $sub = map_submission_row($subRow);
                if ($sub['status'] !== 'pending_admin') {
                    $pdo->rollBack();
                    json_response(['error' => 'Submission already reviewed.'], 400);
                }

                $nowIso = utcIsoNow();
                db_execute(
                    "UPDATE `task_submissions` SET `status` = ?, `admin_note` = ?, `reviewed_at` = ? WHERE `id` = ?",
                    [$decision, $note !== '' ? $note : null, $nowIso, $submissionId]
                );

                if ($decision === 'approved') {
                    db_execute(
                        "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                        [$sub['rewardRwf'], $nowIso, $sub['workerId']]
                    );
                    $taskRow = db_query_one("SELECT * FROM `custom_tasks` WHERE `id` = ? FOR UPDATE", [$sub['taskId']]);
                    if ($taskRow) {
                        $parentTask = map_task_row($taskRow);
                        $approvedList = $parentTask['approvedWorkerIds'];
                        if (!in_array($sub['workerId'], $approvedList, true)) {
                            $approvedList[] = $sub['workerId'];
                        }
                        $nextStatus = count($approvedList) >= $parentTask['targetCompletions'] ? 'completed' : $parentTask['status'];
                        db_execute(
                            "UPDATE `custom_tasks` SET `approved_worker_ids` = ?, `status` = ?, `updated_at` = ? WHERE `id` = ?",
                            [json_encode($approvedList), $nextStatus, $nowIso, $parentTask['id']]
                        );
                    }
                    insert_transaction([
                        'id' => generateSafeId('tx-tsk'),
                        'userId' => $sub['workerId'],
                        'reference' => generateReference('TSK'),
                        'title' => "Task Approved: {$sub['taskTitle']}",
                        'category' => 'Task Reward',
                        'channel' => 'Admin Verified Completion',
                        'amountRwf' => $sub['rewardRwf'],
                        'direction' => 'credit',
                        'status' => 'Completed',
                        'timestamp' => $nowIso,
                    ]);
                }

                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && preg_match('#^/api/admin/loans/([^/]+)/review$#', $route, $m)) {
            $loanId = urldecode($m[1]);
            $body = get_json_body();
            $decision = ($body['decision'] ?? '') === 'approved' ? 'approved' : 'rejected';

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $loanRow = db_query_one("SELECT * FROM `loans` WHERE `id` = ? FOR UPDATE", [$loanId]);
                if (!$loanRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Loan not found.'], 404);
                }
                $loan = map_loan_row($loanRow);
                if ($loan['status'] !== 'pending_admin') {
                    $pdo->rollBack();
                    json_response(['error' => 'Loan already reviewed.'], 400);
                }

                $nowIso = utcIsoNow();
                db_execute("UPDATE `loans` SET `status` = ?, `updated_at` = ? WHERE `id` = ?", [$decision, $nowIso, $loanId]);
                if ($decision === 'approved') {
                    db_execute(
                        "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                        [$loan['principalRwf'], $nowIso, $loan['userId']]
                    );
                }
                db_execute(
                    "UPDATE `transactions` SET `status` = ? WHERE `user_id` = ? AND `category` = 'Loan' AND `status` = 'Pending Review' AND `amount_rwf` = ?",
                    [$decision === 'approved' ? 'Completed' : 'Rejected', $loan['userId'], $loan['principalRwf']]
                );
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && preg_match('#^/api/admin/investments/([^/]+)/review$#', $route, $m)) {
            $invId = urldecode($m[1]);
            $body = get_json_body();
            $decision = ($body['decision'] ?? '') === 'active' ? 'active' : 'rejected';

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $invRow = db_query_one("SELECT * FROM `investments` WHERE `id` = ? FOR UPDATE", [$invId]);
                if (!$invRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Investment not found.'], 404);
                }
                $inv = map_investment_row($invRow);
                if ($inv['status'] !== 'pending_admin') {
                    $pdo->rollBack();
                    json_response(['error' => 'Investment already reviewed.'], 400);
                }

                $nowIso = utcIsoNow();
                db_execute(
                    "UPDATE `investments` SET `status` = ?, `last_roi_credited_at` = ?, `updated_at` = ? WHERE `id` = ?",
                    [$decision, $decision === 'active' ? $nowIso : null, $nowIso, $invId]
                );
                db_execute(
                    "UPDATE `transactions` SET `status` = ? WHERE `user_id` = ? AND `category` = 'Investment Deposit' AND `status` = 'Pending Review' AND `amount_rwf` = ?",
                    [$decision === 'active' ? 'Completed' : 'Rejected', $inv['userId'], $inv['depositRwf']]
                );

                if ($decision === 'active') {
                    $investorRow = db_query_one("SELECT * FROM `users` WHERE `id` = ?", [$inv['userId']]);
                    $investor = $investorRow ? map_user_row($investorRow) : null;
                    if (!empty($investor['referredByUserId'])) {
                        $settings = get_platform_settings();
                        $commRwf = (int)round(($inv['depositRwf'] * $settings['referralCommissionPercent']) / 100);
                        if ($commRwf > 0) {
                            db_execute(
                                "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                                [$commRwf, $nowIso, $investor['referredByUserId']]
                            );
                            insert_transaction([
                                'id' => generateSafeId('tx-refinv'),
                                'userId' => $investor['referredByUserId'],
                                'reference' => generateReference('REF'),
                                'title' => "10% Investment Commission ({$inv['userName']})",
                                'category' => 'Referral Commission',
                                'channel' => "{$inv['planName']} Referral Commission",
                                'amountRwf' => $commRwf,
                                'direction' => 'credit',
                                'status' => 'Completed',
                                'timestamp' => $nowIso,
                            ]);
                        }
                    }
                }
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && preg_match('#^/api/admin/withdrawals/([^/]+)/review$#', $route, $m)) {
            $wdId = urldecode($m[1]);
            $body = get_json_body();
            $decision = ($body['decision'] ?? '') === 'paid' ? 'paid' : 'rejected';

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $wdRow = db_query_one("SELECT * FROM `withdrawals` WHERE `id` = ? FOR UPDATE", [$wdId]);
                if (!$wdRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Withdrawal not found.'], 404);
                }
                $wd = map_withdrawal_row($wdRow);
                if ($wd['status'] !== 'pending_admin') {
                    $pdo->rollBack();
                    json_response(['error' => 'Withdrawal already processed.'], 400);
                }

                $nowIso = utcIsoNow();
                db_execute("UPDATE `withdrawals` SET `status` = ?, `updated_at` = ? WHERE `id` = ?", [$decision, $nowIso, $wdId]);

                if ($decision === 'rejected') {
                    db_execute(
                        "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                        [$wd['grossAmountRwf'], $nowIso, $wd['userId']]
                    );
                } else {
                    db_execute(
                        "UPDATE `users` SET `has_completed_first_withdrawal` = 1, `updated_at` = ? WHERE `id` = ?",
                        [$nowIso, $wd['userId']]
                    );
                }
                db_execute(
                    "UPDATE `transactions` SET `status` = ? WHERE `user_id` = ? AND `category` = 'Withdrawal' AND `status` = 'Pending Review' AND `amount_rwf` = ?",
                    [$decision === 'paid' ? 'Completed' : 'Rejected', $wd['userId'], $wd['grossAmountRwf']]
                );
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && preg_match('#^/api/admin/airtime/([^/]+)/review$#', $route, $m)) {
            $reqId = urldecode($m[1]);
            $body = get_json_body();
            $decision = ($body['decision'] ?? '') === 'approved' ? 'approved' : 'rejected';

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $airRow = db_query_one("SELECT * FROM `airtime_requests` WHERE `id` = ? FOR UPDATE", [$reqId]);
                if (!$airRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'Airtime request not found.'], 404);
                }
                $air = map_airtime_row($airRow);
                if ($air['status'] !== 'pending_admin') {
                    $pdo->rollBack();
                    json_response(['error' => 'Airtime request already processed.'], 400);
                }

                $nowIso = utcIsoNow();
                db_execute("UPDATE `airtime_requests` SET `status` = ?, `updated_at` = ? WHERE `id` = ?", [$decision, $nowIso, $reqId]);
                if ($decision === 'rejected') {
                    db_execute(
                        "UPDATE `users` SET `wallet_balance_rwf` = `wallet_balance_rwf` + ?, `updated_at` = ? WHERE `id` = ?",
                        [$air['amountRwf'], $nowIso, $air['userId']]
                    );
                }
                db_execute(
                    "UPDATE `transactions` SET `status` = ? WHERE `user_id` = ? AND `category` = 'Airtime & Data' AND `status` = 'Pending Review' AND `amount_rwf` = ?",
                    [$decision === 'approved' ? 'Completed' : 'Rejected', $air['userId'], $air['amountRwf']]
                );
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && preg_match('#^/api/admin/usdt/([^/]+)/review$#', $route, $m)) {
            $reqId = urldecode($m[1]);
            $body = get_json_body();
            $decision = ($body['decision'] ?? '') === 'approved' ? 'approved' : 'rejected';

            $pdo = get_pdo();
            $pdo->beginTransaction();
            try {
                $usdtRow = db_query_one("SELECT * FROM `usdt_requests` WHERE `id` = ? FOR UPDATE", [$reqId]);
                if (!$usdtRow) {
                    $pdo->rollBack();
                    json_response(['error' => 'USDT request not found.'], 404);
                }
                $usdtReq = map_usdt_row($usdtRow);
                if ($usdtReq['status'] !== 'pending_admin') {
                    $pdo->rollBack();
                    json_response(['error' => 'USDT request already processed.'], 400);
                }

                $nowIso = utcIsoNow();
                db_execute("UPDATE `usdt_requests` SET `status` = ?, `updated_at` = ? WHERE `id` = ?", [$decision, $nowIso, $reqId]);

                $isDebit = $usdtReq['actionType'] === 'withdraw' || $usdtReq['actionType'] === 'send_binance';
                if (($usdtReq['actionType'] === 'deposit' && $decision === 'approved') || ($isDebit && $decision === 'rejected')) {
                    $userBalRow = db_query_one("SELECT `usdt_balance` FROM `users` WHERE `id` = ? FOR UPDATE", [$usdtReq['userId']]);
                    $nextUsdtBalance = round(((float)($userBalRow['usdt_balance'] ?? 0)) + (float)$usdtReq['amountUsdt'], 2);
                    db_execute(
                        "UPDATE `users` SET `usdt_balance` = ?, `updated_at` = ? WHERE `id` = ?",
                        [$nextUsdtBalance, $nowIso, $usdtReq['userId']]
                    );
                }

                $targetCategory = $usdtReq['actionType'] === 'deposit' ? 'USDT Deposit' : 'USDT Send / Withdraw';
                db_execute(
                    "UPDATE `transactions` SET `status` = ? WHERE `user_id` = ? AND `category` = ? AND `status` = 'Pending Review'",
                    [$decision === 'approved' ? 'Completed' : 'Rejected', $usdtReq['userId'], $targetCategory]
                );
                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        if ($method === 'POST' && $route === '/api/admin/promotions') {
            $body = get_json_body();
            $title = trim((string)($body['title'] ?? ''));
            $category = trim((string)($body['category'] ?? 'Official Announcement'));
            $summary = trim((string)($body['summary'] ?? ''));
            if ($title === '' || $summary === '') {
                json_response(['error' => 'Promotion title and summary required.'], 400);
            }
            db_execute(
                "INSERT INTO `promotions` (`id`, `title`, `summary`, `category`, `active`, `created_at`) VALUES (?, ?, ?, ?, ?, ?)",
                [generateSafeId('promo'), $title, $summary, $category, 1, utcIsoNow()]
            );
            json_response(['ok' => true]);
        }

        if ($method === 'POST' && preg_match('#^/api/admin/promotions/([^/]+)/toggle$#', $route, $m)) {
            $id = urldecode($m[1]);
            $row = db_query_one("SELECT `active` FROM `promotions` WHERE `id` = ?", [$id]);
            if (!$row) {
                json_response(['error' => 'Promotion not found.'], 404);
            }
            db_execute("UPDATE `promotions` SET `active` = ? WHERE `id` = ?", [!empty($row['active']) ? 0 : 1, $id]);
            json_response(['ok' => true]);
        }

        if ($method === 'DELETE' && preg_match('#^/api/admin/promotions/([^/]+)$#', $route, $m)) {
            db_execute("DELETE FROM `promotions` WHERE `id` = ?", [urldecode($m[1])]);
            json_response(['ok' => true]);
        }

        if ($method === 'PUT' && $route === '/api/admin/settings') {
            $nextSettings = get_json_body();
            db_execute(
                "UPDATE `settings` SET `data` = ?, `updated_at` = ? WHERE `key` = 'platform'",
                [json_encode($nextSettings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), utcIsoNow()]
            );
            json_response(['ok' => true]);
        }
    }

    json_response(['error' => 'API endpoint not found.'], 404);
} catch (DatabaseSetupRequiredException $e) {
    json_response(['error' => $e->getMessage(), 'setupRequired' => true], 503);
} catch (Throwable $e) {
    error_log('E-Finance PHP API error: ' . $e->getMessage());
    json_response(['error' => 'Server request could not be completed.'], 500);
}
