import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Undo2, Search, Printer, ScanBarcode } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { processReturn } from '../lib/pos';
import { useBarcodeScanner } from '../lib/scanner';
import { money, num, sum, round2, fmtDateTime } from '../lib/util';
import { toast, Field, Empty, ProductIcon, askManagerPin } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { printVoucher } from '../print/templates';

const REASONS = ['size', 'defect', 'color', 'changedMind', 'other'];

export default function Returns() {
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const [params] = useSearchParams();
  const [bill, setBill] = useState(params.get('bill') || '');
  const [sale, setSale] = useState(null);
  const [lines, setLines] = useState([]);
  const [reason, setReason] = useState('size');
  const [method, setMethod] = useState('creditNote');
  const recent = useLiveQuery(() => db.returns.orderBy('date').reverse().limit(30).toArray(), []) || [];

  const load = async (code = bill) => {
    const s = await db.sales.where('billNo').equals(code.trim().toUpperCase()).first();
    if (!s) { setSale(null); return toast.err(t('ret.notFound')); }
    if (s.status === 'void') { setSale(null); return toast.err(t('ret.voided')); }
    setSale(s); setBill(s.billNo);
    setLines(s.items.map((it, index) => ({ index, qty: 0, max: round2(it.qty - (it.returnedQty || 0)), restock: true })));
  };
  useEffect(() => { if (params.get('bill')) load(params.get('bill')); }, []); // eslint-disable-line
  useBarcodeScanner((code) => { setBill(code); load(code); });

  const amount = sale ? round2(sum(lines, (l) => l.qty * sale.items[l.index].paidUnit)) : 0;
  const days = sale ? (Date.now() - sale.date) / 864e5 : 0;
  const submit = async () => {
    if (!(amount > 0)) return toast.err(t('ret.pickItems'));
    let approver = user;
    if (method === 'cash' || days > 7) {
      approver = ['admin', 'manager'].includes(user.role) ? user : await askManagerPin(days > 7 ? t('ret.lateApprove', { d: Math.floor(days) }) : t('ret.cashApprove'));
      if (!approver) return;
    }
    const { ret, voucher } = await processReturn({ sale, items: lines, refundMethod: method, reason, user, settings });
    toast.ok(t('ret.done', { no: ret.returnNo }));
    if (voucher) printVoucher(voucher, settings);
    setSale(null); setBill(''); setLines([]);
  };

  return (
    <Page>
      <PageHeader title={t('nav.returns')} subtitle={t('ret.subtitle')} help="returns" icon={<Undo2 size={24} />} />
      <div className="card p-4 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1"><ScanBarcode className="absolute left-3.5 top-1/2 -translate-y-1/2 muted" size={20} />
            <input className="input pl-11 text-lg" data-scan-target="1" value={bill} onChange={(e) => setBill(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder={t('ret.billPh')} /></div>
          <button className="btn btn-primary" onClick={() => load()}><Search size={18} /> {t('ret.find')}</button>
        </div>
      </div>
      {sale ? (
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap gap-2 mb-3"><span className="badge badge-blue">{sale.billNo}</span><span className="badge badge-blue">{fmtDateTime(sale.date)}</span>{sale.customerName ? <span className="badge badge-gold">{sale.customerName}</span> : null}{days > 7 ? <span className="badge badge-red">{t('ret.overDays', { d: Math.floor(days) })}</span> : null}</div>
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>{t('prod.product')}</th><th className="text-right">{t('ret.paidEach')}</th><th>{t('ret.returnQty')}</th><th>{t('ret.backToStock')}</th><th className="text-right">{t('ret.refund')}</th></tr></thead>
            <tbody>{lines.map((l, i) => { const it = sale.items[l.index]; const set = (k, v) => setLines(lines.map((x, j) => (j === i ? { ...x, [k]: v } : x))); return (
              <tr key={i} className={l.max <= 0 ? 'opacity-50' : ''}>
                <td><div className="flex items-center gap-2"><ProductIcon icon={it.icon} size={36} /><div><b>{t.name(it)}</b><p className="text-xs muted">{[it.size, it.color].filter(Boolean).join(' · ')} · {t('ret.canReturn')}: {l.max}</p></div></div></td>
                <td className="text-right">{num(it.paidUnit)}</td>
                <td><div className="flex items-center gap-1">
                  <button className="btn btn-ghost btn-sm" disabled={l.qty <= 0} onClick={() => set('qty', round2(Math.max(0, l.qty - (it.unit === 'pcs' ? 1 : 0.5))))}>−</button>
                  <input className="input !min-h-[2.25rem] w-16 text-center" value={l.qty} onChange={(e) => set('qty', Math.min(l.max, Math.max(0, Number(e.target.value) || 0)))} />
                  <button className="btn btn-ghost btn-sm" disabled={l.qty >= l.max} onClick={() => set('qty', round2(Math.min(l.max, l.qty + (it.unit === 'pcs' ? 1 : 0.5))))}>+</button>
                  {l.max > 0 ? <button className="btn btn-ghost btn-sm" onClick={() => set('qty', l.max)}>{t('ret.all')}</button> : null}</div></td>
                <td><input type="checkbox" className="w-5 h-5" checked={l.restock} onChange={(e) => set('restock', e.target.checked)} title={t('ret.restockHint')} /></td>
                <td className="text-right font-bold">{num(l.qty * it.paidUnit)}</td></tr>); })}</tbody>
          </table></div>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <Field label={t('ret.reason')}><select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r} value={r}>{t('ret.r.' + r)}</option>)}</select></Field>
            <Field label={t('ret.method')}><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{['creditNote', 'cash', 'card'].map((m) => <option key={m} value={m}>{t('ret.m.' + m)}</option>)}</select></Field>
            <div className="rounded-2xl p-3 bg-indigo-700 text-white"><p className="text-indigo-200 font-bold text-sm">{t('ret.refund')}</p><p className="font-display text-2xl font-bold">{money(amount)}</p></div>
          </div>
          <p className="muted text-sm mt-2">{t('ret.methodHint')}</p>
          <div className="flex gap-2 justify-end mt-3">
            <button className="btn btn-ghost" onClick={() => setSale(null)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={submit}><Undo2 size={18} /> {t('ret.process')}</button>
          </div>
        </div>
      ) : null}
      <h2 className="font-display text-xl font-bold mb-3">{t('ret.recent')}</h2>
      <div className="card overflow-x-auto">
        {!recent.length ? <Empty icon={<Undo2 size={28} />} title={t('ret.none')} /> : (
          <table className="table">
            <thead><tr><th>{t('ret.no')}</th><th>{t('sales.bill')}</th><th>{t('common.date')}</th><th>{t('ret.reason')}</th><th>{t('ret.method')}</th><th className="text-right">{t('ret.refund')}</th><th /></tr></thead>
            <tbody>{recent.map((r) => (
              <tr key={r.id}><td className="font-bold">{r.returnNo}</td><td>{r.billNo}</td><td className="text-sm">{fmtDateTime(r.date)}</td><td>{t('ret.r.' + r.reason)}</td><td>{t('ret.m.' + r.refundMethod)} {r.voucherCode ? <span className="badge badge-gold">{r.voucherCode}</span> : null}</td><td className="text-right font-bold">{num(r.amount)}</td>
                <td>{r.voucherCode ? <button className="icon-btn" onClick={async () => { const v = await db.vouchers.where('code').equals(r.voucherCode).first(); if (v) printVoucher(v, settings); }} aria-label={t('common.print')}><Printer size={18} /></button> : null}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {sale ? null : <p className="muted text-sm mt-3">{t('ret.exchangeTip')} <button className="font-bold text-indigo-600" onClick={() => nav('/app/pos')}>{t('nav.pos')}</button></p>}
    </Page>
  );
}
