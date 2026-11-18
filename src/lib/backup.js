import { db, syncState } from '../db/db';

const ALL = ['categories', 'products', 'variants', 'customers', 'suppliers', 'sales', 'returns', 'purchases', 'stockMoves', 'expenses', 'shifts', 'promotions', 'vouchers', 'users', 'held', 'audit', 'deletions', 'meta'];

export async function exportAll() {
  const data = { app: 'redipos', version: 1, exportedAt: new Date().toISOString(), tables: {} };
  for (const t of ALL) data.tables[t] = await db[t].toArray();
  return data;
}

export async function importAll(data) {
  if (!data || data.app !== 'redipos' || !data.tables) throw new Error('This is not a Redi POS backup file');
  syncState.applying = true;
  try {
    await db.transaction('rw', ALL.map((t) => db[t]), async () => {
      for (const t of ALL) {
        await db[t].clear();
        if (data.tables[t]?.length) await db[t].bulkPut(data.tables[t]);
      }
    });
  } finally { syncState.applying = false; }
}

export async function wipeBusinessData({ keepProducts = true } = {}) {
  const tables = ['sales', 'returns', 'purchases', 'stockMoves', 'expenses', 'shifts', 'held', 'audit', 'vouchers'];
  if (!keepProducts) tables.push('categories', 'products', 'variants', 'customers', 'suppliers', 'promotions');
  await db.transaction('rw', tables.map((t) => db[t]), async () => { for (const t of tables) await db[t].clear(); });
}
