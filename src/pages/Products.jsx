import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shirt, Plus, Pencil, Trash2, Barcode, Sparkles, Upload, Download, X, Wand2 } from 'lucide-react';
import { db, removeRecord, audit } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { generateBarcode } from '../lib/barcode';
import { money, num, uid, round2, sum, toCSV, downloadText } from '../lib/util';
import { Modal, toast, Field, SearchBox, ProductIcon, Empty, confirmDialog } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import IconPicker from '../components/IconPicker';
import { recommendIcons, ClothingIcon } from '../icons/clothing';

const SIZE_PRESETS = {
  adult: ['S', 'M', 'L', 'XL', 'XXL'],
  kids: ['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y', '12-13Y'],
  baby: ['0-3M', '3-6M', '6-12M', '12-18M'],
  waist: ['28', '30', '32', '34', '36', '38', '40'],
  collar: ['14.5', '15', '15.5', '16', '16.5', '17'],
  free: ['Free size'],
};

function ChipInput({ values, onChange, placeholder }) {
  const [v, setV] = useState('');
  const add = (x) => { const s = x.trim(); if (s && !values.includes(s)) onChange([...values, s]); setV(''); };
  return (
    <div className="input !h-auto py-2 flex flex-wrap gap-1.5 items-center">
      {values.map((x) => (
        <span key={x} className="badge badge-blue text-sm !py-1">{x}<button type="button" onClick={() => onChange(values.filter((y) => y !== x))} aria-label="remove"><X size={14} /></button></span>
      ))}
      <input className="flex-1 min-w-[6rem] bg-transparent outline-none" value={v} placeholder={placeholder}
        onChange={(e) => { if (e.target.value.endsWith(',')) add(e.target.value.slice(0, -1)); else setV(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(v); } if (e.key === 'Backspace' && !v && values.length) onChange(values.slice(0, -1)); }}
        onBlur={() => v && add(v)} />
    </div>
  );
}

export function ProductForm({ open, product, onClose, onSaved }) {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) || [];
  const [f, setF] = useState(null);
  const [vars, setVars] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  const [iconTouched, setIconTouched] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [bulk, setBulk] = useState({ cost: '', price: '', mrp: '', stock: '' });

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (product) {
        setF({ ...product });
        const vs = await db.variants.where('productId').equals(product.id).toArray();
        setVars(vs.map((v) => ({ ...v, _orig: true })));
        setIconTouched(true);
      } else {
        setF({ id: uid(), nameEn: '', nameSi: '', categoryId: categories[0]?.id || '', icon: 'tag', unit: 'pcs', brand: '', material: '', supplierId: '', description: '', active: true, createdAt: Date.now() });
        setVars([]); setIconTouched(false);
      }
      setSizes([]); setColors([]); setShowPicker(false); setBulk({ cost: '', price: '', mrp: '', stock: '' });
    })();
  }, [open, product]); // eslint-disable-line

  const recs = useMemo(() => (f ? recommendIcons(`${f.nameEn} ${f.nameSi}`, 4) : []), [f?.nameEn, f?.nameSi]); // eslint-disable-line
  useEffect(() => {
    if (!f || iconTouched) return;
    const cat = categories.find((c) => c.id === f.categoryId);
    const next = recs[0] || cat?.icon || 'tag';
    if (next !== f.icon) setF((x) => ({ ...x, icon: next }));
  }, [recs, f?.categoryId, iconTouched, categories]); // eslint-disable-line

  if (!open || !f) return null;
  const cat = categories.find((c) => c.id === f.categoryId);
  const set = (k, v) => setF({ ...f, [k]: v });
  const setVar = (i, k, v) => setVars(vars.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const generate = async () => {
    const sz = sizes.length ? sizes : [''];
    const cl = colors.length ? colors : [''];
    const next = [...vars];
    for (const s of sz) for (const c of cl) {
      if (next.some((x) => x.size === s && x.color === c)) continue;
      next.push({ id: uid(), productId: f.id, size: s, color: c, barcode: await generateBarcode(settings.labels.format, settings.labels.prefix), sku: '', cost: Number(bulk.cost) || 0, price: Number(bulk.price) || 0, mrp: Number(bulk.mrp) || 0, wholesale: 0, stock: Number(bulk.stock) || 0, reorderLevel: settings.stock.lowDefault });
    }
    setVars(next); setSizes([]); setColors([]);
  };
  const addSingle = async () => setVars([...vars, { id: uid(), productId: f.id, size: '', color: '', barcode: await generateBarcode(settings.labels.format, settings.labels.prefix), sku: '', cost: Number(bulk.cost) || 0, price: Number(bulk.price) || 0, mrp: 0, wholesale: 0, stock: 0, reorderLevel: settings.stock.lowDefault }]);
  const applyBulk = () => setVars(vars.map((v) => ({ ...v, ...(bulk.cost !== '' ? { cost: Number(bulk.cost) } : {}), ...(bulk.price !== '' ? { price: Number(bulk.price) } : {}), ...(bulk.mrp !== '' ? { mrp: Number(bulk.mrp) } : {}), ...(bulk.stock !== '' && !v._orig ? { stock: Number(bulk.stock) } : {}) })));

  const save = async (andLabels) => {
    if (!f.nameEn.trim()) return toast.err(t('prod.nameRequired'));
    if (!f.categoryId) return toast.err(t('prod.catRequired'));
    if (!vars.length) return toast.err(t('prod.variantRequired'));
    if (vars.some((v) => !(Number(v.price) > 0))) return toast.err(t('prod.priceRequired'));
    const codes = vars.map((v) => String(v.barcode).trim());
    if (codes.some((c) => !c) || new Set(codes).size !== codes.length) return toast.err(t('prod.barcodeDup'));
    for (const v of vars) {
      const other = await db.variants.where('barcode').equals(String(v.barcode).trim()).first();
      if (other && other.id !== v.id) return toast.err(t('prod.barcodeUsed', { code: v.barcode }));
    }
    const existing = product ? await db.variants.where('productId').equals(product.id).toArray() : [];
    const removed = existing.filter((e) => !vars.some((v) => v.id === e.id));
    await db.transaction('rw', [db.products, db.variants, db.stockMoves, db.deletions], async () => {
      await db.products.put({ ...f, nameEn: f.nameEn.trim(), nameSi: (f.nameSi || '').trim() });
      for (const v of vars) {
        const { _orig, ...clean } = v;
        const row = { ...clean, productId: f.id, barcode: String(v.barcode).trim(), cost: Number(v.cost) || 0, price: Number(v.price) || 0, mrp: Number(v.mrp) || 0, wholesale: Number(v.wholesale) || 0, stock: Number(v.stock) || 0, reorderLevel: Number(v.reorderLevel) || 0 };
        await db.variants.put(row);
        if (!_orig && row.stock) await db.stockMoves.add({ id: uid(), variantId: row.id, date: Date.now(), type: 'opening', qty: row.stock, ref: 'New product', userId: user.id });
      }
      for (const r of removed) { await db.variants.delete(r.id); await db.deletions.put({ id: 'variants:' + r.id, table: 'variants', recordId: r.id, updatedAt: Date.now() }); }
    });
    audit(user.id, product ? 'product-edit' : 'product-add', f.nameEn);
    toast.ok(t('prod.saved'));
    onSaved?.(f, andLabels);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={product ? t('prod.edit') : t('prod.add')} size="xl" icon={<Shirt size={20} />}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-outline" onClick={() => save(true)}><Barcode size={18} /> {t('prod.saveAndLabels')}</button>
        <button className="btn btn-primary" onClick={() => save(false)}>{t('common.save')}</button>
      </>}>
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('prod.nameEn')}><input className="input" value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} placeholder="e.g. Handloom cotton saree" /></Field>
            <Field label={t('prod.nameSi')}><input className="input" value={f.nameSi} onChange={(e) => set('nameSi', e.target.value)} placeholder="උදා: කපු සාරිය" /></Field>
            <Field label={t('prod.category')}>
              <select className="input" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{t.name(c)}</option>)}
              </select>
            </Field>
            <Field label={t('prod.unit')} hint={t('prod.unitHint')}>
              <select className="input" value={f.unit} onChange={(e) => set('unit', e.target.value)}>
                {['pcs', 'm', 'yd'].map((u) => <option key={u} value={u}>{t('unit.' + u)}</option>)}
              </select>
            </Field>
            <Field label={t('prod.brand')}><input className="input" value={f.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
            <Field label={t('prod.material')}><input className="input" value={f.material} onChange={(e) => set('material', e.target.value)} placeholder="Cotton, Silk, Linen…" /></Field>
            <Field label={t('prod.supplier')}>
              <select className="input" value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
                <option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 font-bold mt-7"><input type="checkbox" className="w-5 h-5" checked={f.active !== false} onChange={(e) => set('active', e.target.checked)} /> {t('prod.active')}</label>
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}>
          <p className="label">{t('prod.icon')}</p>
          <div className="flex items-center gap-3">
            <ProductIcon icon={f.icon} color={cat?.color} size={72} />
            <div className="flex-1">
              {!iconTouched && recs[0] ? <p className="text-sm font-bold text-saffron-700 dark:text-saffron-300 flex items-center gap-1"><Sparkles size={14} /> {t('prod.autoIcon')}</p> : null}
              <button className="btn btn-outline btn-sm mt-1" onClick={() => setShowPicker(!showPicker)}>{showPicker ? t('common.done') : t('prod.changeIcon')}</button>
            </div>
          </div>
          {!showPicker && recs.length > 1 ? (
            <div className="flex gap-2 mt-3">{recs.map((id) => (
              <button key={id} onClick={() => { set('icon', id); setIconTouched(true); }} className={`rounded-xl p-2 border-2 ${f.icon === id ? 'border-indigo-600' : 'border-transparent'}`} style={{ background: 'var(--surface)', color: cat?.color }} aria-label={id}><ClothingIcon id={id} size={28} /></button>
            ))}</div>
          ) : null}
          {showPicker ? <div className="mt-3"><IconPicker value={f.icon} text={`${f.nameEn} ${f.nameSi}`} color={cat?.color} onChange={(id) => { set('icon', id); setIconTouched(true); }} /></div> : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border-2 border-dashed line p-4">
        <p className="font-display text-lg font-bold mb-1">{t('prod.variants')}</p>
        <p className="muted text-sm mb-3">{t('prod.variantsHint')}</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <span className="label">{t('prod.sizes')}</span>
            <ChipInput values={sizes} onChange={setSizes} placeholder={t('prod.typeEnter')} />
            <div className="flex flex-wrap gap-1.5 mt-2">{Object.entries(SIZE_PRESETS).map(([k, list]) => <button key={k} className="btn btn-ghost btn-sm" onClick={() => setSizes([...new Set([...sizes, ...list])])}>{t('sizes.' + k)}</button>)}</div>
          </div>
          <div>
            <span className="label">{t('prod.colors')}</span>
            <ChipInput values={colors} onChange={setColors} placeholder={t('prod.typeEnter')} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {['cost', 'price', 'mrp', 'stock'].map((k) => <Field key={k} label={t('prod.' + k)}><input className="input" inputMode="decimal" value={bulk[k]} onChange={(e) => setBulk({ ...bulk, [k]: e.target.value })} /></Field>)}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-primary" onClick={generate}><Wand2 size={18} /> {t('prod.generate')}</button>
          <button className="btn btn-outline" onClick={addSingle}><Plus size={18} /> {t('prod.addOne')}</button>
          {vars.length ? <button className="btn btn-ghost" onClick={applyBulk}>{t('prod.applyAll')}</button> : null}
        </div>
        {vars.length ? (
          <div className="overflow-x-auto mt-4">
            <table className="table text-sm">
              <thead><tr><th>{t('prod.size')}</th><th>{t('prod.color')}</th><th>{t('prod.barcode')}</th><th>{t('prod.cost')}</th><th>{t('prod.price')}</th><th>{t('prod.mrp')}</th><th>{t('prod.stock')}</th><th>{t('prod.reorder')}</th><th /></tr></thead>
              <tbody>{vars.map((v, i) => (
                <tr key={v.id}>
                  <td><input className="input !min-h-[2.25rem] w-20" value={v.size} onChange={(e) => setVar(i, 'size', e.target.value)} /></td>
                  <td><input className="input !min-h-[2.25rem] w-24" value={v.color} onChange={(e) => setVar(i, 'color', e.target.value)} /></td>
                  <td><input className="input !min-h-[2.25rem] w-40 font-mono" data-scan-target="1" value={v.barcode} onChange={(e) => setVar(i, 'barcode', e.target.value)} title={t('prod.barcodeHint')} /></td>
                  {['cost', 'price', 'mrp'].map((k) => <td key={k}><input className="input !min-h-[2.25rem] w-24" inputMode="decimal" value={v[k]} onChange={(e) => setVar(i, k, e.target.value)} /></td>)}
                  <td><input className="input !min-h-[2.25rem] w-20" inputMode="decimal" value={v.stock} disabled={v._orig} title={v._orig ? t('prod.stockViaInventory') : ''} onChange={(e) => setVar(i, 'stock', e.target.value)} /></td>
                  <td><input className="input !min-h-[2.25rem] w-16" inputMode="numeric" value={v.reorderLevel} onChange={(e) => setVar(i, 'reorderLevel', e.target.value)} /></td>
                  <td><button className="icon-btn" onClick={() => setVars(vars.filter((_, j) => j !== i))} aria-label={t('common.remove')}><Trash2 size={18} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </div>
      <Field label={t('prod.description')} className="mt-4"><textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
    </Modal>
  );
}

function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export default function Products() {
  const t = useT();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => { if (params.get('new')) { setEdit(null); setFormOpen(true); params.delete('new'); setParams(params, { replace: true }); } }, []); // eslint-disable-line

  const cMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const vBy = useMemo(() => { const m = {}; variants.forEach((v) => (m[v.productId] ||= []).push(v)); return m; }, [variants]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => (cat === 'all' || p.categoryId === cat) && (!s || p.nameEn.toLowerCase().includes(s) || (p.nameSi || '').includes(q.trim()) || (p.brand || '').toLowerCase().includes(s) || (vBy[p.id] || []).some((v) => v.barcode.includes(s))))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  }, [products, q, cat, vBy]);

  const del = async (p) => {
    const sold = await db.sales.filter((s) => s.items.some((i) => i.productId === p.id)).first();
    if (sold) {
      if (await confirmDialog({ title: t('prod.hideTitle'), message: t('prod.hideMsg') })) { await db.products.update(p.id, { active: false }); toast.ok(t('prod.hidden')); }
      return;
    }
    if (!(await confirmDialog({ title: t('prod.deleteTitle'), message: t('prod.deleteMsg', { name: t.name(p) }), danger: true, okText: t('common.delete') }))) return;
    for (const v of vBy[p.id] || []) await removeRecord('variants', v.id);
    await removeRecord('products', p.id);
    audit(user.id, 'product-delete', p.nameEn);
    toast.ok(t('common.deleted'));
  };

  const exportCSV = () => {
    const rows = variants.map((v) => ({ v, p: products.find((p) => p.id === v.productId) })).filter((x) => x.p);
    downloadText('products.csv', toCSV(rows, [
      { label: 'nameEn', value: (r) => r.p.nameEn }, { label: 'nameSi', value: (r) => r.p.nameSi }, { label: 'category', value: (r) => cMap[r.p.categoryId]?.nameEn },
      { label: 'unit', value: (r) => r.p.unit }, { label: 'brand', value: (r) => r.p.brand }, { label: 'size', value: (r) => r.v.size }, { label: 'color', value: (r) => r.v.color },
      { label: 'barcode', value: (r) => r.v.barcode }, { label: 'cost', value: (r) => r.v.cost }, { label: 'price', value: (r) => r.v.price }, { label: 'mrp', value: (r) => r.v.mrp }, { label: 'stock', value: (r) => r.v.stock },
    ]), 'text/csv');
  };

  const doImport = async (file) => {
    const rows = parseCSV(await file.text());
    if (rows.length < 2) return toast.err(t('prod.importEmpty'));
    const head = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
    const col = (r, k) => (r[head.indexOf(k)] ?? '').trim();
    let created = 0; let updated = 0;
    const productByName = Object.fromEntries(products.map((p) => [p.nameEn.toLowerCase(), p]));
    for (const r of rows.slice(1)) {
      const nameEn = col(r, 'nameEn'); if (!nameEn) continue;
      let catRow = categories.find((c) => c.nameEn.toLowerCase() === col(r, 'category').toLowerCase());
      if (!catRow && col(r, 'category')) { catRow = { id: uid(), nameEn: col(r, 'category'), nameSi: '', icon: recommendIcons(col(r, 'category'))[0] || 'tag', color: '#1F2A5C', sort: categories.length + 1 }; await db.categories.add(catRow); categories.push(catRow); }
      let p = productByName[nameEn.toLowerCase()];
      if (!p) {
        p = { id: uid(), nameEn, nameSi: col(r, 'nameSi'), categoryId: catRow?.id || categories[0]?.id, icon: recommendIcons(`${nameEn} ${col(r, 'nameSi')}`)[0] || catRow?.icon || 'tag', unit: col(r, 'unit') || 'pcs', brand: col(r, 'brand'), material: '', supplierId: '', description: '', active: true, createdAt: Date.now() };
        await db.products.add(p); productByName[nameEn.toLowerCase()] = p;
      }
      const code = col(r, 'barcode') || await generateBarcode(settings.labels.format, settings.labels.prefix);
      const existing = await db.variants.where('barcode').equals(code).first();
      const row = { productId: p.id, size: col(r, 'size'), color: col(r, 'color'), barcode: code, cost: Number(col(r, 'cost')) || 0, price: Number(col(r, 'price')) || 0, mrp: Number(col(r, 'mrp')) || 0, stock: Number(col(r, 'stock')) || 0 };
      if (existing) { await db.variants.update(existing.id, row); updated++; } else { await db.variants.add({ id: uid(), sku: '', wholesale: 0, reorderLevel: settings.stock.lowDefault, ...row }); created++; }
    }
    toast.ok(t('prod.imported', { created, updated }));
    setImportOpen(false);
  };

  return (
    <Page>
      <PageHeader title={t('nav.products')} subtitle={t('prod.count', { n: products.length, v: variants.length })} help="products" icon={<Shirt size={24} />}
        actions={<>
          <button className="btn btn-outline" onClick={() => setImportOpen(true)}><Upload size={18} /> {t('common.import')}</button>
          <button className="btn btn-outline" onClick={exportCSV}><Download size={18} /> {t('common.export')}</button>
          <button className="btn btn-primary" onClick={() => { setEdit(null); setFormOpen(true); }}><Plus size={18} /> {t('prod.add')}</button>
        </>} />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 min-w-[16rem]"><SearchBox value={q} onChange={setQ} placeholder={t('prod.searchPh')} scanTarget /></div>
        <select className="input !w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">{t('pos.all')}</option>{categories.map((c) => <option key={c.id} value={c.id}>{t.name(c)}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        {!list.length ? <Empty icon={<Shirt size={28} />} title={t('prod.none')} text={t('prod.noneText')} action={<button className="btn btn-primary" onClick={() => { setEdit(null); setFormOpen(true); }}><Plus size={18} /> {t('prod.add')}</button>} /> : (
          <table className="table">
            <thead><tr><th>{t('prod.product')}</th><th>{t('prod.category')}</th><th>{t('prod.variants')}</th><th className="text-right">{t('prod.price')}</th><th className="text-right">{t('prod.stock')}</th><th /></tr></thead>
            <tbody>
              {list.map((p) => {
                const vs = vBy[p.id] || []; const c = cMap[p.categoryId];
                const prices = vs.map((v) => v.price); const st = round2(sum(vs, (v) => v.stock));
                return (
                  <tr key={p.id} className={p.active === false ? 'opacity-50' : ''}>
                    <td><div className="flex items-center gap-3"><ProductIcon icon={p.icon} color={c?.color} size={44} /><div><p className="font-bold">{p.nameEn}</p><p className="text-sm muted">{p.nameSi}</p></div></div></td>
                    <td>{c ? t.name(c) : '—'}</td>
                    <td><span className="text-sm">{vs.length} · {[...new Set(vs.map((v) => v.size).filter(Boolean))].slice(0, 5).join(', ')}</span></td>
                    <td className="text-right font-bold">{prices.length ? (Math.min(...prices) === Math.max(...prices) ? num(prices[0]) : `${num(Math.min(...prices))}+`) : '—'}</td>
                    <td className="text-right"><span className={`badge ${st <= 0 ? 'badge-red' : vs.some((v) => v.stock <= v.reorderLevel) ? 'badge-gold' : 'badge-green'}`}>{st}{p.unit !== 'pcs' ? ' ' + p.unit : ''}</span></td>
                    <td className="whitespace-nowrap text-right">
                      <button className="icon-btn" title={t('nav.labels')} onClick={() => nav(`/app/labels?product=${p.id}`)} aria-label={t('nav.labels')}><Barcode size={19} /></button>
                      <button className="icon-btn" onClick={() => { setEdit(p); setFormOpen(true); }} aria-label={t('common.edit')}><Pencil size={19} /></button>
                      <button className="icon-btn text-maroon-600" onClick={() => del(p)} aria-label={t('common.delete')}><Trash2 size={19} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <ProductForm open={formOpen} product={edit} onClose={() => setFormOpen(false)} onSaved={(p, labels) => labels && nav(`/app/labels?product=${p.id}`)} />
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('prod.importTitle')} icon={<Upload size={20} />}>
        <p className="mb-3">{t('prod.importHelp')}</p>
        <pre className="text-xs rounded-xl p-3 overflow-x-auto mb-3" style={{ background: 'var(--surface-2)' }}>nameEn,nameSi,category,unit,brand,size,color,barcode,cost,price,mrp,stock{'\n'}Cotton saree,කපු සාරිය,Sarees,pcs,Dumbara,,Red,,3200,5450,5950,10</pre>
        <button className="btn btn-ghost btn-sm mb-3" onClick={() => downloadText('products-template.csv', '\uFEFFnameEn,nameSi,category,unit,brand,size,color,barcode,cost,price,mrp,stock\n', 'text/csv')}><Download size={16} /> {t('prod.template')}</button>
        <input type="file" accept=".csv,text/csv" className="input py-2" onChange={(e) => e.target.files[0] && doImport(e.target.files[0])} />
      </Modal>
    </Page>
  );
}
