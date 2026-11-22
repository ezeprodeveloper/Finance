<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_admin($pdo);
$settings = get_settings($pdo);
run_daily_roi_engine($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'review_investment') {
        $invId = (int)($_POST['investment_id'] ?? 0);
        $decision = (string)($_POST['decision'] ?? '');
        if ($invId > 0 && in_array($decision, ['active', 'rejected'], true)) {
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare(
                    "SELECT ui.*, u.referred_by_user_id, u.first_name, u.second_name
                     FROM user_investments ui
                     JOIN users u ON u.id = ui.user_id
                     WHERE ui.id = :id AND ui.status = 'pending_admin'
                     FOR UPDATE"
                );
                $stmt->execute([':id' => $invId]);
                $inv = $stmt->fetch();
                if ($inv) {
                    if ($decision === 'active') {
                        $pdo->prepare(
                            "UPDATE user_investments
                             SET status = 'active', last_roi_credited_at = NOW()
                             WHERE id = :id"
                        )->execute([':id' => $invId]);

                        $pdo->prepare(
                            "UPDATE transactions
                             SET status = 'Completed'
                             WHERE user_id = :uid AND category = 'Investment Deposit' AND status = 'Pending Review'
                             ORDER BY created_at DESC LIMIT 1"
                        )->execute([':uid' => $inv['user_id']]);

                        $commPct = (float)$settings['referral_commission_percent'];
                        if (!empty($inv['referred_by_user_id']) && $commPct > 0) {
                            $commission = round(((float)$inv['deposit_rwf'] * $commPct) / 100);
                            if ($commission > 0) {
                                $pdo->prepare(
                                    'UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + :c WHERE id = :rid'
                                )->execute([':c' => $commission, ':rid' => $inv['referred_by_user_id']]);

                                log_transaction(
                                    $pdo,
                                    (int)$inv['referred_by_user_id'],
                                    'Referral Commission (' . $commPct . '% on ' . $inv['first_name'] . ' ' . $inv['second_name'] . ')',
                                    'Referral Commission',
                                    'Referred Investment: ' . $inv['plan_name'],
                                    $commission,
                                    'credit',
                                    'Completed',
                                    0.0,
                                    'COM'
                                );
                            }
                        }
                        flash_set('success', 'Investment plan activated. 24-hour ROI payouts scheduled.');
                    } else {
                        $pdo->prepare("UPDATE user_investments SET status = 'rejected' WHERE id = :id")->execute([':id' => $invId]);
                        $pdo->prepare(
                            "UPDATE transactions
                             SET status = 'Rejected'
                             WHERE user_id = :uid AND category = 'Investment Deposit' AND status = 'Pending Review'
                             ORDER BY created_at DESC LIMIT 1"
                        )->execute([':uid' => $inv['user_id']]);
                        flash_set('success', 'Investment deposit rejected.');
                    }
                }
                $pdo->commit();
            } catch (Throwable $ex) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                flash_set('error', 'Unable to process investment review.');
            }
        }
    } elseif ($action === 'review_loan') {
        $loanId = (int)($_POST['loan_id'] ?? 0);
        $decision = (string)($_POST['decision'] ?? '');
        if ($loanId > 0 && in_array($decision, ['approved', 'rejected'], true)) {
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare("SELECT * FROM loans WHERE id = :id AND status = 'pending_admin' FOR UPDATE");
                $stmt->execute([':id' => $loanId]);
                $loan = $stmt->fetch();
                if ($loan) {
                    $pdo->prepare('UPDATE loans SET status = :st WHERE id = :id')->execute([':st' => $decision, ':id' => $loanId]);
                    if ($decision === 'approved') {
                        $pdo->prepare('UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + :p WHERE id = :uid')
                            ->execute([':p' => $loan['principal_rwf'], ':uid' => $loan['user_id']]);
                        $pdo->prepare(
                            "UPDATE transactions
                             SET status = 'Completed'
                             WHERE user_id = :uid AND category = 'Loan' AND status = 'Pending Review'
                             ORDER BY created_at DESC LIMIT 1"
                        )->execute([':uid' => $loan['user_id']]);
                        flash_set('success', 'Loan approved and ' . format_rwf($loan['principal_rwf']) . ' credited to member wallet.');
                    } else {
                        $pdo->prepare(
                            "UPDATE transactions
                             SET status = 'Rejected'
                             WHERE user_id = :uid AND category = 'Loan' AND status = 'Pending Review'
                             ORDER BY created_at DESC LIMIT 1"
                        )->execute([':uid' => $loan['user_id']]);
                        flash_set('success', 'Loan request rejected.');
                    }
                }
                $pdo->commit();
            } catch (Throwable $ex) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                flash_set('error', 'Unable to process loan decision.');
            }
        }
    } elseif ($action === 'review_withdrawal') {
        $wdId = (int)($_POST['withdrawal_id'] ?? 0);
        $decision = (string)($_POST['decision'] ?? '');
        if ($wdId > 0 && in_array($decision, ['paid', 'rejected'], true)) {
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare("SELECT * FROM withdrawals WHERE id = :id AND status = 'pending_admin' FOR UPDATE");
                $stmt->execute([':id' => $wdId]);
                $wd = $stmt->fetch();
                if ($wd) {
                    $pdo->prepare('UPDATE withdrawals SET status = :st WHERE id = :id')->execute([':st' => $decision, ':id' => $wdId]);
                    if ($decision === 'paid') {
                        $pdo->prepare('UPDATE users SET has_completed_first_withdrawal = 1 WHERE id = :uid')
                            ->execute([':uid' => $wd['user_id']]);
                        $pdo->prepare(
                            "UPDATE transactions
                             SET status = 'Completed'
                             WHERE user_id = :uid AND category = 'Withdrawal' AND status = 'Pending Review'
                             ORDER BY created_at DESC LIMIT 1"
                        )->execute([':uid' => $wd['user_id']]);
                        flash_set('success', 'Withdrawal marked as Paid (' . format_rwf($wd['net_amount_rwf']) . ' net payout).');
                    } else {
                        $pdo->prepare('UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + :g WHERE id = :uid')
                            ->execute([':g' => $wd['gross_amount_rwf'], ':uid' => $wd['user_id']]);
                        $pdo->prepare(
                            "UPDATE transactions
                             SET status = 'Rejected'
                             WHERE user_id = :uid AND category = 'Withdrawal' AND status = 'Pending Review'
                             ORDER BY created_at DESC LIMIT 1"
                        )->execute([':uid' => $wd['user_id']]);
                        flash_set('success', 'Withdrawal rejected and ' . format_rwf($wd['gross_amount_rwf']) . ' refunded to member wallet.');
                    }
                }
                $pdo->commit();
            } catch (Throwable $ex) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                flash_set('error', 'Unable to process withdrawal decision.');
            }
        }
    }

    header('Location: /admin/finance.php');
    exit;
}

$investments = $pdo->query(
    'SELECT ui.*, u.first_name, u.second_name, u.account_number, u.phone
     FROM user_investments ui
     JOIN users u ON u.id = ui.user_id
     ORDER BY ui.created_at DESC'
)->fetchAll();

$loans = $pdo->query(
    'SELECT l.*, u.first_name, u.second_name, u.account_number, u.kyc_status
     FROM loans l
     JOIN users u ON u.id = l.user_id
     ORDER BY l.created_at DESC'
)->fetchAll();

$withdrawals = $pdo->query(
    'SELECT w.*, u.first_name, u.second_name, u.account_number, u.kyc_status
     FROM withdrawals w
     JOIN users u ON u.id = w.user_id
     ORDER BY w.created_at DESC'
)->fetchAll();

$pageTitle = 'Investments, Loans & Payouts';
$isAdminLayout = true;
require_once __DIR__ . '/../includes/header.php';
?>

<section class="card">
  <div class="card-header">
    <h2 style="font-size: 17px;">Investment Plan Deposit Approvals</h2>
    <span style="font-size: 12px; color: #64748b;">Verify MoMo reference to activate 24h ROI payouts</span>
  </div>
  <?php if (empty($investments)): ?>
    <p style="font-size: 13px; color: #64748b;">No investment plan deposits submitted yet.</p>
  <?php else: ?>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Plan &amp; Deposit</th>
            <th>MoMo Code &amp; Ref</th>
            <th>Progress</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($investments as $inv): ?>
            <tr>
              <td>
                <strong><?= e($inv['first_name'] . ' ' . $inv['second_name']) ?></strong><br>
                <span class="font-mono" style="font-size: 11px; color: #64748b;"><?= e($inv['account_number']) ?></span>
              </td>
              <td>
                <strong><?= e($inv['plan_name']) ?></strong><br>
                <span class="font-mono" style="font-size: 12px;"><?= e(format_rwf($inv['deposit_rwf'])) ?> (+<?= e(format_rwf($inv['daily_return_rwf'])) ?>/day)</span>
              </td>
              <td class="font-mono" style="font-size: 11.5px;">
                <?= e($inv['payment_code']) ?><br>
                Ref: <strong><?= e($inv['payment_ref']) ?></strong>
              </td>
              <td class="font-mono" style="font-size: 12px;">
                <?= (int)$inv['days_credited'] ?> / <?= (int)$inv['duration_days'] ?> days<br>
                Earned: <?= e(format_rwf($inv['total_earned_rwf'])) ?>
              </td>
              <td>
                <span class="badge <?= $inv['status'] === 'active' || $inv['status'] === 'completed' ? 'badge-success' : ($inv['status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>">
                  <?= e($inv['status']) ?>
                </span>
              </td>
              <td>
                <?php if ($inv['status'] === 'pending_admin'): ?>
                  <form method="post" action="/admin/finance.php" style="display: flex; gap: 6px;">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="review_investment">
                    <input type="hidden" name="investment_id" value="<?= (int)$inv['id'] ?>">
                    <button type="submit" name="decision" value="active" class="btn btn-emerald btn-sm">Activate</button>
                    <button type="submit" name="decision" value="rejected" class="btn btn-danger btn-sm">Reject</button>
                  </form>
                <?php else: ?>
                  <span style="font-size: 11.5px; color: #64748b;">Reviewed</span>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</section>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Loan Requests &amp; Disbursements</h2>
    </div>
    <?php if (empty($loans)): ?>
      <p style="font-size: 13px; color: #64748b;">No loan requests submitted yet.</p>
    <?php else: ?>
      <?php foreach ($loans as $ln): ?>
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <div>
              <strong><?= e($ln['first_name'] . ' ' . $ln['second_name']) ?></strong>
              <span class="font-mono" style="font-size: 11px; color: #64748b;">(KYC: <?= e($ln['kyc_status']) ?>)</span>
            </div>
            <span class="badge <?= $ln['status'] === 'approved' || $ln['status'] === 'repaid' ? 'badge-success' : ($ln['status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($ln['status']) ?></span>
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #071b38;"><?= e($ln['product']) ?> — <span class="font-mono"><?= e(format_rwf($ln['principal_rwf'])) ?></span> (<?= (int)$ln['term_months'] ?> mos)</div>
          <div style="font-size: 12px; color: #475569; margin: 4px 0 8px;">Reason: <?= e($ln['reason']) ?> &middot; Total Repayable: <span class="font-mono"><?= e(format_rwf($ln['total_repayable_rwf'])) ?></span> &middot; Repaid: <span class="font-mono"><?= e(format_rwf($ln['repaid_rwf'])) ?></span></div>
          <?php if ($ln['status'] === 'pending_admin'): ?>
            <form method="post" action="/admin/finance.php" style="display: flex; gap: 8px;">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="review_loan">
              <input type="hidden" name="loan_id" value="<?= (int)$ln['id'] ?>">
              <button type="submit" name="decision" value="approved" class="btn btn-emerald btn-sm">Approve &amp; Credit Wallet</button>
              <button type="submit" name="decision" value="rejected" class="btn btn-danger btn-sm">Reject</button>
            </form>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Mobile Money Payout Requests</h2>
    </div>
    <?php if (empty($withdrawals)): ?>
      <p style="font-size: 13px; color: #64748b;">No withdrawal requests submitted yet.</p>
    <?php else: ?>
      <?php foreach ($withdrawals as $wd): ?>
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <strong><?= e($wd['first_name'] . ' ' . $wd['second_name']) ?> (<?= e($wd['account_number']) ?>)</strong>
            <span class="badge <?= $wd['status'] === 'paid' ? 'badge-success' : ($wd['status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($wd['status']) ?></span>
          </div>
          <div style="font-size: 12.5px; color: #334155;">
            <strong>Network:</strong> <?= e($wd['network']) ?> &middot; <strong><?= e($wd['destination_type']) ?>:</strong> <span class="font-mono"><?= e($wd['destination_value']) ?></span><br>
            <strong>Registered Names:</strong> <?= e($wd['account_registered_names']) ?>
          </div>
          <div class="font-mono" style="font-size: 12px; color: #047857; margin: 6px 0 8px;">
            Gross: <?= e(format_rwf($wd['gross_amount_rwf'])) ?> &middot;
            Fee (<?= (float)$wd['fee_percent'] ?>%): <?= e(format_rwf($wd['fee_rwf'])) ?> &middot;
            <strong>Net Payout: <?= e(format_rwf($wd['net_amount_rwf'])) ?></strong>
          </div>
          <?php if ($wd['status'] === 'pending_admin'): ?>
            <form method="post" action="/admin/finance.php" style="display: flex; gap: 8px;">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="review_withdrawal">
              <input type="hidden" name="withdrawal_id" value="<?= (int)$wd['id'] ?>">
              <button type="submit" name="decision" value="paid" class="btn btn-emerald btn-sm">Mark Paid (<?= e(format_rwf($wd['net_amount_rwf'])) ?>)</button>
              <button type="submit" name="decision" value="rejected" class="btn btn-danger btn-sm">Reject &amp; Refund</button>
            </form>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </section>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
