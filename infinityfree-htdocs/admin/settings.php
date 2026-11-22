<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_admin($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = (string)($_POST['action'] ?? 'save_settings');

    if ($action === 'save_settings') {
        $actFee = max(0, (int)($_POST['activation_fee_rwf'] ?? 200));
        $bonus = max(0, (int)($_POST['welcome_bonus_rwf'] ?? 200));
        $checkin = max(0, (int)($_POST['daily_checkin_rwf'] ?? 20));
        $wdFee = max(0.0, min(90.0, (float)($_POST['withdrawal_fee_percent'] ?? 25)));
        $subMin = max(100, (int)($_POST['subsequent_min_withdrawal_rwf'] ?? 1000));
        $subMax = max($subMin, (int)($_POST['subsequent_max_withdrawal_rwf'] ?? 5000));
        $refComm = max(0.0, min(50.0, (float)($_POST['referral_commission_percent'] ?? 10)));
        $minVid = max(10, (int)($_POST['min_video_reward_rwf'] ?? 50));
        $momoCode = trim((string)($_POST['momo_pay_code'] ?? '1880554'));
        $tagline = trim((string)($_POST['platform_tagline'] ?? ''));
        $maint = isset($_POST['maintenance_mode']) ? 1 : 0;

        if ($momoCode === '' || $tagline === '') {
            flash_set('error', 'Merchant MoMo code and platform tagline cannot be empty.');
        } else {
            $stmt = $pdo->prepare(
                'UPDATE system_settings
                 SET activation_fee_rwf = :af,
                     welcome_bonus_rwf = :wb,
                     daily_checkin_rwf = :dc,
                     withdrawal_fee_percent = :wf,
                     subsequent_min_withdrawal_rwf = :smin,
                     subsequent_max_withdrawal_rwf = :smax,
                     referral_commission_percent = :rc,
                     min_video_reward_rwf = :mv,
                     momo_pay_code = :mc,
                     platform_tagline = :pt,
                     maintenance_mode = :mm
                 WHERE id = 1'
            );
            $stmt->execute([
                ':af' => $actFee,
                ':wb' => $bonus,
                ':dc' => $checkin,
                ':wf' => $wdFee,
                ':smin' => $subMin,
                ':smax' => $subMax,
                ':rc' => $refComm,
                ':mv' => $minVid,
                ':mc' => $momoCode,
                ':pt' => $tagline,
                ':mm' => $maint,
            ]);
            flash_set('success', 'System settings updated.');
        }
    } elseif ($action === 'update_admin_password') {
        $currentPass = (string)($_POST['current_password'] ?? '');
        $newPass = (string)($_POST['new_password'] ?? '');
        if (!password_verify($currentPass, (string)$authUser['password_hash'])) {
            flash_set('error', 'Current administrator password is incorrect.');
        } elseif (strlen($newPass) < 8) {
            flash_set('error', 'New administrator password must be at least 8 characters.');
        } else {
            $newHash = password_hash($newPass, PASSWORD_BCRYPT, ['cost' => 12]);
            $pdo->prepare('UPDATE users SET password_hash = :ph WHERE id = :id')
                ->execute([':ph' => $newHash, ':id' => $authUser['id']]);
            flash_set('success', 'Administrator password updated securely.');
        }
    }

    header('Location: /admin/settings.php');
    exit;
}

$settings = get_settings($pdo);

$pageTitle = 'System Settings';
$isAdminLayout = true;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Platform Financial &amp; Operations Rules</h2>
    </div>
    <form method="post" action="/admin/settings.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="save_settings">
      <div class="form-grid">
        <div class="form-group">
          <label>Activation Fee (RWF)</label>
          <input name="activation_fee_rwf" type="number" min="0" value="<?= (int)$settings['activation_fee_rwf'] ?>" class="form-control font-mono" required>
        </div>
        <div class="form-group">
          <label>Welcome Bonus (RWF)</label>
          <input name="welcome_bonus_rwf" type="number" min="0" value="<?= (int)$settings['welcome_bonus_rwf'] ?>" class="form-control font-mono" required>
        </div>
        <div class="form-group">
          <label>Daily 24h Check-In Reward (RWF)</label>
          <input name="daily_checkin_rwf" type="number" min="0" value="<?= (int)$settings['daily_checkin_rwf'] ?>" class="form-control font-mono" required>
        </div>
        <div class="form-group">
          <label>First Withdrawal Fee (%)</label>
          <input name="withdrawal_fee_percent" type="number" step="0.01" min="0" max="90" value="<?= (float)$settings['withdrawal_fee_percent'] ?>" class="form-control font-mono" required>
        </div>
        <div class="form-group">
          <label>Subsequent Min Withdrawal (RWF)</label>
          <input name="subsequent_min_withdrawal_rwf" type="number" min="100" value="<?= (int)$settings['subsequent_min_withdrawal_rwf'] ?>" class="form-control font-mono" required>
        </div>
        <div class="form-group">
          <label>Subsequent Max Withdrawal (RWF)</label>
          <input name="subsequent_max_withdrawal_rwf" type="number" min="100" value="<?= (int)$settings['subsequent_max_withdrawal_rwf'] ?>" class="form-control font-mono" required>
        </div>
        <div class="form-group">
          <label>Referral Commission (%)</label>
          <input name="referral_commission_percent" type="number" step="0.01" min="0" max="50" value="<?= (float)$settings['referral_commission_percent'] ?>" class="form-control font-mono" required>
        </div>
        <div class="form-group">
          <label>Min Short Video Rate (RWF)</label>
          <input name="min_video_reward_rwf" type="number" min="10" value="<?= (int)$settings['min_video_reward_rwf'] ?>" class="form-control font-mono" required>
        </div>
      </div>

      <div class="form-group">
        <label>Rwanda Merchant MoMo Code</label>
        <input name="momo_pay_code" type="text" value="<?= e($settings['momo_pay_code']) ?>" class="form-control font-mono" required>
      </div>
      <div class="form-group">
        <label>Public Landing Page Tagline</label>
        <input name="platform_tagline" type="text" value="<?= e($settings['platform_tagline']) ?>" class="form-control" required>
      </div>
      <div class="form-group" style="flex-direction: row; align-items: center; gap: 10px;">
        <input id="maintMode" name="maintenance_mode" type="checkbox" <?= (int)$settings['maintenance_mode'] === 1 ? 'checked' : '' ?>>
        <label for="maintMode" style="margin: 0;">Enable Maintenance Mode (temporarily pauses member portal access)</label>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Save System Parameters</button>
    </form>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Administrator Security</h2>
    </div>
    <p style="font-size: 13px; color: #475569; margin-top: 0;">
      Signed in as <strong class="font-mono"><?= e($authUser['email']) ?></strong>. Update your administrator login password below after initial deployment.
    </p>
    <form method="post" action="/admin/settings.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="update_admin_password">
      <div class="form-group">
        <label>Current Password *</label>
        <input name="current_password" type="password" class="form-control" required>
      </div>
      <div class="form-group">
        <label>New Password (8+ characters) *</label>
        <input name="new_password" type="password" minlength="8" class="form-control" required>
      </div>
      <button type="submit" class="btn btn-emerald">Update Administrator Password</button>
    </form>
  </section>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
