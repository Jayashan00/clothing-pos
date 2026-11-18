import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Tags, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { db, removeRecord } from '../db/db';
import { useT } from '../i18n';
import { uid } from '../lib/util';
import { Modal, toast, Field, ProductIcon, confirmDialog } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import IconPicker from '../components/IconPicker';
import { recommendIcons } from '../icons/clothing';

const COLORS = ['#1F2A5C', '#3D4C92', '#8C1C3A', '#B02A4C', '#C4840C', '#9A640C', '#138A6C', '#0B5A47', '#744B0E', '#6E1530', '#172046', '#5E6DAF'];

export default function Categories() {
  const t = useT();
  const cats = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const counts = useLiveQuery(async () => { const m = {}; (await db.products.toArray()).forEach((p) => { m[p.categoryId] = (m[p.categoryId] || 0) + 1; }); return m; }, []) || {};
  const [edit, setEdit] = useState(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!edit || touched) return;
    const r = recommendIcons(`${edit.nameEn} ${edit.nameSi}`)[0];
    if (r && r !== edit.icon) setEdit((e) => ({ ...e, icon: r }));
  }, [edit?.nameEn, edit?.nameSi]); // eslint-disable-line

  const save = async () => {
    if (!edit.nameEn.trim()) return toast.err(t('cat.nameRequired'));
    await db.categories.put(edit); toast.ok(t('common.saved')); setEdit(null);
  };
  const move = async (i, dir) => {
    const a = cats[i]; const b = cats[i + dir]; if (!a || !b) return;
    await db.categories.update(a.id, { sort: b.sort }); await db.categories.update(b.id, { sort: a.sort });
  };
  const del = async (c) => {
    if (counts[c.id]) return toast.err(t('cat.hasProducts', { n: counts[c.id] }));
    if (await confirmDialog({ message: t('cat.deleteMsg', { name: t.name(c) }), danger: true, okText: t('common.delete') })) { await removeRecord('categories', c.id); toast.ok(t('common.deleted')); }
  };

  return (
    <Page>
      <PageHeader title={t('nav.categories')} help="categories" icon={<Tags size={24} />}
        actions={<button className="btn btn-primary" onClick={() => { setTouched(false); setEdit({ id: uid(), nameEn: '', nameSi: '', icon: 'tag', color: COLORS[cats.length % COLORS.length], sort: cats.length }); }}><Plus size={18} /> {t('cat.add')}</button>} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cats.map((c, i) => (
          <div key={c.id} className="card p-4 flex items-center gap-3">
            <ProductIcon icon={c.icon} color={c.color} size={56} />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{c.nameEn}</p>
              <p className="muted text-sm truncate">{c.nameSi}</p>
              <p className="text-xs muted">{counts[c.id] || 0} {t('cat.products')}</p>
            </div>
            <div className="flex flex-col">
              <button className="icon-btn !w-8 !h-8" onClick={() => move(i, -1)} aria-label="Up"><ArrowUp size={16} /></button>
              <button className="icon-btn !w-8 !h-8" onClick={() => move(i, 1)} aria-label="Down"><ArrowDown size={16} /></button>
            </div>
            <button className="icon-btn" onClick={() => { setTouched(true); setEdit({ ...c }); }} aria-label={t('common.edit')}><Pencil size={18} /></button>
            <button className="icon-btn text-maroon-600" onClick={() => del(c)} aria-label={t('common.delete')}><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('cat.edit')} icon={<Tags size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></>}>
        {edit ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t('prod.nameEn')}><input className="input" value={edit.nameEn} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} /></Field>
              <Field label={t('prod.nameSi')}><input className="input" value={edit.nameSi} onChange={(e) => setEdit({ ...edit, nameSi: e.target.value })} /></Field>
            </div>
            <div>
              <span className="label">{t('cat.color')}</span>
              <div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} onClick={() => setEdit({ ...edit, color: c })} className={`w-9 h-9 rounded-full border-4 ${edit.color === c ? 'border-saffron-400' : 'border-transparent'}`} style={{ background: c }} aria-label={c} />)}</div>
            </div>
            <IconPicker value={edit.icon} text={`${edit.nameEn} ${edit.nameSi}`} color={edit.color} onChange={(id) => { setTouched(true); setEdit({ ...edit, icon: id }); }} />
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
