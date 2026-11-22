<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_admin($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $uid = (int)($_POST['user_id'] ?? 0);
    $decision = (string)($_POST['decision'] ?? '');
    $note = trim((string)($_POST['review_note'] ?? '')) ?: null;

    if ($uid > 0 && in_array($decision, ['approved', 'rejected'], true)) {
        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE users SET kyc_status = :st WHERE id = :id')->execute([':st' => $decision, ':id' => $uid]);
            $pdo->prepare('UPDATE kyc_verifications SET review_note = :note, reviewed_at = NOW() WHERE user_id = :uid')->execute([':note' => $note, ':uid' => $uid]);
            $pdo->commit();
            flash_set('success', 'KYC marked as ' . $decision . '.');
        } catch (Throwable $ex) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            flash_set('error', 'Unable to update KYC status.');
        }
    }
    header('Location: /admin/kyc_review.php');
    exit;
}

$kycList = $pdo->query(
    'SELECT k.*, u.first_name, u.second_name, u.account_number, u.kyc_status
     FROM kyc_verifications k
     JOIN users u ON u.id = k.user_id
     ORDER BY k.submitted_at DESC'
)->fetchAll();

$pageTitle = 'Rwanda KYC Verification Desk';
$isAdminLayout = true;
require_once __DIR__ . '/../includes/header.php';
?>

<section class="card">
  <div class="card-header">
    <h2 style="font-size: 17px;">Submitted Rwanda KYC Records (<?= count($kycList) ?>)</h2>
  </div>
  <?php if (empty($kycList)): ?>
    <p style="font-size: 13.5px; color: #64748b;">No KYC submissions yet.</p>
  <?php else: ?>
    <?php foreach ($kycList as $k): ?>
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 14px;">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px;">
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <img src="/<?= e($k['id_document_path']) ?>" alt="ID Card" style="width: 120px; height: 82px; object-fit: cover; border-radius: 8px; border: 1px solid #cbd5e1;">
            <img src="/<?= e($k['selfie_photo_path']) ?>" alt="Selfie" style="width: 82px; height: 82px; object-fit: cover; border-radius: 8px; border: 1px solid #cbd5e1;">
            <div style="font-size: 12.5px; line-height: 1.65;">
              <strong style="font-size: 15px; color: #071b38;"><?= e($k['first_name'] . ' ' . $k['second_name']) ?> (<?= e($k['account_number']) ?>)</strong>
              <div class="font-mono">National ID: <?= e($k['national_id']) ?> &middot; Issued: <?= e($k['id_issue_district']) ?></div>
              <div><?= e($k['province'] . ' / ' . $k['akarere'] . ' / ' . $k['umurenge'] . ' / ' . $k['akagari'] . ' / ' . $k['umudugudu']) ?></div>
              <div>Occupation: <?= e($k['occupation']) ?> &middot; Next of Kin: <?= e($k['next_of_kin_name'] . ' (' . $k['next_of_kin_phone'] . ')') ?></div>
            </div>
          </div>
          <span class="badge <?= $k['kyc_status'] === 'approved' ? 'badge-success' : ($k['kyc_status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($k['kyc_status']) ?></span>
        </div>

        <form method="post" action="/admin/kyc_review.php" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
          <?= csrf_field() ?>
          <input type="hidden" name="user_id" value="<?= (int)$k['user_id'] ?>">
          <input name="review_note" type="text" class="form-control" style="flex: 1; min-width: 200px;" placeholder="Optional review note..." value="<?= e($k['review_note']) ?>">
          <button type="submit" name="decision" value="approved" class="btn btn-emerald btn-sm">Approve KYC</button>
          <button type="submit" name="decision" value="rejected" class="btn btn-danger btn-sm">Reject KYC</button>
        </form>
      </div>
    <?php endforeach; ?>
  <?php endif; ?>
</section>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
