<?php
// GET /api/export.php → download everything on the server as one backup file.
// The file can be restored in Redi POS (Settings → Backup & reset → Restore) on any computer.
require __DIR__ . '/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="redipos-server-' . gmdate('Y-m-d') . '.json"');
@set_time_limit(600);
while (ob_get_level()) ob_end_flush();
$out = fopen('php://output', 'w');
export_all($out);
fclose($out);
