<?php
declare(strict_types=1);

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/security.php';
require_once __DIR__ . '/config/migrations.php';
require_once __DIR__ . '/config/db.php';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function esc(string $val): string {
    return htmlspecialchars($val, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$alreadyConfiguredAndReady = false;
$currentStatus = check_database_status();
if ($currentStatus['connected']) {
    $alreadyConfiguredAndReady = true;
}

$errorMsg = '';
$successMsg = '';

$hostInput = trim((string)($_POST['db_host'] ?? (efinance_is_local_host() ? '127.0.0.1' : '')));
$portInput = (int)($_POST['db_port'] ?? 3306);
if ($portInput <= 0) {
    $portInput = 3306;
}
$nameInput = trim((string)($_POST['db_name'] ?? (efinance_is_local_host() ? 'efinance_rwanda' : '')));
$userInput = trim((string)($_POST['db_user'] ?? (efinance_is_local_host() ? 'root' : '')));
$passInput = (string)($_POST['db_pass'] ?? '');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$alreadyConfiguredAndReady) {
    if ($hostInput === '' || $nameInput === '' || $userInput === '') {
        $errorMsg = 'Enter your MySQL Hostname, Database Name, and MySQL Username.';
    } else {
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        $isLocal = in_array(strtolower($hostInput), ['localhost', '127.0.0.1', '::1'], true);
        try {
            if ($isLocal) {
                $serverDsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $hostInput, $portInput);
                $serverPdo = new PDO($serverDsn, $userInput, $passInput, $options);
                $safeDb = str_replace('`', '``', $nameInput);
                $serverPdo->exec("CREATE DATABASE IF NOT EXISTS `{$safeDb}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            }

            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $hostInput, $portInput, $nameInput);
            $pdo = new PDO($dsn, $userInput, $passInput, $options);
            $summary = runPendingMigrations($pdo);

            $configExport = "<?php\nreturn " . var_export([
                'host' => $hostInput,
                'port' => $portInput,
                'dbname' => $nameInput,
                'user' => $userInput,
                'pass' => $passInput,
            ], true) . ";\n";

            if (@file_put_contents(EFINANCE_LOCAL_DB_FILE, $configExport, LOCK_EX) === false) {
                $errorMsg = 'Connected to MySQL and initialized all tables, but could not write config/local_db.php. Check folder permissions on config/.';
            } else {
                $alreadyConfiguredAndReady = true;
                $currentStatus = [
                    'connected' => true,
                    'engine' => 'mysql',
                    'migrationSummary' => $summary,
                ];
                $successMsg = 'MySQL database connected and all 20 tables, 21 indexes, and default platform settings were initialized automatically.';
            }
        } catch (Throwable $e) {
            $errorMsg = 'Could not connect to MySQL: ' . $e->getMessage();
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>E-Finance Rwanda — Database Setup</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: linear-gradient(135deg, #071B38 0%, #0F3A7D 60%, #0D6E52 100%);
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 560px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(2, 6, 23, 0.35);
      padding: 28px;
    }
    .badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #1e40af;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 4px 10px;
      border-radius: 6px;
    }
    h1 {
      margin: 12px 0 8px;
      font-size: 22px;
      color: #071B38;
    }
    p {
      margin: 0 0 16px;
      font-size: 14px;
      line-height: 1.55;
      color: #475569;
    }
    .alert {
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13.5px;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .alert-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }
    .alert-success {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }
    .field {
      margin-bottom: 14px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 5px;
    }
    input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      color: #0f172a;
    }
    input:focus {
      outline: 2px solid #2563eb;
      border-color: #2563eb;
    }
    .row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 12px 16px;
      border: none;
      border-radius: 10px;
      background: #071B38;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      margin-top: 6px;
    }
    .btn:hover { background: #0f2f5f; }
    .meta {
      margin-top: 16px;
      padding: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 12.5px;
      color: #475569;
      line-height: 1.5;
    }
    code {
      background: #e2e8f0;
      padding: 1px 5px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">XAMPP &amp; InfinityFree Installer</span>
    <h1>E-Finance Rwanda — MySQL Setup</h1>

    <?php if ($alreadyConfiguredAndReady): ?>
      <div class="alert alert-success">
        <strong>Database Ready!</strong>
        <?php echo esc($successMsg !== '' ? $successMsg : 'Your MySQL database is connected and all platform tables, indexes, and settings are initialized.'); ?>
      </div>
      <div class="meta">
        <div><strong>Engine:</strong> MySQL / MariaDB (PDO)</div>
        <div><strong>Migrations Applied:</strong> <?php echo esc(implode(', ', $currentStatus['migrationSummary']['appliedVersions'] ?? [1, 2, 3])); ?></div>
        <div><strong>Administrator Setup:</strong> Sign in with <code><?php echo esc(EFINANCE_ADMIN_EMAIL); ?></code> to claim your secure administrator password on first run.</div>
      </div>
      <a href="./" class="btn" style="margin-top: 16px;">Open E-Finance Rwanda Platform →</a>
    <?php else: ?>
      <p>
        Enter your InfinityFree (VistaPanel → MySQL Databases) or local XAMPP MySQL credentials.
        Tables, indexes, default settings, and initial announcements will be created automatically.
      </p>

      <?php if ($errorMsg !== ''): ?>
        <div class="alert alert-error"><?php echo esc($errorMsg); ?></div>
      <?php endif; ?>

      <form method="post" action="setup.php">
        <div class="row">
          <div class="field">
            <label for="db_host">MySQL Hostname</label>
            <input id="db_host" name="db_host" type="text" required placeholder="e.g. sql305.infinityfree.com or 127.0.0.1" value="<?php echo esc($hostInput); ?>" />
          </div>
          <div class="field">
            <label for="db_port">Port</label>
            <input id="db_port" name="db_port" type="number" required value="<?php echo esc((string)$portInput); ?>" />
          </div>
        </div>
        <div class="field">
          <label for="db_name">Database Name</label>
          <input id="db_name" name="db_name" type="text" required placeholder="e.g. if0_12345678_efinance or efinance_rwanda" value="<?php echo esc($nameInput); ?>" />
        </div>
        <div class="field">
          <label for="db_user">MySQL Username</label>
          <input id="db_user" name="db_user" type="text" required placeholder="e.g. if0_12345678 or root" value="<?php echo esc($userInput); ?>" />
        </div>
        <div class="field">
          <label for="db_pass">MySQL Password (leave empty for default XAMPP)</label>
          <input id="db_pass" name="db_pass" type="password" placeholder="Enter MySQL password" value="" />
        </div>
        <button type="submit" class="btn">Connect Database &amp; Initialize Tables</button>
      </form>

      <div class="meta">
        <strong>Using XAMPP locally?</strong> Start Apache &amp; MySQL in XAMPP Control Panel and simply open <code>./</code> directly — local <code>efinance_rwanda</code> initializes automatically without running setup.
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
