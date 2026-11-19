import { db, syncState } from '../db/db';

const ALL = ['categories', 'products', 'variants', 'customers', 'suppliers', 'sales', 'returns', 'purchases', 'stockMoves', 'expenses', 'shifts', 'promotions', 'vouchers', 'users', 'held', 'audit', 'deletions', 'meta'];

// Settings that belong to this computer only (e.g. the backup folder) are not copied.
const LOCAL_META = (k) => String(k).startsWith('backupDir') || String(k).startsWith('download:');

export async function exportAll() {
  const data = { app: 'redipos', version: 1, exportedAt: new Date().toISOString(), tables: {} };
  for (const t of ALL) data.tables[t] = await db[t].toArray();
  data.tables.meta = data.tables.meta.filter((m) => !LOCAL_META(m.key));
  data.counts = Object.fromEntries(Object.entries(data.tables).map(([k, v]) => [k, v.length]));
  return data;
}

export async function importAll(data) {
  if (!data || data.app !== 'redipos' || !data.tables) throw new Error('This is not a Redi POS backup file');
  syncState.applying = true;
  try {
    await db.transaction('rw', ALL.map((t) => db[t]), async () => {
      const keep = (await db.meta.toArray()).filter((m) => LOCAL_META(m.key));
      for (const t of ALL) {
        await db[t].clear();
        const rows = (data.tables[t] || []).filter((r) => t !== 'meta' || !LOCAL_META(r.key));
        if (rows.length) await db[t].bulkPut(rows);
      }
      if (keep.length) await db.meta.bulkPut(keep);
      if (!data.tables.meta?.some((m) => m.key === 'seeded')) await db.meta.put({ key: 'seeded', value: true });
    });
  } finally { syncState.applying = false; }
}

export async function wipeBusinessData({ keepProducts = true } = {}) {
  const tables = ['sales', 'returns', 'purchases', 'stockMoves', 'expenses', 'shifts', 'held', 'audit', 'vouchers'];
  if (!keepProducts) tables.push('categories', 'products', 'variants', 'customers', 'suppliers', 'promotions');
  await db.transaction('rw', tables.map((t) => db[t]), async () => { for (const t of tables) await db[t].clear(); });
}
