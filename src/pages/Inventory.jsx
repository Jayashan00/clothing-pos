import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Boxes, SlidersHorizontal, ClipboardCheck, History, Download, AlertTriangle, Coins, Tag } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { adjustStock } from '../lib/pos';
import { useBarcodeScanner, beep } from '../lib/scanner';
import { money, num, sum, round2, fmtDateTime, toCSV, downloadText } from '../lib/util';
import { Modal, toast, Field, SearchBox, ProductIcon, Empty, Tabs, Stat, confirmDialog } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';

const REASONS = ['correction', 'damage', 'lost', 'gift', 'count', 'returnSupplier'];

export default function Inventory() {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const [params] = useSearchParams();
  const [tab, setTab] = useState('levels');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(params.get('filter') || 'all');
  const [adj, setAdj] = useState(null);
  const [count, setCount] = useState({});
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const users = useLiveQuery(() => db.users.toArray(), []) || [];
  const moves = useLiveQuery(() => (tab === 'moves' ? db.stockMoves.orderBy('date').reverse().limit(400).toArray() : []), [tab]) || [];
  const pMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const cMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const vMap = useMemo(() => Object.fromEntries(variants.map((v) => [v.id, v])), [variants]);
  const uMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.name])), [users]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return variants.filter((v) => {
      const p = pMap[v.productId]; if (!p) return false;
      if (filter === 'low' && v.stock > (v.reorderLevel ?? 5)) return false;
      if (filter === 'out' && v.stock > 0) return false;
      return !s || p.nameEn.toLowerCase().includes(s) || (p.nameSi || '').includes(q.trim()) || v.barcode.includes(s) || (v.size || '').toLowerCase() === s;
    }).sort((a, b) => (pMap[a.productId].nameEn + a.size).localeCompare(pMap[b.productId].nameEn + b.size));
  }, [variants, pMap, q, filter]);

  const stats = useMemo(() => ({
    units: round2(sum(variants, (v) => Math.max(0, v.stock))),
    cost: sum(variants, (v) => Math.max(0, v.stock) * v.cost),
    retail: sum(variants, (v) => Math.max(0, v.stock) * v.price),
    low: variants.filter((v) => v.stock <= (v.reorderLevel ?? 5)).length,
  }), [variants]);

  useBarcodeScanner((code) => {
    const v = variants.find((x) => x.barcode === code);
    if (!v) { settings.sound && beep(false); return toast.err(t('pos.notFound', { code })); }
    settings.sound && beep(true);
    if (tab === 'count') setCount((c) => ({ ...c, [v.id]: round2((c[v.id] || 0) + 1) }));
    else setQ(code);
  });

  const exportCSV = () => downloadText('stock.csv', toCSV(rows, [
    { label: 'Product', value: (v) => pMap[v.productId]?.nameEn }, { label: 'Size', value: 'size' }, { label: 'Color', value: 'color' },
    { label: 'Barcode', value: 'barcode' }, { label: 'Stock', value: 'stock' }, { label: 'Reorder level', value: 'reorderLevel' },
    { label: 'Cost', value: 'cost' }, { label: 'Price', value: 'price' }, { label: 'Stock value (cost)', value: (v) => round2(v.stock * v.cost) },
  ]), 'text/csv');

  const applyCount = async () => {
    const ids = Object.keys(count); if (!ids.length) return;
    if (!(await confirmDialog({ title: t('inv.applyCount'), message: t('inv.applyCountMsg', { n: ids.length }) }))) return;
    for (const id of ids) await adjustStock({ variantId: id, mode: 'set', value: count[id], reason: 'count', note: 'Stock take', user });
    setCount({}); toast.ok(t('inv.countApplied'));
  };

  const Row = ({ v, children }) => { const p = pMap[v.productId]; return (
    <div className="flex items-center gap-3 min-w-0"><ProductIcon icon={p.icon} color={cMap[p.categoryId]?.color} size={38} />
      <div className="min-w-0"><b className="block truncate">{t.name(p)}</b><span className="text-xs muted">{[v.size, v.color].filter(Boolean).join(' · ')} · {v.barcode}</span></div>{children}</div>); };

  return (
    <Page>
      <PageHeader title={t('nav.inventory')} help="inventory" icon={<Boxes size={24} />} actions={<button className="btn btn-outline" onClick={exportCSV}><Download size={18} /> {t('common.export')}</button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label={t('inv.units')} value={num(stats.units).replace('.00', '')} icon={<Boxes />} />
        <Stat label={t('inv.costValue')} value={money(stats.cost)} icon={<Coins />} tone="gold" />
        <Stat label={t('inv.retailValue')} value={money(stats.retail)} icon={<Tag />} tone="green" />
        <Stat label={t('dash.lowStock')} value={stats.low} icon={<AlertTriangle />} tone="red" />
      </div>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'levels', label: t('inv.levels') }, { id: 'count', label: t('inv.stockTake') }, { id: 'moves', label: t('inv.movements') }]} /></div>

      {tab === 'levels' ? (<>
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex-1 min-w-[16rem]"><SearchBox value={q} onChange={setQ} placeholder={t('prod.searchPh')} scanTarget /></div>
          <Tabs value={filter} onChange={setFilter} tabs={[{ id: 'all', label: t('pos.all') }, { id: 'low', label: t('inv.low') }, { id: 'out', label: t('inv.out') }]} />
        </div>
        <div className="card overflow-x-auto">
          {!rows.length ? <Empty icon={<Boxes size={28} />} title={t('inv.none')} /> : (
            <table className="table">
              <thead><tr><th>{t('prod.product')}</th><th className="text-right">{t('prod.stock')}</th><th className="text-right">{t('prod.reorder')}</th><th className="text-right">{t('inv.value')}</th><th /></tr></thead>
              <tbody>{rows.slice(0, 500).map((v) => (
                <tr key={v.id}>
                  <td><Row v={v} /></td>
                  <td className="text-right"><span className={`badge text-sm ${v.stock <= 0 ? 'badge-red' : v.stock <= v.reorderLevel ? 'badge-gold' : 'badge-green'}`}>{v.stock}</span></td>
                  <td className="text-right muted">{v.reorderLevel}</td>
                  <td className="text-right">{num(Math.max(0, v.stock) * v.cost)}</td>
                  <td className="text-right"><button className="btn btn-ghost btn-sm" onClick={() => setAdj({ v, mode: 'add', value: '', reason: 'correction', note: '' })}><SlidersHorizontal size={16} /> {t('inv.adjust')}</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </>) : null}

      {tab === 'count' ? (
        <div className="card p-4">
          <p className="mb-3">{t('inv.countHelp')}</p>
          {!Object.keys(count).length ? <Empty icon={<ClipboardCheck size={28} />} title={t('inv.countEmpty')} text={t('inv.countEmptyText')} /> : (
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th>{t('prod.product')}</th><th className="text-right">{t('inv.system')}</th><th>{t('inv.counted')}</th><th className="text-right">{t('shift.difference')}</th></tr></thead>
              <tbody>{Object.entries(count).map(([id, c]) => { const v = vMap[id]; if (!v) return null; const diff = round2(c - v.stock); return (
                <tr key={id}><td><Row v={v} /></td><td className="text-right">{v.stock}</td>
                  <td><input className="input !min-h-[2.25rem] w-24" inputMode="decimal" value={c} onChange={(e) => setCount({ ...count, [id]: Number(e.target.value) || 0 })} /></td>
                  <td className={`text-right font-bold ${diff < 0 ? 'text-maroon-600' : diff > 0 ? 'text-leaf-600' : ''}`}>{diff > 0 ? '+' : ''}{diff}</td></tr>); })}</tbody>
            </table></div>
          )}
          <div className="flex gap-2 justify-end mt-3">
            <button className="btn btn-ghost" onClick={() => setCount({})}>{t('common.clear')}</button>
            <button className="btn btn-primary" onClick={applyCount} disabled={!Object.keys(count).length}><ClipboardCheck size={18} /> {t('inv.applyCount')}</button>
          </div>
        </div>
      ) : null}

      {tab === 'moves' ? (
        <div className="card overflow-x-auto">
          {!moves.length ? <Empty icon={<History size={28} />} title={t('inv.noMoves')} /> : (
            <table className="table">
              <thead><tr><th>{t('common.date')}</th><th>{t('prod.product')}</th><th>{t('inv.type')}</th><th className="text-right">{t('pos.qty')}</th><th>{t('inv.ref')}</th><th>{t('common.user')}</th></tr></thead>
              <tbody>{moves.map((m) => { const v = vMap[m.variantId]; return (
                <tr key={m.id}><td className="whitespace-nowrap text-sm">{fmtDateTime(m.date)}</td><td>{v ? <Row v={v} /> : '—'}</td>
                  <td><span className="badge badge-blue">{t('move.' + m.type)}</span></td>
                  <td className={`text-right font-bold ${m.qty < 0 ? 'text-maroon-600' : 'text-leaf-600'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</td>
                  <td className="text-sm">{m.ref}</td><td className="text-sm">{uMap[m.userId] || ''}</td></tr>); })}</tbody>
            </table>
          )}
        </div>
      ) : null}

      <Modal open={!!adj} onClose={() => setAdj(null)} title={t('inv.adjust')} size="sm" icon={<SlidersHorizontal size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setAdj(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={async () => {
          const val = Number(adj.value); if (adj.value === '' || Number.isNaN(val)) return toast.err(t('inv.enterQty'));
          const signed = adj.mode === 'remove' ? -Math.abs(val) : adj.mode === 'add' ? Math.abs(val) : val;
          await adjustStock({ variantId: adj.v.id, mode: adj.mode === 'set' ? 'set' : 'delta', value: signed, reason: adj.reason, note: adj.note, user });
          toast.ok(t('inv.adjusted')); setAdj(null);
        }}>{t('common.save')}</button></>}>
        {adj ? (<div className="space-y-3">
          <Row v={adj.v} />
          <p>{t('inv.current')}: <b>{adj.v.stock}</b></p>
          <Tabs value={adj.mode} onChange={(m) => setAdj({ ...adj, mode: m })} tabs={[{ id: 'add', label: t('inv.add') }, { id: 'remove', label: t('inv.remove') }, { id: 'set', label: t('inv.setTo') }]} />
          <input className="input text-2xl text-center" inputMode="decimal" value={adj.value} onChange={(e) => setAdj({ ...adj, value: e.target.value })} />
          <Field label={t('inv.reason')}><select className="input" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })}>{REASONS.map((r) => <option key={r} value={r}>{t('move.' + r)}</option>)}</select></Field>
          <Field label={t('common.note')}><input className="input" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></Field>
        </div>) : null}
      </Modal>
    </Page>
  );
}
