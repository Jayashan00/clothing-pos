import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BadgePercent, Plus, Pencil, Trash2, Ticket, Printer } from 'lucide-react';
import { db, removeRecord, nextSeq, audit } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { currentShift } from '../lib/pos';
import { money, num, uid, pad, fmtDate, toInputDate, startOfDay, endOfDay } from '../lib/util';
import { Modal, toast, Field, Empty, Tabs, Toggle, confirmDialog } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { printVoucher } from '../print/templates';
import { ClothingIcon } from '../icons/clothing';

export default function Promotions() {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('promos');
  const promos = useLiveQuery(() => db.promotions.toArray(), []) || [];
  const vouchers = useLiveQuery(() => db.vouchers.orderBy('updatedAt').reverse().toArray(), []) || [];
  const cats = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const [edit, setEdit] = useState(null);
  const [gv, setGv] = useState(null);
  const now = Date.now();
  const state = (p) => (!p.active ? 'off' : p.startDate > now ? 'upcoming' : p.endDate && p.endDate < now ? 'ended' : 'running');

  const save = async () => {
    if (!edit.name.trim() || !(Number(edit.value) > 0)) return toast.err(t('promo.fill'));
    await db.promotions.put({ ...edit, value: Number(edit.value), startDate: startOfDay(new Date(edit._from)), endDate: endOfDay(new Date(edit._to)), _from: undefined, _to: undefined });
    toast.ok(t('common.saved')); setEdit(null);
  };
  const issue = async () => {
    const amt = Number(gv.amount); if (!(amt > 0)) return toast.err(t('inv.enterQty'));
    const shift = await currentShift(settings.terminal.code);
    const v = { id: uid(), code: 'GV' + pad(await nextSeq('voucher'), 7), type: 'gift', amount: amt, balance: amt, status: 'active', issuedAt: Date.now(), expiresAt: Date.now() + Number(gv.months) * 30 * 864e5, buyer: gv.buyer, paidMethod: gv.method, terminal: settings.terminal.code, shiftId: shift?.id || null, ref: gv.buyer ? `For ${gv.buyer}` : '' };
    await db.vouchers.add(v); audit(user.id, 'voucher-issue', `${v.code} ${amt}`);
    printVoucher(v, settings); toast.ok(t('promo.issued', { code: v.code })); setGv(null);
  };

  return (
    <Page>
      <PageHeader title={t('nav.promotions')} help="promotions" icon={<BadgePercent size={24} />}
        actions={tab === 'promos'
          ? <button className="btn btn-primary" onClick={() => setEdit({ id: uid(), name: '', nameSi: '', type: 'percent', value: 10, scope: 'category', targetIds: [], active: true, _from: toInputDate(now), _to: toInputDate(now + 14 * 864e5) })}><Plus size={18} /> {t('promo.add')}</button>
          : <button className="btn btn-primary" onClick={() => setGv({ amount: '2500', months: 6, buyer: '', method: 'cash' })}><Ticket size={18} /> {t('promo.issueGift')}</button>} />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'promos', label: t('promo.tab') }, { id: 'vouchers', label: t('promo.vouchers') }]} /></div>
      {tab === 'promos' ? (
        <div className="grid md:grid-cols-2 gap-3">
          {!promos.length ? <div className="card md:col-span-2"><Empty icon={<BadgePercent size={28} />} title={t('promo.none')} text={t('promo.noneText')} /></div> : promos.map((p) => {
            const st = state(p);
            return (
              <div key={p.id} className="card p-4 flex gap-4 items-start">
                <div className="w-16 h-16 rounded-2xl bg-saffron-500 text-ink grid place-items-center font-display font-extrabold text-xl shrink-0">{p.type === 'percent' ? `${p.value}%` : `−${p.value}`}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{t.lang === 'si' && p.nameSi ? p.nameSi : p.name}</p>
                  <p className="text-sm muted">{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className={`badge ${st === 'running' ? 'badge-green' : st === 'upcoming' ? 'badge-blue' : 'badge-red'}`}>{t('promo.' + st)}</span>
                    {p.scope === 'all' ? <span className="badge badge-gold">{t('promo.allItems')}</span> : (p.targetIds || []).slice(0, 4).map((id) => { const c = cats.find((x) => x.id === id) || products.find((x) => x.id === id); return c ? <span key={id} className="badge badge-gold">{t.name(c)}</span> : null; })}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setEdit({ ...p, _from: toInputDate(p.startDate), _to: toInputDate(p.endDate) })} aria-label={t('common.edit')}><Pencil size={18} /></button>
                <button className="icon-btn text-maroon-600" onClick={async () => { if (await confirmDialog({ message: t('promo.deleteMsg'), danger: true, okText: t('common.delete') })) removeRecord('promotions', p.id); }} aria-label={t('common.delete')}><Trash2 size={18} /></button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          {!vouchers.length ? <Empty icon={<Ticket size={28} />} title={t('promo.noVouchers')} /> : (
            <table className="table">
              <thead><tr><th>{t('promo.code')}</th><th>{t('promo.kind')}</th><th className="text-right">{t('promo.amount')}</th><th className="text-right">{t('promo.balance')}</th><th>{t('voucher.expires')}</th><th>{t('common.status')}</th><th /></tr></thead>
              <tbody>{vouchers.map((v) => (
                <tr key={v.id}><td className="font-mono font-bold">{v.code}</td><td>{t(v.type === 'creditNote' ? 'voucher.creditNote' : 'voucher.gift')}</td><td className="text-right">{num(v.amount)}</td><td className="text-right font-bold">{num(v.balance)}</td>
                  <td className="text-sm">{v.expiresAt ? fmtDate(v.expiresAt) : '—'}</td>
                  <td><span className={`badge ${v.status === 'active' && (!v.expiresAt || v.expiresAt > now) ? 'badge-green' : 'badge-red'}`}>{v.status === 'active' && v.expiresAt && v.expiresAt < now ? t('promo.expired') : t('promo.v.' + v.status)}</span></td>
                  <td><button className="icon-btn" onClick={() => printVoucher(v, settings)} aria-label={t('common.print')}><Printer size={18} /></button></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('promo.edit')} icon={<BadgePercent size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></>}>
        {edit ? (<div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('promo.nameEn')}><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Avurudu sale 15% off" /></Field>
            <Field label={t('promo.nameSi')}><input className="input" value={edit.nameSi} onChange={(e) => setEdit({ ...edit, nameSi: e.target.value })} placeholder="අවුරුදු වට්ටම් 15%" /></Field>
            <Field label={t('promo.type')}><select className="input" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}><option value="percent">{t('promo.percent')}</option><option value="amount">{t('promo.amountOff')}</option></select></Field>
            <Field label={t('promo.value')}><input className="input" inputMode="decimal" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></Field>
            <Field label={t('promo.from')}><input type="date" className="input" value={edit._from} onChange={(e) => setEdit({ ...edit, _from: e.target.value })} /></Field>
            <Field label={t('promo.to')}><input type="date" className="input" value={edit._to} onChange={(e) => setEdit({ ...edit, _to: e.target.value })} /></Field>
          </div>
          <Field label={t('promo.appliesTo')}><select className="input" value={edit.scope} onChange={(e) => setEdit({ ...edit, scope: e.target.value, targetIds: [] })}><option value="all">{t('promo.allItems')}</option><option value="category">{t('promo.categories')}</option><option value="product">{t('promo.products')}</option></select></Field>
          {edit.scope !== 'all' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto scroll-thin">
              {(edit.scope === 'category' ? cats : products).map((x) => { const on = edit.targetIds.includes(x.id); return (
                <button key={x.id} onClick={() => setEdit({ ...edit, targetIds: on ? edit.targetIds.filter((i) => i !== x.id) : [...edit.targetIds, x.id] })} className={`flex items-center gap-2 rounded-xl border-2 p-2 text-left text-sm font-bold ${on ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-800' : 'line'}`}>
                  <ClothingIcon id={x.icon} size={20} /> <span className="truncate">{t.name(x)}</span></button>); })}
            </div>
          ) : null}
          <Toggle label={t('promo.active')} checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
        </div>) : null}
      </Modal>
      <Modal open={!!gv} onClose={() => setGv(null)} title={t('promo.issueGift')} size="sm" icon={<Ticket size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setGv(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={issue}><Printer size={18} /> {t('promo.issuePrint')}</button></>}>
        {gv ? <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">{[1000, 2500, 5000, 10000].map((n) => <button key={n} className={`btn btn-sm ${Number(gv.amount) === n ? 'btn-primary' : 'btn-outline'}`} onClick={() => setGv({ ...gv, amount: String(n) })}>{n.toLocaleString()}</button>)}</div>
          <input className="input text-2xl text-center" inputMode="decimal" value={gv.amount} onChange={(e) => setGv({ ...gv, amount: e.target.value })} />
          <Field label={t('promo.validMonths')}><select className="input" value={gv.months} onChange={(e) => setGv({ ...gv, months: e.target.value })}>{[3, 6, 12].map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
          <Field label={t('promo.buyer')}><input className="input" value={gv.buyer} onChange={(e) => setGv({ ...gv, buyer: e.target.value })} /></Field>
          <Field label={t('promo.paidWith')}><select className="input" value={gv.method} onChange={(e) => setGv({ ...gv, method: e.target.value })}>{['cash', 'card', 'qr', 'bank'].map((m) => <option key={m} value={m}>{t('pay.' + m)}</option>)}</select></Field>
          <p className="text-sm muted">{money(Number(gv.amount) || 0)}</p>
        </div> : null}
      </Modal>
    </Page>
  );
}
