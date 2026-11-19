import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { ScanSearch, Printer } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { money } from '../lib/util';
import { beep } from '../lib/scanner';
import { Modal, ProductIcon } from './ui';
import { printLabels } from '../print/templates';
import { markLabelled } from '../pages/Labels';
import { costCode } from '../lib/costcode';

export const usePriceCheck = create((set) => ({ open: false, set }));

// Scan any tag (or type a name) to see what the item is, its price and stock in every size.
export default function PriceCheck() {
  const t = useT();
  const settings = useSettings();
  const { open, set } = usePriceCheck();
  const [q, setQ] = useState('');
  const [hit, setHit] = useState(null);
  const [miss, setMiss] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'F3') { e.preventDefault(); set({ open: true }); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [set]);
  useEffect(() => { if (open) { setQ(''); setHit(null); setMiss(false); setTimeout(() => ref.current?.focus(), 60); } }, [open]);

  const look = async (text) => {
    const s = text.trim(); if (!s) return;
    let v = await db.variants.where('barcode').equals(s).first();
    let p;
    if (v) p = await db.products.get(v.productId);
    else {
      const low = s.toLowerCase();
      p = (await db.products.toArray()).find((x) => x.nameEn.toLowerCase().includes(low) || (x.nameSi || '').includes(s));
    }
    if (!p) { setHit(null); setMiss(true); if (settings.sound) beep(false); return; }
    const all = await db.variants.where('productId').equals(p.id).toArray();
    const cat = await db.categories.get(p.categoryId);
    if (settings.sound && v) beep(true);
    setHit({ p, v: v || null, all, cat }); setMiss(false); setQ('');
  };

  const shown = hit?.v || hit?.all?.[0];
  return (
    <Modal open={open} onClose={() => set({ open: false })} title={t('pc.title')} icon={<ScanSearch size={20} />}>
      <input ref={ref} className="input text-lg" data-scan-target="1" value={q} placeholder={t('pc.ph')}
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); look(q); } }} />
      {miss ? <p className="text-maroon-600 font-bold mt-3">{t('pc.notFound')}</p> : null}
      {hit && shown ? (
        <div className="mt-4">
          <div className="flex items-center gap-4">
            <ProductIcon icon={hit.p.icon} color={hit.cat?.color} size={72} />
            <div className="flex-1 min-w-0">
              <p className="font-display text-2xl font-bold leading-tight">{hit.p.nameEn}</p>
              {hit.p.nameSi ? <p className="text-lg">{hit.p.nameSi}</p> : null}
              <p className="muted">{hit.cat ? t.name(hit.cat) : ''}{hit.p.brand ? ' · ' + hit.p.brand : ''}{hit.p.material ? ' · ' + hit.p.material : ''}</p>
            </div>
          </div>
          {hit.v ? (
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-2xl p-3 bg-indigo-700 text-white"><p className="text-indigo-200 text-sm font-bold">{t('prod.price')}</p><p className="font-display text-2xl font-bold">{money(hit.v.price, settings.currency)}</p></div>
              <div className="rounded-2xl p-3" style={{ background: 'var(--surface-2)' }}><p className="muted text-sm font-bold">{t('prod.size')} / {t('prod.color')}</p><p className="font-bold text-lg">{[hit.v.size, hit.v.color].filter(Boolean).join(' · ') || '—'}</p></div>
              <div className={`rounded-2xl p-3 ${hit.v.stock <= 0 ? 'bg-maroon-50 text-maroon-600' : 'bg-leaf-50 text-leaf-700'}`}><p className="text-sm font-bold">{t('prod.stock')}</p><p className="font-display text-2xl font-bold">{hit.v.stock}</p></div>
            </div>
          ) : null}
          <p className="font-bold mt-4 mb-2">{t('pc.allSizes')}</p>
          <div className="overflow-x-auto"><table className="table text-sm">
            <thead><tr><th>{t('prod.size')}</th><th>{t('prod.color')}</th><th>{t('prod.barcode')}</th><th className="text-right">{t('prod.price')}</th>{settings.labels.showCostCode ? <th>{t('cc.code')}</th> : null}<th className="text-right">{t('prod.stock')}</th><th /></tr></thead>
            <tbody>{hit.all.map((v) => (
              <tr key={v.id} className={hit.v?.id === v.id ? 'bg-saffron-50 dark:bg-saffron-900/30' : ''}>
                <td className="font-bold">{v.size || '—'}</td><td>{v.color}</td><td className="font-mono">{v.barcode}</td>
                <td className="text-right font-bold">{money(v.price, settings.currency)}</td>
                {settings.labels.showCostCode ? <td className="font-bold tracking-wider">{costCode(v.cost, settings.labels.costCode)}</td> : null}
                <td className="text-right"><span className={`badge ${v.stock <= 0 ? 'badge-red' : v.stock <= v.reorderLevel ? 'badge-gold' : 'badge-green'}`}>{v.stock}</span></td>
                <td className="text-right"><button className="btn btn-ghost btn-sm" onClick={() => {
                  printLabels([{ nameEn: hit.p.nameEn, nameSi: hit.p.nameSi, size: v.size, color: v.color, barcode: v.barcode, price: v.price, cost: v.cost, copies: 1 }], settings);
                  markLabelled([v.id]);
                }}><Printer size={15} /> {t('pc.printTag')}</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : null}
      {!hit && !miss ? <p className="muted mt-3">{t('pc.hint')}</p> : null}
    </Modal>
  );
}
