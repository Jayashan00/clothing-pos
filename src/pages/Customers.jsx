import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, Plus, Pencil, Trash2, HandCoins, Cake, Eye, Download } from 'lucide-react';
import { db, removeRecord, audit } from '../db/db';
import { useT } from '../i18n';
import { useAuth, can } from '../store/auth';
import { money, num, uid, round2, fmtDate, fmtDateTime, toCSV, downloadText } from '../lib/util';
import { Modal, toast, Field, SearchBox, Empty, confirmDialog, Tabs } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';

export default function Customers() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const list = useLiveQuery(() => db.customers.toArray(), []) || [];
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const [pay, setPay] = useState(null);
  const month = new Date().getMonth() + 1;
  const isBday = (c) => c.birthday && Number(c.birthday.slice(5, 7)) === month;
  const rows = useMemo(() => list.filter((c) => (!q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone || '').includes(q))
    && (filter === 'all' || (filter === 'credit' && c.creditBalance > 0) || (filter === 'bday' && isBday(c)) || (filter === 'top' && c.totalSpent > 0)))
    .sort((a, b) => (filter === 'top' ? b.totalSpent - a.totalSpent : a.name.localeCompare(b.name))), [list, q, filter]); // eslint-disable-line
  const history = useLiveQuery(() => (view ? db.sales.where('customerId').equals(view.id).reverse().sortBy('date') : []), [view]) || [];

  const save = async () => {
    if (!edit.name.trim()) return toast.err(t('cust.nameRequired'));
    const dup = edit.phone && (await db.customers.where('phone').equals(edit.phone.trim()).first());
    if (dup && dup.id !== edit.id) return toast.err(t('cust.phoneExists'));
    await db.customers.put({ ...edit, name: edit.name.trim(), phone: (edit.phone || '').trim() }); toast.ok(t('common.saved')); setEdit(null);
  };
  const del = async (c) => {
    if (await db.sales.where('customerId').equals(c.id).count()) return toast.err(t('cust.hasSales'));
    if (await confirmDialog({ message: t('cust.deleteMsg', { name: c.name }), danger: true, okText: t('common.delete') })) { await removeRecord('customers', c.id); toast.ok(t('common.deleted')); }
  };
  const settle = async () => {
    const amt = Number(pay.amount); if (!(amt > 0)) return toast.err(t('inv.enterQty'));
    const c = await db.customers.get(pay.c.id);
    await db.customers.update(c.id, { creditBalance: Math.max(0, round2((c.creditBalance || 0) - amt)), payments: [...(c.payments || []), { date: Date.now(), amount: amt, method: pay.method, userId: user.id }] });
    audit(user.id, 'credit-settle', `${c.name} ${amt}`); toast.ok(t('common.saved')); setPay(null);
  };
  const exportCSV = () => downloadText('customers.csv', toCSV(list, [{ label: 'Name', value: 'name' }, { label: 'Phone', value: 'phone' }, { label: 'Email', value: 'email' }, { label: 'Address', value: 'address' }, { label: 'Birthday', value: 'birthday' }, { label: 'Points', value: 'points' }, { label: 'Credit owed', value: 'creditBalance' }, { label: 'Total spent', value: 'totalSpent' }, { label: 'Visits', value: 'visits' }]), 'text/csv');

  return (
    <Page>
      <PageHeader title={t('nav.customers')} subtitle={t('cust.count', { n: list.length })} help="customers" icon={<Users size={24} />}
        actions={<>{can(user, 'reports') ? <button className="btn btn-outline" onClick={exportCSV}><Download size={18} /> {t('common.export')}</button> : null}
          <button className="btn btn-primary" onClick={() => setEdit({ id: uid(), name: '', phone: '', email: '', address: '', nic: '', birthday: '', points: 0, creditBalance: 0, totalSpent: 0, visits: 0, createdAt: Date.now(), note: '' })}><Plus size={18} /> {t('cust.add')}</button></>} />
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[16rem]"><SearchBox value={q} onChange={setQ} placeholder={t('cust.searchPh')} /></div>
        <Tabs value={filter} onChange={setFilter} tabs={[{ id: 'all', label: t('pos.all') }, { id: 'top', label: t('cust.top') }, { id: 'credit', label: t('cust.withCredit') }, { id: 'bday', label: t('cust.birthdays') }]} />
      </div>
      <div className="card overflow-x-auto">
        {!rows.length ? <Empty icon={<Users size={28} />} title={t('cust.none')} /> : (
          <table className="table">
            <thead><tr><th>{t('cust.name')}</th><th>{t('cust.phone')}</th><th className="text-right">{t('cust.points')}</th><th className="text-right">{t('cust.owes')}</th><th className="text-right">{t('cust.spent')}</th><th>{t('cust.lastVisit')}</th><th /></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id}>
                <td><b>{c.name}</b> {isBday(c) ? <Cake size={16} className="inline text-saffron-600" /> : null}</td>
                <td>{c.phone}</td>
                <td className="text-right"><span className="badge badge-gold">★ {c.points || 0}</span></td>
                <td className="text-right">{c.creditBalance > 0 ? <span className="badge badge-red">{num(c.creditBalance)}</span> : '—'}</td>
                <td className="text-right">{num(c.totalSpent || 0)}</td>
                <td className="text-sm">{c.lastVisit ? fmtDate(c.lastVisit) : '—'}</td>
                <td className="text-right whitespace-nowrap">
                  {c.creditBalance > 0 ? <button className="btn btn-ghost btn-sm" onClick={() => setPay({ c, amount: String(c.creditBalance), method: 'cash' })}><HandCoins size={16} /> {t('cust.settle')}</button> : null}
                  <button className="icon-btn" onClick={() => setView(c)} aria-label={t('common.view')}><Eye size={18} /></button>
                  <button className="icon-btn" onClick={() => setEdit({ ...c })} aria-label={t('common.edit')}><Pencil size={18} /></button>
                  <button className="icon-btn text-maroon-600" onClick={() => del(c)} aria-label={t('common.delete')}><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('cust.edit')} icon={<Users size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></>}>
        {edit ? <div className="grid sm:grid-cols-2 gap-3">
          {[['name', 'cust.name'], ['phone', 'cust.phone'], ['email', 'cust.email'], ['nic', 'cust.nic'], ['address', 'cust.address']].map(([k, l]) => <Field key={k} label={t(l)}><input className="input" value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>)}
          <Field label={t('cust.birthday')}><input type="date" className="input" value={edit.birthday || ''} onChange={(e) => setEdit({ ...edit, birthday: e.target.value })} /></Field>
          <Field label={t('common.note')} className="sm:col-span-2"><textarea className="input" rows={2} value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
        </div> : null}
      </Modal>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name} size="lg" icon={<Users size={20} />}>
        {view ? (<div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[['cust.points', `★ ${view.points || 0}`], ['cust.owes', num(view.creditBalance || 0)], ['cust.spent', num(view.totalSpent || 0)], ['cust.visits', view.visits || 0]].map(([k, v]) => <div key={k} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}><p className="text-sm muted font-bold">{t(k)}</p><p className="font-bold text-lg">{v}</p></div>)}
          </div>
          <p className="font-bold mb-2">{t('cust.history')}</p>
          {!history.length ? <p className="muted">{t('cust.noHistory')}</p> : (
            <table className="table text-sm"><tbody>{history.map((s) => <tr key={s.id}><td className="font-bold">{s.billNo}</td><td>{fmtDateTime(s.date)}</td><td className="truncate max-w-[14rem]">{s.items.map((i) => t.name(i)).join(', ')}</td><td className="text-right font-bold">{num(s.total)}</td></tr>)}</tbody></table>
          )}
        </div>) : null}
      </Modal>
      <Modal open={!!pay} onClose={() => setPay(null)} title={t('cust.settle')} size="sm" icon={<HandCoins size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setPay(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={settle}>{t('common.save')}</button></>}>
        {pay ? <div className="space-y-3"><p><b>{pay.c.name}</b> · {t('cust.owes')}: {money(pay.c.creditBalance)}</p>
          <input className="input text-2xl text-center" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          <select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{['cash', 'card', 'qr', 'bank'].map((m) => <option key={m} value={m}>{t('pay.' + m)}</option>)}</select></div> : null}
      </Modal>
    </Page>
  );
}
