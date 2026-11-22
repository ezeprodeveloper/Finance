<?php
declare(strict_types=1);

/** @var string $pageTitle */
/** @var array|null $authUser */
/** @var bool $isAdminLayout */

$pageTitle = $pageTitle ?? 'E-Finance Rwanda';
$authUser = $authUser ?? null;
$isAdminLayout = $isAdminLayout ?? false;
$flash = function_exists('flash_get') ? flash_get() : null;
$currentPath = $_SERVER['PHP_SELF'] ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= e($pageTitle) ?> | E-Finance Rwanda</title>
  <meta name="description" content="E-Finance Rwanda digital savings, KYC-verified credit, daily check-in, and investment portal.">
  <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body class="<?= $authUser ? 'bg-shifting-soft' : 'bg-shifting-aurora' ?>">
<?php if ($authUser && !$isAdminLayout): ?>
<div class="portal-shell">
  <aside class="portal-sidebar bg-shifting-aurora" id="portalSidebar">
    <div class="sidebar-brand">
      <a href="/user/dashboard.php" class="brand-link">E-Finance Rwanda</a>
      <button type="button" class="mobile-close-btn" id="closeSidebarBtn" aria-label="Close Menu">&times;</button>
    </div>
    <?php if (($authUser['account_status'] ?? '') === 'active'): ?>
    <nav class="sidebar-nav" aria-label="Member navigation">
      <a href="/user/dashboard.php" class="<?= str_ends_with($currentPath, '/user/dashboard.php') ? 'active' : '' ?>">Dashboard</a>
      <a href="/user/invest.php" class="<?= str_ends_with($currentPath, '/user/invest.php') ? 'active' : '' ?>">Investment Plans</a>
      <a href="/user/spin.php" class="<?= str_ends_with($currentPath, '/user/spin.php') ? 'active' : '' ?>">Lucky Spin &amp; Referrals</a>
      <a href="/user/kyc.php" class="<?= str_ends_with($currentPath, '/user/kyc.php') ? 'active' : '' ?>">Rwanda KYC</a>
      <a href="/user/savings_loans.php" class="<?= str_ends_with($currentPath, '/user/savings_loans.php') ? 'active' : '' ?>">Savings &amp; Loans</a>
      <a href="/user/videos_tasks.php" class="<?= str_ends_with($currentPath, '/user/videos_tasks.php') ? 'active' : '' ?>">Videos &amp; Tasks</a>
      <a href="/user/withdraw.php" class="<?= str_ends_with($currentPath, '/user/withdraw.php') ? 'active' : '' ?>">Withdraw</a>
      <a href="/user/transactions.php" class="<?= str_ends_with($currentPath, '/user/transactions.php') ? 'active' : '' ?>">History</a>
      <a href="/user/profile.php" class="<?= str_ends_with($currentPath, '/user/profile.php') ? 'active' : '' ?>">My Profile</a>
    </nav>
    <?php endif; ?>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <?php if (!empty($authUser['profile_photo_path'])): ?>
          <img src="/<?= e($authUser['profile_photo_path']) ?>" alt="Member" class="avatar-sm">
        <?php endif; ?>
        <div>
          <div class="user-name"><?= e($authUser['first_name'] . ' ' . $authUser['second_name']) ?></div>
          <div class="user-acct font-mono"><?= e($authUser['account_number']) ?></div>
        </div>
      </div>
      <a href="/logout.php" class="btn btn-ghost-light btn-sm btn-block">Sign Out</a>
    </div>
  </aside>
  <div class="portal-main">
    <header class="portal-topbar">
      <div class="topbar-left">
        <button type="button" class="mobile-menu-btn" id="openSidebarBtn" aria-label="Open Menu">&#9776;</button>
        <div>
          <span class="topbar-sub">E-Finance Rwanda Member</span>
          <h1 class="topbar-title"><?= e($pageTitle) ?></h1>
        </div>
      </div>
      <div class="kigali-clock" id="kigaliColorClock" aria-live="polite">
        <span class="clock-dot"></span>
        <span class="clock-time font-mono" id="clockDigits">--:--:--</span>
        <span class="clock-tz">CAT</span>
      </div>
    </header>
    <main class="portal-content">
      <?php if ($flash): ?>
        <div class="alert alert-<?= $flash['type'] === 'error' ? 'error' : 'success' ?>"><?= e($flash['message']) ?></div>
      <?php endif; ?>
<?php elseif ($authUser && $isAdminLayout): ?>
<div class="portal-shell">
  <aside class="portal-sidebar bg-shifting-aurora" id="portalSidebar">
    <div class="sidebar-brand">
      <a href="/admin/dashboard.php" class="brand-link">E-Finance Admin</a>
      <button type="button" class="mobile-close-btn" id="closeSidebarBtn" aria-label="Close Menu">&times;</button>
    </div>
    <nav class="sidebar-nav" aria-label="Admin navigation">
      <a href="/admin/dashboard.php" class="<?= str_ends_with($currentPath, '/admin/dashboard.php') ? 'active' : '' ?>">Overview</a>
      <a href="/admin/users.php" class="<?= str_ends_with($currentPath, '/admin/users.php') ? 'active' : '' ?>">Users &amp; Photos</a>
      <a href="/admin/kyc_review.php" class="<?= str_ends_with($currentPath, '/admin/kyc_review.php') ? 'active' : '' ?>">Rwanda KYC Desk</a>
      <a href="/admin/moderation.php" class="<?= str_ends_with($currentPath, '/admin/moderation.php') ? 'active' : '' ?>">Videos &amp; Tasks</a>
      <a href="/admin/finance.php" class="<?= str_ends_with($currentPath, '/admin/finance.php') ? 'active' : '' ?>">Investments, Loans &amp; Payouts</a>
      <a href="/admin/promotions.php" class="<?= str_ends_with($currentPath, '/admin/promotions.php') ? 'active' : '' ?>">Public Promotions</a>
      <a href="/admin/settings.php" class="<?= str_ends_with($currentPath, '/admin/settings.php') ? 'active' : '' ?>">System Settings</a>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div>
          <div class="user-name">Administrator</div>
          <div class="user-acct font-mono"><?= e($authUser['email']) ?></div>
        </div>
      </div>
      <a href="/logout.php" class="btn btn-ghost-light btn-sm btn-block">Sign Out</a>
    </div>
  </aside>
  <div class="portal-main">
    <header class="portal-topbar">
      <div class="topbar-left">
        <button type="button" class="mobile-menu-btn" id="openSidebarBtn" aria-label="Open Menu">&#9776;</button>
        <div>
          <span class="topbar-sub">E-Finance Control Center</span>
          <h1 class="topbar-title"><?= e($pageTitle) ?></h1>
        </div>
      </div>
      <div class="kigali-clock" id="kigaliColorClock" aria-live="polite">
        <span class="clock-dot"></span>
        <span class="clock-time font-mono" id="clockDigits">--:--:--</span>
        <span class="clock-tz">CAT</span>
      </div>
    </header>
    <main class="portal-content">
      <?php if ($flash): ?>
        <div class="alert alert-<?= $flash['type'] === 'error' ? 'error' : 'success' ?>"><?= e($flash['message']) ?></div>
      <?php endif; ?>
<?php else: ?>
  <?php if ($flash): ?>
    <div class="public-flash-wrap">
      <div class="alert alert-<?= $flash['type'] === 'error' ? 'error' : 'success' ?>"><?= e($flash['message']) ?></div>
    </div>
  <?php endif; ?>
<?php endif; ?>
