import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Factory, Plus, Pencil, Trash2, HandCoins, Phone } from 'lucide-react';
import { db, removeRecord, audit } from '../db/db';
import { useT } from '../i18n';
import { useAuth } from '../store/auth';
import { money, num, uid, round2, fmtDate } from '../lib/util';
import { Modal, toast, Field, SearchBox, Empty, confirmDialog } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';

export default function Suppliers() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const list = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), []) || [];
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [pay, setPay] = useState(null);
  const rows = list.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.phone || '').includes(q));
  const save = async () => { if (!edit.name.trim()) return toast.err(t('cust.nameRequired')); await db.suppliers.put(edit); toast.ok(t('common.saved')); setEdit(null); };
  const del = async (s) => {
    if (await db.purchases.where('supplierId').equals(s.id).count()) return toast.err(t('sup.hasPurchases'));
    if (await confirmDialog({ message: t('sup.deleteMsg', { name: s.name }), danger: true, okText: t('common.delete') })) { await removeRecord('suppliers', s.id); toast.ok(t('common.deleted')); }
  };
  const recordPay = async () => {
    const amt = Number(pay.amount); if (!(amt > 0)) return toast.err(t('inv.enterQty'));
    const s = await db.suppliers.get(pay.s.id);
    await db.suppliers.update(s.id, { balance: round2((s.balance || 0) - amt), payments: [...(s.payments || []), { date: Date.now(), amount: amt, method: pay.method, note: pay.note, userId: user.id }] });
    audit(user.id, 'supplier-payment', `${s.name} ${amt}`);
    toast.ok(t('common.saved')); setPay(null);
  };
  return (
    <Page>
      <PageHeader title={t('nav.suppliers')} help="suppliers" icon={<Factory size={24} />} actions={<button className="btn btn-primary" onClick={() => setEdit({ id: uid(), name: '', contact: '', phone: '', email: '', address: '', balance: 0, note: '' })}><Plus size={18} /> {t('sup.add')}</button>} />
      <div className="mb-3 max-w-md"><SearchBox value={q} onChange={setQ} placeholder={t('cust.searchPh')} /></div>
      <div className="card overflow-x-auto">
        {!rows.length ? <Empty icon={<Factory size={28} />} title={t('sup.none')} /> : (
          <table className="table">
            <thead><tr><th>{t('cust.name')}</th><th>{t('cust.phone')}</th><th>{t('cust.address')}</th><th className="text-right">{t('sup.weOwe')}</th><th /></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id}><td><b>{s.name}</b>{s.contact ? <p className="text-sm muted">{s.contact}</p> : null}</td>
                <td>{s.phone ? <a className="inline-flex items-center gap-1 font-bold text-indigo-600" href={`tel:${s.phone}`}><Phone size={14} />{s.phone}</a> : '—'}</td>
                <td>{s.address}</td>
                <td className="text-right"><span className={`badge ${s.balance > 0 ? 'badge-red' : 'badge-green'}`}>{num(s.balance || 0)}</span></td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => setPay({ s, amount: '', method: 'cash', note: '' })}><HandCoins size={16} /> {t('sup.pay')}</button>
                  <button className="icon-btn" onClick={() => setEdit({ ...s })} aria-label={t('common.edit')}><Pencil size={18} /></button>
                  <button className="icon-btn text-maroon-600" onClick={() => del(s)} aria-label={t('common.delete')}><Trash2 size={18} /></button>
                </td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('sup.edit')} icon={<Factory size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></>}>
        {edit ? <div className="grid sm:grid-cols-2 gap-3">
          {[['name', 'cust.name'], ['contact', 'sup.contact'], ['phone', 'cust.phone'], ['email', 'cust.email'], ['address', 'cust.address'], ['balance', 'sup.openingBalance']].map(([k, l]) => (
            <Field key={k} label={t(l)}><input className="input" value={edit[k] ?? ''} onChange={(e) => setEdit({ ...edit, [k]: k === 'balance' ? Number(e.target.value) || 0 : e.target.value })} /></Field>
          ))}
          <Field label={t('common.note')} className="sm:col-span-2"><textarea className="input" rows={2} value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
        </div> : null}
      </Modal>
      <Modal open={!!pay} onClose={() => setPay(null)} title={t('sup.pay')} size="sm" icon={<HandCoins size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setPay(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={recordPay}>{t('common.save')}</button></>}>
        {pay ? <div className="space-y-3">
          <p><b>{pay.s.name}</b> · {t('sup.weOwe')}: {money(pay.s.balance || 0)}</p>
          <input className="input text-2xl text-center" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder="0.00" />
          <Field label={t('exp.paidBy')}><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{['cash', 'bank', 'card'].map((m) => <option key={m} value={m}>{t('pay.' + m)}</option>)}</select></Field>
          <Field label={t('common.note')}><input className="input" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field>
          {(pay.s.payments || []).length ? <div className="text-sm"><p className="font-bold mb-1">{t('sup.history')}</p>{pay.s.payments.slice(-5).reverse().map((p, i) => <p key={i} className="muted">{fmtDate(p.date)} · {t('pay.' + p.method)} · {num(p.amount)}</p>)}</div> : null}
        </div> : null}
      </Modal>
    </Page>
  );
}
