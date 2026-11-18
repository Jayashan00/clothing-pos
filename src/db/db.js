import Dexie from 'dexie';
import { uid } from '../lib/util';

// Offline-first database inside the browser (IndexedDB). Sales are saved here
// instantly, so billing never stops when the internet or the server is down.
export const db = new Dexie('redipos');

db.version(1).stores({
  categories: 'id, sort, updatedAt',
  products: 'id, categoryId, nameEn, active, updatedAt',
  variants: 'id, productId, &barcode, sku, updatedAt',
  customers: 'id, phone, name, updatedAt',
  suppliers: 'id, name, updatedAt',
  sales: 'id, &billNo, date, customerId, cashierId, shiftId, status, updatedAt',
  returns: 'id, returnNo, saleId, date, updatedAt',
  purchases: 'id, grnNo, supplierId, date, updatedAt',
  stockMoves: 'id, variantId, date, type, updatedAt',
  expenses: 'id, date, category, updatedAt',
  shifts: 'id, userId, status, openedAt, updatedAt',
  promotions: 'id, active, updatedAt',
  vouchers: 'id, &code, status, updatedAt',
  users: 'id, &username, updatedAt',
  held: 'id, date',
  audit: 'id, date, userId, updatedAt',
  deletions: 'id, table, updatedAt',
  meta: 'key',
});

export const SYNC_TABLES = [
  'categories', 'products', 'variants', 'customers', 'suppliers', 'sales', 'returns', 'purchases',
  'stockMoves', 'expenses', 'shifts', 'promotions', 'vouchers', 'users', 'audit',
];

export const syncState = { applying: false };

// Every change gets a timestamp so the cloud sync knows what to upload.
SYNC_TABLES.forEach((name) => {
  db[name].hook('creating', (_pk, obj) => {
    if (!syncState.applying) obj.updatedAt = Date.now();
    if (!obj.id) obj.id = uid();
  });
  db[name].hook('updating', () => (syncState.applying ? undefined : { updatedAt: Date.now() }));
});

export async function nextSeq(name) {
  return db.transaction('rw', db.meta, async () => {
    const row = await db.meta.get('seq:' + name);
    const v = (row?.value || 0) + 1;
    await db.meta.put({ key: 'seq:' + name, value: v });
    return v;
  });
}

export async function getMeta(key, fallback = null) {
  const r = await db.meta.get(key);
  return r ? r.value : fallback;
}
export const setMeta = (key, value) => db.meta.put({ key, value });

export async function removeRecord(table, id) {
  await db.transaction('rw', db[table], db.deletions, async () => {
    await db[table].delete(id);
    await db.deletions.put({ id: table + ':' + id, table, recordId: id, updatedAt: Date.now() });
  });
}

export async function audit(userId, action, details = '') {
  try { await db.audit.add({ id: uid(), date: Date.now(), userId, action, details }); } catch { /* never block */ }
}

// Ask the browser to keep this data even when disk space runs low.
export async function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { /* */ }
  return false;
}
