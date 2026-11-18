import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Receipt, Plus, Pencil, Trash2 } from 'lucide-react';
import { db, removeRecord } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { money, num, uid, sum, fmtDate, toInputDate } from '../lib/util';
import { Modal, toast, Field, Empty, Toggle, confirmDialog } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { useRange, RangePicker } from './Sales';

export const EXP_CATS = ['rent', 'electricity', 'water', 'salary', 'transport', 'staffMeals', 'packaging', 'repairs', 'advertising', 'telephone', 'tailoring', 'other'];

export default function Expenses() {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const r = useRange('month');
  const list = useLiveQuery(() => db.expenses.where('date').between(r.range[0], r.range[1], true, true).reverse().sortBy('date'), [r.range[0], r.range[1]]) || [];
  const [edit, setEdit] = useState(null);
  const byCat = useMemo(() => { const m = {}; list.forEach((e) => { m[e.category] = (m[e.category] || 0) + e.amount; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [list]);
  const save = async () => {
    if (!(Number(edit.amount) > 0)) return toast.err(t('inv.enterQty'));
    await db.expenses.put({ ...edit, amount: Number(edit.amount), date: new Date(edit._date + 'T12:00:00').getTime(), _date: undefined });
    toast.ok(t('common.saved')); setEdit(null);
  };
  return (
    <Page>
      <PageHeader title={t('nav.expenses')} help="expenses" icon={<Receipt size={24} />} actions={<button className="btn btn-primary" onClick={() => setEdit({ id: uid(), _date: toInputDate(Date.now()), category: 'electricity', amount: '', note: '', paidBy: 'cash', fromDrawer: false, terminal: settings.terminal.code, userId: user.id })}><Plus size={18} /> {t('exp.add')}</button>} />
      <div className="mb-4"><RangePicker r={r} /></div>
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="card overflow-x-auto">
          {!list.length ? <Empty icon={<Receipt size={28} />} title={t('exp.none')} /> : (
            <table className="table">
              <thead><tr><th>{t('common.date')}</th><th>{t('exp.category')}</th><th>{t('common.note')}</th><th>{t('exp.paidBy')}</th><th className="text-right">{t('promo.amount')}</th><th /></tr></thead>
              <tbody>{list.map((e) => (
                <tr key={e.id}><td className="text-sm whitespace-nowrap">{fmtDate(e.date)}</td><td><span className="badge badge-blue">{t('exp.c.' + e.category)}</span></td><td className="text-sm">{e.note}{e.fromDrawer ? <span className="badge badge-gold ml-1">{t('exp.drawer')}</span> : null}</td><td className="text-sm">{t('pay.' + e.paidBy)}</td><td className="text-right font-bold">{num(e.amount)}</td>
                  <td className="whitespace-nowrap"><button className="icon-btn" onClick={() => setEdit({ ...e, _date: toInputDate(e.date) })} aria-label={t('common.edit')}><Pencil size={18} /></button><button className="icon-btn text-maroon-600" onClick={async () => { if (await confirmDialog({ message: t('exp.deleteMsg'), danger: true, okText: t('common.delete') })) removeRecord('expenses', e.id); }} aria-label={t('common.delete')}><Trash2 size={18} /></button></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="card p-4 h-fit">
          <p className="muted font-bold">{t('exp.total')}</p>
          <p className="font-display text-3xl font-bold mb-3">{money(sum(list, (e) => e.amount))}</p>
          {byCat.map(([k, v]) => { const total = sum(list, (e) => e.amount) || 1; return (
            <div key={k} className="mb-2"><div className="flex justify-between text-sm"><span>{t('exp.c.' + k)}</span><b>{num(v)}</b></div>
              <div className="h-2 rounded-full mt-1" style={{ background: 'var(--surface-2)' }}><div className="h-2 rounded-full bg-saffron-500" style={{ width: `${(v / total) * 100}%` }} /></div></div>); })}
        </div>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('exp.add')} size="sm" icon={<Receipt size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></>}>
        {edit ? <div className="space-y-3">
          <Field label={t('common.date')}><input type="date" className="input" value={edit._date} onChange={(e) => setEdit({ ...edit, _date: e.target.value })} /></Field>
          <Field label={t('exp.category')}><select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{EXP_CATS.map((c) => <option key={c} value={c}>{t('exp.c.' + c)}</option>)}</select></Field>
          <Field label={t('promo.amount')}><input className="input text-xl" inputMode="decimal" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
          <Field label={t('exp.paidBy')}><select className="input" value={edit.paidBy} onChange={(e) => setEdit({ ...edit, paidBy: e.target.value })}>{['cash', 'bank', 'card'].map((m) => <option key={m} value={m}>{t('pay.' + m)}</option>)}</select></Field>
          {edit.paidBy === 'cash' ? <Toggle label={t('exp.fromDrawer')} checked={edit.fromDrawer} onChange={(v) => setEdit({ ...edit, fromDrawer: v })} /> : null}
          <Field label={t('common.note')}><input className="input" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
        </div> : null}
      </Modal>
    </Page>
  );
}
