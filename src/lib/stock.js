import { db, syncState } from '../db/db';
import { round2 } from './util';

// The stock ledger. Every change to stock is recorded as a movement (sale, return,
// delivery, adjustment, count…). An item's stock is always the sum of its movements,
// so movements arriving from other counters add up correctly instead of overwriting.

export async function recomputeStock(variantIds) {
  let sums;
  if (!variantIds || variantIds.length > 400) {
    sums = new Map();
    await db.stockMoves.each((m) => { sums.set(m.variantId, (sums.get(m.variantId) || 0) + (Number(m.qty) || 0)); });
    if (!variantIds) variantIds = await db.variants.toCollection().primaryKeys();
  }
  syncState.applying = true; // a recount is not a new edit; do not re-upload it
  try {
    for (const id of variantIds) {
      let total;
      if (sums) total = sums.get(id) || 0;
      else { total = 0; await db.stockMoves.where('variantId').equals(id).each((m) => { total += Number(m.qty) || 0; }); }
      total = round2(total);
      const v = await db.variants.get(id);
      if (v && round2(Number(v.stock) || 0) !== total) await db.variants.update(id, { stock: total });
    }
  } finally { syncState.applying = false; }
}

// One-time start of the ledger on this computer: if an item's stock is not yet fully
// explained by movements, record the difference as its opening stock. The movement id
// is fixed per item, so two computers doing this create the same record, never two.
export async function ensureLedger() {
  if (await db.meta.get('ledger:v1')) return;
  const sums = new Map();
  await db.stockMoves.each((m) => { sums.set(m.variantId, (sums.get(m.variantId) || 0) + (Number(m.qty) || 0)); });
  const variants = await db.variants.toArray();
  const moves = [];
  for (const v of variants) {
    const diff = round2((Number(v.stock) || 0) - (sums.get(v.id) || 0));
    if (Math.abs(diff) > 0.0001) moves.push({ id: 'ledger-open-' + v.id, variantId: v.id, date: Date.now(), type: 'opening', qty: diff, ref: 'Stock ledger start', userId: '' });
  }
  if (moves.length) await db.stockMoves.bulkPut(moves);
  await db.meta.put({ key: 'ledger:v1', value: true });
}
