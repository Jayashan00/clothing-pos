import { db, getMeta, setMeta } from '../db/db';
import { exportAll } from './backup';
import { buildWorkbook, xlsxBlob, monthRange, monthKey } from './excel';
import { dayKey, startOfDay, endOfDay } from './util';

// Automatic backups into a folder on this computer: a normal folder, a USB drive, or a
// Google Drive / OneDrive folder (which then copies it to the cloud by itself).
//
//   <folder>/RediPOS/backups/redipos-backup-YYYY-MM-DD.json   full copy, last 31 days kept
//   <folder>/RediPOS/excel/redipos-YYYY-MM.xlsx               this month, refreshed during the day
//   <folder>/RediPOS/excel/daily/redipos-YYYY-MM-DD.xlsx      one workbook per day (kept)
//
// Works in Google Chrome and Microsoft Edge on computers.

const KEEP_DAYS = 31;
export const folderSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function getFolder() { return getMeta('backupDir', null); }

export async function folderState() {
  const dir = await getFolder();
  if (!dir) return { configured: false };
  let permission = 'prompt';
  try { permission = await dir.queryPermission({ mode: 'readwrite' }); } catch { /* handle no longer valid */ }
  return { configured: true, name: dir.name, permission, last: await getMeta('backupDir:last', 0), lastError: await getMeta('backupDir:error', '') };
}

export async function chooseFolder() {
  const dir = await window.showDirectoryPicker({ id: 'redipos-backup', mode: 'readwrite' });
  await setMeta('backupDir', dir);
  await setMeta('backupDir:error', '');
  return dir;
}

// Must be called from a button press if the browser asks again after a restart.
export async function allowFolder() {
  const dir = await getFolder(); if (!dir) return false;
  return (await dir.requestPermission({ mode: 'readwrite' })) === 'granted';
}

async function writeFile(dir, path, data) {
  const parts = path.split('/'); const name = parts.pop();
  let d = dir;
  for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
  const fh = await d.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data); await w.close();
}

async function prune(dir) {
  try {
    const app = await dir.getDirectoryHandle('RediPOS', { create: true });
    const b = await app.getDirectoryHandle('backups', { create: true });
    const cutoff = dayKey(Date.now() - KEEP_DAYS * 864e5);
    const old = [];
    for await (const [name] of b.entries()) {
      const m = name.match(/^redipos-backup-(\d{4}-\d{2}-\d{2})\.json$/);
      if (m && m[1] < cutoff) old.push(name);
    }
    for (const n of old) await b.removeEntry(n);
  } catch { /* pruning is best effort */ }
}

// Write today's backup + Excel files. Returns { ok, files } or { ok:false, reason }.
export async function runFolderBackup({ force = false } = {}) {
  const dir = await getFolder();
  if (!dir) return { ok: false, reason: 'noFolder' };
  let perm = 'prompt';
  try { perm = await dir.queryPermission({ mode: 'readwrite' }); } catch { /* */ }
  if (perm !== 'granted') return { ok: false, reason: 'permission' };
  const last = await getMeta('backupDir:last', 0);
  if (!force && Date.now() - last < 2 * 3600e3) return { ok: true, skipped: true };
  try {
    const today = dayKey(Date.now()); const month = monthKey();
    const data = await exportAll();
    await writeFile(dir, `RediPOS/backups/redipos-backup-${today}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const [mf, mt] = monthRange();
    await writeFile(dir, `RediPOS/excel/redipos-${month}.xlsx`, xlsxBlob(await buildWorkbook(mf, mt, `Month ${month}`)));
    await writeFile(dir, `RediPOS/excel/daily/redipos-${today}.xlsx`, xlsxBlob(await buildWorkbook(startOfDay(), endOfDay(), `Day ${today}`)));
    // on the first days of a month, also finish last month's workbook
    const d = new Date();
    if (d.getDate() <= 3) {
      const prev = new Date(d.getFullYear(), d.getMonth() - 1, 15).getTime();
      const [pf, pt] = monthRange(prev);
      await writeFile(dir, `RediPOS/excel/redipos-${monthKey(prev)}.xlsx`, xlsxBlob(await buildWorkbook(pf, pt, `Month ${monthKey(prev)}`)));
    }
    await prune(dir);
    await setMeta('backupDir:last', Date.now());
    await setMeta('backupDir:error', '');
    return { ok: true, files: 3 };
  } catch (e) {
    await setMeta('backupDir:error', String(e.message || e));
    return { ok: false, reason: 'error', error: String(e.message || e) };
  }
}

export async function lastDownloadBackup() { return getMeta('download:last', 0); }
export async function markDownloadBackup() { return setMeta('download:last', Date.now()); }
export const META_KEEP = ['backupDir', 'backupDir:last', 'backupDir:error'];
export { db };
