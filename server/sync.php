<?php
// POST /api/sync.php
// Body: { terminal, since, changes: { table: [records] }, deletions: [{table, recordId, updatedAt}] }
// 1. Saves incoming records (newest version wins, by the record's updatedAt).
// 2. Returns records changed since `since` so every counter ends up with the same data.
require __DIR__ . '/bootstrap.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(['ok' => false, 'error' => 'Use POST'], 405);

$raw = file_get_contents('php://input');
$in = json_decode($raw ?: '', true);
if (!is_array($in)) respond(['ok' => false, 'error' => 'Invalid JSON'], 400);

$terminal = substr(preg_replace('/[^A-Za-z0-9]/', '', (string)($in['terminal'] ?? '')), 0, 12);
$since = max(0, (int)($in['since'] ?? 0));
$wantPull = !array_key_exists('pull', $in) || $in['pull'] !== false; // upload-only requests skip the download part
$changes = is_array($in['changes'] ?? null) ? $in['changes'] : [];
$deletions = is_array($in['deletions'] ?? null) ? $in['deletions'] : [];

$pdo = db();
// server_ts = milliseconds × 1000 + a counter, so each row in a request gets its own position
$nowMs = (int)round(microtime(true) * 1000);
$seq = 0;
$nextTs = function () use ($nowMs, &$seq) { return $nowMs * 1000 + ($seq++ % 1000); };

$upsert = $pdo->prepare(
  'INSERT INTO redipos_records (store, id, data, updated_at, server_ts, deleted, terminal)
   VALUES (:store, :id, :data, :u, :ts, 0, :term)
   ON DUPLICATE KEY UPDATE
     data = IF(VALUES(updated_at) >= updated_at, VALUES(data), data),
     deleted = IF(VALUES(updated_at) >= updated_at, 0, deleted),
     server_ts = IF(VALUES(updated_at) >= updated_at, VALUES(server_ts), server_ts),
     terminal = IF(VALUES(updated_at) >= updated_at, VALUES(terminal), terminal),
     updated_at = GREATEST(updated_at, VALUES(updated_at))'
);
$markDeleted = $pdo->prepare(
  'INSERT INTO redipos_records (store, id, data, updated_at, server_ts, deleted, terminal)
   VALUES (:store, :id, \'{}\', :u, :ts, 1, :term)
   ON DUPLICATE KEY UPDATE deleted = 1, server_ts = VALUES(server_ts), updated_at = GREATEST(updated_at, VALUES(updated_at))'
);

$received = 0;
try {
    $pdo->beginTransaction();
    foreach ($changes as $store => $rows) {
        if (!in_array($store, STORES, true) || !is_array($rows)) continue;
        foreach ($rows as $r) {
            if (!is_array($r) || empty($r['id']) || !is_string($r['id']) || strlen($r['id']) > 80) continue;
            $upsert->execute([
                ':store' => $store, ':id' => $r['id'],
                ':data' => json_encode($r, JSON_UNESCAPED_UNICODE),
                ':u' => (int)($r['updatedAt'] ?? 0), ':ts' => $nextTs(), ':term' => $terminal,
            ]);
            $received++;
        }
    }
    foreach ($deletions as $d) {
        $store = $d['table'] ?? ''; $id = $d['recordId'] ?? '';
        if (!in_array($store, STORES, true) || !is_string($id) || $id === '' || strlen($id) > 80) continue;
        $markDeleted->execute([':store' => $store, ':id' => $id, ':u' => (int)($d['updatedAt'] ?? 0), ':ts' => $nextTs(), ':term' => $terminal]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Redi POS sync: ' . $e->getMessage());
    respond(['ok' => false, 'error' => 'Could not save records'], 500);
}

if (!$wantPull) respond(['ok' => true, 'received' => $received]);

// Send back what changed since the client's cursor, in pages.
$LIMIT = 2000;
$q = $pdo->prepare('SELECT store, id, data, deleted, server_ts FROM redipos_records WHERE server_ts > :since ORDER BY server_ts ASC LIMIT ' . $LIMIT);
$q->execute([':since' => $since]);
$rows = $q->fetchAll();

$out = []; $dels = []; $lastTs = $since;
foreach ($rows as $row) {
    $lastTs = (int)$row['server_ts'];
    if ((int)$row['deleted'] === 1) { $dels[] = ['table' => $row['store'], 'recordId' => $row['id']]; continue; }
    $rec = json_decode($row['data'], true);
    if (is_array($rec)) $out[$row['store']][] = $rec;
}
$more = count($rows) === $LIMIT;
// Full page: continue from the last row next time. Otherwise step back 5 seconds,
// so a record saved by another counter at the same moment is never missed.
$cursor = $more ? $lastTs - 1 : max($since, ($nowMs - 5000) * 1000);

respond(['ok' => true, 'received' => $received, 'changes' => (object)$out, 'deletions' => $dels, 'serverTime' => $cursor, 'more' => $more]);
