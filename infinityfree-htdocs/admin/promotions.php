<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_admin($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'add_promo') {
        $title = trim((string)($_POST['title'] ?? ''));
        $category = trim((string)($_POST['category'] ?? 'Announcement'));
        $summary = trim((string)($_POST['summary'] ?? ''));

        if (strlen($title) < 3 || strlen($summary) < 8) {
            flash_set('error', 'Provide a promotional title and clear summary text.');
        } else {
            $bannerPath = null;
            if (!empty($_FILES['banner_image']['name'])) {
                try {
                    $bannerPath = upload_secure_file(
                        $_FILES['banner_image'],
                        'promotions',
                        ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'],
                        UPLOAD_MAX_IMAGE_BYTES
                    );
                } catch (Throwable $ex) {
                    flash_set('error', $ex->getMessage());
                    header('Location: /admin/promotions.php');
                    exit;
                }
            }

            $stmt = $pdo->prepare(
                'INSERT INTO promotions (title, category, summary, banner_path, is_active)
                 VALUES (:t, :c, :s, :b, 1)'
            );
            $stmt->execute([
                ':t' => $title,
                ':c' => $category ?: 'Announcement',
                ':s' => $summary,
                ':b' => $bannerPath,
            ]);
            flash_set('success', 'Promotion published to the public landing page.');
        }
    } elseif ($action === 'toggle_promo') {
        $pid = (int)($_POST['promo_id'] ?? 0);
        if ($pid > 0) {
            $pdo->prepare('UPDATE promotions SET is_active = 1 - is_active WHERE id = :id')->execute([':id' => $pid]);
            flash_set('success', 'Promotion visibility updated.');
        }
    } elseif ($action === 'delete_promo') {
        $pid = (int)($_POST['promo_id'] ?? 0);
        if ($pid > 0) {
            $pdo->prepare('DELETE FROM promotions WHERE id = :id')->execute([':id' => $pid]);
            flash_set('success', 'Promotion deleted.');
        }
    }

    header('Location: /admin/promotions.php');
    exit;
}

$promotions = $pdo->query('SELECT * FROM promotions ORDER BY created_at DESC')->fetchAll();

$pageTitle = 'Public Promotions & Announcements';
$isAdminLayout = true;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="cards-grid-2">
  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Publish Landing Page Promotion</h2>
    </div>
    <form method="post" action="/admin/promotions.php" enctype="multipart/form-data">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="add_promo">
      <div class="form-group">
        <label for="promoTitle">Headline *</label>
        <input id="promoTitle" name="title" type="text" class="form-control" required placeholder="e.g. New Rwandan Cooperative Savings Campaign">
      </div>
      <div class="form-group">
        <label for="promoCategory">Category *</label>
        <select id="promoCategory" name="category" class="form-control">
          <option value="Announcement">Announcement</option>
          <option value="Investment Update">Investment Update</option>
          <option value="Savings Campaign">Savings Campaign</option>
          <option value="Member Event">Member Event</option>
        </select>
      </div>
      <div class="form-group">
        <label for="promoBanner">Promotional Banner Image (Optional JPG/PNG/WebP)</label>
        <input id="promoBanner" name="banner_image" type="file" accept="image/jpeg,image/png,image/webp" class="form-control">
      </div>
      <div class="form-group">
        <label for="promoSummary">Announcement Details *</label>
        <textarea id="promoSummary" name="summary" rows="4" class="form-control" required placeholder="Write clear details visible to visitors before signing up..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Publish to Public Portal</button>
    </form>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 style="font-size: 17px;">Published Announcements (<?= count($promotions) ?>)</h2>
    </div>
    <?php if (empty($promotions)): ?>
      <p style="font-size: 13px; color: #64748b;">No promotions published yet.</p>
    <?php else: ?>
      <?php foreach ($promotions as $p): ?>
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span class="badge <?= (int)$p['is_active'] === 1 ? 'badge-success' : 'badge-warning' ?>"><?= e($p['category']) ?> &middot; <?= (int)$p['is_active'] === 1 ? 'Visible' : 'Hidden' ?></span>
            <span class="font-mono" style="font-size: 11px; color: #64748b;"><?= e($p['created_at']) ?></span>
          </div>
          <?php if (!empty($p['banner_path'])): ?>
            <img src="/<?= e($p['banner_path']) ?>" alt="Promotion banner" style="width: 100%; max-height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;">
          <?php endif; ?>
          <h3 style="font-size: 15px; color: #071b38; margin-bottom: 4px;"><?= e($p['title']) ?></h3>
          <p style="font-size: 12.5px; color: #475569; margin: 0 0 10px;"><?= nl2br(e($p['summary'])) ?></p>
          <div style="display: flex; gap: 8px;">
            <form method="post" action="/admin/promotions.php">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="toggle_promo">
              <input type="hidden" name="promo_id" value="<?= (int)$p['id'] ?>">
              <button type="submit" class="btn btn-outline btn-sm"><?= (int)$p['is_active'] === 1 ? 'Hide' : 'Show' ?></button>
            </form>
            <form method="post" action="/admin/promotions.php">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="delete_promo">
              <input type="hidden" name="promo_id" value="<?= (int)$p['id'] ?>">
              <button type="submit" class="btn btn-danger btn-sm">Delete</button>
            </form>
          </div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </section>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
