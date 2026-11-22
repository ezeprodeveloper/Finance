<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$pdo = db();
$existing = current_user($pdo);
if ($existing) {
    header('Location: ' . (($existing['role'] ?? '') === 'admin' ? '/admin/dashboard.php' : '/user/dashboard.php'));
    exit;
}

$error = null;
if (isset($_GET['error']) && $_GET['error'] === 'suspended') {
    $error = 'Your account is currently suspended. Please contact support.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $identifier = trim((string)($_POST['identifier'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    if ($identifier === '' || $password === '') {
        $error = 'Enter both your email or phone number and password.';
    } else {
        $cleanPhone = preg_replace('/[\s-]+/', '', $identifier) ?? '';
        $stmt = $pdo->prepare(
            'SELECT * FROM users WHERE LOWER(email) = LOWER(:id_email) OR REPLACE(REPLACE(phone, " ", ""), "-", "") = :id_phone LIMIT 1'
        );
        $stmt->execute([
            ':id_email' => $identifier,
            ':id_phone' => $cleanPhone,
        ]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, (string)$user['password_hash'])) {
            $error = 'Invalid email/phone or password.';
        } elseif ($user['account_status'] === 'suspended') {
            $error = 'Your account is suspended.';
        } else {
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int)$user['id'];
            $_SESSION['user_role'] = (string)$user['role'];

            if ($user['role'] === 'admin') {
                header('Location: /admin/dashboard.php');
                exit;
            }
            if ($user['account_status'] === 'pending_approval') {
                header('Location: /user/pending.php');
                exit;
            }
            if ($user['account_status'] === 'awaiting_payment' || $user['account_status'] === 'payment_submitted') {
                header('Location: /user/activate.php');
                exit;
            }
            header('Location: /user/dashboard.php');
            exit;
        }
    }
}

$pageTitle = 'Sign In';
$authUser = null;
require_once __DIR__ . '/includes/header.php';
?>

<div class="auth-wrapper">
  <div class="auth-card">
    <div style="margin-bottom: 22px;">
      <a href="/index.php" style="font-size: 12px; font-weight: 600; color: #1e40af; text-decoration: none;">&larr; Back to E-Finance Rwanda</a>
      <h1 style="font-size: 24px; color: #071b38; margin-top: 8px;">Sign in to E-Finance</h1>
      <p style="font-size: 13px; color: #64748b; margin: 4px 0 0;">Access your savings, investments, tasks, and wallet ledger.</p>
    </div>

    <?php if ($error): ?>
      <div class="alert alert-error" style="margin-bottom: 16px;"><?= e($error) ?></div>
    <?php endif; ?>

    <form method="post" action="/login.php">
      <?= csrf_field() ?>
      <div class="form-group">
        <label for="loginIdentifier">Email Address or Phone Number</label>
        <input id="loginIdentifier" name="identifier" type="text" class="form-control" required autofocus value="<?= e($_POST['identifier'] ?? '') ?>">
      </div>
      <div class="form-group">
        <label for="loginPassword">Password</label>
        <input id="loginPassword" name="password" type="password" class="form-control" required>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Sign In</button>
    </form>

    <div style="margin-top: 18px; text-align: center; font-size: 13px; color: #475569;">
      New to E-Finance Rwanda? <a href="/register.php" style="color: #1e40af; font-weight: 600; text-decoration: none;">Create an account</a>
    </div>
  </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
