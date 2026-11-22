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
if ($authUser['account_status'] === 'awaiting_payment' || $authUser['account_status'] === 'payment_submitted') {
    header('Location: /user/activate.php');
    exit;
}

$pageTitle = 'Account Verification Pending';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="card" style="max-width: 640px; margin: 24px auto;">
  <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 18px;">
    <?php if (!empty($authUser['profile_photo_path'])): ?>
      <img src="/<?= e($authUser['profile_photo_path']) ?>" alt="Member Photo" class="avatar-lg">
    <?php endif; ?>
    <div>
      <span class="badge badge-warning">Pending Admin Approval</span>
      <h2 style="font-size: 20px; color: #071b38; margin-top: 6px;">
        Hello, <?= e($authUser['first_name'] . ' ' . $authUser['second_name']) ?>
      </h2>
      <p class="font-mono" style="font-size: 12px; color: #64748b; margin: 2px 0 0;"><?= e($authUser['account_number']) ?></p>
    </div>
  </div>

  <p style="font-size: 14px; color: #334155; line-height: 1.65;">
    Your 3-step E-Finance Rwanda registration has been received. Admin is verifying your identification details, education records, and locked profile photo.
    Once approved, you will unlock the <?= e(format_rwf((int)$settings['activation_fee_rwf'])) ?> activation step and receive your <?= e(format_rwf((int)$settings['welcome_bonus_rwf'])) ?> welcome bonus.
  </p>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; font-size: 13px; line-height: 1.7;">
    <div><strong>National ID:</strong> <span class="font-mono"><?= e($authUser['national_id']) ?></span></div>
    <div><strong>Education:</strong> <?= e($authUser['education_type'] . ' — ' . $authUser['institution_name'] . ' (' . $authUser['level_or_class'] . ', ' . $authUser['faculty_or_combination'] . ')') ?></div>
    <div><strong>Place of Birth:</strong> <?= e($authUser['place_of_birth']) ?></div>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
