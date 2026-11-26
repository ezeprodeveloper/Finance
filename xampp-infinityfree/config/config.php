<?php
declare(strict_types=1);

define('EFINANCE_ADMIN_EMAIL', 'ezeprodeveloper@gmail.com');
define('EFINANCE_LOCAL_DB_FILE', __DIR__ . '/local_db.php');

function efinance_env(string $key, string $default = ''): string {
    $val = getenv($key);
    if ($val === false || trim((string)$val) === '') {
        return $default;
    }
    return trim((string)$val);
}

function efinance_get_admin_passcode(): string {
    $val = getenv('ADMIN_PASSCODE');
    if ($val !== false && trim((string)$val) !== '') {
        return (string)$val;
    }
    $val2 = getenv('EFINANCE_ADMIN_PASSCODE');
    if ($val2 !== false && trim((string)$val2) !== '') {
        return (string)$val2;
    }
    return '';
}

function efinance_is_local_host(): bool {
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost'));
    $hostname = explode(':', $host)[0];
    return in_array($hostname, ['localhost', '127.0.0.1', '::1'], true)
        || substr($hostname, -6) === '.local';
}

function efinance_load_db_config(): array {
    $localFile = EFINANCE_LOCAL_DB_FILE;
    if (is_file($localFile)) {
        $loaded = require $localFile;
        if (is_array($loaded) && !empty($loaded['host']) && !empty($loaded['dbname']) && isset($loaded['user'])) {
            return [
                'host' => (string)$loaded['host'],
                'port' => (int)($loaded['port'] ?? 3306),
                'dbname' => (string)$loaded['dbname'],
                'user' => (string)$loaded['user'],
                'pass' => (string)($loaded['pass'] ?? ''),
                'configured' => true,
                'source' => 'local_db.php',
            ];
        }
    }

    $envHost = efinance_env('EFINANCE_DB_HOST');
    $envDb = efinance_env('EFINANCE_DB_NAME');
    $envUser = efinance_env('EFINANCE_DB_USER');
    $envPass = getenv('EFINANCE_DB_PASS');
    $envPort = (int)efinance_env('EFINANCE_DB_PORT', '3306');

    if ($envHost !== '' && $envDb !== '' && $envUser !== '') {
        return [
            'host' => $envHost,
            'port' => $envPort > 0 ? $envPort : 3306,
            'dbname' => $envDb,
            'user' => $envUser,
            'pass' => $envPass === false ? '' : (string)$envPass,
            'configured' => true,
            'source' => 'env',
        ];
    }

    // Default XAMPP localhost connection (auto-initializes efinance_rwanda database)
    if (efinance_is_local_host()) {
        return [
            'host' => '127.0.0.1',
            'port' => 3306,
            'dbname' => 'efinance_rwanda',
            'user' => 'root',
            'pass' => '',
            'configured' => true,
            'source' => 'xampp_default',
        ];
    }

    return [
        'host' => '',
        'port' => 3306,
        'dbname' => '',
        'user' => '',
        'pass' => '',
        'configured' => false,
        'source' => 'unconfigured',
    ];
}
