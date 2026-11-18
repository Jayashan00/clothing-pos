import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Barcode, Printer, Trash2, Plus, Info, Tag, RefreshCw, Layers } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useBarcodeScanner, beep } from '../lib/scanner';
import { LABEL_TEMPLATES } from '../lib/print';
import { num } from '../lib/util';

// Remember when each item's tag was printed and at what price, so the shop can find
// items that were never tagged and items whose price changed after printing.
export async function markLabelled(variantIds) {
  const now = Date.now();
  await db.transaction('rw', db.variants, async () => {
    for (const id of variantIds) { const v = await db.variants.get(id); if (v) await db.variants.update(id, { labelledAt: now, labelPrice: v.price }); }
  });
}

import { toast, SearchBox, ProductIcon, Empty, Toggle, Field } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { Label, printLabels } from '../print/templates';

export default function Labels() {
  const t = useT();
  const settings = useSettings();
  const cfg = settings.labels;
  const setCfg = (patch) => settings.setSection('labels', patch);
  const [params] = useSearchParams();
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const [queue, setQueue] = useState([]);
  const [q, setQ] = useState('');

  const pMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const cMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const item = (v, copies = 1) => { const p = pMap[v.productId]; return { key: v.id, variantId: v.id, nameEn: p?.nameEn || '', nameSi: p?.nameSi || '', icon: p?.icon, categoryId: p?.categoryId, size: v.size, color: v.color, barcode: v.barcode, price: v.price, copies }; };

  const add = (v, copies = 1) => setQueue((qq) => {
    const i = qq.findIndex((x) => x.variantId === v.id);
    if (i >= 0) return qq.map((x, j) => (j === i ? { ...x, copies: x.copies + copies } : x));
    return [...qq, item(v, copies)];
  });

  useEffect(() => {
    if (!products.length || !variants.length) return;
    const pid = params.get('product'); const grn = params.get('purchase');
    if (params.get('queue')) {
      try {
        const qd = JSON.parse(sessionStorage.getItem('redipos-label-queue') || '[]');
        setQueue(qd.map((x) => { const v = variants.find((y) => y.id === x.variantId); return v ? item(v, x.copies) : null; }).filter(Boolean));
      } catch { /* ignore */ }
    }
    if (pid) setQueue(variants.filter((v) => v.productId === pid).map((v) => item(v, Math.max(1, Math.round(v.stock) || 1))));
    if (grn) db.purchases.get(grn).then((pu) => pu && setQueue(pu.items.map((it) => { const v = variants.find((x) => x.id === it.variantId); return v ? item(v, Math.max(1, Math.round(it.qty))) : null; }).filter(Boolean)));
  }, [products.length, variants.length]); // eslint-disable-line

  useBarcodeScanner(async (code) => {
    const v = variants.find((x) => x.barcode === code);
    if (v) { add(v); settings.sound && beep(true); } else { settings.sound && beep(false); toast.err(t('pos.notFound', { code })); }
  });

  const results = useMemo(() => {
    const s = q.trim().toLowerCase(); if (!s) return [];
    return variants.filter((v) => { const p = pMap[v.productId]; return p && (p.nameEn.toLowerCase().includes(s) || (p.nameSi || '').includes(q.trim()) || v.barcode.includes(s)); }).slice(0, 30);
  }, [q, variants, pMap]);

  const copiesFor = (v) => (pMap[v.productId]?.unit === 'pcs' ? Math.max(1, Math.round(v.stock) || 1) : 1);
  const notLabelled = variants.filter((v) => pMap[v.productId] && pMap[v.productId].active !== false && !v.labelledAt);
  const priceChanged = variants.filter((v) => pMap[v.productId] && v.labelledAt && v.labelPrice !== v.price);
  const [qCat, setQCat] = useState('');
  const addMany = (list) => { if (!list.length) return toast.info(t('labels.nothing')); list.forEach((v) => add(v, copiesFor(v))); };
  const doPrint = async () => { await printLabels(queue, settings); markLabelled(queue.filter((x) => x.copies > 0).map((x) => x.variantId)); };
  const tpl = LABEL_TEMPLATES[cfg.template] || LABEL_TEMPLATES['38x25'];
  const total = queue.reduce((s, x) => s + (Number(x.copies) || 0), 0);
  const scale = Math.min(3, 240 / (tpl.w * 3.78));

  return (
    <Page>
      <PageHeader title={t('nav.labels')} subtitle={t('labels.subtitle')} help="labels" icon={<Barcode size={24} />} />
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-4">
          <div className="card p-4">
            <p className="font-bold mb-2">{t('labels.quick')}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <button className="btn btn-outline" onClick={() => addMany(notLabelled)}><Tag size={18} /> {t('labels.notLabelled')} <span className={`badge ${notLabelled.length ? 'badge-gold' : 'badge-green'}`}>{notLabelled.length}</span></button>
              <button className="btn btn-outline" onClick={() => addMany(priceChanged)}><RefreshCw size={18} /> {t('labels.priceChanged')} <span className={`badge ${priceChanged.length ? 'badge-red' : 'badge-green'}`}>{priceChanged.length}</span></button>
              <select className="input !w-auto" value={qCat} onChange={(e) => setQCat(e.target.value)}>
                <option value="">{t('labels.pickCategory')}</option>{categories.map((c) => <option key={c.id} value={c.id}>{t.name(c)}</option>)}
              </select>
              <button className="btn btn-outline" disabled={!qCat} onClick={() => addMany(variants.filter((v) => pMap[v.productId]?.categoryId === qCat))}><Layers size={18} /> {t('labels.addCategory')}</button>
              {queue.length ? <button className="btn btn-ghost" onClick={() => setQueue([])}>{t('common.clear')}</button> : null}
            </div>
            <p className="hint mt-2">{t('labels.quickHint')}</p>
          </div>
          <div className="card p-4">
            <SearchBox value={q} onChange={setQ} placeholder={t('labels.searchPh')} scanTarget />
            {results.length ? (
              <div className="mt-2 max-h-72 overflow-y-auto scroll-thin divide-y line">
                {results.map((v) => { const p = pMap[v.productId]; return (
                  <button key={v.id} onClick={() => add(v)} className="w-full flex items-center gap-3 py-2 px-1 text-left hover:bg-indigo-50 dark:hover:bg-indigo-800 rounded-lg">
                    <ProductIcon icon={p.icon} color={cMap[p.categoryId]?.color} size={36} />
                    <span className="flex-1 min-w-0"><b className="block truncate">{t.name(p)}</b><span className="text-sm muted">{[v.size, v.color].filter(Boolean).join(' · ')} · {v.barcode}</span></span>
                    <span className="badge badge-blue">{t('labels.stock')} {v.stock}</span><Plus size={18} />
                  </button>); })}
              </div>
            ) : <p className="muted text-sm mt-2">{t('labels.scanHint')}</p>}
          </div>
          <div className="card overflow-x-auto">
            {!queue.length ? <Empty icon={<Barcode size={28} />} title={t('labels.empty')} text={t('labels.emptyText')} /> : (
              <table className="table">
                <thead><tr><th>{t('prod.product')}</th><th>{t('prod.barcode')}</th><th className="text-right">{t('prod.price')}</th><th>{t('labels.copies')}</th><th /></tr></thead>
                <tbody>{queue.map((x, i) => (
                  <tr key={x.key}>
                    <td><div className="flex items-center gap-2"><ProductIcon icon={x.icon} color={cMap[x.categoryId]?.color} size={34} /><div><b>{t.name(x)}</b><p className="text-xs muted">{[x.size, x.color].filter(Boolean).join(' · ')}</p></div></div></td>
                    <td className="font-mono text-sm">{x.barcode}</td>
                    <td className="text-right">{num(x.price)}</td>
                    <td><input className="input !min-h-[2.25rem] w-20" inputMode="numeric" value={x.copies} onChange={(e) => setQueue(queue.map((y, j) => (j === i ? { ...y, copies: Number(e.target.value.replace(/\D/g, '')) || 0 } : y)))} /></td>
                    <td><button className="icon-btn" onClick={() => setQueue(queue.filter((_, j) => j !== i))} aria-label={t('common.remove')}><Trash2 size={18} /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <p className="font-display text-lg font-bold mb-3">{t('labels.preview')}</p>
            <div className="rounded-2xl p-4 grid place-items-center overflow-hidden" style={{ background: 'repeating-linear-gradient(45deg, var(--surface-2) 0 10px, var(--surface) 10px 20px)', minHeight: 160 }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', margin: `${(tpl.h * 3.78 * (scale - 1)) / 2}px 0` }}>
                <div className="bg-white shadow-lift" style={{ outline: '1px solid #ccc' }}>
                  <Label item={queue[0] || { nameEn: 'Handloom cotton saree', nameSi: 'කපු සාරිය', size: 'Free', color: 'Maroon', barcode: '2000000000015', price: 5450 }} cfg={cfg} tpl={tpl} shop={settings.shop} cur={settings.currency} />
                </div>
              </div>
            </div>
            <p className="text-xs muted mt-2 text-center">{tpl.name}</p>
          </div>
          <div className="card p-4 space-y-2">
            <Field label={t('labels.size')}>
              <select className="input" value={cfg.template} onChange={(e) => setCfg({ template: e.target.value })}>
                {Object.entries(LABEL_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
            </Field>
            <Field label={t('labels.nameLang')}>
              <select className="input" value={cfg.nameLang} onChange={(e) => setCfg({ nameLang: e.target.value })}>
                <option value="en">English</option><option value="si">සිංහල</option>
              </select>
            </Field>
            <Field label={t('labels.barWidth')} hint={t('labels.barWidthHint')}>
              <select className="input" value={cfg.moduleMm} onChange={(e) => setCfg({ moduleMm: Number(e.target.value) })}>
                <option value={0.25}>0.25 mm ({t('labels.standard')})</option><option value={0.33}>0.33 mm</option><option value={0.375}>0.375 mm ({t('labels.bold')})</option>
              </select>
            </Field>
            <Toggle label={t('labels.showShop')} checked={cfg.showShop} onChange={(v) => setCfg({ showShop: v })} />
            <Toggle label={t('labels.showPrice')} checked={cfg.showPrice} onChange={(v) => setCfg({ showPrice: v })} />
            <Toggle label={t('labels.showVariant')} checked={cfg.showVariant} onChange={(v) => setCfg({ showVariant: v })} />
          </div>
          <button className="btn btn-accent btn-lg w-full" disabled={!total} onClick={doPrint}><Printer /> {t('labels.print', { n: total })}</button>
          <div className="rounded-2xl p-4 bg-indigo-50 dark:bg-indigo-800/40 text-sm flex gap-2"><Info size={18} className="shrink-0 mt-0.5" /><span>{t('labels.printerTip')}</span></div>
        </div>
      </div>
    </Page>
  );
}
