import { db } from '../db/db';
import { getSettings } from '../store/settings';
import { round2, sum, dayKey, pad } from './util';

// Builds a real Excel workbook (.xlsx) of the shop's data for a period.
// Sheets: Summary, Bills, Bill items, Payments, Returns, Stock now, Stock movements,
// Deliveries, Expenses, Customers, Suppliers, Vouchers.

const day = (t) => (t ? dayKey(t) : '');
const time = (t) => (t ? `${pad(new Date(t).getHours(), 2)}:${pad(new Date(t).getMinutes(), 2)}` : '');

function sheet(XLSX, rows, widths, moneyCols = []) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'No records in this period' }]);
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  if (rows.length && moneyCols.length) {
    const keys = Object.keys(rows[0]);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (const name of moneyCols) {
      const c = keys.indexOf(name); if (c < 0) continue;
      for (let r = 1; r <= range.e.r; r++) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && cell.t === 'n') cell.z = '#,##0.00'; }
    }
  }
  if (rows.length) ws['!autofilter'] = { ref: ws['!ref'] };
  return ws;
}

export async function buildWorkbook(from, to, label) {
  const XLSX = await import('xlsx');
  const s = getSettings();
  const inRange = (t) => t >= from && t <= to;
  const [sales, returns, moves, purchases, expenses, products, variants, categories, customers, suppliers, vouchers, users] = await Promise.all([
    db.sales.where('date').between(from, to, true, true).toArray(),
    db.returns.where('date').between(from, to, true, true).toArray(),
    db.stockMoves.where('date').between(from, to, true, true).toArray(),
    db.purchases.where('date').between(from, to, true, true).toArray(),
    db.expenses.where('date').between(from, to, true, true).toArray(),
    db.products.toArray(), db.variants.toArray(), db.categories.toArray(),
    db.customers.toArray(), db.suppliers.toArray(), db.vouchers.toArray(), db.users.toArray(),
  ]);
  const P = Object.fromEntries(products.map((x) => [x.id, x]));
  const V = Object.fromEntries(variants.map((x) => [x.id, x]));
  const C = Object.fromEntries(categories.map((x) => [x.id, x]));
  const S = Object.fromEntries(suppliers.map((x) => [x.id, x]));
  const U = Object.fromEntries(users.map((x) => [x.id, x.name]));
  const valid = sales.filter((x) => x.status !== 'void').sort((a, b) => a.date - b.date);
  const methods = ['cash', 'card', 'qr', 'bank', 'credit', 'voucher', 'points'];
  const mName = { cash: 'Cash', card: 'Card', qr: 'LankaQR', bank: 'Bank', credit: 'Credit', voucher: 'Voucher', points: 'Points' };

  const netSales = round2(sum(valid, (x) => x.total) - sum(returns, (r) => r.amount));
  const cogs = round2(sum(valid, (x) => sum(x.items, (i) => i.cost * (i.qty - (i.returnedQty || 0)))));
  const exp = round2(sum(expenses, (e) => e.amount));
  const summary = [
    { Item: 'Shop', Value: s.shop.nameEn }, { Item: 'Period', Value: label },
    { Item: 'From', Value: day(from) }, { Item: 'To', Value: day(to) }, { Item: 'Created', Value: `${day(Date.now())} ${time(Date.now())}` },
    { Item: 'Bills', Value: valid.length }, { Item: 'Cancelled bills', Value: sales.length - valid.length },
    { Item: 'Sales before discount', Value: round2(sum(valid, (x) => x.subtotal)) },
    { Item: 'Discounts', Value: round2(sum(valid, (x) => x.itemDiscount + x.billDiscount)) },
    { Item: 'Sales', Value: round2(sum(valid, (x) => x.total)) },
    { Item: 'Refunds', Value: round2(sum(returns, (r) => r.amount)) },
    { Item: 'Net sales', Value: netSales },
    { Item: 'Cost of items sold', Value: cogs }, { Item: 'Gross profit', Value: round2(netSales - cogs) },
    { Item: 'Expenses', Value: exp }, { Item: 'Profit after expenses', Value: round2(netSales - cogs - exp) },
    // cash received minus change given = cash kept
    ...methods.map((m) => ({ Item: `Paid by ${mName[m]}`, Value: round2(sum(valid, (x) => sum(x.payments.filter((p) => p.method === m), (p) => p.amount)) - (m === 'cash' ? sum(valid, (x) => x.change) : 0)) })),
    { Item: 'Stock value now (cost)', Value: round2(sum(variants, (v) => Math.max(0, v.stock) * v.cost)) },
    { Item: 'Stock value now (selling)', Value: round2(sum(variants, (v) => Math.max(0, v.stock) * v.price)) },
    { Item: 'Pieces in stock now', Value: round2(sum(variants, (v) => Math.max(0, v.stock))) },
  ];

  const bills = sales.sort((a, b) => a.date - b.date).map((x) => {
    const row = { 'Bill no': x.billNo, Date: day(x.date), Time: time(x.date), Counter: x.terminal || '', Cashier: x.cashierName, Customer: x.customerName || '', Phone: x.customerPhone || '',
      Items: x.items.length, Subtotal: x.subtotal, Discount: round2(x.itemDiscount + x.billDiscount), Tax: x.tax, Total: x.total };
    methods.forEach((m) => { row[mName[m]] = round2(sum(x.payments.filter((p) => p.method === m), (p) => p.amount)); });
    row.Change = x.change; row.Status = x.status; row.Returned = x.returnedAmount || 0; row['Points earned'] = x.pointsEarned || 0;
    return row;
  });
  const items = [];
  sales.forEach((x) => x.items.forEach((i) => items.push({
    'Bill no': x.billNo, Date: day(x.date), Time: time(x.date), Status: x.status,
    'Product (English)': i.nameEn, 'Product (Sinhala)': i.nameSi || '', Category: C[i.categoryId]?.nameEn || '', Size: i.size, Colour: i.color, Barcode: i.barcode,
    Qty: i.qty, Unit: i.unit, Price: i.price, Discount: i.discount, Net: i.net, 'Cost each': i.cost, Profit: round2(i.net - i.cost * i.qty), 'Returned qty': i.returnedQty || 0,
  })));
  const payments = [];
  sales.forEach((x) => x.payments.forEach((p) => payments.push({ 'Bill no': x.billNo, Date: day(x.date), Time: time(x.date), Method: mName[p.method] || p.method, Amount: p.amount, Reference: p.ref || '' })));
  const rets = returns.map((r) => ({ 'Return no': r.returnNo, 'Bill no': r.billNo, Date: day(r.date), Time: time(r.date), By: r.userName, Reason: r.reason, 'Refund as': r.refundMethod, 'Credit note': r.voucherCode || '', Amount: r.amount, Items: r.items.map((i) => `${i.nameEn} ${[i.size, i.color].filter(Boolean).join('/')} ×${i.qty}`).join('; ') }));
  const stock = variants.map((v) => { const p = P[v.productId] || {}; return {
    'Product (English)': p.nameEn || '', 'Product (Sinhala)': p.nameSi || '', Category: C[p.categoryId]?.nameEn || '', Brand: p.brand || '', Size: v.size, Colour: v.color, Barcode: v.barcode,
    Unit: p.unit || 'pcs', Stock: v.stock, 'Reorder at': v.reorderLevel, 'Cost price': v.cost, 'Selling price': v.price, MRP: v.mrp || 0,
    'Value (cost)': round2(Math.max(0, v.stock) * v.cost), 'Value (selling)': round2(Math.max(0, v.stock) * v.price), Active: p.active === false ? 'No' : 'Yes',
  }; }).sort((a, b) => (a.Category + a['Product (English)'] + a.Size).localeCompare(b.Category + b['Product (English)'] + b.Size));
  const mv = moves.sort((a, b) => a.date - b.date).map((m) => { const v = V[m.variantId] || {}; const p = P[v.productId] || {}; return {
    Date: day(m.date), Time: time(m.date), Type: m.type, 'Product (English)': p.nameEn || '', Size: v.size || '', Colour: v.color || '', Barcode: v.barcode || '', Qty: m.qty, Reference: m.ref || '', By: U[m.userId] || '' }; });
  const grn = [];
  purchases.forEach((pu) => pu.items.forEach((it) => { const v = V[it.variantId] || {}; const p = P[v.productId] || {}; grn.push({
    GRN: pu.grnNo, Date: day(pu.date), Supplier: S[pu.supplierId]?.name || '', Invoice: pu.invoiceNo || '', 'Product (English)': p.nameEn || '', Size: v.size || '', Colour: v.color || '',
    Qty: Number(it.qty), 'Cost each': Number(it.cost), 'Line total': round2(Number(it.qty) * Number(it.cost)), 'GRN total': pu.total, 'Paid now': pu.paid }); }));
  const ex = expenses.sort((a, b) => a.date - b.date).map((e) => ({ Date: day(e.date), Type: e.category, Amount: e.amount, 'Paid by': e.paidBy, 'From drawer': e.fromDrawer ? 'Yes' : 'No', Note: e.note || '' }));
  const cust = customers.map((c) => ({ Name: c.name, Phone: c.phone, Email: c.email || '', Address: c.address || '', NIC: c.nic || '', Birthday: c.birthday || '', Points: c.points || 0, 'Owes (credit)': c.creditBalance || 0, 'Total spent': c.totalSpent || 0, Visits: c.visits || 0, 'Last visit': day(c.lastVisit) }));
  const sup = suppliers.map((x) => ({ Name: x.name, Contact: x.contact || '', Phone: x.phone, Address: x.address || '', 'We owe': x.balance || 0 }));
  const vou = vouchers.map((v) => ({ Code: v.code, Kind: v.type === 'creditNote' ? 'Credit note' : 'Gift voucher', Amount: v.amount, Balance: v.balance, Status: v.status, Issued: day(v.issuedAt), 'Valid until': day(v.expiresAt), Reference: v.ref || '' }));

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: `${s.shop.nameEn} – ${label}`, Author: 'Redi POS', CreatedDate: new Date() };
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, summary, [30, 34], ['Value']), 'Summary');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, bills, [12, 11, 7, 8, 18, 18, 12, 6, 11, 10, 9, 11, 10, 10, 10, 10, 10, 10, 10, 9, 10, 9, 8], ['Subtotal', 'Discount', 'Tax', 'Total', 'Cash', 'Card', 'LankaQR', 'Bank', 'Credit', 'Voucher', 'Points', 'Change', 'Returned']), 'Bills');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, items, [12, 11, 7, 10, 28, 26, 16, 8, 10, 15, 6, 5, 10, 9, 11, 10, 10, 8], ['Price', 'Discount', 'Net', 'Cost each', 'Profit']), 'Bill items');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, payments, [12, 11, 7, 10, 12, 16], ['Amount']), 'Payments');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, rets, [12, 12, 11, 7, 16, 12, 12, 12, 10, 50], ['Amount']), 'Returns');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, stock, [28, 26, 16, 14, 8, 10, 15, 6, 8, 9, 10, 11, 9, 13, 14, 7], ['Cost price', 'Selling price', 'MRP', 'Value (cost)', 'Value (selling)']), 'Stock now');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, mv, [11, 7, 12, 28, 8, 10, 15, 7, 16, 16]), 'Stock movements');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, grn, [11, 11, 22, 12, 28, 8, 10, 7, 10, 11, 11, 10], ['Cost each', 'Line total', 'GRN total', 'Paid now']), 'Deliveries');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, ex, [11, 14, 11, 9, 11, 30], ['Amount']), 'Expenses');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, cust, [22, 12, 20, 20, 13, 11, 7, 11, 12, 7, 11], ['Owes (credit)', 'Total spent']), 'Customers');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, sup, [26, 18, 12, 22, 12], ['We owe']), 'Suppliers');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, vou, [12, 13, 10, 10, 9, 11, 11, 16], ['Amount', 'Balance']), 'Vouchers');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
}

export const xlsxBlob = (buf) => new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

export async function downloadExcel(from, to, label, filename) {
  const buf = await buildWorkbook(from, to, label);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(xlsxBlob(buf)); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const monthRange = (t = Date.now()) => { const x = new Date(t); return [new Date(x.getFullYear(), x.getMonth(), 1).getTime(), new Date(x.getFullYear(), x.getMonth() + 1, 0, 23, 59, 59, 999).getTime()]; };
export const monthKey = (t = Date.now()) => dayKey(t).slice(0, 7);
