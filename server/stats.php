<?php
// GET /api/stats.php → how many records the server holds per table (for "Check the server copy").
require __DIR__ . '/bootstrap.php';
$rows = db()->query('SELECT store, COUNT(*) AS n FROM redipos_records WHERE deleted = 0 GROUP BY store')->fetchAll();
$counts = [];
foreach (STORES as $s) $counts[$s] = 0;
foreach ($rows as $r) $counts[$r['store']] = (int)$r['n'];
respond(['ok' => true, 'counts' => $counts, 'time' => (int)round(microtime(true) * 1000)]);
