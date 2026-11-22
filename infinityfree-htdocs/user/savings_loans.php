<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'create_goal') {
        if ($authUser['kyc_status'] !== 'approved') {
            flash_set('error', 'Complete Rwanda KYC before creating savings vaults.');
        } else {
            $title = trim((string)($_POST['title'] ?? ''));
            $planType = (string)($_POST['plan_type'] ?? 'Flexible');
            $target = (float)($_POST['target_rwf'] ?? 0);
            $targetDate = trim((string)($_POST['target_date'] ?? ''));
            if (strlen($title) < 2 || $target < 100 || $targetDate === '') {
                flash_set('error', 'Provide goal title, valid RWF target, and target date.');
            } else {
                $ins = $pdo->prepare('INSERT INTO savings_goals (user_id, title, plan_type, target_rwf, target_date) VALUES (:uid, :t, :pt, :tg, :td)');
                $ins->execute([':uid' => $authUser['id'], ':t' => $title, ':pt' => $planType, ':tg' => $target, ':td' => $targetDate]);
                flash_set('success', 'Savings goal created.');
            }
        }
    } elseif ($action === 'deposit_savings' || $action === 'withdraw_savings') {
        if ($authUser['kyc_status'] !== 'approved') {
            flash_set('error', 'Approved Rwanda KYC is required for savings transfers.');
        } else {
            $goalId = (int)($_POST['goal_id'] ?? 0);
            $amount = round((float)($_POST['amount_rwf'] ?? 0));
            $pdo->beginTransaction();
            try {
                $uStmt = $pdo->prepare('SELECT wallet_balance_rwf, savings_balance_rwf FROM users WHERE id = :id FOR UPDATE');
                $uStmt->execute([':id' => $authUser['id']]);
                $uRow = $uStmt->fetch();

                $gStmt = $pdo->prepare('SELECT * FROM savings_goals WHERE id = :gid AND user_id = :uid FOR UPDATE');
                $gStmt->execute([':gid' => $goalId, ':uid' => $authUser['id']]);
                $gRow = $gStmt->fetch();

                if (!$gRow || $amount <= 0) {
                    throw new RuntimeException('Invalid savings goal or amount.');
                }

                if ($action === 'deposit_savings') {
                    if ($amount > (float)$uRow['wallet_balance_rwf']) {
                        throw new RuntimeException('Insufficient main wallet balance.');
                    }
                    $pdo->prepare('UPDATE users SET wallet_balance_rwf = wallet_balance_rwf - :a, savings_balance_rwf = savings_balance_rwf + :a2 WHERE id = :id')
                        ->execute([':a' => $amount, ':a2' => $amount, ':id' => $authUser['id']]);
                    $pdo->prepare('UPDATE savings_goals SET current_rwf = current_rwf + :a WHERE id = :gid')
                        ->execute([':a' => $amount, ':gid' => $goalId]);
                    log_transaction($pdo, (int)$authUser['id'], 'Saved to ' . $gRow['title'], 'Savings', 'Smart Savings Vault', $amount, 'debit', 'Completed', 0.0, 'SAV');
                    flash_set('success', 'Saved ' . format_rwf($amount) . ' into ' . $gRow['title'] . '.');
                } else {
                    if ($amount > (float)$gRow['current_rwf']) {
                        throw new RuntimeException('Amount exceeds goal savings balance.');
                    }
                    $pdo->prepare('UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + :a, savings_balance_rwf = GREATEST(0, savings_balance_rwf - :a2) WHERE id = :id')
                        ->execute([':a' => $amount, ':a2' => $amount, ':id' => $authUser['id']]);
                    $pdo->prepare('UPDATE savings_goals SET current_rwf = current_rwf - :a WHERE id = :gid')
                        ->execute([':a' => $amount, ':gid' => $goalId]);
                    log_transaction($pdo, (int)$authUser['id'], 'Retrieved from ' . $gRow['title'], 'Savings', 'Savings Retrieval', $amount, 'credit', 'Completed', 0.0, 'SAV');
                    flash_set('success', 'Moved ' . format_rwf($amount) . ' back to Main Wallet.');
                }
                $pdo->commit();
            } catch (Throwable $ex) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                flash_set('error', $ex->getMessage());
            }
        }
    } elseif ($action === 'request_loan') {
        $product = trim((string)($_POST['product'] ?? 'Personal Micro-Loan'));
        $reason = trim((string)($_POST['reason'] ?? ''));
        $principal = round((float)($_POST['principal_rwf'] ?? 0));
        $months = max(1, min(24, (int)($_POST['term_months'] ?? 3)));
        if ($principal < 500 || strlen($reason) < 4) {
            flash_set('error', 'Enter a valid loan amount (>= 500 RWF) and reason.');
        } else {
            $rate = 12.0;
            $totalRepayable = round($principal * (1 + (($rate / 100) * ($months / 12))));
            $monthly = round($totalRepayable / $months);
            $pdo->prepare(
                'INSERT INTO loans (user_id, product, reason, principal_rwf, term_months, annual_rate_percent, monthly_payment_rwf, total_repayable_rwf)
                 VALUES (:uid, :p, :r, :pr, :tm, :ar, :mp, :tr)'
            )->execute([
                ':uid' => $authUser['id'], ':p' => $product, ':r' => $reason, ':pr' => $principal,
                ':tm' => $months, ':ar' => $rate, ':mp' => $monthly, ':tr' => $totalRepayable,
            ]);
            log_transaction($pdo, (int)$authUser['id'], 'Loan Request: ' . $product, 'Loan', $months . ' months', $principal, 'credit', 'Pending Review', 0.0, 'LN');
            flash_set('success', 'Loan request submitted for Admin approval.');
        }
    } elseif ($action === 'repay_loan') {
        $loanId = (int)($_POST['loan_id'] ?? 0);
        $amount = round((float)($_POST['repay_rwf'] ?? 0));
        $pdo->beginTransaction();
        try {
            $uStmt = $pdo->prepare('SELECT wallet_balance_rwf FROM users WHERE id = :id FOR UPDATE');
            $uStmt->execute([':id' => $authUser['id']]);
            $bal = (float)$uStmt->fetchColumn();

            $lStmt = $pdo->prepare("SELECT * FROM loans WHERE id = :lid AND user_id = :uid AND status = 'approved' FOR UPDATE");
            $lStmt->execute([':lid' => $loanId, ':uid' => $authUser['id']]);
            $loan = $lStmt->fetch();
            if (!$loan || $amount <= 0 || $amount > $bal) {
                throw new RuntimeException('Insufficient wallet balance or invalid loan.');
            }
            $remaining = max(0, (float)$loan['total_repayable_rwf'] - (float)$loan['repaid_rwf']);
            $pay = min($amount, $remaining);
            $nextRepaid = (float)$loan['repaid_rwf'] + $pay;
            $newStatus = $nextRepaid >= (float)$loan['total_repayable_rwf'] ? 'repaid' : 'approved';

            $pdo->prepare('UPDATE users SET wallet_balance_rwf = wallet_balance_rwf - :p WHERE id = :id')->execute([':p' => $pay, ':id' => $authUser['id']]);
            $pdo->prepare('UPDATE loans SET repaid_rwf = :rep, status = :st WHERE id = :lid')->execute([':rep' => $nextRepaid, ':st' => $newStatus, ':lid' => $loanId]);
            log_transaction($pdo, (int)$authUser['id'], 'Loan Repayment: ' . $loan['product'], 'Loan', 'Wallet Repayment', $pay, 'debit', 'Completed', 0.0, 'REP');
            $pdo->commit();
            flash_set('success', 'Repaid ' . format_rwf($pay) . '.');
        } catch (Throwable $ex) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            flash_set('error', $ex->getMessage());
        }
    }

    header('Location: /user/savings_loans.php');
    exit;
}

$goalsStmt = $pdo->prepare('SELECT * FROM savings_goals WHERE user_id = :uid ORDER BY created_at DESC');
$goalsStmt->execute([':uid' => $authUser['id']]);
$goals = $goalsStmt->fetchAll();

$loansStmt = $pdo->prepare('SELECT * FROM loans WHERE user_id = :uid ORDER BY created_at DESC');
$loansStmt->execute([':uid' => $authUser['id']]);
$loans = $loansStmt->fetchAll();

$pageTitle = 'Savings & Loans';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Smart Savings Vault</h2>
      <span class="font-mono" style="font-size: 13px; font-weight: 700; color: #047857;">Saved: <?= e(format_rwf($authUser['savings_balance_rwf'])) ?></span>
    </div>

    <?php if ($authUser['kyc_status'] !== 'approved'): ?>
      <div class="alert alert-error">Rwanda KYC approval is required before saving. <a href="/user/kyc.php">Complete KYC &rarr;</a></div>
    <?php else: ?>
      <form method="post" action="/user/savings_loans.php" style="margin-bottom: 18px;">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="create_goal">
        <div class="form-grid">
          <div class="form-group">
            <label>Goal Name *</label>
            <input name="title" type="text" class="form-control" required placeholder="e.g. Tuition or Business Capital">
          </div>
          <div class="form-group">
            <label>Plan Type</label>
            <select name="plan_type" class="form-control">
              <option value="Flexible">Flexible</option>
              <option value="Goal-Based">Goal-Based</option>
              <option value="Long-Term">Long-Term</option>
            </select>
          </div>
          <div class="form-group">
            <label>Target Amount (RWF) *</label>
            <input name="target_rwf" type="number" min="100" class="form-control font-mono" required>
          </div>
          <div class="form-group">
            <label>Target Date *</label>
            <input name="target_date" type="date" class="form-control font-mono" required>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">Create Savings Goal</button>
      </form>

      <?php foreach ($goals as $g): ?>
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong><?= e($g['title']) ?> (<?= e($g['plan_type']) ?>)</strong>
            <span class="font-mono" style="color: #047857; font-weight: 700;"><?= e(format_rwf($g['current_rwf'])) ?> / <?= e(format_rwf($g['target_rwf'])) ?></span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <form method="post" action="/user/savings_loans.php" style="display: flex; gap: 6px;">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="deposit_savings">
              <input type="hidden" name="goal_id" value="<?= (int)$g['id'] ?>">
              <input name="amount_rwf" type="number" min="50" placeholder="Deposit RWF" class="form-control font-mono" style="width: 130px; min-height: 34px;" required>
              <button type="submit" class="btn btn-emerald btn-sm">Save</button>
            </form>
            <form method="post" action="/user/savings_loans.php" style="display: flex; gap: 6px;">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="withdraw_savings">
              <input type="hidden" name="goal_id" value="<?= (int)$g['id'] ?>">
              <input name="amount_rwf" type="number" min="50" placeholder="Retrieve RWF" class="form-control font-mono" style="width: 130px; min-height: 34px;" required>
              <button type="submit" class="btn btn-outline btn-sm">To Wallet</button>
            </form>
          </div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Borrow &amp; Repay Loans</h2>
      <span class="font-mono" style="font-size: 12px; color: #64748b;">12% APR</span>
    </div>
    <form method="post" action="/user/savings_loans.php" style="margin-bottom: 18px;">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="request_loan">
      <div class="form-grid">
        <div class="form-group">
          <label>Loan Product</label>
          <select name="product" class="form-control">
            <option value="Personal Micro-Loan">Personal Micro-Loan</option>
            <option value="Student Support Credit">Student Support Credit</option>
            <option value="Small Business Boost">Small Business Boost</option>
          </select>
        </div>
        <div class="form-group">
          <label>Principal (RWF) *</label>
          <input name="principal_rwf" type="number" min="500" class="form-control font-mono" required>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Term (Months)</label>
          <select name="term_months" class="form-control">
            <option value="1">1 Month</option>
            <option value="3" selected>3 Months</option>
            <option value="6">6 Months</option>
            <option value="12">12 Months</option>
          </select>
        </div>
        <div class="form-group">
          <label>Reason *</label>
          <input name="reason" type="text" class="form-control" required placeholder="Purpose of credit">
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-sm">Submit Loan Request</button>
    </form>

    <?php foreach ($loans as $ln): ?>
      <?php $rem = max(0, (float)$ln['total_repayable_rwf'] - (float)$ln['repaid_rwf']); ?>
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <strong><?= e($ln['product']) ?></strong>
          <span class="badge <?= $ln['status'] === 'approved' || $ln['status'] === 'repaid' ? 'badge-success' : ($ln['status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($ln['status']) ?></span>
        </div>
        <div class="font-mono" style="font-size: 12px; color: #475569; margin-bottom: 8px;">
          Principal: <?= e(format_rwf($ln['principal_rwf'])) ?> &middot; Remaining: <strong><?= e(format_rwf($rem)) ?></strong>
        </div>
        <?php if ($ln['status'] === 'approved' && $rem > 0): ?>
          <form method="post" action="/user/savings_loans.php" style="display: flex; gap: 6px;">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="repay_loan">
            <input type="hidden" name="loan_id" value="<?= (int)$ln['id'] ?>">
            <input name="repay_rwf" type="number" min="100" max="<?= (int)$rem ?>" value="<?= (int)min($rem, (float)$ln['monthly_payment_rwf']) ?>" class="form-control font-mono" style="width: 140px; min-height: 34px;" required>
            <button type="submit" class="btn btn-emerald btn-sm">Repay</button>
          </form>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
  </section>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
