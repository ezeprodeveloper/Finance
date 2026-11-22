<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$pdo = db();
$settings = get_settings($pdo);

$existing = current_user($pdo);
if ($existing) {
    if (($existing['role'] ?? '') === 'admin') {
        header('Location: /admin/dashboard.php');
        exit;
    }
    header('Location: /user/dashboard.php');
    exit;
}

$promoStmt = $pdo->query('SELECT * FROM promotions WHERE is_active = 1 ORDER BY created_at DESC LIMIT 8');
$promotions = $promoStmt->fetchAll();

$tierStmt = $pdo->query('SELECT * FROM investment_tiers WHERE is_active = 1 ORDER BY deposit_rwf ASC');
$tiers = $tierStmt->fetchAll();

$pageTitle = 'Welcome';
$authUser = null;
require_once __DIR__ . '/includes/header.php';
?>

<header class="public-header">
  <div class="container header-inner">
    <a href="/index.php" class="brand-link">E-Finance Rwanda</a>
    <div class="header-actions">
      <a href="/login.php" class="btn btn-ghost-light btn-sm">Login</a>
      <a href="/register.php" class="btn btn-emerald btn-sm">Create Account</a>
    </div>
  </div>
</header>

<section class="hero-section">
  <div class="container hero-grid">
    <div>
      <h1 class="hero-title">Smart Digital Savings, Credit &amp; Community Earnings in Rwanda</h1>
      <p class="hero-sub">
        <?= e($settings['platform_tagline']) ?> Build disciplined RWF savings goals, access transparent micro-loans, grow with daily investment plans, and earn from verified digital tasks.
      </p>
      <div class="hero-cta-row">
        <a href="/register.php" class="btn btn-emerald">Create Free Account</a>
        <a href="/login.php" class="btn btn-ghost-light">Sign In to Account</a>
      </div>
    </div>

    <div class="glass-panel">
      <h2 style="font-size: 18px; margin-bottom: 12px;">Built for Rwandan Members</h2>
      <ul style="margin: 0; padding-left: 18px; line-height: 1.85; font-size: 14px; color: #e2e8f0;">
        <li>Rwanda National ID &amp; KYC verified savings vaults</li>
        <li>Transparent RWF micro-loans with clear repayment schedules</li>
        <li>10 daily return investment tiers powered by automated 24h yields</li>
        <li>Short video watch rewards &amp; creator campaign hosting</li>
        <li>Daily member check-ins, Lucky Spin Wheel &amp; referral rewards</li>
      </ul>
    </div>
  </div>
</section>

<section class="public-band">
  <div class="container">
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 24px; color: #071b38;">Core Financial Services</h2>
      <p style="font-size: 14px; color: #475569; margin: 6px 0 0;">Everything you need to save, borrow, invest, and earn in Rwandan Francs.</p>
    </div>

    <div class="cards-grid-3">
      <div class="card">
        <h3 style="font-size: 16px; color: #071b38; margin-bottom: 8px;">Smart Savings &amp; Credit</h3>
        <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0;">
          Create flexible or goal-based RWF savings plans and request verified personal loans with complete transaction ledgers.
        </p>
      </div>
      <div class="card">
        <h3 style="font-size: 16px; color: #071b38; margin-bottom: 8px;">Daily Investment Plans</h3>
        <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0;">
          Choose from <?= count($tiers) ?> structured RWF investment tiers starting from 500 RWF up to 20,000 RWF with automatic 24-hour payouts.
        </p>
      </div>
      <div class="card">
        <h3 style="font-size: 16px; color: #071b38; margin-bottom: 8px;">Videos, Tasks &amp; Referrals</h3>
        <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0;">
          Earn rewards watching short videos, completing community tasks, checking in every 24 hours, and inviting friends.
        </p>
      </div>
    </div>
  </div>
</section>

<section class="public-band" style="background: #f8fafc;">
  <div class="container">
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 24px; color: #071b38;">Announcements &amp; Promotions</h2>
      <p style="font-size: 14px; color: #475569; margin: 6px 0 0;">Official updates and active member opportunities from E-Finance Rwanda.</p>
    </div>

    <?php if (empty($promotions)): ?>
      <div class="card" style="text-align: center; color: #64748b; font-size: 14px;">
        New E-Finance Rwanda announcements and promotions will appear here once published.
      </div>
    <?php else: ?>
      <div class="cards-grid-2">
        <?php foreach ($promotions as $promo): ?>
          <article class="card">
            <?php if (!empty($promo['banner_path'])): ?>
              <img src="/<?= e($promo['banner_path']) ?>" alt="<?= e($promo['title']) ?>" style="width: 100%; max-height: 170px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;">
            <?php endif; ?>
            <span class="badge badge-success" style="margin-bottom: 10px;"><?= e($promo['category']) ?></span>
            <h3 style="font-size: 17px; color: #071b38; margin-bottom: 8px;"><?= e($promo['title']) ?></h3>
            <p style="font-size: 13.5px; color: #334155; line-height: 1.65; margin: 0;"><?= nl2br(e($promo['summary'])) ?></p>
          </article>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
