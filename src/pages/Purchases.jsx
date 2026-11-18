import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Truck, Plus, Trash2, Barcode, Eye, Shirt } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { receiveGoods } from '../lib/pos';
import { useBarcodeScanner, beep } from '../lib/scanner';
import { money, num, sum, round2, fmtDateTime } from '../lib/util';
import { Modal, toast, Field, SearchBox, ProductIcon, Empty, Toggle } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { ProductForm } from './Products';

function GRNModal({ open, onClose, onSaved }) {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) || [];
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const pMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const [sup, setSup] = useState(''); const [inv, setInv] = useState(''); const [items, setItems] = useState([]);
  const [paid, setPaid] = useState(''); const [note, setNote] = useState(''); const [q, setQ] = useState('');
  const [updCost, setUpdCost] = useState(true); const [newProd, setNewProd] = useState(false);
  useEffect(() => { if (open) { setSup(''); setInv(''); setItems([]); setPaid(''); setNote(''); setQ(''); } }, [open]);

  const add = (v) => setItems((it) => {
    const i = it.findIndex((x) => x.variantId === v.id);
    if (i >= 0) return it.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x));
    return [...it, { variantId: v.id, qty: 1, cost: v.cost, price: v.price }];
  });
  useBarcodeScanner((code) => {
    const v = variants.find((x) => x.barcode === code);
    if (v) { add(v); settings.sound && beep(true); } else { settings.sound && beep(false); toast.err(t('pos.notFound', { code })); }
  }, { enabled: open && !newProd });

  const results = useMemo(() => {
    const s = q.trim().toLowerCase(); if (!s) return [];
    return variants.filter((v) => { const p = pMap[v.productId]; return p && (p.nameEn.toLowerCase().includes(s) || (p.nameSi || '').includes(q.trim()) || v.barcode.includes(s)); }).slice(0, 20);
  }, [q, variants, pMap]);
  const total = round2(sum(items, (i) => i.qty * i.cost));
  const save = async () => {
    if (!items.length) return toast.err(t('grn.noItems'));
    const pu = await receiveGoods({ supplierId: sup, invoiceNo: inv, items: items.map((i) => ({ ...i, qty: Number(i.qty), cost: Number(i.cost), price: Number(i.price) })), paid: Number(paid) || 0, note, user, updateCost: updCost, updatePrice: true });
    toast.ok(t('grn.saved', { no: pu.grnNo }));
    onSaved(pu); onClose();
  };
  if (!open) return null;
  return (
    <Modal open onClose={onClose} title={t('grn.new')} size="xl" icon={<Truck size={20} />}
      footer={<><span className="mr-auto font-display text-xl font-bold">{t('pos.total')}: {money(total)}</span><button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('grn.receive')}</button></>}>
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <Field label={t('nav.suppliers')}><select className="input" value={sup} onChange={(e) => setSup(e.target.value)}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label={t('grn.invoice')}><input className="input" value={inv} onChange={(e) => setInv(e.target.value)} /></Field>
        <Field label={t('grn.paidNow')}><input className="input" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0.00" /></Field>
      </div>
      <div className="flex gap-2">
        <div className="flex-1"><SearchBox value={q} onChange={setQ} placeholder={t('labels.searchPh')} scanTarget /></div>
        <button className="btn btn-outline" onClick={() => setNewProd(true)}><Shirt size={18} /> {t('prod.add')}</button>
      </div>
      {results.length ? <div className="mt-2 max-h-56 overflow-y-auto scroll-thin divide-y line">{results.map((v) => { const p = pMap[v.productId]; return (
        <button key={v.id} onClick={() => { add(v); setQ(''); }} className="w-full flex items-center gap-3 py-2 px-1 text-left hover:bg-indigo-50 dark:hover:bg-indigo-800 rounded-lg"><ProductIcon icon={p.icon} size={34} />
          <span className="flex-1"><b>{t.name(p)}</b> <span className="text-sm muted">{[v.size, v.color].filter(Boolean).join(' · ')}</span></span><Plus size={18} /></button>); })}</div> : null}
      <div className="overflow-x-auto mt-3">
        {!items.length ? <Empty icon={<Truck size={28} />} title={t('grn.empty')} text={t('labels.scanHint')} /> : (
          <table className="table">
            <thead><tr><th>{t('prod.product')}</th><th>{t('pos.qty')}</th><th>{t('prod.cost')}</th><th>{t('grn.sellPrice')}</th><th className="text-right">{t('grn.lineTotal')}</th><th /></tr></thead>
            <tbody>{items.map((it, i) => { const v = variants.find((x) => x.id === it.variantId); const p = v && pMap[v.productId]; if (!p) return null; const set = (k, val) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: val } : x))); return (
              <tr key={it.variantId}>
                <td><b>{t.name(p)}</b><p className="text-xs muted">{[v.size, v.color].filter(Boolean).join(' · ')} · {v.barcode}</p></td>
                <td><input className="input !min-h-[2.25rem] w-20" inputMode="decimal" value={it.qty} onChange={(e) => set('qty', e.target.value)} /></td>
                <td><input className="input !min-h-[2.25rem] w-24" inputMode="decimal" value={it.cost} onChange={(e) => set('cost', e.target.value)} /></td>
                <td><input className="input !min-h-[2.25rem] w-24" inputMode="decimal" value={it.price} onChange={(e) => set('price', e.target.value)} /></td>
                <td className="text-right font-bold">{num((Number(it.qty) || 0) * (Number(it.cost) || 0))}</td>
                <td><button className="icon-btn" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={t('common.remove')}><Trash2 size={18} /></button></td>
              </tr>); })}</tbody>
          </table>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <Field label={t('common.note')}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="pt-6"><Toggle label={t('grn.updateCost')} checked={updCost} onChange={setUpdCost} /></div>
      </div>
      <ProductForm open={newProd} onClose={() => setNewProd(false)} onSaved={async (p) => { const vs = await db.variants.where('productId').equals(p.id).toArray(); vs.forEach((v) => setItems((it) => [...it, { variantId: v.id, qty: 0, cost: v.cost, price: v.price }])); }} />
    </Modal>
  );
}

export default function Purchases() {
  const t = useT();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const list = useLiveQuery(() => db.purchases.orderBy('date').reverse().toArray(), []) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) || [];
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const sMap = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  useEffect(() => { if (params.get('new')) { setOpen(true); params.delete('new'); setParams(params, { replace: true }); } }, []); // eslint-disable-line
  const label = (it) => { const v = variants.find((x) => x.id === it.variantId); const p = v && products.find((x) => x.id === v.productId); return p ? `${t.name(p)} ${[v.size, v.color].filter(Boolean).join(' · ')}` : '—'; };

  return (
    <Page>
      <PageHeader title={t('nav.purchases')} subtitle={t('grn.subtitle')} help="purchases" icon={<Truck size={24} />} actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> {t('grn.new')}</button>} />
      <div className="card overflow-x-auto">
        {!list.length ? <Empty icon={<Truck size={28} />} title={t('grn.none')} text={t('grn.noneText')} action={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> {t('grn.new')}</button>} /> : (
          <table className="table">
            <thead><tr><th>GRN</th><th>{t('common.date')}</th><th>{t('nav.suppliers')}</th><th>{t('grn.invoice')}</th><th className="text-right">{t('pos.total')}</th><th className="text-right">{t('pay.paid')}</th><th /></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id}><td className="font-bold">{p.grnNo}</td><td>{fmtDateTime(p.date)}</td><td>{sMap[p.supplierId] || '—'}</td><td>{p.invoiceNo}</td>
                <td className="text-right font-bold">{num(p.total)}</td><td className="text-right">{num(p.paid)}</td>
                <td className="text-right whitespace-nowrap"><button className="icon-btn" onClick={() => setView(p)} aria-label={t('common.view')}><Eye size={18} /></button><button className="icon-btn" onClick={() => nav(`/app/labels?purchase=${p.id}`)} title={t('nav.labels')} aria-label={t('nav.labels')}><Barcode size={18} /></button></td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <GRNModal open={open} onClose={() => setOpen(false)} onSaved={(pu) => nav(`/app/labels?purchase=${pu.id}`)} />
      <Modal open={!!view} onClose={() => setView(null)} title={view?.grnNo} icon={<Truck size={20} />}>
        {view ? (<div>
          <p className="muted mb-3">{fmtDateTime(view.date)} · {sMap[view.supplierId] || '—'} · {view.invoiceNo}</p>
          <table className="table"><tbody>{view.items.map((it, i) => <tr key={i}><td>{label(it)}</td><td className="text-right">{it.qty} × {num(it.cost)}</td><td className="text-right font-bold">{num(it.qty * it.cost)}</td></tr>)}</tbody></table>
          <p className="text-right font-display text-xl font-bold mt-3">{money(view.total)}</p>
          {view.note ? <p className="muted">{view.note}</p> : null}
        </div>) : null}
      </Modal>
    </Page>
  );
}
