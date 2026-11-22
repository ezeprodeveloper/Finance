<?php
declare(strict_types=1);

date_default_timezone_set('Africa/Kigali');

define('APP_NAME', 'E-Finance Rwanda');
define('BASE_PATH', dirname(__DIR__));

// Update these constants with your InfinityFree MySQL credentials from VistaPanel
define('DB_HOST', getenv('EFINANCE_DB_HOST') ?: 'sqlXXX.infinityfree.com');
define('DB_NAME', getenv('EFINANCE_DB_NAME') ?: 'epiz_XXXXXXXX_efinance');
define('DB_USER', getenv('EFINANCE_DB_USER') ?: 'epiz_XXXXXXXX');
define('DB_PASS', getenv('EFINANCE_DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

define('UPLOAD_MAX_IMAGE_BYTES', 3 * 1024 * 1024);  // 3 MB
define('UPLOAD_MAX_VIDEO_BYTES', 15 * 1024 * 1024); // 15 MB
