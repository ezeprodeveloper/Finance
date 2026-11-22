<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_admin($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'review_video') {
        $cid = (int)($_POST['campaign_id'] ?? 0);
        $dec = (string)($_POST['decision'] ?? '');
        if ($cid > 0 && in_array($dec, ['active', 'rejected'], true)) {
            $pdo->prepare("UPDATE video_campaigns SET status = :st WHERE id = :id AND status = 'pending_admin'")->execute([':st' => $dec, ':id' => $cid]);
            $pdo->prepare("UPDATE transactions SET status = :tst WHERE category = 'Campaign Payment' AND status = 'Pending Review' AND user_id = (SELECT creator_id FROM video_campaigns WHERE id = :id)")
                ->execute([':tst' => $dec === 'active' ? 'Completed' : 'Rejected', ':id' => $cid]);
            flash_set('success', 'Video campaign marked as ' . $dec . '.');
        }
    } elseif ($action === 'review_task') {
        $tid = (int)($_POST['task_id'] ?? 0);
        $dec = (string)($_POST['decision'] ?? '');
        if ($tid > 0 && in_array($dec, ['active', 'rejected'], true)) {
            $pdo->prepare("UPDATE custom_tasks SET status = :st WHERE id = :id AND status = 'pending_admin'")->execute([':st' => $dec, ':id' => $tid]);
            $pdo->prepare("UPDATE transactions SET status = :tst WHERE category = 'Campaign Payment' AND status = 'Pending Review' AND user_id = (SELECT creator_id FROM custom_tasks WHERE id = :id) ORDER BY created_at DESC LIMIT 1")
                ->execute([':tst' => $dec === 'active' ? 'Completed' : 'Rejected', ':id' => $tid]);
            flash_set('success', 'Custom task marked as ' . $dec . '.');
        }
    } elseif ($action === 'review_submission') {
        $sid = (int)($_POST['submission_id'] ?? 0);
        $dec = (string)($_POST['decision'] ?? '');
        if ($sid > 0 && in_array($dec, ['approved', 'rejected'], true)) {
            $pdo->beginTransaction();
            try {
                $sStmt = $pdo->prepare("SELECT ts.*, ct.title AS task_title, ct.approved_count, ct.target_completions FROM task_submissions ts JOIN custom_tasks ct ON ct.id = ts.task_id WHERE ts.id = :id AND ts.status = 'pending_admin' FOR UPDATE");
                $sStmt->execute([':id' => $sid]);
                $sub = $sStmt->fetch();
                if ($sub) {
                    $pdo->prepare('UPDATE task_submissions SET status = :st, reviewed_at = NOW() WHERE id = :id')->execute([':st' => $dec, ':id' => $sid]);
                    if ($dec === 'approved') {
                        $pdo->prepare('UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + :r WHERE id = :wid')->execute([':r' => $sub['reward_rwf'], ':wid' => $sub['worker_id']]);
                        $newCount = (int)$sub['approved_count'] + 1;
                        $taskStatus = $newCount >= (int)$sub['target_completions'] ? 'completed' : 'active';
                        $pdo->prepare('UPDATE custom_tasks SET approved_count = :ac, status = :st WHERE id = :tid')->execute([':ac' => $newCount, ':st' => $taskStatus, ':tid' => $sub['task_id']]);
                        log_transaction($pdo, (int)$sub['worker_id'], 'Task Approved: ' . $sub['task_title'], 'Task Reward', 'Admin Requirement Check', (float)$sub['reward_rwf'], 'credit', 'Completed', 0.0, 'TSK');
                    }
                }
                $pdo->commit();
                flash_set('success', 'Task submission ' . $dec . '.');
            } catch (Throwable $ex) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                flash_set('error', 'Unable to update task submission.');
            }
        }
    }

    header('Location: /admin/moderation.php');
    exit;
}

$submissions = $pdo->query(
    'SELECT ts.*, ct.title AS task_title, ct.requirements, u.first_name, u.second_name
     FROM task_submissions ts
     JOIN custom_tasks ct ON ct.id = ts.task_id
     JOIN users u ON u.id = ts.worker_id
     ORDER BY ts.submitted_at DESC'
)->fetchAll();

$videos = $pdo->query('SELECT vc.*, u.first_name, u.second_name FROM video_campaigns vc JOIN users u ON u.id = vc.creator_id ORDER BY vc.created_at DESC')->fetchAll();
$tasks = $pdo->query('SELECT ct.*, u.first_name, u.second_name FROM custom_tasks ct JOIN users u ON u.id = ct.creator_id ORDER BY ct.created_at DESC')->fetchAll();

$pageTitle = 'Videos & Tasks Moderation';
$isAdminLayout = true;
require_once __DIR__ . '/../includes/header.php';
?>

<section class="card">
  <div class="card-header"><h2 style="font-size: 17px;">Worker Task Completion Proofs (Requirement Verification)</h2></div>
  <?php if (empty($submissions)): ?>
    <p style="font-size: 13px; color: #64748b;">No task proofs submitted yet.</p>
  <?php else: ?>
    <?php foreach ($submissions as $s): ?>
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <strong><?= e($s['first_name'] . ' ' . $s['second_name']) ?> &rarr; <?= e($s['task_title']) ?></strong>
          <span class="badge <?= $s['status'] === 'approved' ? 'badge-success' : ($s['status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($s['status']) ?></span>
        </div>
        <p style="font-size: 12px; background: #f8fafc; padding: 8px; border-radius: 6px; margin: 4px 0;"><strong>Creator Requirements:</strong> <?= e($s['requirements']) ?></p>
        <p style="font-size: 12.5px; margin: 4px 0;"><strong>Worker Proof:</strong> <?= e($s['proof_text']) ?> <?php if (!empty($s['proof_url'])): ?><a href="<?= e($s['proof_url']) ?>" target="_blank" rel="noreferrer">Open Proof Link</a><?php endif; ?></p>
        <?php if ($s['status'] === 'pending_admin'): ?>
          <form method="post" action="/admin/moderation.php" style="display: flex; gap: 8px; margin-top: 8px;">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="review_submission">
            <input type="hidden" name="submission_id" value="<?= (int)$s['id'] ?>">
            <button type="submit" name="decision" value="approved" class="btn btn-emerald btn-sm">Approve &amp; Pay <?= e(format_rwf($s['reward_rwf'])) ?></button>
            <button type="submit" name="decision" value="rejected" class="btn btn-danger btn-sm">Reject</button>
          </form>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
  <?php endif; ?>
</section>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header"><h2 style="font-size: 17px;">Short Video Campaigns</h2></div>
    <?php foreach ($videos as $v): ?>
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <strong><?= e($v['title']) ?></strong>
          <span class="badge <?= $v['status'] === 'active' || $v['status'] === 'completed' ? 'badge-success' : ($v['status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($v['status']) ?></span>
        </div>
        <div class="font-mono" style="font-size: 11.5px; color: #475569; margin: 4px 0;">By <?= e($v['first_name'] . ' ' . $v['second_name']) ?> &middot; <?= e(format_rwf($v['total_budget_rwf'])) ?> &middot; Ref: <?= e($v['payment_ref']) ?></div>
        <video src="<?= e($v['video_path_or_url']) ?>" controls style="max-height: 160px; width: 100%; border-radius: 8px; background: #000; margin: 6px 0;"></video>
        <?php if ($v['status'] === 'pending_admin'): ?>
          <form method="post" action="/admin/moderation.php" style="display: flex; gap: 8px;">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="review_video">
            <input type="hidden" name="campaign_id" value="<?= (int)$v['id'] ?>">
            <button type="submit" name="decision" value="active" class="btn btn-emerald btn-sm">Verify &amp; Publish</button>
            <button type="submit" name="decision" value="rejected" class="btn btn-danger btn-sm">Reject</button>
          </form>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
  </section>

  <section class="card">
    <div class="card-header"><h2 style="font-size: 17px;">Creator Custom Tasks</h2></div>
    <?php foreach ($tasks as $t): ?>
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <strong><?= e($t['title']) ?></strong>
          <span class="badge <?= $t['status'] === 'active' || $t['status'] === 'completed' ? 'badge-success' : ($t['status'] === 'rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($t['status']) ?></span>
        </div>
        <div class="font-mono" style="font-size: 11.5px; color: #475569; margin: 4px 0;">By <?= e($t['first_name'] . ' ' . $t['second_name']) ?> &middot; <?= e(format_rwf($t['total_budget_rwf'])) ?> &middot; Ref: <?= e($t['payment_ref']) ?></div>
        <p style="font-size: 12px; color: #334155;"><?= e($t['requirements']) ?></p>
        <?php if ($t['status'] === 'pending_admin'): ?>
          <form method="post" action="/admin/moderation.php" style="display: flex; gap: 8px;">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="review_task">
            <input type="hidden" name="task_id" value="<?= (int)$t['id'] ?>">
            <button type="submit" name="decision" value="active" class="btn btn-emerald btn-sm">Verify &amp; Publish</button>
            <button type="submit" name="decision" value="rejected" class="btn btn-danger btn-sm">Reject</button>
          </form>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
  </section>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
