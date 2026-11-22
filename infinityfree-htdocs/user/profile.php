<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo);

$pageTitle = 'My Member Profile';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="card" style="max-width: 780px;">
  <div class="card-header">
    <div style="display: flex; align-items: center; gap: 16px;">
      <?php if (!empty($authUser['profile_photo_path'])): ?>
        <img src="/<?= e($authUser['profile_photo_path']) ?>" alt="Member Photo" class="avatar-lg">
      <?php endif; ?>
      <div>
        <h2 style="font-size: 20px; color: #071b38;"><?= e($authUser['first_name'] . ' ' . $authUser['second_name']) ?></h2>
        <div class="font-mono" style="font-size: 12px; color: #64748b;"><?= e($authUser['account_number']) ?></div>
      </div>
    </div>
    <span class="badge badge-warning">Photo &amp; ID Locked (Admin Only Edit)</span>
  </div>

  <div class="form-grid" style="font-size: 13.5px; line-height: 1.75;">
    <div><strong>Email:</strong><br><?= e($authUser['email']) ?></div>
    <div><strong>Phone:</strong><br><span class="font-mono"><?= e($authUser['phone']) ?></span></div>
    <div><strong>National ID:</strong><br><span class="font-mono"><?= e($authUser['national_id']) ?></span></div>
    <div><strong>Gender &amp; DOB:</strong><br><?= e($authUser['gender'] . ' · ' . $authUser['date_of_birth']) ?></div>
    <div><strong>Education (<?= e($authUser['education_type']) ?>):</strong><br><?= e($authUser['institution_name'] . ' · ' . $authUser['level_or_class'] . ' · ' . $authUser['faculty_or_combination']) ?></div>
    <div><strong>Birth &amp; Residence:</strong><br>Born: <?= e($authUser['place_of_birth']) ?><?= $authUser['akarere'] ? ' · ' . e($authUser['akarere'] . ' / ' . ($authUser['umurenge'] ?? '-') . ' / ' . ($authUser['akagari'] ?? '-') . ' / ' . ($authUser['umudugudu'] ?? '-')) : '' ?></div>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
