import { db, SYNC_TABLES, syncState } from '../db/db';
import { getSettings, useSettings } from '../store/settings';
import { recomputeStock } from './stock';

// Cloud sync with the shop server (server/sync.php).
// Rules that protect the data:
//  • Every sale is saved on this computer first; the server is a copy + the link between counters.
//  • Upload takes a snapshot of record ids first, then sends them in chunks. The server must
//    confirm how many it saved; if anything is missing the sync fails and nothing is marked done.
//  • "Last uploaded" only moves forward after every chunk succeeded, so an interrupted sync
//    simply repeats next time (repeating is harmless; the newest version of a record wins).
let running = false;
const CHUNK = 1500;
const UNIQUE = { variants: 'barcode', users: 'username', sales: 'billNo', vouchers: 'code' };
const base = (url) => url.replace(/\/+$/, '');

async function post(url, key, body, timeoutMs = 120000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(base(url) + '/sync.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || 'HTTP ' + res.status);
    return data;
  } finally { clearTimeout(timer); }
}

async function applyPage(data) {
  let pulled = 0;
  const touchedVariants = new Set();
  syncState.applying = true;
  try {
    for (const [t, rows] of Object.entries(data.changes || {})) {
      if (!SYNC_TABLES.includes(t) || !rows.length) continue;
      const local = await db[t].bulkGet(rows.map((r) => r.id));
      const newer = rows.filter((r, i) => !local[i] || (local[i].updatedAt || 0) < (r.updatedAt || 0));
      if (t === 'stockMoves') rows.forEach((r) => r.variantId && touchedVariants.add(r.variantId));
      if (t === 'variants') rows.forEach((r) => touchedVariants.add(r.id));
      if (!newer.length) continue;
      const uniq = UNIQUE[t];
      if (uniq) {
        // the server copy wins if another local record already uses the same unique value
        for (const r of newer) {
          if (!r[uniq]) continue;
          const clash = await db[t].where(uniq).equals(r[uniq]).first();
          if (clash && clash.id !== r.id) await db[t].delete(clash.id);
        }
      }
      await db[t].bulkPut(newer); pulled += newer.length;
    }
    for (const d of data.deletions || []) {
      if (SYNC_TABLES.includes(d.table)) await db[d.table].delete(d.recordId);
    }
  } finally { syncState.applying = false; }
  // Stock = the sum of every movement from every counter, so it is always right after a sync.
  if (touchedVariants.size) await recomputeStock([...touchedVariants]);
  return pulled;
}

export async function syncNow({ full = false } = {}) {
  const s = getSettings();
  const { url, key, lastPush = 0, lastPull = 0 } = s.sync;
  if (!url || !key) return { ok: false, error: 'notConfigured' };
  if (!navigator.onLine) return { ok: false, error: 'offline' };
  if (running) return { ok: false, error: 'busy' };
  running = true;
  const startedAt = Date.now();
  const since = full ? -1 : lastPush;
  try {
    // ---------- 1. UPLOAD ----------
    let pushed = 0;
    for (const t of SYNC_TABLES) {
      const ids = await db[t].where('updatedAt').between(since, startedAt, false, true).primaryKeys();
      for (let i = 0; i < ids.length; i += CHUNK) {
        const rows = (await db[t].bulkGet(ids.slice(i, i + CHUNK))).filter(Boolean);
        if (!rows.length) continue;
        const r = await post(url, key, { terminal: s.terminal.code, pull: false, changes: { [t]: rows }, deletions: [] });
        if (r.received !== rows.length) throw new Error(`Server saved ${r.received} of ${rows.length} ${t}`);
        pushed += rows.length;
      }
    }
    const dels = await db.deletions.where('updatedAt').between(since, startedAt, false, true).toArray();
    for (let i = 0; i < dels.length; i += CHUNK) {
      await post(url, key, { terminal: s.terminal.code, pull: false, changes: {}, deletions: dels.slice(i, i + CHUNK) });
    }
    useSettings.getState().setSection('sync', { lastPush: startedAt });

    // ---------- 2. DOWNLOAD ----------
    let pulled = 0; let cursor = full ? 0 : lastPull;
    for (let page = 0; page < 10000; page++) {
      const data = await post(url, key, { terminal: s.terminal.code, pull: true, since: cursor, changes: {}, deletions: [] });
      pulled += await applyPage(data);
      cursor = data.serverTime;
      if (!data.more) break;
    }
    useSettings.getState().setSection('sync', { lastPull: cursor, lastResult: `↑${pushed} ↓${pulled}`, lastOk: Date.now(), lastError: '' });
    return { ok: true, pushed, pulled };
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Timed out' : String(e.message || e);
    useSettings.getState().setSection('sync', { lastError: msg, lastFail: Date.now() });
    return { ok: false, error: msg };
  } finally { running = false; }
}

export async function testConnection(url, key) {
  try {
    const res = await fetch(base(url) + '/health.php', { headers: { 'X-Api-Key': key } });
    const data = await res.json();
    return { ok: !!data.ok, message: data.message || data.error || '' };
  } catch (e) { return { ok: false, message: String(e.message || e) }; }
}

// Compare record counts on this computer and on the server, table by table.
export async function compareWithServer() {
  const s = getSettings();
  const res = await fetch(base(s.sync.url) + '/stats.php', { headers: { 'X-Api-Key': s.sync.key } });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Server error');
  const rows = [];
  for (const t of SYNC_TABLES) {
    const local = await db[t].count();
    rows.push({ table: t, local, server: Number(data.counts[t] || 0) });
  }
  return rows;
}

// Download everything stored on the server as a backup file (same format as a local backup).
export async function downloadServerExport() {
  const s = getSettings();
  const res = await fetch(base(s.sync.url) + '/export.php', { headers: { 'X-Api-Key': s.sync.key } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `redipos-server-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Second counter / new computer / new domain: clear this computer, download the whole shop.
// Nothing local is uploaded first, so demo or test data never reaches the server.
export async function joinFromCloud() {
  const s = getSettings();
  const ok = await testConnection(s.sync.url, s.sync.key);
  if (!ok.ok) return { ok: false, error: ok.message || 'connection' };
  await Promise.all(db.tables.filter((tb) => tb.name !== 'meta').map((tb) => tb.clear()));
  await db.meta.put({ key: 'seeded', value: true });
  await db.meta.put({ key: 'ledger:v1', value: true });
  useSettings.getState().setSection('sync', { lastPush: Date.now(), lastPull: 0, lastError: '' });
  const r = await syncNow();
  if (!r.ok) return r;
  // make sure every item's stock matches its movements after the full download
  await recomputeStock(null);
  return { ok: true, pulled: r.pulled };
}

// How many changes on this computer have not reached the server yet.
export async function unsyncedCount() {
  const since = getSettings().sync.lastPush || 0;
  let n = 0;
  for (const t of SYNC_TABLES) n += await db[t].where('updatedAt').above(since).count();
  return n + await db.deletions.where('updatedAt').above(since).count();
}
