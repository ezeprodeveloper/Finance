<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_admin($pdo);
$settings = get_settings($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = (string)($_POST['action'] ?? '');
    $uid = (int)($_POST['user_id'] ?? 0);

    if ($action === 'approve_reg' && $uid > 0) {
        $pdo->prepare("UPDATE users SET account_status = 'awaiting_payment' WHERE id = :id AND role = 'member'")->execute([':id' => $uid]);
        flash_set('success', 'Registration approved. Member unlocked for 200 RWF activation.');
    } elseif ($action === 'activate_bonus' && $uid > 0) {
        $pdo->beginTransaction();
        try {
            $uStmt = $pdo->prepare("SELECT * FROM users WHERE id = :id AND role = 'member' FOR UPDATE");
            $uStmt->execute([':id' => $uid]);
            $target = $uStmt->fetch();
            if ($target && $target['account_status'] !== 'active') {
                $bonus = (float)$settings['welcome_bonus_rwf'];
                $pdo->prepare(
                    "UPDATE users
                     SET account_status = 'active',
                         wallet_balance_rwf = wallet_balance_rwf + :b1,
                         bonus_balance_rwf = bonus_balance_rwf + :b2
                     WHERE id = :id"
                )->execute([':b1' => $bonus, ':b2' => $bonus, ':id' => $uid]);

                log_transaction($pdo, $uid, 'Welcome Bonus (' . $bonus . ' RWF)', 'Bonus', 'System Activation', $bonus, 'credit', 'Completed', 0.0, 'BNS');
                $pdo->prepare("UPDATE transactions SET status = 'Completed' WHERE user_id = :uid AND category = 'Activation' AND status = 'Pending Review'")->execute([':uid' => $uid]);

                if (!empty($target['referred_by_user_id'])) {
                    $refId = (int)$target['referred_by_user_id'];
                    $comm = round(((float)$settings['activation_fee_rwf'] * (float)$settings['referral_commission_percent']) / 100, 2);
                    $pdo->prepare('UPDATE users SET spin_credits = spin_credits + 1, wallet_balance_rwf = wallet_balance_rwf + :c WHERE id = :rid')
                        ->execute([':c' => $comm, ':rid' => $refId]);
                    log_transaction($pdo, $refId, 'Referral Bonus +1 Spin (' . $target['first_name'] . ' activated)', 'Referral Commission', 'Activation Referral', $comm, 'credit', 'Completed', 0.0, 'REF');
                }
            }
            $pdo->commit();
            flash_set('success', 'Member activated and welcome bonus credited.');
        } catch (Throwable $ex) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            flash_set('error', 'Activation failed.');
        }
    } elseif ($action === 'toggle_suspend' && $uid > 0) {
        $pdo->prepare("UPDATE users SET account_status = IF(account_status = 'suspended', 'active', 'suspended') WHERE id = :id AND role = 'member'")->execute([':id' => $uid]);
        flash_set('success', 'Member suspension status updated.');
    } elseif ($action === 'admin_edit_user' && $uid > 0) {
        $photoSql = '';
        $params = [
            ':fn' => trim((string)($_POST['first_name'] ?? '')),
            ':sn' => trim((string)($_POST['second_name'] ?? '')),
            ':em' => strtolower(trim((string)($_POST['email'] ?? ''))),
            ':ph' => trim((string)($_POST['phone'] ?? '')),
            ':nid' => trim((string)($_POST['national_id'] ?? '')),
            ':wb' => (float)($_POST['wallet_balance_rwf'] ?? 0),
            ':bb' => (float)($_POST['bonus_balance_rwf'] ?? 0),
            ':sc' => max(0, (int)($_POST['spin_credits'] ?? 0)),
            ':ak' => trim((string)($_POST['akarere'] ?? '')) ?: null,
            ':um' => trim((string)($_POST['umurenge'] ?? '')) ?: null,
            ':id' => $uid,
        ];
        if (!empty($_FILES['new_photo']['name'])) {
            try {
                $newPath = upload_secure_file($_FILES['new_photo'], 'photos', ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'], UPLOAD_MAX_IMAGE_BYTES);
                $photoSql = ', profile_photo_path = :pp';
                $params[':pp'] = $newPath;
            } catch (Throwable $ex) {
                flash_set('error', $ex->getMessage());
                header('Location: /admin/users.php');
                exit;
            }
        }
        $pdo->prepare(
            "UPDATE users SET first_name = :fn, second_name = :sn, email = :em, phone = :ph, national_id = :nid,
             wallet_balance_rwf = :wb, bonus_balance_rwf = :bb, spin_credits = :sc, akarere = :ak, umurenge = :um {$photoSql}
             WHERE id = :id AND role = 'member'"
        )->execute($params);
        flash_set('success', 'Member details and/or photo updated by Admin.');
    }

    header('Location: /admin/users.php');
    exit;
}

$users = $pdo->query("SELECT * FROM users WHERE role = 'member' ORDER BY created_at DESC")->fetchAll();
$editId = isset($_GET['edit']) ? (int)$_GET['edit'] : 0;
$editingUser = null;
if ($editId > 0) {
    foreach ($users as $u) {
        if ((int)$u['id'] === $editId) {
            $editingUser = $u;
            break;
        }
    }
}

$pageTitle = 'Users & Photos Management';
$isAdminLayout = true;
require_once __DIR__ . '/../includes/header.php';
?>

<?php if ($editingUser): ?>
  <section class="card" style="border: 2px solid #071b38;">
    <div class="card-header">
      <h2 style="font-size: 17px;">Admin Edit Member: <?= e($editingUser['first_name'] . ' ' . $editingUser['second_name']) ?> (<?= e($editingUser['account_number']) ?>)</h2>
      <a href="/admin/users.php" class="btn btn-outline btn-sm">Close</a>
    </div>
    <form method="post" action="/admin/users.php" enctype="multipart/form-data">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="admin_edit_user">
      <input type="hidden" name="user_id" value="<?= (int)$editingUser['id'] ?>">
      <div class="form-grid">
        <div class="form-group"><label>First Name</label><input name="first_name" class="form-control" value="<?= e($editingUser['first_name']) ?>" required></div>
        <div class="form-group"><label>Second Name</label><input name="second_name" class="form-control" value="<?= e($editingUser['second_name']) ?>" required></div>
        <div class="form-group"><label>Email</label><input name="email" type="email" class="form-control" value="<?= e($editingUser['email']) ?>" required></div>
        <div class="form-group"><label>Phone</label><input name="phone" class="form-control font-mono" value="<?= e($editingUser['phone']) ?>" required></div>
        <div class="form-group"><label>National ID</label><input name="national_id" class="form-control font-mono" value="<?= e($editingUser['national_id']) ?>" required></div>
        <div class="form-group"><label>Wallet Balance (RWF)</label><input name="wallet_balance_rwf" type="number" step="0.01" class="form-control font-mono" value="<?= e((string)$editingUser['wallet_balance_rwf']) ?>" required></div>
        <div class="form-group"><label>Bonus Balance (RWF)</label><input name="bonus_balance_rwf" type="number" step="0.01" class="form-control font-mono" value="<?= e((string)$editingUser['bonus_balance_rwf']) ?>" required></div>
        <div class="form-group"><label>Spin Credits</label><input name="spin_credits" type="number" min="0" class="form-control font-mono" value="<?= (int)$editingUser['spin_credits'] ?>" required></div>
        <div class="form-group"><label>Akarere</label><input name="akarere" class="form-control" value="<?= e($editingUser['akarere']) ?>"></div>
        <div class="form-group"><label>Umurenge</label><input name="umurenge" class="form-control" value="<?= e($editingUser['umurenge']) ?>"></div>
      </div>
      <div class="form-group">
        <label>Replace Profile Photo (Admin Override)</label>
        <input name="new_photo" type="file" accept="image/jpeg,image/png,image/webp" class="form-control">
      </div>
      <button type="submit" class="btn btn-primary">Save Admin Changes</button>
    </form>
  </section>
<?php endif; ?>

<section class="card">
  <div class="card-header">
    <h2 style="font-size: 17px;">All Registered Members (<?= count($users) ?>)</h2>
  </div>
  <?php if (empty($users)): ?>
    <p style="font-size: 13.5px; color: #64748b;">No members registered yet.</p>
  <?php else: ?>
    <?php foreach ($users as $u): ?>
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px; align-items: center;">
        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <?php if (!empty($u['profile_photo_path'])): ?>
            <img src="/<?= e($u['profile_photo_path']) ?>" alt="Photo" class="avatar-lg">
          <?php endif; ?>
          <div style="font-size: 12.5px; line-height: 1.65;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <strong style="font-size: 15px; color: #071b38;"><?= e($u['first_name'] . ' ' . $u['second_name']) ?></strong>
              <span class="font-mono" style="color: #64748b;"><?= e($u['account_number']) ?></span>
              <span class="badge <?= $u['account_status'] === 'active' ? 'badge-success' : ($u['account_status'] === 'suspended' ? 'badge-danger' : 'badge-warning') ?>"><?= e(str_replace('_', ' ', $u['account_status'])) ?></span>
            </div>
            <div><?= e($u['email']) ?> &middot; <span class="font-mono"><?= e($u['phone']) ?></span> &middot; ID: <span class="font-mono"><?= e($u['national_id']) ?></span></div>
            <div><strong><?= e($u['education_type']) ?>:</strong> <?= e($u['institution_name'] . ' (' . $u['level_or_class'] . ', ' . $u['faculty_or_combination'] . ')') ?></div>
            <div><strong>Birth:</strong> <?= e($u['place_of_birth']) ?><?= $u['akarere'] ? ' &middot; ' . e($u['akarere'] . ' / ' . ($u['umurenge'] ?? '-')) : '' ?></div>
            <?php if (!empty($u['activation_ref'])): ?>
              <div class="font-mono" style="color: #1e40af;">Activation Ref: <?= e($u['activation_ref']) ?> (<?= e($u['activation_phone']) ?>)</div>
            <?php endif; ?>
            <div class="font-mono">Wallet: <strong><?= e(format_rwf($u['wallet_balance_rwf'])) ?></strong> &middot; Saved: <strong><?= e(format_rwf($u['savings_balance_rwf'])) ?></strong> &middot; Spins: <?= (int)$u['spin_credits'] ?> &middot; KYC: <?= e($u['kyc_status']) ?></div>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <?php if ($u['account_status'] === 'pending_approval'): ?>
            <form method="post" action="/admin/users.php">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="approve_reg">
              <input type="hidden" name="user_id" value="<?= (int)$u['id'] ?>">
              <button type="submit" class="btn btn-primary btn-sm">Approve Registration</button>
            </form>
          <?php elseif ($u['account_status'] === 'awaiting_payment' || $u['account_status'] === 'payment_submitted'): ?>
            <form method="post" action="/admin/users.php">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="activate_bonus">
              <input type="hidden" name="user_id" value="<?= (int)$u['id'] ?>">
              <button type="submit" class="btn btn-emerald btn-sm">Confirm <?= (int)$settings['activation_fee_rwf'] ?> &amp; Grant <?= (int)$settings['welcome_bonus_rwf'] ?> Bonus</button>
            </form>
          <?php endif; ?>
          <a href="/admin/users.php?edit=<?= (int)$u['id'] ?>" class="btn btn-outline btn-sm">Edit Info &amp; Photo</a>
          <?php if (in_array($u['account_status'], ['active', 'suspended'], true)): ?>
            <form method="post" action="/admin/users.php">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="toggle_suspend">
              <input type="hidden" name="user_id" value="<?= (int)$u['id'] ?>">
              <button type="submit" class="btn btn-danger btn-sm"><?= $u['account_status'] === 'suspended' ? 'Unsuspend' : 'Suspend' ?></button>
            </form>
          <?php endif; ?>
        </div>
      </div>
    <?php endforeach; ?>
  <?php endif; ?>
</section>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
