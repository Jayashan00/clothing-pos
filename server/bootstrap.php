<?php
// Shared setup for every endpoint: config, CORS, API key check, database.
declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'config.php is missing. Copy config.sample.php to config.php.']);
    exit;
}
$CONFIG = require $configFile;

// ---- CORS (the POS runs on Vercel, the API on Hostinger) ----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = $CONFIG['allowed_origins'] ?? [];
if ($origin && (in_array('*', $allowed, true) || in_array($origin, $allowed, true))) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function respond(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- API key ----
$key = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!is_string($CONFIG['api_key'] ?? null) || strlen($CONFIG['api_key']) < 16 || strpos($CONFIG['api_key'], 'CHANGE-ME') === 0) {
    respond(['ok' => false, 'error' => 'Set a real api_key in config.php'], 500);
}
if (!hash_equals($CONFIG['api_key'], (string)$key)) {
    usleep(300000); // slow down guessing
    respond(['ok' => false, 'error' => 'Wrong API key'], 401);
}

// ---- Database ----
function db(): PDO {
    static $pdo = null;
    global $CONFIG;
    if ($pdo) return $pdo;
    try {
        $pdo = new PDO(
            'mysql:host=' . $CONFIG['db_host'] . ';dbname=' . $CONFIG['db_name'] . ';charset=utf8mb4',
            $CONFIG['db_user'], $CONFIG['db_pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
        );
    } catch (Throwable $e) {
        error_log('Redi POS DB: ' . $e->getMessage());
        respond(['ok' => false, 'error' => 'Database connection failed. Check config.php.'], 500);
    }
    // Create the table on first use, so no manual SQL step is needed.
    $pdo->exec("CREATE TABLE IF NOT EXISTS redipos_records (
        store VARCHAR(32) NOT NULL,
        id VARCHAR(80) NOT NULL,
        data LONGTEXT NOT NULL,
        updated_at BIGINT NOT NULL DEFAULT 0,
        server_ts BIGINT NOT NULL DEFAULT 0,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        terminal VARCHAR(12) NOT NULL DEFAULT '',
        PRIMARY KEY (store, id),
        KEY idx_server_ts (server_ts)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    return $pdo;
}

const STORES = ['categories','products','variants','customers','suppliers','sales','returns','purchases',
                'stockMoves','expenses','shifts','promotions','vouchers','users','audit'];
