<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo);

$kycStmt = $pdo->prepare('SELECT * FROM kyc_verifications WHERE user_id = :uid LIMIT 1');
$kycStmt->execute([':uid' => $authUser['id']]);
$kycRow = $kycStmt->fetch() ?: null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $nationalId = preg_replace('/\s+/', '', (string)($_POST['national_id'] ?? '')) ?? '';
    $issueDistrict = trim((string)($_POST['id_issue_district'] ?? ''));
    $province = trim((string)($_POST['province'] ?? ''));
    $akarere = trim((string)($_POST['akarere'] ?? ''));
    $umurenge = trim((string)($_POST['umurenge'] ?? ''));
    $akagari = trim((string)($_POST['akagari'] ?? ''));
    $umudugudu = trim((string)($_POST['umudugudu'] ?? ''));
    $occupation = trim((string)($_POST['occupation'] ?? ''));
    $kinName = trim((string)($_POST['next_of_kin_name'] ?? ''));
    $kinPhone = trim((string)($_POST['next_of_kin_phone'] ?? ''));

    if (!valid_rwanda_id($nationalId)) {
        flash_set('error', 'Enter a valid 16-digit Rwanda National ID.');
    } elseif ($akarere === '' || $umurenge === '' || $akagari === '' || $umudugudu === '' || $occupation === '' || $kinName === '' || !valid_rwanda_phone($kinPhone)) {
        flash_set('error', 'Complete all Rwanda KYC location, occupation, and Next of Kin fields.');
    } else {
        try {
            $allowedImg = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
            $idDocPath = upload_secure_file($_FILES['id_document_photo'] ?? [], 'kyc', $allowedImg, UPLOAD_MAX_IMAGE_BYTES);
            $selfiePath = upload_secure_file($_FILES['selfie_photo'] ?? [], 'kyc', $allowedImg, UPLOAD_MAX_IMAGE_BYTES);

            $pdo->beginTransaction();
            $upsert = $pdo->prepare(
                'INSERT INTO kyc_verifications (
                    user_id, national_id, id_issue_district, province, akarere, umurenge, akagari, umudugudu,
                    occupation, next_of_kin_name, next_of_kin_phone, id_document_path, selfie_photo_path, review_note, submitted_at
                ) VALUES (
                    :uid, :nid, :dist, :prov, :ak, :um, :ag, :ud, :occ, :kn, :kp, :doc, :selfie, NULL, NOW()
                ) ON DUPLICATE KEY UPDATE
                    national_id = VALUES(national_id), id_issue_district = VALUES(id_issue_district),
                    province = VALUES(province), akarere = VALUES(akarere), umurenge = VALUES(umurenge),
                    akagari = VALUES(akagari), umudugudu = VALUES(umudugudu), occupation = VALUES(occupation),
                    next_of_kin_name = VALUES(next_of_kin_name), next_of_kin_phone = VALUES(next_of_kin_phone),
                    id_document_path = VALUES(id_document_path), selfie_photo_path = VALUES(selfie_photo_path),
                    review_note = NULL, submitted_at = NOW()'
            );
            $upsert->execute([
                ':uid' => $authUser['id'], ':nid' => $nationalId, ':dist' => $issueDistrict, ':prov' => $province,
                ':ak' => $akarere, ':um' => $umurenge, ':ag' => $akagari, ':ud' => $umudugudu,
                ':occ' => $occupation, ':kn' => $kinName, ':kp' => $kinPhone, ':doc' => $idDocPath, ':selfie' => $selfiePath,
            ]);

            $updUser = $pdo->prepare("UPDATE users SET kyc_status = 'pending' WHERE id = :id");
            $updUser->execute([':id' => $authUser['id']]);
            $pdo->commit();
            flash_set('success', 'Rwanda KYC submitted for Admin verification.');
        } catch (Throwable $ex) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            flash_set('error', $ex->getMessage());
        }
    }
    header('Location: /user/kyc.php');
    exit;
}

$pageTitle = 'Rwanda KYC Verification';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="card" style="max-width: 820px;">
  <div class="card-header">
    <div>
      <h2 style="font-size: 18px;">Rwanda National KYC Verification</h2>
      <p style="font-size: 12.5px; color: #64748b; margin: 4px 0 0;">Required before depositing into Savings Vaults or requesting Mobile Money withdrawals.</p>
    </div>
    <span class="badge <?= $authUser['kyc_status'] === 'approved' ? 'badge-success' : ($authUser['kyc_status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>">
      Status: <?= e($authUser['kyc_status']) ?>
    </span>
  </div>

  <?php if (!empty($kycRow['review_note'])): ?>
    <div class="alert alert-error" style="margin-bottom: 16px;">Admin Note: <?= e($kycRow['review_note']) ?></div>
  <?php endif; ?>

  <?php if ($authUser['kyc_status'] === 'approved' && $kycRow): ?>
    <div class="alert alert-success" style="margin-bottom: 14px;">Your Rwanda KYC is verified. Savings and Mobile Money withdrawals are unlocked.</div>
    <p style="font-size: 13px;">National ID: <strong class="font-mono"><?= e($kycRow['national_id']) ?></strong> &middot; Address: <?= e($kycRow['province'] . ' / ' . $kycRow['akarere'] . ' / ' . $kycRow['umurenge'] . ' / ' . $kycRow['akagari'] . ' / ' . $kycRow['umudugudu']) ?></p>
  <?php else: ?>
    <form method="post" action="/user/kyc.php" enctype="multipart/form-data">
      <?= csrf_field() ?>
      <div class="form-grid">
        <div class="form-group">
          <label for="kycNid">16-Digit National ID *</label>
          <input id="kycNid" name="national_id" type="text" maxlength="16" class="form-control font-mono" required value="<?= e($kycRow['national_id'] ?? $authUser['national_id']) ?>">
        </div>
        <div class="form-group">
          <label for="kycIssue">ID Issuing District *</label>
          <input id="kycIssue" name="id_issue_district" type="text" class="form-control" required value="<?= e($kycRow['id_issue_district'] ?? '') ?>">
        </div>
        <div class="form-group">
          <label for="kycProvince">Province *</label>
          <select id="kycProvince" name="province" class="form-control" required>
            <?php foreach (['Kigali City', 'Northern Province', 'Southern Province', 'Eastern Province', 'Western Province'] as $prov): ?>
              <option value="<?= e($prov) ?>" <?= (($kycRow['province'] ?? '') === $prov) ? 'selected' : '' ?>><?= e($prov) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group">
          <label for="kycOcc">Occupation *</label>
          <input id="kycOcc" name="occupation" type="text" class="form-control" required value="<?= e($kycRow['occupation'] ?? '') ?>">
        </div>
      </div>

      <div data-rwanda-location
           data-init-district="<?= e($kycRow['akarere'] ?? $authUser['akarere'] ?? '') ?>"
           data-init-sector="<?= e($kycRow['umurenge'] ?? $authUser['umurenge'] ?? '') ?>"
           data-init-cell="<?= e($kycRow['akagari'] ?? $authUser['akagari'] ?? '') ?>"
           data-init-village="<?= e($kycRow['umudugudu'] ?? $authUser['umudugudu'] ?? '') ?>">
        <div class="form-grid">
          <div class="form-group">
            <label for="kycAk">Akarere (District) *</label>
            <select id="kycAk" name="akarere" data-loc="district" class="form-control" required></select>
          </div>
          <div class="form-group">
            <label for="kycUm">Umurenge (Sector) *</label>
            <select id="kycUm" name="umurenge" data-loc="sector" class="form-control" required></select>
          </div>
          <div class="form-group">
            <label for="kycAg">Akagari (Cell) *</label>
            <select id="kycAg" name="akagari" data-loc="cell" class="form-control" required></select>
          </div>
          <div class="form-group">
            <label for="kycUd">Umudugudu (Village) *</label>
            <select id="kycUd" name="umudugudu" data-loc="village" class="form-control" required></select>
          </div>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label for="kycKinName">Next of Kin Full Name *</label>
          <input id="kycKinName" name="next_of_kin_name" type="text" class="form-control" required value="<?= e($kycRow['next_of_kin_name'] ?? '') ?>">
        </div>
        <div class="form-group">
          <label for="kycKinPhone">Next of Kin Phone *</label>
          <input id="kycKinPhone" name="next_of_kin_phone" type="tel" class="form-control font-mono" required value="<?= e($kycRow['next_of_kin_phone'] ?? '') ?>">
        </div>
        <div class="form-group">
          <label for="kycDoc">National ID Card Photo (JPG/PNG) *</label>
          <input id="kycDoc" name="id_document_photo" type="file" accept="image/jpeg,image/png,image/webp" class="form-control" required>
        </div>
        <div class="form-group">
          <label for="kycSelfie">Selfie Verification Photo (JPG/PNG) *</label>
          <input id="kycSelfie" name="selfie_photo" type="file" accept="image/jpeg,image/png,image/webp" class="form-control" required>
        </div>
      </div>

      <button type="submit" class="btn btn-primary">Submit Rwanda KYC for Review</button>
    </form>
  <?php endif; ?>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
