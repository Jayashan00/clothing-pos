import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { ScanBarcode, Receipt, ShoppingBag, TrendingUp, AlertTriangle, Plus, Barcode, Truck, Coins } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useAuth, can } from '../store/auth';
import { useSettings } from '../store/settings';
import { money, num, dayKey, startOfDay, sum, round2, fmtTime } from '../lib/util';
import { Stat, ProductIcon, Empty } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';

const PIE = ['#1F2A5C', '#E8A317', '#138A6C', '#8C1C3A', '#5E6DAF', '#C4840C', '#0B5A47'];

export default function Dashboard() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const cur = useSettings((s) => s.currency);
  const since = startOfDay(Date.now() - 29 * 864e5);
  const sales = useLiveQuery(() => db.sales.where('date').aboveOrEqual(since).toArray(), [since]) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const pMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const cMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const d = useMemo(() => {
    const valid = sales.filter((s) => s.status !== 'void');
    const today = startOfDay(); const yest = today - 864e5;
    const tSales = valid.filter((s) => s.date >= today);
    const ySales = valid.filter((s) => s.date >= yest && s.date < today);
    const total = sum(tSales, (s) => s.total); const yTotal = sum(ySales, (s) => s.total);
    const items = sum(tSales, (s) => sum(s.items, (i) => (i.unit === 'pcs' ? i.qty : 1)));
    const profit = sum(tSales, (s) => s.total - sum(s.items, (i) => i.cost * i.qty));
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const k = dayKey(Date.now() - i * 864e5);
      days.push({ k, label: new Date(Date.now() - i * 864e5).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), total: 0 });
    }
    const idx = Object.fromEntries(days.map((x, i) => [x.k, i]));
    valid.forEach((s) => { const i = idx[dayKey(s.date)]; if (i != null) days[i].total = round2(days[i].total + s.total); });
    const pay = {};
    valid.forEach((s) => s.payments.forEach((p) => { pay[p.method] = (pay[p.method] || 0) + p.amount - (p.method === 'cash' ? s.change : 0); }));
    const top = {};
    valid.forEach((s) => s.items.forEach((i) => { top[i.productId] = top[i.productId] || { qty: 0, total: 0, id: i.productId }; top[i.productId].qty += i.qty; top[i.productId].total += i.net; }));
    return {
      total, count: tSales.length, avg: tSales.length ? total / tSales.length : 0, items, profit,
      change: yTotal ? ((total - yTotal) / yTotal) * 100 : null,
      days, pay: Object.entries(pay).map(([k, v]) => ({ name: t('pay.' + k), value: round2(v) })),
      top: Object.values(top).sort((a, b) => b.total - a.total).slice(0, 6),
      recent: [...valid].sort((a, b) => b.date - a.date).slice(0, 6),
    };
  }, [sales, t]);

  const low = useMemo(() => variants.filter((v) => (v.stock || 0) <= (v.reorderLevel ?? 5)).sort((a, b) => a.stock - b.stock).slice(0, 8), [variants]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('dash.morning') : hour < 17 ? t('dash.afternoon') : t('dash.evening');
  const showMoney = can(user, 'reports') || can(user, 'pos');

  return (
    <Page>
      <PageHeader title={`${greet}, ${user.name.split(/[\s(]/)[0]}`} subtitle={new Date().toLocaleDateString(t.lang === 'si' ? 'si-LK' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} help="dashboard" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {can(user, 'pos') ? <Link to="/app/pos" className="col-span-2 lg:col-span-1 rounded-2xl p-5 bg-indigo-700 text-white flex items-center gap-4 hover:bg-indigo-800 transition relative overflow-hidden">
          <div className="weave h-1.5 absolute top-0 inset-x-0" />
          <ScanBarcode size={40} className="text-saffron-400" />
          <div><p className="font-display text-2xl font-bold">{t('dash.newBill')}</p><p className="text-indigo-200 text-sm">{t('dash.newBillHint')}</p></div>
        </Link> : null}
        {can(user, 'products') ? <Link to="/app/products?new=1" className="card p-4 flex items-center gap-3 hover:border-indigo-400"><Plus className="text-indigo-600" /><span className="font-bold">{t('dash.addProduct')}</span></Link> : null}
        {can(user, 'labels') ? <Link to="/app/labels" className="card p-4 flex items-center gap-3 hover:border-indigo-400"><Barcode className="text-indigo-600" /><span className="font-bold">{t('dash.printLabels')}</span></Link> : null}
        {can(user, 'purchases') ? <Link to="/app/purchases?new=1" className="card p-4 flex items-center gap-3 hover:border-indigo-400"><Truck className="text-indigo-600" /><span className="font-bold">{t('dash.receiveGoods')}</span></Link> : null}
      </div>

      {showMoney ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Stat label={t('dash.todaySales')} value={money(d.total, cur)} icon={<TrendingUp />} sub={d.change == null ? '' : `${d.change >= 0 ? '▲' : '▼'} ${Math.abs(d.change).toFixed(0)}% ${t('dash.vsYesterday')}`} />
          <Stat label={t('dash.bills')} value={d.count} icon={<Receipt />} tone="gold" sub={`${t('dash.avgBill')}: ${num(d.avg)}`} />
          <Stat label={t('dash.itemsSold')} value={num(d.items).replace('.00', '')} icon={<ShoppingBag />} tone="green" />
          {can(user, 'reports') ? <Stat label={t('dash.grossProfit')} value={money(d.profit, cur)} icon={<Coins />} tone="red" /> : <Stat label={t('dash.lowStock')} value={low.length} icon={<AlertTriangle />} tone="red" />}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {showMoney ? <div className="card p-4 lg:col-span-2">
          <h2 className="font-display text-lg font-bold mb-3">{t('dash.last14')}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.days} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={40} />
                <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }} />
                <Bar dataKey="total" fill="#1F2A5C" radius={[6, 6, 0, 0]} name={t('dash.sales')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div> : null}
        {showMoney ? <div className="card p-4">
          <h2 className="font-display text-lg font-bold mb-1">{t('dash.payments30')}</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={d.pay} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {d.pay.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie><Tooltip formatter={(v) => money(v, cur)} /></PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1">{d.pay.map((p, i) => <div key={p.name} className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded" style={{ background: PIE[i % PIE.length] }} /><span className="flex-1">{p.name}</span><b>{num(p.value)}</b></div>)}</div>
        </div> : null}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {showMoney ? <div className="card p-4">
          <h2 className="font-display text-lg font-bold mb-3">{t('dash.topProducts')}</h2>
          <div className="space-y-2.5">
            {d.top.map((x) => { const p = pMap[x.id]; if (!p) return null; return (
              <div key={x.id} className="flex items-center gap-3"><ProductIcon icon={p.icon} color={cMap[p.categoryId]?.color} size={40} />
                <div className="flex-1 min-w-0"><p className="font-bold truncate">{t.name(p)}</p><p className="text-xs muted">{num(x.qty).replace('.00', '')} {t('dash.sold')}</p></div>
                <b>{num(x.total)}</b></div>); })}
          </div>
        </div> : null}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3"><h2 className="font-display text-lg font-bold">{t('dash.lowStock')}</h2>{can(user, 'inventory') ? <Link to="/app/inventory?filter=low" className="text-sm font-bold text-indigo-600">{t('common.viewAll')}</Link> : null}</div>
          {!low.length ? <Empty icon={<ShoppingBag size={26} />} title={t('dash.stockOk')} /> : (
            <div className="space-y-2">
              {low.map((v) => { const p = pMap[v.productId]; if (!p) return null; return (
                <div key={v.id} className="flex items-center gap-3"><ProductIcon icon={p.icon} color={cMap[p.categoryId]?.color} size={36} />
                  <div className="flex-1 min-w-0"><p className="font-bold truncate text-sm">{t.name(p)}</p><p className="text-xs muted">{[v.size, v.color].filter(Boolean).join(' · ')}</p></div>
                  <span className={`badge ${v.stock <= 0 ? 'badge-red' : 'badge-gold'}`}>{v.stock}</span></div>); })}
            </div>
          )}
        </div>
        {showMoney ? <div className="card p-4">
          <div className="flex items-center justify-between mb-3"><h2 className="font-display text-lg font-bold">{t('dash.recentBills')}</h2><Link to="/app/sales" className="text-sm font-bold text-indigo-600">{t('common.viewAll')}</Link></div>
          <div className="space-y-2">
            {d.recent.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm"><span className="font-bold w-24">{s.billNo}</span><span className="muted flex-1 truncate">{fmtTime(s.date)} · {s.customerName || t('pos.walkIn')}</span><b>{num(s.total)}</b></div>
            ))}
          </div>
        </div> : null}
      </div>
    </Page>
  );
}
