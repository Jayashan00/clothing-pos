<?php
// Shared setup for every endpoint: config, CORS, API key check, database.
declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

// config.php is looked for next to this file (shared hosting) or two folders up,
// outside the public web folder (VPS install: /var/www/<site>/config.php).
$configFile = null;
foreach ([__DIR__ . '/config.php', dirname(__DIR__, 2) . '/config.php'] as $c) { if (is_file($c)) { $configFile = $c; break; } }
if (!$configFile) {
    if (PHP_SAPI !== 'cli') { http_response_code(500); header('Content-Type: application/json'); }
    echo json_encode(['ok' => false, 'error' => 'config.php is missing. Copy config.sample.php to config.php.']);
    exit(1);
}
$CONFIG = require $configFile;
$IS_CLI = PHP_SAPI === 'cli';

if (!$IS_CLI) {
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
}

function respond(array $data, int $code = 200): void {
    if (PHP_SAPI !== 'cli') http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- API key ----
if (!$IS_CLI) {
$key = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!is_string($CONFIG['api_key'] ?? null) || strlen($CONFIG['api_key']) < 16 || strpos($CONFIG['api_key'], 'CHANGE-ME') === 0) {
    respond(['ok' => false, 'error' => 'Set a real api_key in config.php'], 500);
}
if (!hash_equals($CONFIG['api_key'], (string)$key)) {
    usleep(300000); // slow down guessing
    respond(['ok' => false, 'error' => 'Wrong API key'], 401);
}
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

// Writes every record as one JSON document in the same format as a Redi POS backup file,
// so the server copy can be restored on any computer or loaded into a new server.
function export_all($out): array {
    $pdo = db();
    $counts = [];
    fwrite($out, '{"app":"redipos","version":1,"source":"server","exportedAt":' . json_encode(gmdate('c')) . ',"tables":{');
    $firstTable = true;
    foreach (STORES as $store) {
        fwrite($out, ($firstTable ? '' : ',') . json_encode($store) . ':[');
        $firstTable = false;
        $q = $pdo->prepare('SELECT data FROM redipos_records WHERE store = :s AND deleted = 0 ORDER BY id');
        $q->execute([':s' => $store]);
        $n = 0;
        while ($row = $q->fetch(PDO::FETCH_NUM)) { fwrite($out, ($n ? ',' : '') . $row[0]); $n++; }
        fwrite($out, ']');
        $counts[$store] = $n;
    }
    fwrite($out, '},"counts":' . json_encode($counts) . '}');
    return $counts;
}
