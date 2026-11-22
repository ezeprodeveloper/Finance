<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo);
$settings = get_settings($pdo);
$minVideoReward = (int)$settings['min_video_reward_rwf'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'upload_video') {
        $title = trim((string)($_POST['title'] ?? ''));
        $desc = trim((string)($_POST['description'] ?? ''));
        $videoUrl = trim((string)($_POST['video_url'] ?? ''));
        $reward = (int)($_POST['reward_per_view_rwf'] ?? 0);
        $target = (int)($_POST['target_viewers'] ?? 0);
        $payRef = trim((string)($_POST['payment_ref'] ?? ''));

        if (strlen($title) < 3 || $reward < $minVideoReward || $target < 1 || strlen($payRef) < 4) {
            flash_set('error', 'Reward per view must be at least ' . format_rwf($minVideoReward) . ' with valid title, viewer count, and MoMo reference.');
        } else {
            $storedSource = $videoUrl;
            if (!empty($_FILES['video_file']['name'])) {
                try {
                    $storedSource = '/' . upload_secure_file(
                        $_FILES['video_file'],
                        'videos',
                        ['video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov'],
                        UPLOAD_MAX_VIDEO_BYTES
                    );
                } catch (Throwable $ex) {
                    flash_set('error', $ex->getMessage());
                    header('Location: /user/videos_tasks.php');
                    exit;
                }
            }
            if ($storedSource === '') {
                flash_set('error', 'Upload a short video file or provide a direct video URL.');
                header('Location: /user/videos_tasks.php');
                exit;
            }
            $totalBudget = $reward * $target;
            $payCode = build_ussd_code((string)$settings['momo_pay_code'], $totalBudget);

            $pdo->prepare(
                'INSERT INTO video_campaigns (creator_id, title, description, video_path_or_url, reward_per_view_rwf, target_viewers, total_budget_rwf, payment_code, payment_ref)
                 VALUES (:cid, :t, :d, :src, :r, :tv, :tb, :pc, :pr)'
            )->execute([
                ':cid' => $authUser['id'], ':t' => $title, ':d' => $desc, ':src' => $storedSource,
                ':r' => $reward, ':tv' => $target, ':tb' => $totalBudget, ':pc' => $payCode, ':pr' => $payRef,
            ]);
            log_transaction($pdo, (int)$authUser['id'], 'Video Campaign Deposit: ' . $title, 'Campaign Payment', $payCode . ' · Ref ' . $payRef, (float)$totalBudget, 'debit', 'Pending Review', 0.0, 'CMP');
            flash_set('success', 'Video campaign submitted for Admin verification.');
        }
    } elseif ($action === 'create_task') {
        $title = trim((string)($_POST['title'] ?? ''));
        $req = trim((string)($_POST['requirements'] ?? ''));
        $reward = (int)($_POST['reward_per_completion_rwf'] ?? 0);
        $target = (int)($_POST['target_completions'] ?? 0);
        $payRef = trim((string)($_POST['payment_ref'] ?? ''));

        if (strlen($title) < 3 || strlen($req) < 8 || $reward < 20 || $target < 1 || strlen($payRef) < 4) {
            flash_set('error', 'Provide task title, clear worker requirements, valid reward, target count, and MoMo reference.');
        } else {
            $totalBudget = $reward * $target;
            $payCode = build_ussd_code((string)$settings['momo_pay_code'], $totalBudget);
            $pdo->prepare(
                'INSERT INTO custom_tasks (creator_id, title, requirements, reward_per_completion_rwf, target_completions, total_budget_rwf, payment_code, payment_ref)
                 VALUES (:cid, :t, :req, :r, :tc, :tb, :pc, :pr)'
            )->execute([
                ':cid' => $authUser['id'], ':t' => $title, ':req' => $req, ':r' => $reward,
                ':tc' => $target, ':tb' => $totalBudget, ':pc' => $payCode, ':pr' => $payRef,
            ]);
            log_transaction($pdo, (int)$authUser['id'], 'Custom Task Deposit: ' . $title, 'Campaign Payment', $payCode . ' · Ref ' . $payRef, (float)$totalBudget, 'debit', 'Pending Review', 0.0, 'TSK');
            flash_set('success', 'Custom task submitted for Admin approval.');
        }
    } elseif ($action === 'submit_task_proof') {
        $taskId = (int)($_POST['task_id'] ?? 0);
        $proofText = trim((string)($_POST['proof_text'] ?? ''));
        $proofUrl = trim((string)($_POST['proof_url'] ?? '')) ?: null;

        $tStmt = $pdo->prepare("SELECT * FROM custom_tasks WHERE id = :id AND status = 'active' LIMIT 1");
        $tStmt->execute([':id' => $taskId]);
        $task = $tStmt->fetch();

        if (!$task || strlen($proofText) < 5) {
            flash_set('error', 'Invalid task or proof description.');
        } else {
            try {
                $ins = $pdo->prepare(
                    'INSERT INTO task_submissions (task_id, worker_id, proof_text, proof_url, reward_rwf)
                     VALUES (:tid, :wid, :pt, :pu, :rew)'
                );
                $ins->execute([
                    ':tid' => $taskId, ':wid' => $authUser['id'], ':pt' => $proofText,
                    ':pu' => $proofUrl, ':rew' => $task['reward_per_completion_rwf'],
                ]);
                flash_set('success', 'Task proof sent to Admin. Reward credits after requirement verification.');
            } catch (PDOException $dup) {
                flash_set('error', 'You have already submitted proof for this task (1 completion per user).');
            }
        }
    }

    header('Location: /user/videos_tasks.php');
    exit;
}

$videosStmt = $pdo->prepare(
    "SELECT vc.*, u.first_name, u.second_name,
            (SELECT COUNT(*) FROM user_video_views uvv WHERE uvv.campaign_id = vc.id AND uvv.user_id = :uid) AS already_watched
     FROM video_campaigns vc
     JOIN users u ON u.id = vc.creator_id
     WHERE vc.status = 'active' AND vc.views_count < vc.target_viewers
     ORDER BY vc.created_at DESC"
);
$videosStmt->execute([':uid' => $authUser['id']]);
$videos = $videosStmt->fetchAll();

$tasksStmt = $pdo->prepare(
    "SELECT ct.*, u.first_name, u.second_name,
            (SELECT status FROM task_submissions ts WHERE ts.task_id = ct.id AND ts.worker_id = :uid LIMIT 1) AS my_submission_status
     FROM custom_tasks ct
     JOIN users u ON u.id = ct.creator_id
     WHERE ct.status = 'active' AND ct.approved_count < ct.target_completions
     ORDER BY ct.created_at DESC"
);
$tasksStmt->execute([':uid' => $authUser['id']]);
$tasks = $tasksStmt->fetchAll();

$pageTitle = 'Short Videos & Paid Tasks';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Watch Short Videos &amp; Earn</h2>
      <span style="font-size: 11px; color: #64748b;">1 view per member</span>
    </div>
    <?php if (empty($videos)): ?>
      <p style="font-size: 13px; color: #64748b;">No active video campaigns right now.</p>
    <?php else: ?>
      <?php foreach ($videos as $v): ?>
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <strong><?= e($v['title']) ?></strong>
            <span class="font-mono" style="color: #047857; font-weight: 700;">+<?= e(format_rwf($v['reward_per_view_rwf'])) ?></span>
          </div>
          <p style="font-size: 12.5px; color: #475569; margin: 0 0 10px;"><?= e($v['description']) ?></p>
          <?php if ((int)$v['already_watched'] > 0): ?>
            <span class="badge badge-success">Already watched &amp; credited</span>
          <?php else: ?>
            <video src="<?= e($v['video_path_or_url']) ?>" controls style="width: 100%; max-height: 220px; border-radius: 8px; background: #000;" data-claim-video="<?= (int)$v['id'] ?>"></video>
            <button type="button" class="btn btn-emerald btn-sm claim-video-btn" data-cid="<?= (int)$v['id'] ?>" disabled style="margin-top: 8px;">
              Watch Full Video to Claim <?= e(format_rwf($v['reward_per_view_rwf'])) ?>
            </button>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Upload Video Campaign (Min <?= e(format_rwf($minVideoReward)) ?>/view)</h2>
    </div>
    <form method="post" action="/user/videos_tasks.php" enctype="multipart/form-data">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="upload_video">
      <div class="form-group">
        <label>Campaign Title *</label>
        <input name="title" type="text" class="form-control" required>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea name="description" rows="2" class="form-control"></textarea>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Upload Video File (MP4/WebM)</label>
          <input name="video_file" type="file" accept="video/mp4,video/webm,video/quicktime" class="form-control">
        </div>
        <div class="form-group">
          <label>Or Direct Video URL</label>
          <input name="video_url" type="url" class="form-control" placeholder="https://...">
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Reward / View (Min <?= $minVideoReward ?> RWF) *</label>
          <input id="vidRewardInput" name="reward_per_view_rwf" type="number" min="<?= $minVideoReward ?>" value="<?= $minVideoReward ?>" class="form-control font-mono" required>
        </div>
        <div class="form-group">
          <label>Target Viewers *</label>
          <input id="vidCountInput" name="target_viewers" type="number" min="1" value="10" class="form-control font-mono" required>
        </div>
      </div>
      <div class="ussd-box" style="margin-bottom: 12px;">
        <div>
          <div style="font-size: 11px; color: #cbd5e1;">Tap USSD to Pay Campaign Total:</div>
          <a id="vidUssdLink" href="<?= e(build_ussd_href((string)$settings['momo_pay_code'], $minVideoReward * 10)) ?>" class="ussd-link font-mono">
            <?= e(build_ussd_code((string)$settings['momo_pay_code'], $minVideoReward * 10)) ?>
          </a>
        </div>
      </div>
      <div class="form-group">
        <label>MoMo Payment Reference *</label>
        <input name="payment_ref" type="text" class="form-control font-mono" required placeholder="Enter MoMo Transaction ID">
      </div>
      <button type="submit" class="btn btn-primary btn-sm">Submit Video Campaign</button>
    </form>
  </section>
</div>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Available Paid Tasks</h2>
      <span style="font-size: 11px; color: #64748b;">Admin checks requirements</span>
    </div>
    <?php if (empty($tasks)): ?>
      <p style="font-size: 13px; color: #64748b;">No active tasks available right now.</p>
    <?php else: ?>
      <?php foreach ($tasks as $t): ?>
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <strong><?= e($t['title']) ?></strong>
            <span class="font-mono" style="color: #047857; font-weight: 700;">+<?= e(format_rwf($t['reward_per_completion_rwf'])) ?></span>
          </div>
          <p style="font-size: 12.5px; background: #f8fafc; padding: 8px; border-radius: 6px; margin: 6px 0;"><strong>Requirements:</strong> <?= e($t['requirements']) ?></p>
          <?php if (!empty($t['my_submission_status'])): ?>
            <span class="badge badge-warning">Submission Status: <?= e($t['my_submission_status']) ?></span>
          <?php else: ?>
            <form method="post" action="/user/videos_tasks.php">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="submit_task_proof">
              <input type="hidden" name="task_id" value="<?= (int)$t['id'] ?>">
              <div class="form-group">
                <input name="proof_text" type="text" class="form-control" required placeholder="Describe how you met the requirements...">
              </div>
              <div class="form-group">
                <input name="proof_url" type="url" class="form-control" placeholder="Proof link (Optional)">
              </div>
              <button type="submit" class="btn btn-primary btn-sm">Submit Proof to Admin</button>
            </form>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Create &amp; Fund a Custom Task</h2>
    </div>
    <form method="post" action="/user/videos_tasks.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="create_task">
      <div class="form-group">
        <label>Task Title *</label>
        <input name="title" type="text" class="form-control" required>
      </div>
      <div class="form-group">
        <label>Task Requirements (Admin inspects every proof against these) *</label>
        <textarea name="requirements" rows="3" class="form-control" required></textarea>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Reward per Person (RWF) *</label>
          <input id="tskRewardInput" name="reward_per_completion_rwf" type="number" min="20" value="100" class="form-control font-mono" required>
        </div>
        <div class="form-group">
          <label>Participants Wanted *</label>
          <input id="tskCountInput" name="target_completions" type="number" min="1" value="10" class="form-control font-mono" required>
        </div>
      </div>
      <div class="ussd-box" style="margin-bottom: 12px;">
        <div>
          <div style="font-size: 11px; color: #cbd5e1;">Tap USSD to Pay Task Budget:</div>
          <a id="tskUssdLink" href="<?= e(build_ussd_href((string)$settings['momo_pay_code'], 1000)) ?>" class="ussd-link font-mono">
            <?= e(build_ussd_code((string)$settings['momo_pay_code'], 1000)) ?>
          </a>
        </div>
      </div>
      <div class="form-group">
        <label>MoMo Payment Reference *</label>
        <input name="payment_ref" type="text" class="form-control font-mono" required>
      </div>
      <button type="submit" class="btn btn-primary btn-sm">Publish Custom Task</button>
    </form>
  </section>
</div>

<script>
(function () {
  var code = <?= json_encode((string)$settings['momo_pay_code']) ?>;
  function bindBudget(rId, cId, linkId) {
    var rEl = document.getElementById(rId), cEl = document.getElementById(cId), aEl = document.getElementById(linkId);
    if (!rEl || !cEl || !aEl) return;
    function sync() {
      var amt = Math.max(1, (parseInt(rEl.value || '0', 10) || 0) * (parseInt(cEl.value || '0', 10) || 0));
      aEl.textContent = '*182*8*1*' + code + '*' + amt + '#';
      aEl.href = 'tel:*182*8*1*' + encodeURIComponent(code) + '*' + amt + '%23';
    }
    rEl.addEventListener('input', sync);
    cEl.addEventListener('input', sync);
  }
  bindBudget('vidRewardInput', 'vidCountInput', 'vidUssdLink');
  bindBudget('tskRewardInput', 'tskCountInput', 'tskUssdLink');

  document.querySelectorAll('video[data-claim-video]').forEach(function (vid) {
    var cid = vid.getAttribute('data-claim-video');
    var btn = document.querySelector('.claim-video-btn[data-cid="' + cid + '"]');
    if (!btn) return;
    vid.addEventListener('ended', function () { btn.disabled = false; });
    btn.addEventListener('click', function () {
      var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      btn.disabled = true;
      fetch('/api/watch_video.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf },
        body: JSON.stringify({ campaign_id: parseInt(cid, 10), csrf_token: csrf }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) window.location.reload();
          else alert(d.error || 'Unable to claim.');
        });
    });
  });
})();
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
