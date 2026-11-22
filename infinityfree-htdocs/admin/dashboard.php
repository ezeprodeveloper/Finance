<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_admin($pdo);
$settings = get_settings($pdo);
run_daily_roi_engine($pdo);

$counts = [
    'members' => (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'member'")->fetchColumn(),
    'pending_reg' => (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'member' AND account_status = 'pending_approval'")->fetchColumn(),
    'pending_act' => (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'member' AND account_status IN ('awaiting_payment', 'payment_submitted')")->fetchColumn(),
    'pending_kyc' => (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'member' AND kyc_status = 'pending'")->fetchColumn(),
    'pending_videos' => (int)$pdo->query("SELECT COUNT(*) FROM video_campaigns WHERE status = 'pending_admin'")->fetchColumn(),
    'pending_tasks' => (int)$pdo->query("SELECT COUNT(*) FROM custom_tasks WHERE status = 'pending_admin'")->fetchColumn(),
    'pending_subs' => (int)$pdo->query("SELECT COUNT(*) FROM task_submissions WHERE status = 'pending_admin'")->fetchColumn(),
    'pending_inv' => (int)$pdo->query("SELECT COUNT(*) FROM user_investments WHERE status = 'pending_admin'")->fetchColumn(),
    'pending_loans' => (int)$pdo->query("SELECT COUNT(*) FROM loans WHERE status = 'pending_admin'")->fetchColumn(),
    'pending_wd' => (int)$pdo->query("SELECT COUNT(*) FROM withdrawals WHERE status = 'pending_admin'")->fetchColumn(),
    'fees_earned' => (float)($pdo->query("SELECT COALESCE(SUM(fee_rwf), 0) FROM withdrawals WHERE status = 'paid'")->fetchColumn() ?: 0),
];

$pageTitle = 'Admin Overview';
$isAdminLayout = true;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="cards-grid-4">
  <div class="card">
    <div class="stat-label">Registered Members</div>
    <div class="stat-value font-mono"><?= $counts['members'] ?></div>
    <div style="font-size: 12px; color: #b45309;"><?= $counts['pending_reg'] ?> awaiting approval</div>
  </div>
  <div class="card">
    <div class="stat-label">Activations &amp; Rwanda KYC</div>
    <div class="stat-value font-mono"><?= $counts['pending_act'] + $counts['pending_kyc'] ?></div>
    <div style="font-size: 12px; color: #64748b;"><?= $counts['pending_act'] ?> payments &middot; <?= $counts['pending_kyc'] ?> KYC</div>
  </div>
  <div class="card">
    <div class="stat-label">Videos &amp; Task Reviews</div>
    <div class="stat-value font-mono"><?= $counts['pending_videos'] + $counts['pending_tasks'] + $counts['pending_subs'] ?></div>
    <div style="font-size: 12px; color: #64748b;"><?= $counts['pending_subs'] ?> worker proof(s)</div>
  </div>
  <div class="card">
    <div class="stat-label">Withdrawal Fees Earned</div>
    <div class="stat-value font-mono" style="color: #047857;"><?= e(format_rwf($counts['fees_earned'])) ?></div>
    <div style="font-size: 12px; color: #64748b;"><?= $counts['pending_inv'] ?> inv &middot; <?= $counts['pending_loans'] ?> loans &middot; <?= $counts['pending_wd'] ?> payout</div>
  </div>
</div>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header"><h2 style="font-size: 17px;">Operations Queue</h2></div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <a href="/admin/users.php" class="btn btn-outline" style="justify-content: space-between;">
        <span>Member Approvals &amp; 200 RWF Activations</span>
        <span class="font-mono"><?= $counts['pending_reg'] + $counts['pending_act'] ?></span>
      </a>
      <a href="/admin/kyc_review.php" class="btn btn-outline" style="justify-content: space-between;">
        <span>Rwanda KYC Verification Queue</span>
        <span class="font-mono"><?= $counts['pending_kyc'] ?></span>
      </a>
      <a href="/admin/moderation.php" class="btn btn-outline" style="justify-content: space-between;">
        <span>Short Videos, Tasks &amp; Proof Approvals</span>
        <span class="font-mono"><?= $counts['pending_videos'] + $counts['pending_tasks'] + $counts['pending_subs'] ?></span>
      </a>
      <a href="/admin/finance.php" class="btn btn-outline" style="justify-content: space-between;">
        <span>Investments, Loans &amp; Payouts</span>
        <span class="font-mono"><?= $counts['pending_inv'] + $counts['pending_loans'] + $counts['pending_wd'] ?></span>
      </a>
    </div>
  </section>

  <section class="card bg-shifting-aurora" style="color: #ffffff; border: none;">
    <div style="font-size: 12px; color: #6ee7b7; font-weight: 600;">Active Rules</div>
    <h2 style="font-size: 20px; margin: 6px 0 14px;">E-Finance System Parameters</h2>
    <div class="font-mono" style="font-size: 12.5px; line-height: 1.9; color: #e2e8f0;">
      <div>MoMo Pay Code: <?= e($settings['momo_pay_code']) ?></div>
      <div>Activation Fee: <?= e(format_rwf((int)$settings['activation_fee_rwf'])) ?> &middot; Bonus: <?= e(format_rwf((int)$settings['welcome_bonus_rwf'])) ?></div>
      <div>Daily 24h Check-In: <?= e(format_rwf((int)$settings['daily_checkin_rwf'])) ?> &middot; Min Video: <?= e(format_rwf((int)$settings['min_video_reward_rwf'])) ?></div>
      <div>First Withdrawal Fee: <?= e((string)$settings['withdrawal_fee_percent']) ?>% &middot; Standard: <?= e(format_rwf((int)$settings['subsequent_min_withdrawal_rwf'])) ?>–<?= e(format_rwf((int)$settings['subsequent_max_withdrawal_rwf'])) ?></div>
      <div>Referral Commission: <?= e((string)$settings['referral_commission_percent']) ?>% + 1 Spin</div>
    </div>
    <a href="/admin/settings.php" class="btn btn-sm" style="background: #ffffff; color: #071b38; margin-top: 14px;">Update Settings</a>
  </section>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
