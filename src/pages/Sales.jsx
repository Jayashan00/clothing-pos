import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ReceiptText, Printer, Undo2, Ban, Download, Eye } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth, can } from '../store/auth';
import { voidSale } from '../lib/pos';
import { useBarcodeScanner } from '../lib/scanner';
import { money, num, sum, startOfDay, endOfDay, fmtDateTime, toInputDate, toCSV, downloadText, qtyFmt } from '../lib/util';
import { Modal, toast, SearchBox, Empty, Tabs, askManagerPin, ProductIcon } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { printReceipt } from '../print/templates';

export function useRange(initial = 'today') {
  const [preset, setPreset] = useState(initial);
  const [from, setFrom] = useState(toInputDate(Date.now()));
  const [to, setTo] = useState(toInputDate(Date.now()));
  const range = useMemo(() => {
    const now = Date.now();
    if (preset === 'today') return [startOfDay(), endOfDay()];
    if (preset === 'yesterday') return [startOfDay(now - 864e5), endOfDay(now - 864e5)];
    if (preset === '7') return [startOfDay(now - 6 * 864e5), endOfDay()];
    if (preset === '30') return [startOfDay(now - 29 * 864e5), endOfDay()];
    if (preset === 'month') { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), endOfDay()]; }
    return [startOfDay(new Date(from)), endOfDay(new Date(to))];
  }, [preset, from, to]);
  return { preset, setPreset, from, setFrom, to, setTo, range };
}

export function RangePicker({ r }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={r.preset} onChange={r.setPreset} tabs={['today', 'yesterday', '7', '30', 'month', 'custom'].map((k) => ({ id: k, label: t('range.' + k) }))} />
      {r.preset === 'custom' ? <><input type="date" className="input !w-auto" value={r.from} onChange={(e) => r.setFrom(e.target.value)} /><input type="date" className="input !w-auto" value={r.to} onChange={(e) => r.setTo(e.target.value)} /></> : null}
    </div>
  );
}

export function SaleDetail({ sale, onClose }) {
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  if (!sale) return null;
  const doVoid = async () => {
    if (sale.status !== 'completed') return;
    const approver = can(user, 'void') ? user : await askManagerPin(t('sales.voidApprove'));
    if (!approver) return;
    const reason = window.prompt(t('sales.voidReason')) || '';
    await voidSale(sale, approver, reason); toast.ok(t('sales.voided')); onClose();
  };
  return (
    <Modal open onClose={onClose} title={`${t('sales.bill')} ${sale.billNo}`} size="lg" icon={<ReceiptText size={20} />}
      footer={<>
        {sale.status === 'completed' && Date.now() - sale.date < 864e5 ? <button className="btn btn-danger mr-auto" onClick={doVoid}><Ban size={18} /> {t('sales.void')}</button> : null}
        {sale.status !== 'void' && sale.status !== 'returned' && can(user, 'returns') ? <button className="btn btn-outline" onClick={() => nav(`/app/returns?bill=${sale.billNo}`)}><Undo2 size={18} /> {t('sales.return')}</button> : null}
        <button className="btn btn-primary" onClick={() => printReceipt(sale, settings, { reprint: true })}><Printer size={18} /> {t('sales.reprint')}</button>
      </>}>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`badge ${sale.status === 'completed' ? 'badge-green' : sale.status === 'void' ? 'badge-red' : 'badge-gold'}`}>{t('status.' + sale.status)}</span>
        <span className="badge badge-blue">{fmtDateTime(sale.date)}</span>
        <span className="badge badge-blue">{sale.cashierName}</span>
        {sale.customerName ? <span className="badge badge-gold">{sale.customerName} {sale.customerPhone}</span> : null}
      </div>
      <table className="table">
        <tbody>{sale.items.map((it, i) => (
          <tr key={i}><td><div className="flex items-center gap-2"><ProductIcon icon={it.icon} size={34} /><div><b>{t.name(it)}</b><p className="text-xs muted">{[it.size, it.color].filter(Boolean).join(' · ')}{it.returnedQty ? ` · ${t('sales.returnedQty')}: ${it.returnedQty}` : ''}</p></div></div></td>
            <td className="text-right whitespace-nowrap">{qtyFmt(it.qty, it.unit)} × {num(it.price)}</td>
            <td className="text-right">{it.discount ? <span className="text-leaf-600">−{num(it.discount)}</span> : ''}</td>
            <td className="text-right font-bold">{num(it.net)}</td></tr>
        ))}</tbody>
      </table>
      <div className="mt-3 ml-auto max-w-xs space-y-1">
        <div className="flex justify-between"><span>{t('pos.subtotal')}</span><span>{num(sale.subtotal)}</span></div>
        {sale.itemDiscount + sale.billDiscount > 0 ? <div className="flex justify-between text-leaf-600"><span>{t('pos.discount')}</span><span>−{num(sale.itemDiscount + sale.billDiscount)}</span></div> : null}
        {sale.tax > 0 ? <div className="flex justify-between"><span>{settings.tax.label}</span><span>{num(sale.tax)}</span></div> : null}
        <div className="flex justify-between font-display text-xl font-bold"><span>{t('pos.total')}</span><span>{money(sale.total)}</span></div>
        {sale.payments.map((p, i) => <div key={i} className="flex justify-between muted"><span>{t('pay.' + p.method)} {p.ref}</span><span>{num(p.amount)}</span></div>)}
        {sale.change ? <div className="flex justify-between"><span>{t('pay.change')}</span><span>{num(sale.change)}</span></div> : null}
        {sale.voidReason ? <p className="text-maroon-600 text-sm">{t('sales.voidReason')}: {sale.voidReason} ({sale.voidBy})</p> : null}
      </div>
    </Modal>
  );
}

export default function Sales() {
  const t = useT();
  const r = useRange('today');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState(null);
  const sales = useLiveQuery(() => db.sales.where('date').between(r.range[0], r.range[1], true, true).reverse().sortBy('date'), [r.range[0], r.range[1]]) || [];
  useBarcodeScanner(async (code) => { const s = await db.sales.where('billNo').equals(code.toUpperCase()).first(); if (s) setView(s); else toast.err(t('pos.notFound', { code })); });
  const rows = useMemo(() => sales.filter((s) => (status === 'all' || s.status === status) && (!q || s.billNo.toLowerCase().includes(q.toLowerCase()) || (s.customerName || '').toLowerCase().includes(q.toLowerCase()) || (s.customerPhone || '').includes(q))), [sales, q, status]);
  const valid = rows.filter((s) => s.status !== 'void');
  const exportCSV = () => downloadText('sales.csv', toCSV(rows, [{ label: 'Bill', value: 'billNo' }, { label: 'Date', value: (s) => fmtDateTime(s.date) }, { label: 'Customer', value: 'customerName' }, { label: 'Cashier', value: 'cashierName' }, { label: 'Items', value: (s) => s.items.length }, { label: 'Discount', value: (s) => s.itemDiscount + s.billDiscount }, { label: 'Total', value: 'total' }, { label: 'Payment', value: (s) => s.payments.map((p) => p.method).join('+') }, { label: 'Status', value: 'status' }]), 'text/csv');
  return (
    <Page>
      <PageHeader title={t('nav.sales')} help="sales" icon={<ReceiptText size={24} />} actions={<button className="btn btn-outline" onClick={exportCSV}><Download size={18} /> {t('common.export')}</button>} />
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <RangePicker r={r} />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[16rem]"><SearchBox value={q} onChange={setQ} placeholder={t('sales.searchPh')} scanTarget /></div>
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>{['all', 'completed', 'partial', 'returned', 'void'].map((s) => <option key={s} value={s}>{s === 'all' ? t('pos.all') : t('status.' + s)}</option>)}</select>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="badge badge-blue text-sm">{t('dash.bills')}: {valid.length}</span>
        <span className="badge badge-green text-sm">{t('pos.total')}: {money(sum(valid, (s) => s.total))}</span>
        <span className="badge badge-gold text-sm">{t('pos.discount')}: {num(sum(valid, (s) => s.itemDiscount + s.billDiscount))}</span>
      </div>
      <div className="card overflow-x-auto">
        {!rows.length ? <Empty icon={<ReceiptText size={28} />} title={t('sales.none')} /> : (
          <table className="table">
            <thead><tr><th>{t('sales.bill')}</th><th>{t('common.date')}</th><th>{t('pos.customer')}</th><th>{t('shift.cashier')}</th><th>{t('sales.payment')}</th><th className="text-right">{t('pos.total')}</th><th /></tr></thead>
            <tbody>{rows.slice(0, 500).map((s) => (
              <tr key={s.id} className="cursor-pointer" onClick={() => setView(s)}>
                <td className="font-bold">{s.billNo} {s.status !== 'completed' ? <span className={`badge ${s.status === 'void' ? 'badge-red' : 'badge-gold'}`}>{t('status.' + s.status)}</span> : null}</td>
                <td className="text-sm whitespace-nowrap">{fmtDateTime(s.date)}</td>
                <td>{s.customerName || <span className="muted">{t('pos.walkIn')}</span>}</td>
                <td className="text-sm">{s.cashierName}</td>
                <td className="text-sm">{s.payments.map((p) => t('pay.' + p.method)).join(' + ')}</td>
                <td className={`text-right font-bold ${s.status === 'void' ? 'line-through muted' : ''}`}>{num(s.total)}</td>
                <td><Eye size={18} className="muted" /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <SaleDetail sale={view} onClose={() => setView(null)} />
    </Page>
  );
}
