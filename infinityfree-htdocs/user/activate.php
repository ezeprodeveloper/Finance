<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo, false);
$settings = get_settings($pdo);

if ($authUser['account_status'] === 'active') {
    header('Location: /user/dashboard.php');
    exit;
}
if ($authUser['account_status'] === 'pending_approval') {
    header('Location: /user/pending.php');
    exit;
}

$fee = (int)$settings['activation_fee_rwf'];
$ussdCode = build_ussd_code((string)$settings['momo_pay_code'], $fee);
$ussdHref = build_ussd_href((string)$settings['momo_pay_code'], $fee);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $phone = trim((string)($_POST['activation_phone'] ?? ''));
    $ref = trim((string)($_POST['activation_ref'] ?? ''));

    if (!valid_rwanda_phone($phone) || strlen($ref) < 4) {
        flash_set('error', 'Enter a valid Rwanda Mobile Money phone number and Transaction ID.');
    } else {
        $pdo->beginTransaction();
        try {
            $upd = $pdo->prepare(
                "UPDATE users
                 SET account_status = 'payment_submitted',
                     activation_phone = :phone,
                     activation_ref = :ref
                 WHERE id = :id"
            );
            $upd->execute([':phone' => $phone, ':ref' => $ref, ':id' => $authUser['id']]);

            log_transaction(
                $pdo,
                (int)$authUser['id'],
                'System Activation Fee (' . $fee . ' RWF)',
                'Activation',
                $ussdCode . ' · Ref ' . $ref,
                (float)$fee,
                'debit',
                'Pending Review',
                0.0,
                'ACT'
            );
            $pdo->commit();
            flash_set('success', 'Activation payment confirmation submitted. Admin will verify and credit your welcome bonus.');
        } catch (Throwable $ex) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            flash_set('error', 'Could not save activation details.');
        }
    }
    header('Location: /user/activate.php');
    exit;
}

$pageTitle = 'Activate Account (' . format_rwf($fee) . ')';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="card" style="max-width: 600px; margin: 24px auto;">
  <span class="badge badge-success">Registration Approved</span>
  <h2 style="font-size: 22px; color: #071b38; margin-top: 8px;">Activate Your Account (<?= e(format_rwf($fee)) ?>)</h2>
  <p style="font-size: 13.5px; color: #475569; line-height: 1.65;">
    Dial the Rwanda Mobile Money USSD payment code below to pay <?= e(format_rwf($fee)) ?>. Once confirmed by Admin, your dashboard opens with a <?= e(format_rwf((int)$settings['welcome_bonus_rwf'])) ?> welcome bonus.
  </p>

  <div class="ussd-box" style="margin: 18px 0;">
    <div>
      <div style="font-size: 11px; color: #cbd5e1;">Tap to Dial Rwanda MoMo USSD Code</div>
      <a href="<?= e($ussdHref) ?>" class="ussd-link font-mono"><?= e($ussdCode) ?></a>
    </div>
    <a href="<?= e($ussdHref) ?>" class="btn btn-emerald btn-sm">Dial Now</a>
  </div>

  <?php if ($authUser['account_status'] === 'payment_submitted'): ?>
    <div class="alert alert-success">
      <strong>Payment Confirmation Submitted</strong><br>
      Phone: <span class="font-mono"><?= e($authUser['activation_phone']) ?></span> · Ref: <span class="font-mono"><?= e($authUser['activation_ref']) ?></span><br>
      Admin is confirming your transfer now.
    </div>
  <?php else: ?>
    <form method="post" action="/user/activate.php">
      <?= csrf_field() ?>
      <div class="form-group">
        <label for="actPhone">Mobile Money Phone Used *</label>
        <input id="actPhone" name="activation_phone" type="tel" class="form-control font-mono" required value="<?= e($authUser['phone']) ?>">
      </div>
      <div class="form-group">
        <label for="actRef">MoMo Transaction Reference ID *</label>
        <input id="actRef" name="activation_ref" type="text" class="form-control font-mono" required placeholder="Enter MoMo Transaction ID">
      </div>
      <button type="submit" class="btn btn-emerald btn-block">Confirm <?= e(format_rwf($fee)) ?> Activation Payment</button>
    </form>
  <?php endif; ?>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
