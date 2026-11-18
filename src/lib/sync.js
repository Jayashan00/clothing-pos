import { db, SYNC_TABLES, syncState } from '../db/db';
import { getSettings, useSettings } from '../store/settings';

// Cloud sync with the Hostinger PHP API (server/sync.php).
// The shop keeps selling offline; this uploads new records and downloads changes
// from other counters whenever the connection is available. Safe to run any time.
let running = false;
const UNIQUE = { variants: 'barcode', users: 'username', sales: 'billNo', vouchers: 'code' };

export async function syncNow() {
  const s = getSettings();
  const { url, key, lastPush = 0, lastPull = 0 } = s.sync;
  if (!url || !key) return { ok: false, error: 'notConfigured' };
  if (!navigator.onLine) return { ok: false, error: 'offline' };
  if (running) return { ok: false, error: 'busy' };
  running = true;
  const startedAt = Date.now();
  try {
    const changes = {}; let count = 0;
    for (const t of SYNC_TABLES) {
      const rows = await db[t].where('updatedAt').above(lastPush).limit(3000).toArray();
      if (rows.length) { changes[t] = rows; count += rows.length; }
    }
    const deletions = await db.deletions.where('updatedAt').above(lastPush).toArray();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    const res = await fetch(url.replace(/\/+$/, '') + '/sync.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body: JSON.stringify({ terminal: s.terminal.code, since: lastPull, changes, deletions }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Server error');
    let pulled = 0;
    // keep downloading while the server has more pages
    for (let page = 0; page < 200; page++) {
    syncState.applying = true;
    try {
      for (const [t, rows] of Object.entries(data.changes || {})) {
        if (!SYNC_TABLES.includes(t) || !rows.length) continue;
        const local = await db[t].bulkGet(rows.map((r) => r.id));
        const newer = rows.filter((r, i) => !local[i] || (local[i].updatedAt || 0) < (r.updatedAt || 0));
        if (!newer.length) continue;
        // The cloud copy wins if another local record already uses the same unique value
        const uniq = UNIQUE[t];
        if (uniq) {
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
    if (!data.more) break;
    const nextRes = await fetch(url.replace(/\/+$/, '') + '/sync.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body: JSON.stringify({ terminal: s.terminal.code, since: data.serverTime, changes: {}, deletions: [] }),
    });
    const next = await nextRes.json();
    if (!next.ok) throw new Error(next.error || 'Server error');
    data = next;
    }
    const result = `↑${count} ↓${pulled}`;
    useSettings.getState().setSection('sync', { lastPush: startedAt, lastPull: data.serverTime || lastPull, lastResult: result, lastOk: Date.now(), lastError: '' });
    return { ok: true, pushed: count, pulled };
  } catch (e) {
    useSettings.getState().setSection('sync', { lastError: String(e.message || e), lastFail: Date.now() });
    return { ok: false, error: String(e.message || e) };
  } finally { running = false; }
}

export async function testConnection(url, key) {
  try {
    const res = await fetch(url.replace(/\/+$/, '') + '/health.php', { headers: { 'X-Api-Key': key } });
    const data = await res.json();
    return { ok: !!data.ok, message: data.message || '' };
  } catch (e) { return { ok: false, message: String(e.message || e) }; }
}

// Second (or replacement) computer: clear this computer, then download the whole shop.
// Nothing local is uploaded, so demo data never reaches the cloud.
export async function joinFromCloud() {
  const s = getSettings();
  const ok = await testConnection(s.sync.url, s.sync.key);
  if (!ok.ok) return { ok: false, error: ok.message || 'connection' };
  await Promise.all(db.tables.map((tb) => tb.clear()));
  await db.meta.put({ key: 'seeded', value: true });
  useSettings.getState().setSection('sync', { lastPush: Date.now(), lastPull: 0, lastError: '' });
  let total = 0;
  for (let i = 0; i < 50; i++) {            // pull in rounds until nothing new arrives
    const r = await syncNow();
    if (!r.ok) return r;
    total += r.pulled;
    if (!r.pulled) break;
  }
  return { ok: true, pulled: total };
}
