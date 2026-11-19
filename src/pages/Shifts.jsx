import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Wallet, Printer, Lock, Unlock, Clock } from 'lucide-react';
import { db, audit } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { currentShift, shiftSummary } from '../lib/pos';
import { money, num, uid, fmtDateTime, round2 } from '../lib/util';
import { Modal, toast, Field, Empty } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { printShift } from '../print/templates';
import { runFolderBackup } from '../lib/autobackup';
import { downloadExcel } from '../lib/excel';
import { exportAll } from '../lib/backup';
import { downloadText, dayKey, startOfDay, endOfDay } from '../lib/util';

const NOTES = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 2, 1];

function CashCounter({ value, onChange }) {
  const t = useT();
  const [counts, setCounts] = useState({});
  const total = NOTES.reduce((s, n) => s + n * (Number(counts[n]) || 0), 0);
  useEffect(() => { onChange(total); }, [total]); // eslint-disable-line
  return (
    <div>
      <p className="font-bold mb-2">{t('shift.countNotes')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {NOTES.map((n) => (
          <label key={n} className="flex items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: 'var(--surface-2)' }}>
            <span className="w-14 font-bold text-right">{n >= 20 ? n.toLocaleString() : n}</span>
            <span className="muted">×</span>
            <input className="input !min-h-[2.25rem] !px-2 text-center" inputMode="numeric" value={counts[n] || ''} onChange={(e) => setCounts({ ...counts, [n]: e.target.value.replace(/\D/g, '') })} />
          </label>
        ))}
      </div>
      <p className="text-right mt-2 font-display text-2xl font-bold">{money(value)}</p>
    </div>
  );
}

export function ShiftOpenModal({ open, onClose }) {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const [cash, setCash] = useState('');
  const [useCounter, setUseCounter] = useState(false);
  useEffect(() => { if (open) { setCash(''); setUseCounter(false); } }, [open]);
  const openShift = async () => {
    if (await currentShift(settings.terminal.code)) { toast.err(t('shift.alreadyOpen')); return onClose(); }
    await db.shifts.add({ id: uid(), terminal: settings.terminal.code, userId: user.id, userName: user.name, openedAt: Date.now(), openingCash: round2(Number(cash) || 0), status: 'open' });
    audit(user.id, 'shift-open', cash);
    toast.ok(t('shift.opened')); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={t('shift.open')} icon={<Unlock size={20} />}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={openShift}>{t('shift.open')}</button></>}>
      <p className="muted mb-3">{t('shift.openHint')}</p>
      {useCounter ? <CashCounter value={Number(cash) || 0} onChange={(v) => setCash(String(v))} /> : (
        <Field label={t('shift.openingCash')}><input className="input text-2xl" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0.00" /></Field>
      )}
      <button className="btn btn-ghost btn-sm mt-3" onClick={() => setUseCounter(!useCounter)}>{useCounter ? t('shift.typeTotal') : t('shift.countByNotes')}</button>
    </Modal>
  );
}

export default function Shifts() {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const shift = useLiveQuery(() => currentShift(settings.terminal.code), [settings.terminal.code]);
  const history = useLiveQuery(() => db.shifts.orderBy('openedAt').reverse().limit(60).toArray(), []) || [];
  const [summary, setSummary] = useState(null);
  const [openM, setOpenM] = useState(false);
  const [closeM, setCloseM] = useState(false);
  const [counted, setCounted] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!shift) { setSummary(null); return; }
    let live = true;
    const load = () => shiftSummary(shift).then((s) => live && setSummary(s));
    load(); const id = setInterval(load, 10000);
    return () => { live = false; clearInterval(id); };
  }, [shift]);

  const closeShift = async () => {
    const s = await shiftSummary(shift);
    const closed = { ...shift, closedAt: Date.now(), closingCash: round2(counted), expectedCash: s.expected, difference: round2(counted - s.expected), summary: s, note, status: 'closed', closedBy: user.name };
    await db.shifts.put(closed);
    audit(user.id, 'shift-close', `${counted} vs ${s.expected}`);
    printShift(closed, s, settings, true);
    setCloseM(false); toast.ok(t('shift.closedOk'));
    // End of day: save the full backup and today's Excel sheet.
    const r = await runFolderBackup({ force: true });
    if (r.ok) toast.ok(t('bk.savedFolder'));
    else {
      // no backup folder on this computer: download the files instead
      const today = dayKey(Date.now());
      await downloadExcel(startOfDay(), endOfDay(), `Day ${today}`, `redipos-${today}.xlsx`);
      downloadText(`redipos-backup-${today}.json`, JSON.stringify(await exportAll()), 'application/json');
      toast.info(t('bk.downloaded'));
    }
  };

  return (
    <Page>
      <PageHeader title={t('nav.shifts')} subtitle={settings.terminal.name} help="shifts" icon={<Wallet size={24} />} />
      {!shift ? (
        <div className="card p-6 text-center">
          <Lock size={40} className="mx-auto text-indigo-600 mb-3" />
          <p className="font-display text-xl font-bold">{t('shift.noneOpen')}</p>
          <p className="muted mb-4">{t('shift.openHint')}</p>
          <button className="btn btn-primary btn-lg" onClick={() => setOpenM(true)}><Unlock /> {t('shift.open')}</button>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="badge badge-green text-sm"><Clock size={14} /> {t('shift.openSince')} {fmtDateTime(shift.openedAt)}</span>
            <span className="muted">{shift.userName}</span>
            <div className="flex-1" />
            <button className="btn btn-outline" onClick={() => summary && printShift(shift, summary, settings, false)}><Printer size={18} /> {t('shift.printX')}</button>
            <button className="btn btn-danger" onClick={() => { setCounted(0); setNote(''); setCloseM(true); }}><Lock size={18} /> {t('shift.close')}</button>
          </div>
          {summary ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[['shift.bills', summary.bills], ['shift.grossSales', money(summary.gross)], ['shift.openingCash', money(shift.openingCash)], ['shift.expected', money(summary.expected)]].map(([k, v]) => (
                <div key={k} className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}><p className="muted font-bold text-sm">{t(k)}</p><p className="font-display text-2xl font-bold">{v}</p></div>
              ))}
              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2">
                {Object.entries(summary.byMethod).map(([m, v]) => <span key={m} className="badge badge-blue text-sm">{t('pay.' + m)}: {num(v)}</span>)}
                {summary.cashRefunds ? <span className="badge badge-red text-sm">{t('shift.cashRefunds')}: {num(summary.cashRefunds)}</span> : null}
                {summary.cashExpenses ? <span className="badge badge-red text-sm">{t('shift.cashExpenses')}: {num(summary.cashExpenses)}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <h2 className="font-display text-xl font-bold mt-8 mb-3">{t('shift.history')}</h2>
      <div className="card overflow-x-auto">
        {!history.length ? <Empty icon={<Clock size={28} />} title={t('shift.noHistory')} /> : (
          <table className="table">
            <thead><tr><th>{t('shift.opened')}</th><th>{t('shift.closed')}</th><th>{t('shift.cashier')}</th><th className="text-right">{t('shift.expected')}</th><th className="text-right">{t('shift.counted')}</th><th className="text-right">{t('shift.difference')}</th><th /></tr></thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDateTime(s.openedAt)}</td>
                  <td>{s.closedAt ? fmtDateTime(s.closedAt) : <span className="badge badge-green">{t('shift.openNow')}</span>}</td>
                  <td>{s.userName}</td>
                  <td className="text-right">{s.expectedCash != null ? num(s.expectedCash) : '—'}</td>
                  <td className="text-right">{s.closingCash != null ? num(s.closingCash) : '—'}</td>
                  <td className={`text-right font-bold ${s.difference < 0 ? 'text-maroon-600' : s.difference > 0 ? 'text-leaf-600' : ''}`}>{s.difference != null ? num(s.difference) : '—'}</td>
                  <td>{s.summary ? <button className="icon-btn" onClick={() => printShift(s, s.summary, settings, true)} aria-label={t('common.print')}><Printer size={18} /></button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ShiftOpenModal open={openM} onClose={() => setOpenM(false)} />
      <Modal open={closeM} onClose={() => setCloseM(false)} title={t('shift.close')} size="lg" icon={<Lock size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setCloseM(false)}>{t('common.cancel')}</button><button className="btn btn-danger" onClick={closeShift}>{t('shift.closeAndPrint')}</button></>}>
        <CashCounter value={counted} onChange={setCounted} />
        {summary ? (
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}><p className="muted text-sm font-bold">{t('shift.expected')}</p><p className="font-bold text-lg">{num(summary.expected)}</p></div>
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}><p className="muted text-sm font-bold">{t('shift.counted')}</p><p className="font-bold text-lg">{num(counted)}</p></div>
            <div className={`rounded-xl p-3 ${counted - summary.expected < 0 ? 'bg-maroon-50 text-maroon-600' : 'bg-leaf-50 text-leaf-700'}`}><p className="text-sm font-bold">{t('shift.difference')}</p><p className="font-bold text-lg">{num(counted - summary.expected)}</p></div>
          </div>
        ) : null}
        <Field label={t('common.note')} className="mt-3"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </Page>
  );
}
