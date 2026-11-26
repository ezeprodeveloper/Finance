<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/migrations.php';

class DatabaseSetupRequiredException extends RuntimeException {
}

function get_pdo(): PDO {
    static $cachedPdo = null;
    if ($cachedPdo instanceof PDO) {
        return $cachedPdo;
    }

    $cfg = efinance_load_db_config();
    if (!$cfg['configured']) {
        throw new DatabaseSetupRequiredException(
            'Database is not configured yet. Open setup.php to connect your MySQL database (InfinityFree / shared hosting).'
        );
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $host = $cfg['host'];
    $port = (int)$cfg['port'];
    $dbname = $cfg['dbname'];
    $user = $cfg['user'];
    $pass = $cfg['pass'];

    // On XAMPP / localhost, auto-create the database if it does not exist yet
    $isLocalSource = ($cfg['source'] === 'xampp_default' || in_array(strtolower($host), ['localhost', '127.0.0.1', '::1'], true));

    if ($isLocalSource) {
        $serverDsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, $port);
        try {
            $serverPdo = new PDO($serverDsn, $user, $pass, $options);
            $safeDbName = str_replace('`', '``', $dbname);
            $serverPdo->exec("CREATE DATABASE IF NOT EXISTS `{$safeDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        } catch (Throwable $e) {
            throw new RuntimeException('Unable to connect to local MySQL server. Ensure MySQL is started in XAMPP Control Panel.');
        }
    }

    $dbDsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $dbname);
    try {
        $pdo = new PDO($dbDsn, $user, $pass, $options);
    } catch (Throwable $e) {
        if ($cfg['source'] === 'unconfigured' || !$isLocalSource) {
            throw new DatabaseSetupRequiredException(
                'Unable to connect to the configured MySQL database. Verify credentials in setup.php.'
            );
        }
        throw new RuntimeException('Database connection failed.');
    }

    runPendingMigrations($pdo);
    $cachedPdo = $pdo;
    return $cachedPdo;
}

function db_query_all(string $sql, array $params = []): array {
    $pdo = get_pdo();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function db_query_one(string $sql, array $params = []): ?array {
    $pdo = get_pdo();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

function db_execute(string $sql, array $params = []): int {
    $pdo = get_pdo();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function check_database_status(): array {
    try {
        $pdo = get_pdo();
        $summary = runPendingMigrations($pdo);
        return [
            'connected' => true,
            'engine' => 'mysql',
            'error' => null,
            'migrationSummary' => $summary,
        ];
    } catch (DatabaseSetupRequiredException $e) {
        return [
            'connected' => false,
            'engine' => 'mysql',
            'error' => $e->getMessage(),
            'setupRequired' => true,
        ];
    } catch (Throwable $e) {
        return [
            'connected' => false,
            'engine' => 'mysql',
            'error' => $e->getMessage(),
            'setupRequired' => false,
        ];
    }
}
