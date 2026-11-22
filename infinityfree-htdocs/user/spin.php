<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo);
$settings = get_settings($pdo);

$refStmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE referred_by_user_id = :uid AND account_status = 'active'");
$refStmt->execute([':uid' => $authUser['id']]);
$activeReferrals = (int)$refStmt->fetchColumn();

$histStmt = $pdo->prepare('SELECT * FROM spin_history WHERE user_id = :uid ORDER BY spun_at DESC LIMIT 12');
$histStmt->execute([':uid' => $authUser['id']]);
$spinHistory = $histStmt->fetchAll();

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$referralLink = $scheme . '://' . $host . '/register.php?ref=' . rawurlencode((string)$authUser['referral_code']);

$pageTitle = 'Lucky Spin & Referrals';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="cards-grid-3">
  <div class="card">
    <div class="stat-label">Available Spin Credits</div>
    <div class="stat-value font-mono"><?= (int)$authUser['spin_credits'] ?> spin(s)</div>
    <div style="font-size: 12px; color: #64748b;">Earn +1 free spin per activated referral</div>
  </div>
  <div class="card">
    <div class="stat-label">Active Referred Members</div>
    <div class="stat-value font-mono" style="color: #047857;"><?= $activeReferrals ?></div>
    <div style="font-size: 12px; color: #64748b;">+<?= e((string)$settings['referral_commission_percent']) ?>% commission on deposits</div>
  </div>
  <div class="card">
    <div class="stat-label">Your Referral Code</div>
    <div class="stat-value font-mono" style="color: #1e40af; font-size: 18px;"><?= e($authUser['referral_code']) ?></div>
    <input type="text" readonly value="<?= e($referralLink) ?>" class="form-control font-mono" style="font-size: 11px; min-height: 32px;" onclick="this.select();">
  </div>
</div>

<div class="cards-grid-2">
  <section class="card" style="display: flex; flex-direction: column; align-items: center;">
    <div class="card-header" style="width: 100%;">
      <h2 style="font-size: 17px;">E-Finance Lucky Spin Wheel</h2>
    </div>
    <div style="width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-top: 20px solid #f59e0b; margin-bottom: -8px; z-index: 5;"></div>
    <canvas id="luckyWheelCanvas" width="320" height="320" style="max-width: 100%;"></canvas>
    <div id="spinResultBanner" class="hidden" style="margin-top: 14px; width: 100%;"></div>
    <button type="button" id="spinNowBtn" class="btn btn-primary" style="margin-top: 16px;" <?= (int)$authUser['spin_credits'] <= 0 ? 'disabled' : '' ?>>
      <?= (int)$authUser['spin_credits'] > 0 ? 'Spin Now (' . (int)$authUser['spin_credits'] . ' left)' : 'No Spin Credits — Invite Friends' ?>
    </button>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Recent Spin Wins</h2>
    </div>
    <?php if (empty($spinHistory)): ?>
      <p style="font-size: 13px; color: #64748b;">No spin wins recorded yet.</p>
    <?php else: ?>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th style="text-align:right;">Reward</th></tr></thead>
          <tbody>
            <?php foreach ($spinHistory as $sp): ?>
              <tr>
                <td class="font-mono" style="font-size: 12px;"><?= e($sp['spun_at']) ?></td>
                <td class="font-mono" style="text-align:right; color: #047857; font-weight: 700;">+<?= e(format_rwf($sp['reward_rwf'])) ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </section>
</div>

<script src="/assets/js/spin_wheel.js"></script>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
