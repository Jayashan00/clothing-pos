import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ListPlus, Plus, Copy, Trash2, Save, Printer, CheckCircle2 } from 'lucide-react';
import { db, audit } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { generateBarcode } from '../lib/barcode';
import { uid, round2 } from '../lib/util';
import { toast, confirmDialog, ProductIcon } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { recommendIcons } from '../icons/clothing';

const DRAFT_KEY = 'redipos-quickadd-draft';
const blank = (prev) => ({
  key: uid(), nameEn: prev?.nameEn || '', nameSi: prev?.nameSi || '', categoryId: prev?.categoryId || '', unit: prev?.unit || 'pcs',
  size: '', color: prev?.color || '', cost: prev?.cost || '', price: prev?.price || '', qty: '', barcode: '', catTouched: !!prev?.catTouched,
});

// Fast entry for loading a whole shop: one row = one size/colour of an item.
// Rows with the same name become one product. Each row gets its own barcode,
// and the tags print with one copy for every piece entered.
export default function QuickAdd() {
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const allProducts = useLiveQuery(() => db.products.toArray(), []) || [];
  const [rows, setRows] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); if (Array.isArray(d) && d.length) return d; } catch { /* */ }
    return [blank(), blank(), blank()];
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const tableRef = useRef(null);

  // keep the typed rows safe if the page is refreshed or the power goes off
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(rows)); } catch { /* */ } }, [rows]);
  useEffect(() => {
    if (categories.length) setRows((rs) => rs.map((r) => (r.categoryId ? r : { ...r, categoryId: categories[0].id })));
  }, [categories.length]); // eslint-disable-line

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  // Learn which category each kind of garment usually goes in, from the shop's own products.
  const catGuess = useMemo(() => {
    const count = {};
    allProducts.forEach((p) => { (count[p.icon] ||= {}); count[p.icon][p.categoryId] = (count[p.icon][p.categoryId] || 0) + 1; });
    const out = {};
    Object.entries(count).forEach(([icon, m]) => { out[icon] = Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]; });
    categories.forEach((c) => { if (!out[c.icon]) out[c.icon] = c.id; });
    return out;
  }, [allProducts, categories]);
  const set = (i, k, v) => setRows((rs) => rs.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [k]: v };
    if (k === 'categoryId') next.catTouched = true;
    if ((k === 'nameEn' || k === 'nameSi') && !r.catTouched) {
      // same name already typed above → same category; otherwise guess from the garment
      const same = rs.find((x, xi) => xi !== i && x.nameEn.trim() && x.nameEn.trim().toLowerCase() === next.nameEn.trim().toLowerCase());
      const existing = allProducts.find((p) => p.nameEn.trim().toLowerCase() === next.nameEn.trim().toLowerCase());
      const guess = existing?.categoryId || same?.categoryId || catGuess[recommendIcons(`${next.nameEn} ${next.nameSi}`)[0]];
      if (guess && catMap[guess]) next.categoryId = guess;
    }
    return next;
  }));
  const addRow = (n = 1, from) => setRows((rs) => [...rs, ...Array.from({ length: n }, () => blank(from || rs[rs.length - 1]))]);
  const filled = rows.filter((r) => r.nameEn.trim());
  const totalQty = round2(filled.reduce((s, r) => s + (Number(r.qty) || 0), 0));
  const iconFor = (r) => recommendIcons(`${r.nameEn} ${r.nameSi}`)[0] || catMap[r.categoryId]?.icon || 'tag';

  const onKey = (e, i, last) => {
    if (e.key === 'Enter' && last) {
      e.preventDefault();
      if (i === rows.length - 1) addRow(1, rows[i]);
      setTimeout(() => tableRef.current?.querySelectorAll('tbody tr')[i + 1]?.querySelector('input[data-col=size]')?.focus(), 30);
    }
  };

  const save = async () => {
    const bad = filled.findIndex((r) => !(Number(r.price) > 0) || !r.categoryId);
    if (!filled.length) return toast.err(t('qa.empty'));
    if (bad >= 0) return toast.err(t('qa.rowErr', { n: rows.indexOf(filled[bad]) + 1 }));
    const codes = filled.map((r) => r.barcode.trim()).filter(Boolean);
    if (new Set(codes).size !== codes.length) return toast.err(t('prod.barcodeDup'));
    setSaving(true);
    try {
      const products = await db.products.toArray();
      const byName = Object.fromEntries(products.map((p) => [p.nameEn.trim().toLowerCase(), p]));
      const queue = []; let newItems = 0; let restocked = 0;
      for (const r of filled) {
        const qty = round2(Number(r.qty) || 0);
        let p = byName[r.nameEn.trim().toLowerCase()];
        if (!p) {
          p = { id: uid(), nameEn: r.nameEn.trim(), nameSi: r.nameSi.trim(), categoryId: r.categoryId, icon: iconFor(r), unit: r.unit, brand: '', material: '', supplierId: '', description: '', active: true, createdAt: Date.now() };
          await db.products.add(p); byName[p.nameEn.toLowerCase()] = p;
        } else if (!p.nameSi && r.nameSi.trim()) await db.products.update(p.id, { nameSi: r.nameSi.trim() });
        const size = r.size.trim(); const color = r.color.trim();
        let v = await db.variants.where('productId').equals(p.id).filter((x) => (x.size || '') === size && (x.color || '') === color).first();
        if (!v && r.barcode.trim()) {
          const used = await db.variants.where('barcode').equals(r.barcode.trim()).first();
          if (used) { toast.err(t('prod.barcodeUsed', { code: r.barcode.trim() })); continue; }
        }
        if (v) {
          // same item, size and colour already in the system: add the pieces to its stock
          await db.variants.update(v.id, { stock: round2((Number(v.stock) || 0) + qty), price: Number(r.price), ...(Number(r.cost) ? { cost: Number(r.cost) } : {}) });
          if (qty) await db.stockMoves.add({ id: uid(), variantId: v.id, date: Date.now(), type: 'purchase', qty, ref: 'Quick add', userId: user.id });
          v = { ...v, price: Number(r.price) }; restocked++;
        } else {
          v = { id: uid(), productId: p.id, size, color, barcode: r.barcode.trim() || await generateBarcode(settings.labels.format, settings.labels.prefix), sku: '', cost: Number(r.cost) || 0, price: Number(r.price), mrp: 0, wholesale: 0, stock: qty, reorderLevel: settings.stock.lowDefault };
          await db.variants.add(v);
          if (qty) await db.stockMoves.add({ id: uid(), variantId: v.id, date: Date.now(), type: 'opening', qty, ref: 'Quick add', userId: user.id });
          newItems++;
        }
        // one tag per piece (cloth by the metre gets one tag for the roll)
        queue.push({ variantId: v.id, copies: p.unit === 'pcs' ? Math.max(1, Math.round(qty)) : 1 });
      }
      audit(user.id, 'quick-add', `${newItems} new, ${restocked} restocked`);
      setResult({ newItems, restocked, queue, tags: queue.reduce((s, x) => s + x.copies, 0) });
      setRows([blank(), blank(), blank()].map((r) => ({ ...r, categoryId: filled[filled.length - 1].categoryId })));
      toast.ok(t('qa.saved', { items: newItems + restocked }));
    } finally { setSaving(false); }
  };

  const printNow = () => {
    sessionStorage.setItem('redipos-label-queue', JSON.stringify(result.queue));
    nav('/app/labels?queue=1');
  };

  const inp = 'input !min-h-[2.5rem] !px-2';
  return (
    <Page wide>
      <PageHeader title={t('nav.quickAdd')} subtitle={t('qa.subtitle')} help="quickAdd" icon={<ListPlus size={24} />}
        actions={<>
          <button className="btn btn-ghost" onClick={async () => { if (await confirmDialog({ message: t('qa.clearMsg'), danger: true })) setRows([blank(), blank(), blank()]); }}>{t('qa.clearAll')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={18} /> {t('qa.save')}</button>
        </>} />

      {result ? (
        <div className="rounded-2xl p-5 mb-4 bg-leaf-50 dark:bg-leaf-700/20 flex flex-wrap items-center gap-4">
          <CheckCircle2 size={36} className="text-leaf-600" />
          <div className="flex-1 min-w-[14rem]">
            <p className="font-display text-xl font-bold">{t('qa.doneTitle', { items: result.newItems + result.restocked })}</p>
            <p className="muted">{t('qa.doneText', { newItems: result.newItems, restocked: result.restocked, tags: result.tags })}</p>
          </div>
          <button className="btn btn-accent btn-lg" onClick={printNow}><Printer /> {t('qa.printNow', { n: result.tags })}</button>
          <button className="btn btn-ghost" onClick={() => setResult(null)}>{t('common.close')}</button>
        </div>
      ) : null}

      <div className="rounded-2xl p-4 mb-4 bg-indigo-50 dark:bg-indigo-800/40 text-sm">{t('qa.hint')}</div>

      <div className="card overflow-x-auto" ref={tableRef}>
        <table className="table text-sm [&_td]:!px-1.5 [&_th]:!px-1.5">
          <thead><tr>
            <th className="hidden 2xl:table-cell">#</th><th /><th>{t('prod.nameEn')}</th><th>{t('prod.nameSi')}</th><th>{t('prod.category')}</th>
            <th>{t('prod.size')}</th><th>{t('prod.color')}</th><th>{t('prod.price')}</th><th>{t('qa.qty')}</th><th>{t('prod.cost')}</th><th>{t('prod.unit')}</th><th>{t('qa.barcodeOpt')}</th><th />
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="muted font-bold hidden 2xl:table-cell">{i + 1}</td>
                <td>{r.nameEn ? <ProductIcon icon={iconFor(r)} color={catMap[r.categoryId]?.color} size={34} /> : null}</td>
                <td><input className={`${inp} w-40`} value={r.nameEn} onChange={(e) => set(i, 'nameEn', e.target.value)} placeholder="Cotton saree" /></td>
                <td><input className={`${inp} w-32`} value={r.nameSi} onChange={(e) => set(i, 'nameSi', e.target.value)} placeholder="කපු සාරිය" /></td>
                <td><select className={`${inp} w-32`} value={r.categoryId} onChange={(e) => set(i, 'categoryId', e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{t.name(c)}</option>)}</select></td>
                <td><input className={`${inp} w-16`} data-col="size" value={r.size} onChange={(e) => set(i, 'size', e.target.value)} placeholder="M" /></td>
                <td><input className={`${inp} w-20`} value={r.color} onChange={(e) => set(i, 'color', e.target.value)} placeholder="Red" /></td>
                <td><input className={`${inp} w-20 font-bold`} inputMode="decimal" value={r.price} onChange={(e) => set(i, 'price', e.target.value)} /></td>
                <td><input className={`${inp} w-16 font-bold`} inputMode="decimal" value={r.qty} onChange={(e) => set(i, 'qty', e.target.value)} onKeyDown={(e) => onKey(e, i, true)} /></td>
                <td><input className={`${inp} w-20`} inputMode="decimal" value={r.cost} onChange={(e) => set(i, 'cost', e.target.value)} /></td>
                <td><select className={`${inp} w-[5.5rem]`} value={r.unit} onChange={(e) => set(i, 'unit', e.target.value)}>{['pcs', 'm', 'yd'].map((u) => <option key={u} value={u}>{t('unit.' + u)}</option>)}</select></td>
                <td><input className={`${inp} w-[8.5rem] font-mono`} data-scan-target="1" value={r.barcode} onChange={(e) => set(i, 'barcode', e.target.value)} placeholder={t('qa.auto')} /></td>
                <td className="whitespace-nowrap">
                  <button className="icon-btn !w-9 !h-9" title={t('qa.copyRow')} aria-label={t('qa.copyRow')} onClick={() => setRows((rs) => [...rs.slice(0, i + 1), { ...blank(r), size: '', qty: '' }, ...rs.slice(i + 1)])}><Copy size={16} /></button>
                  <button className="icon-btn !w-9 !h-9 text-maroon-600" aria-label={t('common.remove')} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button className="btn btn-outline" onClick={() => addRow(1)}><Plus size={18} /> {t('qa.addRow')}</button>
        <button className="btn btn-outline" onClick={() => addRow(10)}><Plus size={18} /> {t('qa.add10')}</button>
        <span className="flex-1" />
        <span className="badge badge-blue text-sm">{t('qa.totals', { rows: filled.length, qty: totalQty })}</span>
        <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}><Save /> {t('qa.save')}</button>
      </div>
    </Page>
  );
}
