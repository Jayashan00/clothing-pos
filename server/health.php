<?php
// GET /api/health.php  → checks the key and the database connection.
require __DIR__ . '/bootstrap.php';
$count = (int)db()->query('SELECT COUNT(*) FROM redipos_records')->fetchColumn();
respond(['ok' => true, 'message' => "Connected. $count records stored.", 'php' => PHP_VERSION, 'time' => (int)round(microtime(true) * 1000)]);
