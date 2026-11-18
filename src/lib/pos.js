import { db, nextSeq, audit } from '../db/db';
import { uid, round2, pad, sum, startOfDay } from './util';

export const PAYMENT_METHODS = ['cash', 'card', 'qr', 'bank', 'credit', 'voucher', 'points'];

export function activePromotions(promotions, now = Date.now()) {
  return (promotions || []).filter(
    (p) => p.active && (!p.startDate || p.startDate <= now) && (!p.endDate || p.endDate >= now)
  );
}

export function promoForLine(line, promos) {
  let best = null; let bestAmt = 0;
  for (const p of promos) {
    const hit = p.scope === 'all'
      || (p.scope === 'category' && (p.targetIds || []).includes(line.categoryId))
      || (p.scope === 'product' && (p.targetIds || []).includes(line.productId));
    if (!hit) continue;
    const gross = line.price * line.qty;
    const amt = p.type === 'percent' ? (gross * p.value) / 100 : Math.min(gross, p.value * line.qty);
    if (amt > bestAmt) { bestAmt = amt; best = p; }
  }
  return { promo: best, amount: round2(bestAmt) };
}

// Works out every number on the bill. Used by the screen, the receipt and the saved sale.
export function computeTotals(cart, settings, promotions = []) {
  const promos = activePromotions(promotions);
  const lines = cart.lines.map((l) => {
    const gross = round2(l.price * l.qty);
    const { promo, amount } = promoForLine(l, promos);
    const lineDisc = round2(Math.min(gross, amount + (Number(l.discount) || 0)));
    return { ...l, gross, promoName: promo ? promo.name : '', promoDisc: amount, lineDisc, net: round2(gross - lineDisc) };
  });
  const subtotal = round2(sum(lines, (l) => l.gross));
  const itemDiscount = round2(sum(lines, (l) => l.lineDisc));
  const afterItems = round2(subtotal - itemDiscount);
  const bd = cart.billDiscount || { type: 'amount', value: 0 };
  const billDiscount = round2(Math.min(afterItems, bd.type === 'percent' ? (afterItems * (Number(bd.value) || 0)) / 100 : Number(bd.value) || 0));
  const taxable = round2(afterItems - billDiscount);
  let tax = 0; let total = taxable;
  if (settings.tax?.enabled) {
    const r = Number(settings.tax.rate) || 0;
    if (settings.tax.inclusive) tax = round2((taxable * r) / (100 + r));
    else { tax = round2((taxable * r) / 100); total = round2(taxable + tax); }
  }
  const ratio = afterItems > 0 ? taxable / afterItems : 0;
  lines.forEach((l) => { l.paidUnit = l.qty ? round2((l.net * ratio) / l.qty) : 0; });
  const mrpSavings = round2(sum(lines, (l) => (l.mrp > l.price ? (l.mrp - l.price) * l.qty : 0)));
  const items = round2(sum(lines, (l) => (l.unit === 'pcs' ? l.qty : 1)));
  return { lines, subtotal, itemDiscount, billDiscount, taxable, tax, total, savings: round2(itemDiscount + billDiscount + mrpSavings), items };
}

export async function currentShift(terminal) {
  const open = await db.shifts.where('status').equals('open').toArray();
  return open.find((s) => s.terminal === terminal) || null;
}

export async function completeSale({ cart, totals, payments, user, settings }) {
  const terminal = settings.terminal.code || 'T1';
  const seq = await nextSeq('bill:' + terminal);
  const billNo = `${terminal}-${pad(seq, 6)}`;
  const shift = await currentShift(terminal);
  const paid = round2(sum(payments, (p) => p.amount));
  const nonCash = round2(sum(payments.filter((p) => p.method !== 'cash'), (p) => p.amount));
  const change = round2(Math.max(0, paid - totals.total));
  const pointsPaid = sum(payments.filter((p) => p.method === 'points'), (p) => p.amount);
  const pointsEarned = settings.loyalty.enabled && cart.customer
    ? Math.floor((totals.total - pointsPaid) / (settings.loyalty.rsPerPoint || 100)) : 0;

  const sale = {
    id: uid(),
    billNo,
    date: Date.now(),
    terminal,
    items: totals.lines.map((l) => ({
      variantId: l.variantId, productId: l.productId, categoryId: l.categoryId,
      nameEn: l.nameEn, nameSi: l.nameSi, icon: l.icon, size: l.size, color: l.color, barcode: l.barcode,
      unit: l.unit, qty: l.qty, price: l.price, mrp: l.mrp, cost: l.cost, gross: l.gross,
      discount: l.lineDisc, promoName: l.promoName, net: l.net, paidUnit: l.paidUnit, returnedQty: 0,
    })),
    subtotal: totals.subtotal,
    itemDiscount: totals.itemDiscount,
    billDiscount: totals.billDiscount,
    tax: totals.tax,
    total: totals.total,
    savings: totals.savings,
    payments: payments.map((p) => ({ method: p.method, amount: round2(p.amount), ref: p.ref || '' })),
    paid,
    cashReceived: round2(paid - nonCash),
    change,
    customerId: cart.customer?.id || null,
    customerName: cart.customer?.name || '',
    customerPhone: cart.customer?.phone || '',
    cashierId: user.id,
    cashierName: user.name,
    shiftId: shift?.id || null,
    status: 'completed',
    pointsEarned,
    pointsUsed: pointsPaid,
    note: cart.note || '',
  };

  await db.transaction('rw', [db.sales, db.variants, db.stockMoves, db.customers, db.vouchers, db.audit, db.held], async () => {
    for (const it of sale.items) {
      const v = await db.variants.get(it.variantId);
      if (v) {
        await db.variants.update(v.id, { stock: round2((Number(v.stock) || 0) - it.qty), lastSold: sale.date });
        await db.stockMoves.add({ id: uid(), variantId: v.id, date: sale.date, type: 'sale', qty: -it.qty, ref: billNo, userId: user.id });
      }
    }
    for (const p of payments) {
      if (p.method === 'voucher' && p.voucherId) {
        const vo = await db.vouchers.get(p.voucherId);
        if (vo) {
          const bal = round2(vo.balance - p.amount);
          await db.vouchers.update(vo.id, { balance: bal, status: bal <= 0 ? 'used' : 'active' });
        }
      }
    }
    if (cart.customer?.id) {
      const c = await db.customers.get(cart.customer.id);
      if (c) {
        const creditAdd = sum(payments.filter((p) => p.method === 'credit'), (p) => p.amount);
        await db.customers.update(c.id, {
          points: Math.max(0, (c.points || 0) - pointsPaid + pointsEarned),
          creditBalance: round2((c.creditBalance || 0) + creditAdd),
          totalSpent: round2((c.totalSpent || 0) + sale.total),
          visits: (c.visits || 0) + 1,
          lastVisit: sale.date,
        });
      }
    }
    if (cart.heldId) await db.held.delete(cart.heldId);
    await db.sales.add(sale);
  });
  audit(user.id, 'sale', `${billNo} ${sale.total}`);
  return sale;
}

export async function processReturn({ sale, items, refundMethod, reason, user, settings }) {
  const terminal = settings.terminal.code || 'T1';
  const seq = await nextSeq('return:' + terminal);
  const returnNo = `R${terminal}-${pad(seq, 5)}`;
  const shift = await currentShift(terminal);
  const lines = items.filter((x) => x.qty > 0).map((x) => {
    const it = sale.items[x.index];
    return { index: x.index, variantId: it.variantId, nameEn: it.nameEn, nameSi: it.nameSi, size: it.size, color: it.color, unit: it.unit, qty: x.qty, unitPrice: it.paidUnit, amount: round2(it.paidUnit * x.qty), restock: x.restock !== false };
  });
  const amount = round2(sum(lines, (l) => l.amount));
  let voucher = null;
  const ret = { id: uid(), returnNo, saleId: sale.id, billNo: sale.billNo, date: Date.now(), items: lines, amount, refundMethod, reason, userId: user.id, userName: user.name, shiftId: shift?.id || null, customerId: sale.customerId };

  await db.transaction('rw', [db.sales, db.variants, db.stockMoves, db.returns, db.vouchers, db.customers], async () => {
    const fresh = await db.sales.get(sale.id);
    const saleItems = fresh.items.map((it) => ({ ...it }));
    for (const l of lines) {
      saleItems[l.index].returnedQty = round2((saleItems[l.index].returnedQty || 0) + l.qty);
      if (l.restock) {
        const v = await db.variants.get(l.variantId);
        if (v) {
          await db.variants.update(v.id, { stock: round2((Number(v.stock) || 0) + l.qty) });
          await db.stockMoves.add({ id: uid(), variantId: v.id, date: ret.date, type: 'return', qty: l.qty, ref: returnNo, userId: user.id });
        }
      }
    }
    const all = saleItems.every((it) => (it.returnedQty || 0) >= it.qty);
    await db.sales.update(sale.id, { items: saleItems, status: all ? 'returned' : 'partial', returnedAmount: round2((fresh.returnedAmount || 0) + amount) });
    if (refundMethod === 'creditNote') {
      const code = 'CN' + pad(await nextSeq('voucher'), 7);
      voucher = { id: uid(), code, type: 'creditNote', amount, balance: amount, status: 'active', issuedAt: ret.date, expiresAt: ret.date + 90 * 864e5, customerId: sale.customerId, ref: returnNo };
      await db.vouchers.add(voucher);
      ret.voucherCode = code;
    }
    if (sale.customerId) {
      const c = await db.customers.get(sale.customerId);
      if (c) {
        const lostPoints = Math.floor(amount / (settings.loyalty.rsPerPoint || 100));
        await db.customers.update(c.id, { points: Math.max(0, (c.points || 0) - lostPoints), totalSpent: Math.max(0, round2((c.totalSpent || 0) - amount)) });
      }
    }
    await db.returns.add(ret);
  });
  audit(user.id, 'return', `${returnNo} for ${sale.billNo} ${amount}`);
  return { ret, voucher };
}

export async function voidSale(sale, user, reason) {
  await db.transaction('rw', [db.sales, db.variants, db.stockMoves, db.customers], async () => {
    for (const it of sale.items) {
      const back = it.qty - (it.returnedQty || 0);
      const v = await db.variants.get(it.variantId);
      if (v && back > 0) {
        await db.variants.update(v.id, { stock: round2((Number(v.stock) || 0) + back) });
        await db.stockMoves.add({ id: uid(), variantId: v.id, date: Date.now(), type: 'void', qty: back, ref: sale.billNo, userId: user.id });
      }
    }
    if (sale.customerId) {
      const c = await db.customers.get(sale.customerId);
      if (c) await db.customers.update(c.id, { points: Math.max(0, (c.points || 0) - (sale.pointsEarned || 0) + (sale.pointsUsed || 0)), totalSpent: Math.max(0, round2((c.totalSpent || 0) - sale.total)) });
    }
    await db.sales.update(sale.id, { status: 'void', voidReason: reason, voidBy: user.name, voidAt: Date.now() });
  });
  audit(user.id, 'void', `${sale.billNo} ${reason}`);
}

export async function receiveGoods({ supplierId, items, paid, note, invoiceNo, user, updateCost = true, updatePrice = true }) {
  const seq = await nextSeq('grn');
  const grnNo = 'GRN-' + pad(seq, 5);
  const total = round2(sum(items, (i) => i.qty * i.cost));
  const purchase = { id: uid(), grnNo, supplierId, invoiceNo: invoiceNo || '', date: Date.now(), items, total, paid: round2(paid || 0), note: note || '', userId: user.id };
  await db.transaction('rw', [db.purchases, db.variants, db.stockMoves, db.suppliers], async () => {
    for (const it of items) {
      const v = await db.variants.get(it.variantId);
      if (!v) continue;
      const patch = { stock: round2((Number(v.stock) || 0) + Number(it.qty)) };
      if (updateCost && it.cost) patch.cost = Number(it.cost);
      if (updatePrice && it.price) patch.price = Number(it.price);
      await db.variants.update(v.id, patch);
      await db.stockMoves.add({ id: uid(), variantId: v.id, date: purchase.date, type: 'purchase', qty: Number(it.qty), ref: grnNo, userId: user.id });
    }
    if (supplierId) {
      const s = await db.suppliers.get(supplierId);
      if (s) await db.suppliers.update(s.id, { balance: round2((s.balance || 0) + total - (paid || 0)) });
    }
    await db.purchases.add(purchase);
  });
  audit(user.id, 'grn', `${grnNo} ${total}`);
  return purchase;
}

export async function adjustStock({ variantId, mode, value, reason, note, user }) {
  return db.transaction('rw', [db.variants, db.stockMoves], async () => {
    const v = await db.variants.get(variantId);
    if (!v) return;
    const before = Number(v.stock) || 0;
    const after = mode === 'set' ? Number(value) : round2(before + Number(value));
    await db.variants.update(v.id, { stock: after });
    await db.stockMoves.add({ id: uid(), variantId, date: Date.now(), type: reason || 'adjust', qty: round2(after - before), ref: note || '', userId: user.id });
    return after;
  });
}

// Everything that happened in a shift, used for the X / Z report.
export async function shiftSummary(shift) {
  const from = shift.openedAt; const to = shift.closedAt || Date.now();
  const sales = (await db.sales.where('date').between(from, to, true, true).toArray()).filter((s) => s.terminal === shift.terminal && s.status !== 'void');
  const returns = (await db.returns.where('date').between(from, to, true, true).toArray()).filter((r) => r.shiftId === shift.id);
  const expenses = (await db.expenses.where('date').between(from, to, true, true).toArray()).filter((e) => e.fromDrawer && e.terminal === shift.terminal);
  const byMethod = {};
  sales.forEach((s) => s.payments.forEach((p) => { byMethod[p.method] = round2((byMethod[p.method] || 0) + p.amount); }));
  // gift vouchers sold during this shift are money in the drawer too
  const vouchersSold = (await db.vouchers.where('updatedAt').aboveOrEqual(from).toArray()).filter((v) => v.type === 'gift' && v.shiftId === shift.id);
  vouchersSold.forEach((v) => { byMethod[v.paidMethod || 'cash'] = round2((byMethod[v.paidMethod || 'cash'] || 0) + v.amount); });
  const changeGiven = round2(sum(sales, (s) => s.change));
  const cashIn = round2((byMethod.cash || 0) - changeGiven);
  const cashRefunds = round2(sum(returns.filter((r) => r.refundMethod === 'cash'), (r) => r.amount));
  const cashExpenses = round2(sum(expenses, (e) => e.amount));
  const expected = round2((shift.openingCash || 0) + cashIn - cashRefunds - cashExpenses);
  return {
    bills: sales.length,
    gross: round2(sum(sales, (s) => s.total)),
    discounts: round2(sum(sales, (s) => s.itemDiscount + s.billDiscount)),
    items: round2(sum(sales, (s) => sum(s.items, (i) => (i.unit === 'pcs' ? i.qty : 1)))),
    byMethod, cashIn, cashRefunds, cashExpenses, expected,
    returnsCount: returns.length, returnsTotal: round2(sum(returns, (r) => r.amount)),
  };
}

export async function todayStats() {
  const from = startOfDay();
  const sales = (await db.sales.where('date').aboveOrEqual(from).toArray()).filter((s) => s.status !== 'void');
  return { count: sales.length, total: round2(sum(sales, (s) => s.total)) };
}
