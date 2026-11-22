<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$pdo = db();
$existing = current_user($pdo);
if ($existing) {
    header('Location: /user/dashboard.php');
    exit;
}

$refCodeQuery = strtoupper(trim((string)($_GET['ref'] ?? '')));
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();

    $firstName = trim((string)($_POST['first_name'] ?? ''));
    $secondName = trim((string)($_POST['second_name'] ?? ''));
    $email = strtolower(trim((string)($_POST['email'] ?? '')));
    $phone = trim((string)($_POST['phone'] ?? ''));
    $gender = (string)($_POST['gender'] ?? 'Male');
    $dob = trim((string)($_POST['date_of_birth'] ?? ''));
    $nationalId = preg_replace('/\s+/', '', (string)($_POST['national_id'] ?? '')) ?? '';

    $eduType = (string)($_POST['education_type'] ?? 'University');
    $institutionName = trim((string)($_POST['institution_name'] ?? ''));
    $levelOrClass = trim((string)($_POST['level_or_class'] ?? ''));
    $facultyOrComb = trim((string)($_POST['faculty_or_combination'] ?? ''));

    $placeOfBirth = trim((string)($_POST['place_of_birth'] ?? ''));
    $akarere = trim((string)($_POST['akarere'] ?? '')) ?: null;
    $umurenge = trim((string)($_POST['umurenge'] ?? '')) ?: null;
    $akagari = trim((string)($_POST['akagari'] ?? '')) ?: null;
    $umudugudu = trim((string)($_POST['umudugudu'] ?? '')) ?: null;
    $refInput = strtoupper(trim((string)($_POST['referral_code'] ?? '')));

    $password = (string)($_POST['password'] ?? '');
    $confirmPassword = (string)($_POST['confirm_password'] ?? '');

    if (strlen($firstName) < 2 || strlen($secondName) < 2) {
        $errors[] = 'First name and second name are required.';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Enter a valid email address.';
    }
    if (!valid_rwanda_phone($phone)) {
        $errors[] = 'Enter a valid Rwanda phone number (e.g. +250788123456 or 0788123456).';
    }
    if (!in_array($gender, ['Male', 'Female', 'Other'], true)) {
        $errors[] = 'Invalid gender selection.';
    }
    if ($dob === '') {
        $errors[] = 'Date of birth is required.';
    }
    if (!valid_rwanda_id($nationalId)) {
        $errors[] = 'National ID must be exactly 16 digits.';
    }
    if (!in_array($eduType, ['University', 'A-Level'], true) || $institutionName === '' || $levelOrClass === '' || $facultyOrComb === '') {
        $errors[] = 'Complete all education background fields.';
    }
    if (strlen($placeOfBirth) < 2) {
        $errors[] = 'Place of birth is required.';
    }
    if (strlen($password) < 8) {
        $errors[] = 'Password must be at least 8 characters.';
    }
    if ($password !== $confirmPassword) {
        $errors[] = 'Passwords do not match.';
    }

    if (empty($errors)) {
        $cleanPhone = preg_replace('/[\s-]+/', '', $phone) ?? '';
        $dupStmt = $pdo->prepare(
            'SELECT id FROM users WHERE LOWER(email) = :email OR national_id = :nid OR REPLACE(REPLACE(phone, " ", ""), "-", "") = :phone LIMIT 1'
        );
        $dupStmt->execute([
            ':email' => $email,
            ':nid' => $nationalId,
            ':phone' => $cleanPhone,
        ]);
        if ($dupStmt->fetch()) {
            $errors[] = 'An account with this email, phone number, or National ID already exists.';
        }
    }

    $photoPath = '';
    if (empty($errors)) {
        try {
            $photoPath = upload_secure_file(
                $_FILES['profile_photo'] ?? [],
                'photos',
                ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'],
                UPLOAD_MAX_IMAGE_BYTES
            );
        } catch (Throwable $ex) {
            $errors[] = $ex->getMessage();
        }
    }

    if (empty($errors)) {
        $referrerId = null;
        if ($refInput !== '') {
            $refStmt = $pdo->prepare('SELECT id FROM users WHERE UPPER(referral_code) = :code LIMIT 1');
            $refStmt->execute([':code' => $refInput]);
            $refRow = $refStmt->fetch();
            if ($refRow) {
                $referrerId = (int)$refRow['id'];
            }
        }

        $stmt = $pdo->prepare(
            'INSERT INTO users (
                account_number, role, first_name, second_name, email, phone, gender,
                date_of_birth, national_id, profile_photo_path, education_type,
                institution_name, level_or_class, faculty_or_combination,
                place_of_birth, akarere, umurenge, akagari, umudugudu,
                password_hash, referral_code, referred_by_user_id, account_status
            ) VALUES (
                :account_number, "member", :first_name, :second_name, :email, :phone, :gender,
                :dob, :national_id, :photo_path, :edu_type,
                :institution, :level_class, :faculty_comb,
                :pob, :akarere, :umurenge, :akagari, :umudugudu,
                :password_hash, :referral_code, :referrer_id, "pending_approval"
            )'
        );
        $stmt->execute([
            ':account_number' => generate_account_number(),
            ':first_name' => $firstName,
            ':second_name' => $secondName,
            ':email' => $email,
            ':phone' => $phone,
            ':gender' => $gender,
            ':dob' => $dob,
            ':national_id' => $nationalId,
            ':photo_path' => $photoPath,
            ':edu_type' => $eduType,
            ':institution' => $institutionName,
            ':level_class' => $levelOrClass,
            ':faculty_comb' => $facultyOrComb,
            ':pob' => $placeOfBirth,
            ':akarere' => $akarere,
            ':umurenge' => $umurenge,
            ':akagari' => $akagari,
            ':umudugudu' => $umudugudu,
            ':password_hash' => password_hash($password, PASSWORD_BCRYPT),
            ':referral_code' => generate_referral_code($firstName),
            ':referrer_id' => $referrerId,
        ]);

        $newUserId = (int)$pdo->lastInsertId();
        session_regenerate_id(true);
        $_SESSION['user_id'] = $newUserId;
        $_SESSION['user_role'] = 'member';
        header('Location: /user/pending.php');
        exit;
    }
}

$pageTitle = 'Create Account';
$authUser = null;
require_once __DIR__ . '/includes/header.php';
?>

<div class="auth-wrapper">
  <div class="auth-card wide">
    <div style="margin-bottom: 18px;">
      <a href="/index.php" style="font-size: 12px; font-weight: 600; color: #1e40af; text-decoration: none;">&larr; Back to Home</a>
      <h1 style="font-size: 24px; color: #071b38; margin-top: 8px;">E-Finance Rwanda Registration</h1>
      <p style="font-size: 13px; color: #64748b; margin: 4px 0 0;">Complete all 3 verification steps. Uploaded profile photos are locked after submission.</p>
    </div>

    <div class="step-tabs">
      <div class="step-pill active" id="stepPill1">1. Personal ID &amp; Photo</div>
      <div class="step-pill" id="stepPill2">2. Education</div>
      <div class="step-pill" id="stepPill3">3. Residence &amp; Password</div>
    </div>

    <?php if (!empty($errors)): ?>
      <div class="alert alert-error" style="margin-bottom: 16px;">
        <?php foreach ($errors as $err): ?>
          <div><?= e($err) ?></div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>

    <div id="regClientError" class="alert alert-error hidden" style="margin-bottom: 16px;"></div>

    <form id="registerWizardForm" method="post" action="/register.php" enctype="multipart/form-data">
      <?= csrf_field() ?>

      <!-- STEP 1 -->
      <div id="regStep1">
        <div class="form-grid">
          <div class="form-group">
            <label for="regFirstName">First Name (F-Name) *</label>
            <input id="regFirstName" name="first_name" type="text" class="form-control" required value="<?= e($_POST['first_name'] ?? '') ?>">
          </div>
          <div class="form-group">
            <label for="regSecondName">Second Name (S-Name) *</label>
            <input id="regSecondName" name="second_name" type="text" class="form-control" required value="<?= e($_POST['second_name'] ?? '') ?>">
          </div>
          <div class="form-group">
            <label for="regEmail">Email Address *</label>
            <input id="regEmail" name="email" type="email" class="form-control" required value="<?= e($_POST['email'] ?? '') ?>">
          </div>
          <div class="form-group">
            <label for="regPhone">Phone Number (Rwanda) *</label>
            <input id="regPhone" name="phone" type="tel" class="form-control font-mono" placeholder="+250 788 000 000" required value="<?= e($_POST['phone'] ?? '') ?>">
          </div>
          <div class="form-group">
            <label for="regGender">Gender *</label>
            <select id="regGender" name="gender" class="form-control" required>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label for="regDob">Date of Birth *</label>
            <input id="regDob" name="date_of_birth" type="date" class="form-control font-mono" required value="<?= e($_POST['date_of_birth'] ?? '') ?>">
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="regNationalId">Rwanda National ID (16 Digits) *</label>
            <input id="regNationalId" name="national_id" type="text" maxlength="16" class="form-control font-mono" placeholder="1199XXXXXXXXXXXX" required value="<?= e($_POST['national_id'] ?? '') ?>">
          </div>
          <div class="form-group">
            <label for="regPhoto">Passport / Profile Photo (Locked After Submit) *</label>
            <input id="regPhoto" name="profile_photo" type="file" accept="image/jpeg,image/png,image/webp" class="form-control" required>
          </div>
        </div>
      </div>

      <!-- STEP 2 -->
      <div id="regStep2" class="hidden">
        <div class="form-group">
          <label>Education Level *</label>
          <div style="display: flex; gap: 16px; padding: 6px 0;">
            <label style="display: inline-flex; align-items: center; gap: 6px; font-weight: 500;">
              <input type="radio" name="education_type" value="University" checked> University
            </label>
            <label style="display: inline-flex; align-items: center; gap: 6px; font-weight: 500;">
              <input type="radio" name="education_type" value="A-Level"> A-Level (Secondary)
            </label>
          </div>
        </div>
        <div class="form-group">
          <label id="lblInstitution" for="regInstitution">University Name *</label>
          <input id="regInstitution" name="institution_name" type="text" class="form-control" required value="<?= e($_POST['institution_name'] ?? '') ?>">
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label id="lblLevelClass" for="regLevelClass">Academic Level *</label>
            <input id="regLevelClass" name="level_or_class" type="text" class="form-control" required value="<?= e($_POST['level_or_class'] ?? '') ?>">
          </div>
          <div class="form-group">
            <label id="lblFacultyComb" for="regFacultyComb">Faculty / Department *</label>
            <input id="regFacultyComb" name="faculty_or_combination" type="text" class="form-control" required value="<?= e($_POST['faculty_or_combination'] ?? '') ?>">
          </div>
        </div>
      </div>

      <!-- STEP 3 -->
      <div id="regStep3" class="hidden">
        <div class="form-grid">
          <div class="form-group">
            <label for="regPob">Place of Birth *</label>
            <input id="regPob" name="place_of_birth" type="text" class="form-control" required placeholder="e.g. Kigali, Huye, Musanze" value="<?= e($_POST['place_of_birth'] ?? '') ?>">
          </div>
          <div class="form-group">
            <label for="regReferral">Referral Code (Optional)</label>
            <input id="regReferral" name="referral_code" type="text" class="form-control font-mono" value="<?= e($_POST['referral_code'] ?? $refCodeQuery) ?>" placeholder="e.g. EF-RW123">
          </div>
        </div>

        <div data-rwanda-location style="margin-bottom: 12px;">
          <p style="font-size: 12px; font-weight: 600; color: #334155; margin: 0 0 8px;">Residence Hierarchy (Optional)</p>
          <div class="form-grid">
            <div class="form-group">
              <label for="regAkarere">Akarere (District)</label>
              <select id="regAkarere" name="akarere" data-loc="district" class="form-control"></select>
            </div>
            <div class="form-group">
              <label for="regUmurenge">Umurenge (Sector)</label>
              <select id="regUmurenge" name="umurenge" data-loc="sector" class="form-control"></select>
            </div>
            <div class="form-group">
              <label for="regAkagari">Akagari (Cell)</label>
              <select id="regAkagari" name="akagari" data-loc="cell" class="form-control"></select>
            </div>
            <div class="form-group">
              <label for="regUmudugudu">Umudugudu (Village)</label>
              <select id="regUmudugudu" name="umudugudu" data-loc="village" class="form-control"></select>
            </div>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="regPass">Create Password *</label>
            <input id="regPass" name="password" type="password" minlength="8" class="form-control" required>
          </div>
          <div class="form-group">
            <label for="regPassConfirm">Confirm Password *</label>
            <input id="regPassConfirm" name="confirm_password" type="password" minlength="8" class="form-control" required>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
        <button type="button" id="regPrevBtn" class="btn btn-outline hidden">Previous Step</button>
        <a href="/login.php" style="font-size: 12.5px; color: #1e40af; font-weight: 600; text-decoration: none;">Already have an account?</a>
        <div style="display: flex; gap: 10px;">
          <button type="button" id="regNextBtn" class="btn btn-primary">Continue &rarr;</button>
          <button type="submit" id="regSubmitBtn" class="btn btn-emerald hidden">Submit Registration</button>
        </div>
      </div>
    </form>
  </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
