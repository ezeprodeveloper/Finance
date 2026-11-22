<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo);
$settings = get_settings($pdo);

$tiersStmt = $pdo->query('SELECT * FROM investment_tiers WHERE is_active = 1 ORDER BY deposit_rwf ASC');
$tiers = $tiersStmt->fetchAll();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $tierId = trim((string)($_POST['tier_id'] ?? ''));
    $paymentRef = trim((string)($_POST['payment_ref'] ?? ''));

    $tierStmt = $pdo->prepare('SELECT * FROM investment_tiers WHERE id = :id AND is_active = 1 LIMIT 1');
    $tierStmt->execute([':id' => $tierId]);
    $tier = $tierStmt->fetch();

    if (!$tier || strlen($paymentRef) < 4) {
        flash_set('error', 'Select a valid investment plan and enter your MoMo Transaction Reference ID.');
    } else {
        $payCode = build_ussd_code((string)$settings['momo_pay_code'], (int)$tier['deposit_rwf']);
        $pdo->beginTransaction();
        try {
            $ins = $pdo->prepare(
                'INSERT INTO user_investments (user_id, tier_id, plan_name, deposit_rwf, daily_return_rwf, duration_days, payment_code, payment_ref)
                 VALUES (:uid, :tid, :pn, :dep, :dr, :dd, :pc, :pr)'
            );
            $ins->execute([
                ':uid' => $authUser['id'], ':tid' => $tier['id'], ':pn' => $tier['name'],
                ':dep' => $tier['deposit_rwf'], ':dr' => $tier['daily_return_rwf'],
                ':dd' => $tier['duration_days'], ':pc' => $payCode, ':pr' => $paymentRef,
            ]);

            log_transaction(
                $pdo,
                (int)$authUser['id'],
                'Investment Plan Deposit: ' . $tier['name'],
                'Investment Deposit',
                $payCode . ' · Ref ' . $paymentRef,
                (float)$tier['deposit_rwf'],
                'debit',
                'Pending Review',
                0.0,
                'INV'
            );
            $pdo->commit();
            flash_set('success', 'Investment deposit submitted! Admin will confirm your MoMo reference and start 24h daily payouts.');
        } catch (Throwable $ex) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            flash_set('error', 'Could not save investment request.');
        }
    }
    header('Location: /user/invest.php');
    exit;
}

$invStmt = $pdo->prepare('SELECT * FROM user_investments WHERE user_id = :uid ORDER BY created_at DESC');
$invStmt->execute([':uid' => $authUser['id']]);
$myInvestments = $invStmt->fetchAll();

$pageTitle = 'Daily Investment Plans';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header">
      <div>
        <h2 style="font-size: 17px;">10 Daily Return Tiers</h2>
        <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">Tap a tier's USSD code to pay via Rwanda MoMo and earn automatic 24-hour payouts.</p>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 18px;">
      <?php foreach ($tiers as $t): ?>
        <?php $href = build_ussd_href((string)$settings['momo_pay_code'], (int)$t['deposit_rwf']); ?>
        <div style="border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; background: #f8fafc;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong class="font-mono" style="font-size: 15px; color: #071b38;"><?= e(format_rwf($t['deposit_rwf'])) ?></strong>
            <span class="font-mono" style="font-size: 12px; font-weight: 700; color: #047857;">+<?= e(format_rwf($t['daily_return_rwf'])) ?>/day</span>
          </div>
          <div style="font-size: 12px; color: #475569; margin: 4px 0 8px;"><?= e($t['name']) ?> &middot; <?= (int)$t['duration_days'] ?>d</div>
          <a href="<?= e($href) ?>" class="btn btn-primary btn-sm btn-block font-mono" style="font-size: 11px;">
            Dial <?= e(build_ussd_code((string)$settings['momo_pay_code'], (int)$t['deposit_rwf'])) ?>
          </a>
        </div>
      <?php endforeach; ?>
    </div>

    <form method="post" action="/user/invest.php">
      <?= csrf_field() ?>
      <div class="form-grid">
        <div class="form-group">
          <label for="invTier">Select Paid Plan *</label>
          <select id="invTier" name="tier_id" class="form-control" required>
            <?php foreach ($tiers as $t): ?>
              <option value="<?= e($t['id']) ?>"><?= e($t['name']) ?> — <?= e(format_rwf($t['deposit_rwf'])) ?> (+<?= e(format_rwf($t['daily_return_rwf'])) ?>/day)</option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group">
          <label for="invRef">MoMo Transaction ID / Reference *</label>
          <input id="invRef" name="payment_ref" type="text" class="form-control font-mono" required placeholder="Enter MoMo ref after dialing USSD">
        </div>
      </div>
      <button type="submit" class="btn btn-emerald">Submit Deposit Confirmation</button>
    </form>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Your Investment Plans</h2>
    </div>
    <?php if (empty($myInvestments)): ?>
      <p style="font-size: 13px; color: #64748b;">No investment plans submitted yet.</p>
    <?php else: ?>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Plan</th><th>Deposit</th><th>Daily ROI</th><th>Earned</th><th>Status</th></tr>
          </thead>
          <tbody>
            <?php foreach ($myInvestments as $inv): ?>
              <tr>
                <td><strong><?= e($inv['plan_name']) ?></strong><br><span class="font-mono" style="font-size: 11px; color: #64748b;">Ref: <?= e($inv['payment_ref']) ?></span></td>
                <td class="font-mono"><?= e(format_rwf($inv['deposit_rwf'])) ?></td>
                <td class="font-mono" style="color: #047857;">+<?= e(format_rwf($inv['daily_return_rwf'])) ?></td>
                <td class="font-mono"><strong><?= e(format_rwf($inv['total_earned_rwf'])) ?></strong></td>
                <td><span class="badge <?= $inv['status'] === 'active' || $inv['status'] === 'completed' ? 'badge-success' : ($inv['status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($inv['status']) ?></span></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </section>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
