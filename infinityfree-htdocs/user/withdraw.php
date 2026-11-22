<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo);
$settings = get_settings($pdo);
$isFirstBonus = (int)$authUser['has_completed_first_withdrawal'] === 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    if ($authUser['kyc_status'] !== 'approved') {
        flash_set('error', 'Rwanda KYC approval is required before withdrawing.');
        header('Location: /user/withdraw.php');
        exit;
    }

    $network = (string)($_POST['network'] ?? 'MTN Rwanda');
    $destType = $network === 'Airtel / Tigo Rwanda' ? 'Phone Number' : (string)($_POST['destination_type'] ?? 'Phone Number');
    $destValue = trim((string)($_POST['destination_value'] ?? ''));
    $regNames = trim((string)($_POST['account_registered_names'] ?? ''));
    $gross = round((float)($_POST['gross_amount_rwf'] ?? 0));

    if (!in_array($network, ['MTN Rwanda', 'Airtel / Tigo Rwanda'], true) || !in_array($destType, ['Phone Number', 'MoMo Pay Code'], true)) {
        flash_set('error', 'Invalid Mobile Money network or destination.');
    } elseif ($destType === 'Phone Number' && !valid_rwanda_phone($destValue)) {
        flash_set('error', 'Enter a valid Rwanda Mobile Money phone number.');
    } elseif ($destType === 'MoMo Pay Code' && strlen($destValue) < 4) {
        flash_set('error', 'Enter a valid MTN MoMo Pay Code.');
    } elseif (strlen($regNames) < 3) {
        flash_set('error', 'Enter registered Mobile Money account names.');
    } else {
        $minLimit = $isFirstBonus ? 100 : (int)$settings['subsequent_min_withdrawal_rwf'];
        $maxLimit = $isFirstBonus ? 1000000 : (int)$settings['subsequent_max_withdrawal_rwf'];
        $feePct = $isFirstBonus ? (float)$settings['withdrawal_fee_percent'] : 0.0;

        if ($gross < $minLimit || $gross > $maxLimit) {
            flash_set('error', 'Withdrawal amount must be between ' . format_rwf($minLimit) . ' and ' . format_rwf($maxLimit) . '.');
        } else {
            $pdo->beginTransaction();
            try {
                $uStmt = $pdo->prepare('SELECT wallet_balance_rwf FROM users WHERE id = :id FOR UPDATE');
                $uStmt->execute([':id' => $authUser['id']]);
                $bal = (float)$uStmt->fetchColumn();
                if ($gross > $bal) {
                    throw new RuntimeException('Insufficient main wallet balance.');
                }

                $feeRwf = round(($gross * $feePct) / 100);
                $netRwf = max(0, $gross - $feeRwf);

                $pdo->prepare('UPDATE users SET wallet_balance_rwf = wallet_balance_rwf - :g WHERE id = :id')
                    ->execute([':g' => $gross, ':id' => $authUser['id']]);

                $pdo->prepare(
                    'INSERT INTO withdrawals (user_id, network, destination_type, destination_value, account_registered_names, gross_amount_rwf, fee_percent, fee_rwf, net_amount_rwf, is_first_bonus_withdrawal)
                     VALUES (:uid, :net, :dt, :dv, :arn, :g, :fp, :fr, :nr, :fb)'
                )->execute([
                    ':uid' => $authUser['id'], ':net' => $network, ':dt' => $destType, ':dv' => $destValue,
                    ':arn' => $regNames, ':g' => $gross, ':fp' => $feePct, ':fr' => $feeRwf,
                    ':nr' => $netRwf, ':fb' => $isFirstBonus ? 1 : 0,
                ]);

                log_transaction(
                    $pdo,
                    (int)$authUser['id'],
                    'Withdrawal (' . $network . ') — Net ' . format_rwf($netRwf),
                    'Withdrawal',
                    $network . ' · ' . $destType . ': ' . $destValue . ' (' . $regNames . ')',
                    $gross,
                    'debit',
                    'Pending Review',
                    $feeRwf,
                    'WDR'
                );

                $pdo->commit();
                flash_set('success', 'Withdrawal request submitted. Net payout after ' . $feePct . '% fee: ' . format_rwf($netRwf) . '.');
            } catch (Throwable $ex) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                flash_set('error', $ex->getMessage());
            }
        }
    }

    header('Location: /user/withdraw.php');
    exit;
}

$wdStmt = $pdo->prepare('SELECT * FROM withdrawals WHERE user_id = :uid ORDER BY created_at DESC');
$wdStmt->execute([':uid' => $authUser['id']]);
$myWithdrawals = $wdStmt->fetchAll();

$pageTitle = 'Withdraw to Mobile Money';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Request Withdrawal</h2>
      <span class="font-mono" style="font-size: 13px; font-weight: 700;">Balance: <?= e(format_rwf($authUser['wallet_balance_rwf'])) ?></span>
    </div>

    <?php if ($authUser['kyc_status'] !== 'approved'): ?>
      <div class="alert alert-error">Rwanda KYC verification is required before withdrawing. <a href="/user/kyc.php">Complete KYC &rarr;</a></div>
    <?php else: ?>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; padding: 10px 12px; font-size: 12.5px; margin-bottom: 14px;">
        <?php if ($isFirstBonus): ?>
          <strong>First Withdrawal (Welcome Bonus):</strong> System deducts <?= e((string)$settings['withdrawal_fee_percent']) ?>% fee automatically. Subsequent withdrawals allow <?= e(format_rwf((int)$settings['subsequent_min_withdrawal_rwf'])) ?> &ndash; <?= e(format_rwf((int)$settings['subsequent_max_withdrawal_rwf'])) ?>.
        <?php else: ?>
          <strong>Standard Withdrawal Limits:</strong> Minimum <?= e(format_rwf((int)$settings['subsequent_min_withdrawal_rwf'])) ?> &middot; Maximum <?= e(format_rwf((int)$settings['subsequent_max_withdrawal_rwf'])) ?> per transaction.
        <?php endif; ?>
      </div>

      <form method="post" action="/user/withdraw.php">
        <?= csrf_field() ?>
        <div class="form-grid">
          <div class="form-group">
            <label for="wdNetwork">Rwanda Network *</label>
            <select id="wdNetwork" name="network" class="form-control" required>
              <option value="MTN Rwanda">MTN Rwanda</option>
              <option value="Airtel / Tigo Rwanda">Airtel / Tigo Rwanda</option>
            </select>
          </div>
          <div class="form-group" id="wdDestTypeWrap">
            <label for="wdDestType">MTN Destination *</label>
            <select id="wdDestType" name="destination_type" class="form-control">
              <option value="Phone Number">Phone Number</option>
              <option value="MoMo Pay Code">MoMo Pay Code</option>
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label id="wdDestLbl" for="wdDestVal">Phone Number / MoMo Code *</label>
            <input id="wdDestVal" name="destination_value" type="text" class="form-control font-mono" required value="<?= e($authUser['phone']) ?>">
          </div>
          <div class="form-group">
            <label for="wdNames">Registered Account Names *</label>
            <input id="wdNames" name="account_registered_names" type="text" class="form-control" required value="<?= e($authUser['first_name'] . ' ' . $authUser['second_name']) ?>">
          </div>
        </div>
        <div class="form-group">
          <label for="wdAmount">Amount (RWF) *</label>
          <input id="wdAmount" name="gross_amount_rwf" type="number"
                 min="<?= $isFirstBonus ? 100 : (int)$settings['subsequent_min_withdrawal_rwf'] ?>"
                 <?= $isFirstBonus ? '' : 'max="' . (int)$settings['subsequent_max_withdrawal_rwf'] . '"' ?>
                 value="<?= $isFirstBonus ? (int)$settings['welcome_bonus_rwf'] : (int)$settings['subsequent_min_withdrawal_rwf'] ?>"
                 class="form-control font-mono" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Submit Withdrawal Request</button>
      </form>
    <?php endif; ?>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Your Withdrawals</h2>
    </div>
    <?php if (empty($myWithdrawals)): ?>
      <p style="font-size: 13px; color: #64748b;">No withdrawal requests yet.</p>
    <?php else: ?>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Destination</th><th>Gross</th><th>Fee</th><th>Net Payout</th><th>Status</th></tr></thead>
          <tbody>
            <?php foreach ($myWithdrawals as $wd): ?>
              <tr>
                <td><strong><?= e($wd['network']) ?></strong><br><span class="font-mono" style="font-size: 11px;"><?= e($wd['destination_type'] . ': ' . $wd['destination_value']) ?></span><br><span style="font-size: 11px; color: #64748b;"><?= e($wd['account_registered_names']) ?></span></td>
                <td class="font-mono"><?= e(format_rwf($wd['gross_amount_rwf'])) ?></td>
                <td class="font-mono"><?= e(format_rwf($wd['fee_rwf'])) ?> (<?= (float)$wd['fee_percent'] ?>%)</td>
                <td class="font-mono" style="color: #047857; font-weight: 700;"><?= e(format_rwf($wd['net_amount_rwf'])) ?></td>
                <td><span class="badge <?= $wd['status'] === 'paid' ? 'badge-success' : ($wd['status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($wd['status']) ?></span></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </section>
</div>

<script>
(function () {
  var netSel = document.getElementById('wdNetwork');
  var dtWrap = document.getElementById('wdDestTypeWrap');
  var dtSel = document.getElementById('wdDestType');
  var lbl = document.getElementById('wdDestLbl');
  if (!netSel || !dtWrap || !dtSel || !lbl) return;
  function sync() {
    if (netSel.value === 'Airtel / Tigo Rwanda') {
      dtWrap.style.display = 'none';
      dtSel.value = 'Phone Number';
      lbl.textContent = 'Airtel / Tigo Phone Number *';
    } else {
      dtWrap.style.display = 'flex';
      lbl.textContent = dtSel.value === 'MoMo Pay Code' ? 'MTN MoMo Pay Code *' : 'MTN Phone Number *';
    }
  }
  netSel.addEventListener('change', sync);
  dtSel.addEventListener('change', sync);
  sync();
})();
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
