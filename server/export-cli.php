<?php
// Command line: php export-cli.php /path/to/file.json
// Used by the nightly server backup (deploy/backup.sh). Not reachable from the web.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/bootstrap.php';
$path = $argv[1] ?? 'php://stdout';
$out = fopen($path, 'w');
if (!$out) { fwrite(STDERR, "Cannot write $path\n"); exit(1); }
$counts = export_all($out);
fclose($out);
fwrite(STDERR, 'Exported: ' . json_encode($counts) . "\n");
