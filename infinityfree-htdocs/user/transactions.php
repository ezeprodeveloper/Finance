<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

$pdo = db();
$authUser = require_user($pdo);

$catFilter = trim((string)($_GET['category'] ?? 'All'));
$search = trim((string)($_GET['q'] ?? ''));

$sql = 'SELECT * FROM transactions WHERE user_id = :uid';
$params = [':uid' => $authUser['id']];

if ($catFilter !== '' && $catFilter !== 'All') {
    $sql .= ' AND category = :cat';
    $params[':cat'] = $catFilter;
}
if ($search !== '') {
    $sql .= ' AND (title LIKE :q1 OR reference LIKE :q2 OR channel LIKE :q3)';
    $like = '%' . $search . '%';
    $params[':q1'] = $like;
    $params[':q2'] = $like;
    $params[':q3'] = $like;
}
$sql .= ' ORDER BY created_at DESC LIMIT 200';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

if (isset($_GET['export']) && $_GET['export'] === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="efinance-' . $authUser['account_number'] . '-ledger.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['Reference', 'Title', 'Category', 'Channel', 'Direction', 'Amount RWF', 'Fee RWF', 'Status', 'Timestamp']);
    foreach ($rows as $r) {
        fputcsv($out, [$r['reference'], $r['title'], $r['category'], $r['channel'], $r['direction'], $r['amount_rwf'], $r['fee_rwf'], $r['status'], $r['created_at']]);
    }
    fclose($out);
    exit;
}

$pageTitle = 'Transaction History & Ledger';
$isAdminLayout = false;
require_once __DIR__ . '/../includes/header.php';
?>

<section class="card">
  <form method="get" action="/user/transactions.php" style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 16px;">
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <select name="category" class="form-control" style="width: auto;">
        <?php foreach (['All', 'Bonus', 'Check-In', 'Activation', 'Savings', 'Loan', 'Investment ROI', 'Investment Deposit', 'Spin Win', 'Referral Commission', 'Withdrawal', 'Video Reward', 'Task Reward', 'Campaign Payment'] as $c): ?>
          <option value="<?= e($c) ?>" <?= $catFilter === $c ? 'selected' : '' ?>><?= e($c) ?></option>
        <?php endforeach; ?>
      </select>
      <input name="q" type="search" value="<?= e($search) ?>" placeholder="Search reference or title..." class="form-control" style="width: 220px;">
      <button type="submit" class="btn btn-primary btn-sm">Filter</button>
    </div>
    <a href="/user/transactions.php?category=<?= urlencode($catFilter) ?>&q=<?= urlencode($search) ?>&export=csv" class="btn btn-outline btn-sm">Export CSV</a>
  </form>

  <?php if (empty($rows)): ?>
    <p style="font-size: 13px; color: #64748b;">No matching transactions found.</p>
  <?php else: ?>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Reference</th><th>Operation</th><th>Category</th><th>Status</th><th>Date</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>
          <?php foreach ($rows as $tx): ?>
            <tr>
              <td class="font-mono"><?= e($tx['reference']) ?></td>
              <td><strong><?= e($tx['title']) ?></strong><br><span style="font-size: 11px; color: #64748b;"><?= e($tx['channel']) ?></span></td>
              <td><?= e($tx['category']) ?></td>
              <td><span class="badge <?= $tx['status'] === 'Completed' ? 'badge-success' : ($tx['status'] === 'Rejected' ? 'badge-danger' : 'badge-warning') ?>"><?= e($tx['status']) ?></span></td>
              <td class="font-mono" style="font-size: 12px;"><?= e($tx['created_at']) ?></td>
              <td class="font-mono" style="text-align:right; font-weight: 700; color: <?= $tx['direction'] === 'credit' ? '#047857' : '#0f172a' ?>;">
                <?= $tx['direction'] === 'credit' ? '+' : '-' ?><?= e(format_rwf($tx['amount_rwf'])) ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</section>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
