<?php
declare(strict_types=1);

require_once __DIR__ . '/functions.php';

$pdo = db();
$processed = run_daily_roi_engine($pdo);

if (PHP_SAPI === 'cli') {
    echo "Processed daily ROI for {$processed} active investment(s).\n";
} else {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'credited_investments' => $processed]);
}
