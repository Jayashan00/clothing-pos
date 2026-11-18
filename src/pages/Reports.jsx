import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart3, Download, Printer, TrendingUp, Coins, Receipt, Undo2, Wallet, Percent } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { money, num, sum, round2, dayKey, fmtDate, toCSV, downloadText } from '../lib/util';
import { printReact } from '../lib/print';
import { Tabs, Stat, ProductIcon, Empty } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { useRange, RangePicker } from './Sales';

function ReportPrint({ title, subtitle, columns, rows, shop }) {
  return (
    <div className="p-doc" style={{ width: '186mm', fontSize: 11, fontWeight: 600 }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{shop.nameEn}</div>
      <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{title}</div>
      <div style={{ marginBottom: 8 }}>{subtitle}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{columns.map((c) => <th key={c.label} style={{ textAlign: c.right ? 'right' : 'left', borderBottom: '2px solid #000', padding: '4px 3px' }}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c.label} style={{ textAlign: c.right ? 'right' : 'left', borderBottom: '1px solid #000', padding: '3px' }}>{typeof c.value === 'function' ? c.value(r) : r[c.value]}</td>)}</tr>)}</tbody>
      </table>
      <div style={{ marginTop: 10, fontSize: 9 }}>Printed {new Date().toLocaleString('en-GB')} · Redi POS</div>
    </div>
  );
}

export default function Reports() {
  const t = useT();
  const settings = useSettings();
  const r = useRange('30');
  const [tab, setTab] = useState('summary');
  const sales = useLiveQuery(() => db.sales.where('date').between(r.range[0], r.range[1], true, true).toArray(), [r.range[0], r.range[1]]) || [];
  const returns = useLiveQuery(() => db.returns.where('date').between(r.range[0], r.range[1], true, true).toArray(), [r.range[0], r.range[1]]) || [];
  const expenses = useLiveQuery(() => db.expenses.where('date').between(r.range[0], r.range[1], true, true).toArray(), [r.range[0], r.range[1]]) || [];
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const pMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const cMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const d = useMemo(() => {
    const valid = sales.filter((s) => s.status !== 'void');
    const gross = sum(valid, (s) => s.subtotal);
    const discounts = sum(valid, (s) => s.itemDiscount + s.billDiscount);
    const total = sum(valid, (s) => s.total);
    const refunds = sum(returns, (x) => x.amount);
    const net = total - refunds;
    const cogs = sum(valid, (s) => sum(s.items, (i) => i.cost * (i.qty - (i.returnedQty || 0))));
    const exp = sum(expenses, (e) => e.amount);
    const tax = sum(valid, (s) => s.tax);
    const daily = {}; const byCat = {}; const byProd = {}; const byCashier = {}; const byPay = {}; const byHour = Array.from({ length: 24 }, (_, h) => ({ h: `${h}:00`, total: 0, bills: 0 }));
    valid.forEach((s) => {
      const k = dayKey(s.date); daily[k] = daily[k] || { k, total: 0, bills: 0 }; daily[k].total += s.total; daily[k].bills += 1;
      const hr = new Date(s.date).getHours(); byHour[hr].total += s.total; byHour[hr].bills += 1;
      byCashier[s.cashierName] = byCashier[s.cashierName] || { name: s.cashierName, bills: 0, total: 0, discount: 0 };
      byCashier[s.cashierName].bills += 1; byCashier[s.cashierName].total += s.total; byCashier[s.cashierName].discount += s.itemDiscount + s.billDiscount;
      s.payments.forEach((p) => { byPay[p.method] = byPay[p.method] || { method: p.method, count: 0, total: 0 }; byPay[p.method].count += 1; byPay[p.method].total += p.amount - (p.method === 'cash' ? s.change : 0); });
      s.items.forEach((i) => {
        const ratio = i.net ? (i.paidUnit * i.qty) / i.net : 1;
        const rev = i.net * (ratio || 1); const cost = i.cost * i.qty;
        byCat[i.categoryId] = byCat[i.categoryId] || { id: i.categoryId, qty: 0, revenue: 0, cost: 0 };
        byCat[i.categoryId].qty += i.unit === 'pcs' ? i.qty : 1; byCat[i.categoryId].revenue += rev; byCat[i.categoryId].cost += cost;
        byProd[i.productId] = byProd[i.productId] || { id: i.productId, qty: 0, revenue: 0, cost: 0, unit: i.unit };
        byProd[i.productId].qty += i.qty; byProd[i.productId].revenue += rev; byProd[i.productId].cost += cost;
      });
    });
    const soldIds = new Set(Object.keys(byProd));
    return {
      bills: valid.length, gross, discounts, total, refunds, net, cogs, exp, tax, profit: net - cogs, netProfit: net - cogs - exp, avg: valid.length ? total / valid.length : 0,
      daily: Object.values(daily).sort((a, b) => a.k.localeCompare(b.k)).map((x) => ({ ...x, label: fmtDate(x.k).slice(0, 6), total: round2(x.total) })),
      byCat: Object.values(byCat).sort((a, b) => b.revenue - a.revenue),
      byProd: Object.values(byProd).sort((a, b) => b.revenue - a.revenue),
      slow: products.filter((p) => p.active !== false && !soldIds.has(p.id)),
      byCashier: Object.values(byCashier).sort((a, b) => b.total - a.total),
      byPay: Object.values(byPay).sort((a, b) => b.total - a.total),
      byHour: byHour.slice(8, 22).map((x) => ({ ...x, total: round2(x.total) })),
    };
  }, [sales, returns, expenses, products]);

  const stock = useMemo(() => {
    const m = {};
    variants.forEach((v) => { const p = pMap[v.productId]; if (!p) return; const c = p.categoryId; m[c] = m[c] || { id: c, units: 0, cost: 0, retail: 0 }; const q = Math.max(0, v.stock); m[c].units += q; m[c].cost += q * v.cost; m[c].retail += q * v.price; });
    return Object.values(m).sort((a, b) => b.cost - a.cost);
  }, [variants, pMap]);

  const catName = (id) => (cMap[id] ? t.name(cMap[id]) : '—');
  const prodName = (id) => (pMap[id] ? t.name(pMap[id]) : '—');
  const tables = {
    category: { rows: d.byCat, cols: [{ label: t('prod.category'), value: (x) => catName(x.id) }, { label: t('rep.qty'), value: (x) => num(x.qty).replace('.00', ''), right: true }, { label: t('rep.revenue'), value: (x) => num(x.revenue), right: true }, { label: t('rep.cost'), value: (x) => num(x.cost), right: true }, { label: t('rep.profit'), value: (x) => num(x.revenue - x.cost), right: true }, { label: t('rep.margin'), value: (x) => (x.revenue ? (((x.revenue - x.cost) / x.revenue) * 100).toFixed(1) + '%' : '—'), right: true }] },
    product: { rows: d.byProd, cols: [{ label: t('prod.product'), value: (x) => prodName(x.id) }, { label: t('rep.qty'), value: (x) => num(x.qty).replace('.00', ''), right: true }, { label: t('rep.revenue'), value: (x) => num(x.revenue), right: true }, { label: t('rep.profit'), value: (x) => num(x.revenue - x.cost), right: true }] },
    slow: { rows: d.slow, cols: [{ label: t('prod.product'), value: (x) => t.name(x) }, { label: t('prod.category'), value: (x) => catName(x.categoryId) }, { label: t('prod.stock'), value: (x) => sum(variants.filter((v) => v.productId === x.id), (v) => v.stock), right: true }] },
    cashier: { rows: d.byCashier, cols: [{ label: t('shift.cashier'), value: 'name' }, { label: t('dash.bills'), value: 'bills', right: true }, { label: t('pos.discount'), value: (x) => num(x.discount), right: true }, { label: t('rep.revenue'), value: (x) => num(x.total), right: true }] },
    payment: { rows: d.byPay, cols: [{ label: t('sales.payment'), value: (x) => t('pay.' + x.method) }, { label: t('rep.count'), value: 'count', right: true }, { label: t('rep.revenue'), value: (x) => num(x.total), right: true }] },
    stock: { rows: stock, cols: [{ label: t('prod.category'), value: (x) => catName(x.id) }, { label: t('inv.units'), value: (x) => num(x.units).replace('.00', ''), right: true }, { label: t('inv.costValue'), value: (x) => num(x.cost), right: true }, { label: t('inv.retailValue'), value: (x) => num(x.retail), right: true }] },
    summary: { rows: d.daily, cols: [{ label: t('common.date'), value: 'k' }, { label: t('dash.bills'), value: 'bills', right: true }, { label: t('rep.revenue'), value: (x) => num(x.total), right: true }] },
  };
  const cur = tables[tab] || tables.summary;
  const subtitle = `${fmtDate(r.range[0])} – ${fmtDate(r.range[1])}`;
  const exportCSV = () => downloadText(`report-${tab}.csv`, toCSV(cur.rows, cur.cols), 'text/csv');
  const print = () => printReact(<ReportPrint title={t('rep.t.' + tab)} subtitle={subtitle} columns={cur.cols} rows={cur.rows} shop={settings.shop} />, { page: 'size: A4 portrait; margin: 12mm' });

  const Table = ({ cols, rows, icon }) => (
    <div className="card overflow-x-auto">
      {!rows.length ? <Empty icon={<BarChart3 size={28} />} title={t('rep.noData')} /> : (
        <table className="table"><thead><tr>{cols.map((c) => <th key={c.label} className={c.right ? 'text-right' : ''}>{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((x, i) => <tr key={i}>{cols.map((c, j) => <td key={c.label} className={c.right ? 'text-right font-bold' : ''}>{j === 0 && icon ? <div className="flex items-center gap-2">{icon(x)}{typeof c.value === 'function' ? c.value(x) : x[c.value]}</div> : (typeof c.value === 'function' ? c.value(x) : x[c.value])}</td>)}</tr>)}</tbody></table>
      )}
    </div>
  );

  return (
    <Page>
      <PageHeader title={t('nav.reports')} subtitle={subtitle} help="reports" icon={<BarChart3 size={24} />}
        actions={<><button className="btn btn-outline" onClick={exportCSV}><Download size={18} /> {t('common.export')}</button><button className="btn btn-outline" onClick={print}><Printer size={18} /> {t('common.print')}</button></>} />
      <div className="mb-3"><RangePicker r={r} /></div>
      <div className="mb-4 overflow-x-auto"><Tabs value={tab} onChange={setTab} tabs={['summary', 'category', 'product', 'slow', 'cashier', 'payment', 'stock'].map((k) => ({ id: k, label: t('rep.t.' + k) }))} /></div>

      {tab === 'summary' ? (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat label={t('rep.netSales')} value={money(d.net)} icon={<TrendingUp />} sub={`${t('dash.bills')}: ${d.bills} · ${t('dash.avgBill')}: ${num(d.avg)}`} />
          <Stat label={t('rep.grossProfit')} value={money(d.profit)} icon={<Coins />} tone="green" sub={d.net ? `${t('rep.margin')}: ${((d.profit / d.net) * 100).toFixed(1)}%` : ''} />
          <Stat label={t('nav.expenses')} value={money(d.exp)} icon={<Receipt />} tone="gold" />
          <Stat label={t('rep.netProfit')} value={money(d.netProfit)} icon={<Wallet />} tone={d.netProfit < 0 ? 'red' : 'green'} />
          <Stat label={t('rep.grossSales')} value={money(d.gross)} icon={<TrendingUp />} />
          <Stat label={t('pos.discount')} value={money(d.discounts)} icon={<Percent />} tone="gold" />
          <Stat label={t('rep.refunds')} value={money(d.refunds)} icon={<Undo2 />} tone="red" />
          <Stat label={t('rep.cogs')} value={money(d.cogs)} icon={<Coins />} />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-4"><h2 className="font-display text-lg font-bold mb-3">{t('rep.daily')}</h2><div className="h-64"><ResponsiveContainer><LineChart data={d.daily}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} /><Tooltip formatter={(v) => money(v)} /><Line type="monotone" dataKey="total" stroke="#1F2A5C" strokeWidth={3} dot={false} name={t('dash.sales')} /></LineChart></ResponsiveContainer></div></div>
          <div className="card p-4"><h2 className="font-display text-lg font-bold mb-3">{t('rep.busyHours')}</h2><div className="h-64"><ResponsiveContainer><BarChart data={d.byHour}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="h" tick={{ fontSize: 11, fill: 'var(--muted)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={30} /><Tooltip /><Bar dataKey="bills" fill="#E8A317" radius={[6, 6, 0, 0]} name={t('dash.bills')} /></BarChart></ResponsiveContainer></div></div>
        </div>
      </>) : null}
      {tab === 'category' ? <Table {...tables.category} icon={(x) => <ProductIcon icon={cMap[x.id]?.icon} color={cMap[x.id]?.color} size={32} />} /> : null}
      {tab === 'product' ? <Table {...tables.product} icon={(x) => <ProductIcon icon={pMap[x.id]?.icon} color={cMap[pMap[x.id]?.categoryId]?.color} size={32} />} /> : null}
      {tab === 'slow' ? <><p className="muted mb-3">{t('rep.slowHint')}</p><Table {...tables.slow} icon={(x) => <ProductIcon icon={x.icon} color={cMap[x.categoryId]?.color} size={32} />} /></> : null}
      {tab === 'cashier' ? <Table {...tables.cashier} /> : null}
      {tab === 'payment' ? <Table {...tables.payment} /> : null}
      {tab === 'stock' ? <Table {...tables.stock} icon={(x) => <ProductIcon icon={cMap[x.id]?.icon} color={cMap[x.id]?.color} size={32} />} /> : null}
    </Page>
  );
}
