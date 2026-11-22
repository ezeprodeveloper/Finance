<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo);
$settings = get_settings($pdo);

$loanStmt = $pdo->prepare(
    "SELECT COALESCE(SUM(GREATEST(0, total_repayable_rwf - repaid_rwf)), 0) AS active_loan
     FROM loans WHERE user_id = :uid AND status = 'approved'"
);
$loanStmt->execute([':uid' => $authUser['id']]);
$activeLoanBalance = (float)($loanStmt->fetchColumn() ?: 0);

$txStmt = $pdo->prepare('SELECT * FROM transactions WHERE user_id = :uid ORDER BY created_at DESC LIMIT 8');
$txStmt->execute([':uid' => $authUser['id']]);
$recentTx = $txStmt->fetchAll();

$secondsRemaining = 0;
if (!empty($authUser['last_checkin_at'])) {
    $lastTs = strtotime((string)$authUser['last_checkin_at']);
    if ($lastTs !== false) {
        $secondsRemaining = max(0, ($lastTs + 86400) - time());
    }
}

$pageTitle = 'Dashboard Overview';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="cards-grid-4">
  <div class="card">
    <div class="stat-label">Main Wallet Balance</div>
    <div class="stat-value font-mono"><?= e(format_rwf($authUser['wallet_balance_rwf'])) ?></div>
    <div class="font-mono" style="font-size: 11px; color: #64748b;"><?= e($authUser['account_number']) ?></div>
  </div>
  <div class="card">
    <div class="stat-label">Savings Vault Balance</div>
    <div class="stat-value font-mono" style="color: #047857;"><?= e(format_rwf($authUser['savings_balance_rwf'])) ?></div>
    <a href="/user/savings_loans.php" style="font-size: 12px; font-weight: 600; color: #1e40af; text-decoration: none;">Manage savings &rarr;</a>
  </div>
  <div class="card">
    <div class="stat-label">Welcome Bonus &amp; Spins</div>
    <div class="stat-value font-mono" style="color: #b45309;"><?= e(format_rwf($authUser['bonus_balance_rwf'])) ?></div>
    <a href="/user/spin.php" style="font-size: 12px; font-weight: 600; color: #1e40af; text-decoration: none;"><?= (int)$authUser['spin_credits'] ?> Lucky Spin(s) &rarr;</a>
  </div>
  <div class="card">
    <div class="stat-label">Active Loan Balance</div>
    <div class="stat-value font-mono"><?= e(format_rwf($activeLoanBalance)) ?></div>
    <span class="badge <?= $authUser['kyc_status'] === 'approved' ? 'badge-success' : ($authUser['kyc_status'] === 'pending' ? 'badge-warning' : 'badge-danger') ?>">
      KYC: <?= e($authUser['kyc_status']) ?>
    </span>
  </div>
</div>

<div class="cards-grid-2">
  <section class="card bg-shifting-aurora" style="color: #ffffff; border: none; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <div style="font-size: 12px; font-weight: 600; color: #6ee7b7;">Daily 24-Hour Check-In &middot; Streak <?= (int)$authUser['checkin_streak'] ?></div>
      <h2 style="font-size: 21px; margin: 8px 0;">Claim <?= e(format_rwf((int)$settings['daily_checkin_rwf'])) ?> every 24 hours</h2>
      <p style="font-size: 13px; color: #e2e8f0; line-height: 1.6;">
        Check in once every 24 hours to credit <?= e(format_rwf((int)$settings['daily_checkin_rwf'])) ?> directly to your Main Wallet balance.
      </p>
    </div>
    <div style="margin-top: 16px;">
      <?php if ($secondsRemaining > 0): ?>
        <?php
          $h = str_pad((string)floor($secondsRemaining / 3600), 2, '0', STR_PAD_LEFT);
          $m = str_pad((string)floor(($secondsRemaining % 3600) / 60), 2, '0', STR_PAD_LEFT);
          $s = str_pad((string)($secondsRemaining % 60), 2, '0', STR_PAD_LEFT);
        ?>
        <div style="background: rgba(255,255,255,0.16); padding: 12px 16px; border-radius: 10px; display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
          <span style="color: #6ee7b7;">Check-In Claimed</span>
          <span id="checkinCountdown" data-seconds="<?= $secondsRemaining ?>" class="font-mono"><?= $h . ':' . $m . ':' . $s ?></span>
        </div>
      <?php else: ?>
        <button type="button" id="dailyCheckinBtn" class="btn btn-block" style="background: #ffffff; color: #071b38;">
          Claim <?= e(format_rwf((int)$settings['daily_checkin_rwf'])) ?> Now
        </button>
      <?php endif; ?>
    </div>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 16px;">Quick Member Actions</h2>
      <a href="/user/kyc.php" style="font-size: 12px; font-weight: 600; color: #1e40af; text-decoration: none;">KYC Desk &rarr;</a>
    </div>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
      <a href="/user/invest.php" class="btn btn-primary btn-sm">Investment Plans</a>
      <a href="/user/videos_tasks.php" class="btn btn-emerald btn-sm">Watch &amp; Earn</a>
      <a href="/user/savings_loans.php" class="btn btn-outline btn-sm">Save / Borrow</a>
      <a href="/user/withdraw.php" class="btn btn-outline btn-sm">Withdraw RWF</a>
    </div>
  </section>
</div>

<section class="card">
  <div class="card-header">
    <h2 style="font-size: 16px;">Recent Transactions</h2>
    <a href="/user/transactions.php" style="font-size: 12px; font-weight: 600; color: #1e40af; text-decoration: none;">Full History &rarr;</a>
  </div>
  <?php if (empty($recentTx)): ?>
    <p style="font-size: 13px; color: #64748b; margin: 0;">No transactions recorded yet.</p>
  <?php else: ?>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Ref</th><th>Operation</th><th>Category</th><th>Status</th><th>Date</th><th style="text-align:right;">Amount</th></tr>
        </thead>
        <tbody>
          <?php foreach ($recentTx as $tx): ?>
            <tr>
              <td class="font-mono"><?= e($tx['reference']) ?></td>
              <td><strong><?= e($tx['title']) ?></strong><br><span style="font-size: 11px; color: #64748b;"><?= e($tx['channel']) ?></span></td>
              <td><?= e($tx['category']) ?></td>
              <td><span class="badge <?= $tx['status'] === 'Completed' ? 'badge-success' : ($tx['status'] === 'Rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($tx['status']) ?></span></td>
              <td class="font-mono" style="font-size: 12px;"><?= e($tx['created_at']) ?></td>
              <td class="font-mono" style="text-align:right; font-weight: 700; color: <?= $tx['direction'] === 'credit' ? '#047857' : '#0f172a' ?>;">
                <?= $tx['direction'] === 'credit' ? '+' : '-' ?><?= e(format_rwf($tx['amount_rwf'])) ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</section>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
