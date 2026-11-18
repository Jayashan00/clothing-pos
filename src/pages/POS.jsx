import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Camera, Minus, Plus, Trash2, UserPlus, User, Percent, ListRestart, Banknote, CreditCard, QrCode, Landmark,
  HandCoins, Ticket, Star, Printer, CheckCircle2, X, ScanBarcode, Wallet, ShoppingBag, CirclePause as PauseCircle,
} from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth, can } from '../store/auth';
import { useCart } from '../store/cart';
import { computeTotals, completeSale, currentShift, PAYMENT_METHODS } from '../lib/pos';
import { useBarcodeScanner, beep } from '../lib/scanner';
import { money, num, uid, round2, qtyFmt, sum } from '../lib/util';
import { Modal, toast, ProductIcon, SearchBox, Field, askManagerPin, confirmDialog, Empty } from '../components/ui';
import { HelpButton, useHelp } from '../components/Help';
import CameraScanner from '../components/CameraScanner';
import { printReceipt } from '../print/templates';
import { ClothingIcon } from '../icons/clothing';
import { ShiftOpenModal } from './Shifts';

const PAY_ICONS = { cash: Banknote, card: CreditCard, qr: QrCode, bank: Landmark, credit: HandCoins, voucher: Ticket, points: Star };

export default function POS() {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const cart = useCart();
  const setHelp = useHelp((s) => s.set);
  useEffect(() => { setHelp({ page: 'pos' }); }, [setHelp]);

  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const promotions = useLiveQuery(() => db.promotions.toArray(), []) || [];
  const heldCount = useLiveQuery(() => db.held.count(), []) || 0;
  const shift = useLiveQuery(() => currentShift(settings.terminal.code), [settings.terminal.code]);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [variantFor, setVariantFor] = useState(null);
  const [qtyFor, setQtyFor] = useState(null);
  const [editLine, setEditLine] = useState(null);
  const [custOpen, setCustOpen] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [done, setDone] = useState(null);
  const [flash, setFlash] = useState(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [mobileCart, setMobileCart] = useState(false);
  const searchRef = useRef(null);

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const varsByProduct = useMemo(() => {
    const m = {}; variants.forEach((v) => { (m[v.productId] ||= []).push(v); }); return m;
  }, [variants]);
  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const totals = useMemo(() => computeTotals(cart, settings, promotions), [cart, settings, promotions]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => p.active !== false && (cat === 'all' || p.categoryId === cat) && (!s
      || p.nameEn.toLowerCase().includes(s) || (p.nameSi || '').includes(q.trim()) || (p.brand || '').toLowerCase().includes(s)
      || (varsByProduct[p.id] || []).some((v) => v.barcode === s || (v.sku || '').toLowerCase() === s)))
      .sort((a, b) => ((catMap[a.categoryId]?.sort ?? 99) - (catMap[b.categoryId]?.sort ?? 99)) || t.name(a).localeCompare(t.name(b)));
  }, [products, q, cat, varsByProduct, catMap, t]);

  const addToCart = useCallback(async (v, p, qty = 1) => {
    const inCart = sum(useCart.getState().lines.filter((l) => l.variantId === v.id), (l) => l.qty);
    if ((Number(v.stock) || 0) < inCart + qty) {
      if (!settings.stock.allowNegative) {
        const ok = await askManagerPin(t('pos.noStockApprove', { name: t.name(p) }));
        if (!ok) return;
      } else toast.info(t('pos.lowStockWarn'));
    }
    useCart.getState().addVariant(v, p, qty);
    setFlash(v.id);
    setTimeout(() => setFlash(null), 600);
  }, [settings.stock.allowNegative, t]);

  const chooseProduct = (p) => {
    const vs = varsByProduct[p.id] || [];
    if (!vs.length) return toast.err(t('pos.noVariants'));
    if (vs.length === 1) {
      if (p.unit !== 'pcs') setQtyFor({ v: vs[0], p });
      else addToCart(vs[0], p);
    } else setVariantFor(p);
  };

  const handleCode = useCallback(async (code) => {
    const v = await db.variants.where('barcode').equals(code).first();
    if (v) {
      const p = await db.products.get(v.productId);
      if (settings.sound) beep(true);
      if (p.unit !== 'pcs') setQtyFor({ v, p }); else addToCart(v, p);
      setQ('');
      return true;
    }
    if (settings.sound) beep(false);
    toast.err(t('pos.notFound', { code }));
    return false;
  }, [addToCart, settings.sound, t]);

  useBarcodeScanner(handleCode, { enabled: !payOpen && !variantFor && !qtyFor && !editLine && !custOpen });

  const canPay = cart.lines.length > 0;
  const holdBill = async () => {
    if (!cart.lines.length) return;
    await db.held.put({ id: cart.heldId || uid(), date: Date.now(), userName: user.name, snapshot: { lines: cart.lines, customer: cart.customer, billDiscount: cart.billDiscount, note: cart.note }, total: totals.total, count: cart.lines.length });
    cart.clear();
    toast.ok(t('pos.held'));
  };
  const clearBill = async () => {
    if (!cart.lines.length) return;
    if (await confirmDialog({ title: t('pos.clearTitle'), message: t('pos.clearMsg'), danger: true, okText: t('pos.clear') })) cart.clear();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (payOpen || done) return;
      const map = { F2: () => searchRef.current?.focus(), F4: () => canPay && setPayOpen(true), F12: () => canPay && setPayOpen(true), F6: () => setCustOpen(true), F7: holdBill, F8: () => setHeldOpen(true), F10: () => setDiscOpen(true) };
      if (map[e.key]) { e.preventDefault(); map[e.key](); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onSearchKey = async (e) => {
    if (e.key !== 'Enter') return;
    const s = q.trim(); if (!s) return;
    const ok = await handleCode(s).catch(() => false);
    if (!ok && filtered.length === 1) { chooseProduct(filtered[0]); setQ(''); }
  };

  const finish = async (payments, print) => {
    try {
      const sale = await completeSale({ cart, totals, payments, user, settings });
      cart.clear();
      setPayOpen(false);
      setDone(sale);
      if (print) printReceipt(sale, settings);
    } catch (e) { toast.err(String(e.message || e)); }
  };

  const priceRange = (p) => {
    const vs = varsByProduct[p.id] || []; if (!vs.length) return '';
    const ps = vs.map((v) => v.price); const lo = Math.min(...ps); const hi = Math.max(...ps);
    return lo === hi ? money(lo, settings.currency) : `${money(lo, settings.currency)}+`;
  };
  const stockOf = (p) => round2(sum(varsByProduct[p.id] || [], (v) => v.stock));

  const CartPanel = (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--surface)' }}>
      <div className="p-3 border-b line flex items-center gap-2">
        <button className="btn btn-outline flex-1 justify-start !px-3 min-w-0" onClick={() => setCustOpen(true)}>
          {cart.customer ? <User size={20} className="text-indigo-600 shrink-0" /> : <UserPlus size={20} className="shrink-0" />}
          <span className="truncate">{cart.customer ? cart.customer.name : t('pos.addCustomer')}</span>
          {cart.customer && settings.loyalty.enabled ? <span className="badge badge-gold ml-auto">★ {cart.customer.points || 0}</span> : <kbd className="ml-auto text-xs muted">F6</kbd>}
        </button>
        {cart.customer ? <button className="icon-btn" onClick={() => cart.setCustomer(null)} aria-label={t('common.remove')}><X size={20} /></button> : null}
        <button className="lg:hidden icon-btn" onClick={() => setMobileCart(false)} aria-label={t('common.close')}><X /></button>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {!cart.lines.length ? (
          <Empty icon={<ScanBarcode size={30} />} title={t('pos.emptyTitle')} text={t('pos.emptyText')} />
        ) : totals.lines.map((l) => (
          <div key={l.key} className={`px-3 py-2.5 border-b line flex gap-3 items-center ${cart.lastAddedKey === l.key ? 'bg-saffron-50/70 dark:bg-saffron-900/20' : ''}`}>
            <button onClick={() => setEditLine(l)} className="flex gap-3 items-center flex-1 min-w-0 text-left">
              <ProductIcon icon={l.icon} color={catMap[l.categoryId]?.color} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight truncate">{t.name(l)}</p>
                <p className="text-xs muted truncate">{[l.size, l.color].filter(Boolean).join(' · ')}{l.size || l.color ? ' · ' : ''}{num(l.price)}{l.unit !== 'pcs' ? '/' + l.unit : ''}</p>
                {l.lineDisc > 0 ? <p className="text-xs font-bold text-leaf-600">−{num(l.lineDisc)} {l.promoName ? '· ' + l.promoName : ''}</p> : null}
              </div>
            </button>
            <div className="flex items-center gap-1">
              <button className="w-9 h-9 rounded-lg btn-ghost grid place-items-center" onClick={() => cart.dec(l.key, l.unit === 'pcs' ? 1 : 0.5)} aria-label="−"><Minus size={16} /></button>
              <span className="w-10 text-center font-bold">{qtyFmt(l.qty, l.unit)}</span>
              <button className="w-9 h-9 rounded-lg btn-ghost grid place-items-center" onClick={() => cart.inc(l.key, l.unit === 'pcs' ? 1 : 0.5)} aria-label="+"><Plus size={16} /></button>
            </div>
            <p className="w-20 text-right font-bold">{num(l.net)}</p>
          </div>
        ))}
      </div>
      <div className="border-t line p-3 space-y-1.5">
        <div className="flex justify-between"><span className="muted">{t('pos.subtotal')} ({totals.items} {t('pos.itemsShort')})</span><span className="font-bold">{num(totals.subtotal)}</span></div>
        {totals.itemDiscount + totals.billDiscount > 0 ? <div className="flex justify-between text-leaf-600 font-bold"><span>{t('pos.discount')}</span><span>−{num(totals.itemDiscount + totals.billDiscount)}</span></div> : null}
        {totals.tax > 0 ? <div className="flex justify-between muted"><span>{settings.tax.label} {settings.tax.rate}%{settings.tax.inclusive ? ` (${t('pos.incl')})` : ''}</span><span>{num(totals.tax)}</span></div> : null}
        <div className="flex justify-between items-end pt-1">
          <span className="font-display text-lg font-bold">{t('pos.total')}</span>
          <span className="font-display text-3xl font-extrabold text-indigo-700 dark:text-saffron-300">{money(totals.total, settings.currency)}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 pt-1">
          <button className="btn btn-ghost btn-sm !h-12 flex-col !gap-0.5 text-xs" onClick={() => setDiscOpen(true)} disabled={!can(user, 'discount')}><Percent size={18} />{t('pos.billDiscount')}</button>
          <button className="btn btn-ghost btn-sm !h-12 flex-col !gap-0.5 text-xs" onClick={holdBill} disabled={!cart.lines.length}><PauseCircle size={18} />{t('pos.hold')}</button>
          <button className="btn btn-ghost btn-sm !h-12 flex-col !gap-0.5 text-xs relative" onClick={() => setHeldOpen(true)}><ListRestart size={18} />{t('pos.recall')}{heldCount ? <span className="absolute -top-1 -right-1 badge bg-maroon-600 text-white">{heldCount}</span> : null}</button>
          <button className="btn btn-ghost btn-sm !h-12 flex-col !gap-0.5 text-xs" onClick={clearBill} disabled={!cart.lines.length}><Trash2 size={18} />{t('pos.clear')}</button>
        </div>
        <button className="btn btn-accent btn-lg w-full !h-16 text-xl" disabled={!canPay} onClick={() => setPayOpen(true)}>
          <Wallet size={24} /> {t('pos.pay')} {canPay ? money(totals.total, settings.currency) : ''} <kbd className="text-xs opacity-70">F4</kbd>
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex min-h-0">
      <section className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="p-3 sm:p-4 pb-2 space-y-3">
          {!shift ? (
            <div className="rounded-2xl px-4 py-3 bg-saffron-50 dark:bg-saffron-900/30 flex flex-wrap items-center gap-3">
              <Wallet className="text-saffron-700" />
              <p className="flex-1 font-bold min-w-[12rem]">{t('pos.noShift')}</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShiftOpen(true)}>{t('shift.open')}</button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <div className="flex-1"><SearchBox inputRef={searchRef} value={q} onChange={setQ} onKeyDown={onSearchKey} scanTarget placeholder={t('pos.searchPh')} autoFocus /></div>
            <button className="icon-btn btn-outline !w-12 !h-12" onClick={() => setCamOpen(true)} title={t('camera.title')} aria-label={t('camera.title')}><Camera /></button>
            <HelpButton page="pos" className="!w-12 !h-12" />
          </div>
          <div className="flex gap-2 overflow-x-auto scroll-thin pb-1 -mx-1 px-1">
            <button onClick={() => setCat('all')} className={`shrink-0 h-11 px-4 rounded-xl font-bold flex items-center gap-2 border-2 ${cat === 'all' ? 'bg-indigo-700 text-white border-indigo-700' : 'line'}`} style={cat === 'all' ? undefined : { background: 'var(--surface)' }}>
              <ShoppingBag size={18} /> {t('pos.all')}
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 h-11 px-3 rounded-xl font-bold flex items-center gap-2 border-2 ${cat === c.id ? 'text-white' : 'line'}`}
                style={cat === c.id ? { background: c.color, borderColor: c.color } : { background: 'var(--surface)' }}>
                <ClothingIcon id={c.icon} size={20} /> {t.name(c)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin px-3 sm:px-4 pb-24 lg:pb-4">
          {!filtered.length ? <Empty icon={<ScanBarcode size={30} />} title={t('pos.noMatch')} text={t('pos.noMatchText')} /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtered.map((p) => {
                const st = stockOf(p); const c = catMap[p.categoryId];
                const isFlash = (varsByProduct[p.id] || []).some((v) => v.id === flash);
                return (
                  <button key={p.id} onClick={() => chooseProduct(p)} className={`card p-3 text-left hover:border-indigo-400 active:scale-[.98] transition flex flex-col gap-2 ${isFlash ? 'scan-flash' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <ProductIcon icon={p.icon} color={c?.color} size={52} />
                      <span className={`badge ${st <= 0 ? 'badge-red' : st <= 5 ? 'badge-gold' : 'badge-green'}`}>{qtyFmt(st, p.unit)}{p.unit !== 'pcs' ? p.unit : ''}</span>
                    </div>
                    <p className="font-bold leading-tight line-clamp-2 min-h-[2.5em]">{t.name(p)}</p>
                    <p className="font-display font-bold text-indigo-700 dark:text-saffron-300">{priceRange(p)}{p.unit !== 'pcs' ? <span className="text-xs muted font-sans"> / {t('unit.' + p.unit)}</span> : null}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <aside className="hidden lg:flex w-[420px] xl:w-[460px] border-l line flex-col min-h-0">{CartPanel}</aside>
      {mobileCart ? <div className="lg:hidden fixed inset-0 z-40 flex flex-col">{CartPanel}</div> : null}
      <button className="lg:hidden fixed bottom-4 inset-x-4 z-30 btn btn-accent btn-lg shadow-pop" onClick={() => setMobileCart(true)}>
        <ShoppingBag /> {t('pos.viewBill')} · {cart.lines.length} · {money(totals.total, settings.currency)}
      </button>

      <VariantModal product={variantFor} variants={variantFor ? varsByProduct[variantFor.id] || [] : []} onClose={() => setVariantFor(null)}
        onPick={(v) => { const p = variantFor; setVariantFor(null); if (p.unit !== 'pcs') setQtyFor({ v, p }); else addToCart(v, p); }} />
      <QtyModal data={qtyFor} onClose={() => setQtyFor(null)} onDone={(qty) => { addToCart(qtyFor.v, qtyFor.p, qty); setQtyFor(null); }} />
      <LineModal line={editLine} onClose={() => setEditLine(null)} />
      <CustomerModal open={custOpen} onClose={() => setCustOpen(false)} />
      <BillDiscountModal open={discOpen} onClose={() => setDiscOpen(false)} subtotal={totals.subtotal - totals.itemDiscount} />
      <HeldModal open={heldOpen} onClose={() => setHeldOpen(false)} />
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} totals={totals} onFinish={finish} />
      <DoneModal sale={done} onClose={() => { setDone(null); setTimeout(() => searchRef.current?.focus(), 50); }} />
      <CameraScanner open={camOpen} onClose={() => setCamOpen(false)} onScan={handleCode} />
      <ShiftOpenModal open={shiftOpen} onClose={() => setShiftOpen(false)} />
    </div>
  );
}

function VariantModal({ product, variants, onClose, onPick }) {
  const t = useT();
  const cur = useSettings((s) => s.currency);
  if (!product) return null;
  return (
    <Modal open onClose={onClose} title={t.name(product)} icon={<ClothingIcon id={product.icon} size={22} />}>
      <p className="muted mb-3">{t('pos.pickVariant')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {variants.map((v) => (
          <button key={v.id} onClick={() => onPick(v)} className={`card p-3 text-left hover:border-indigo-400 ${v.stock <= 0 ? 'opacity-60' : ''}`}>
            <p className="font-display text-xl font-bold">{v.size || '—'}</p>
            <p className="font-bold">{v.color}</p>
            <p className="text-indigo-700 dark:text-saffron-300 font-bold">{money(v.price, cur)}</p>
            <p className={`text-xs font-bold ${v.stock <= 0 ? 'text-maroon-600' : 'muted'}`}>{t('pos.inStock')}: {v.stock}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function QtyModal({ data, onClose, onDone }) {
  const t = useT();
  const [val, setVal] = useState('1');
  useEffect(() => { if (data) setVal('1'); }, [data]);
  if (!data) return null;
  const unit = data.p.unit;
  const submit = () => { const n = Number(val); if (n > 0) onDone(round2(n)); };
  return (
    <Modal open onClose={onClose} title={t('pos.howMuch', { unit: t('unit.' + unit) })} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={submit}>{t('pos.addToBill')}</button></>}>
      <p className="font-bold mb-2">{t.name(data.p)} {data.v.color ? '· ' + data.v.color : ''}</p>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map((n) => <button key={n} className={`btn ${Number(val) === n ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVal(String(n))}>{n}</button>)}
      </div>
      <input className="input text-2xl text-center" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <p className="text-center mt-2 font-bold">{money(round2((Number(val) || 0) * data.v.price))}</p>
    </Modal>
  );
}

function LineModal({ line, onClose }) {
  const t = useT();
  const user = useAuth((s) => s.user);
  const cart = useCart();
  const [qty, setQty] = useState(1); const [price, setPrice] = useState(0); const [disc, setDisc] = useState(0); const [mode, setMode] = useState('amount');
  useEffect(() => { if (line) { setQty(line.qty); setPrice(line.price); setDisc(line.discount || 0); setMode('amount'); } }, [line]);
  if (!line) return null;
  const save = async () => {
    const d = mode === 'percent' ? round2((Number(price) * Number(qty) * Number(disc)) / 100) : Number(disc) || 0;
    if (Number(price) !== line.price && !can(user, 'price-edit')) {
      const ok = await askManagerPin(t('pos.priceApprove')); if (!ok) return;
    }
    cart.updateLine(line.key, { price: Number(price) || 0, discount: d, manualPrice: Number(price) !== line.price || line.manualPrice });
    cart.setQty(line.key, qty);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={t.name(line)} size="sm" icon={<ClothingIcon id={line.icon} size={22} />}
      footer={<>
        <button className="btn btn-danger mr-auto" onClick={() => { cart.remove(line.key); onClose(); }}><Trash2 size={18} /> {t('common.remove')}</button>
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={save}>{t('common.save')}</button>
      </>}>
      <div className="space-y-3">
        <Field label={t('pos.qty')}><input className="input text-xl" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label={t('pos.unitPrice')}><input className="input text-xl" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        {can(user, 'discount') ? (
          <Field label={t('pos.itemDiscount')}>
            <div className="flex gap-2">
              <input className="input text-xl" inputMode="decimal" value={disc} onChange={(e) => setDisc(e.target.value)} />
              <button className={`btn ${mode === 'amount' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('amount')}>Rs.</button>
              <button className={`btn ${mode === 'percent' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('percent')}>%</button>
            </div>
          </Field>
        ) : null}
        <p className="muted text-sm">{line.barcode}</p>
      </div>
    </Modal>
  );
}

function CustomerModal({ open, onClose }) {
  const t = useT();
  const cart = useCart();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const list = useLiveQuery(async () => {
    const all = await db.customers.toArray();
    const s = q.trim().toLowerCase();
    return all.filter((c) => !s || c.name.toLowerCase().includes(s) || (c.phone || '').includes(s)).slice(0, 40);
  }, [q]) || [];
  useEffect(() => { if (open) { setQ(''); setAdding(false); setForm({ name: '', phone: '' }); } }, [open]);
  const pick = (c) => { cart.setCustomer({ id: c.id, name: c.name, phone: c.phone, points: c.points || 0, creditBalance: c.creditBalance || 0 }); onClose(); };
  const add = async () => {
    if (!form.name.trim()) return toast.err(t('cust.nameRequired'));
    if (form.phone && await db.customers.where('phone').equals(form.phone.trim()).first()) return toast.err(t('cust.phoneExists'));
    const c = { id: uid(), name: form.name.trim(), phone: form.phone.trim(), points: 0, creditBalance: 0, totalSpent: 0, visits: 0, createdAt: Date.now() };
    await db.customers.add(c); pick(c); toast.ok(t('cust.added'));
  };
  return (
    <Modal open={open} onClose={onClose} title={t('pos.customer')} icon={<User size={20} />}>
      {!adding ? (<>
        <div className="flex gap-2 mb-3">
          <div className="flex-1"><SearchBox value={q} onChange={setQ} placeholder={t('cust.searchPh')} autoFocus /></div>
          <button className="btn btn-primary" onClick={() => { setAdding(true); setForm({ name: /\d/.test(q) ? '' : q, phone: /\d/.test(q) ? q : '' }); }}><UserPlus size={18} /> {t('common.new')}</button>
        </div>
        <div className="divide-y line">
          {list.map((c) => (
            <button key={c.id} onClick={() => pick(c)} className="w-full flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-800 text-left">
              <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center font-bold">{c.name.slice(0, 1)}</span>
              <span className="flex-1 min-w-0"><span className="font-bold block truncate">{c.name}</span><span className="muted text-sm">{c.phone}</span></span>
              <span className="badge badge-gold">★ {c.points || 0}</span>
              {c.creditBalance > 0 ? <span className="badge badge-red">{t('cust.owes')} {num(c.creditBalance)}</span> : null}
            </button>
          ))}
        </div>
      </>) : (
        <div className="space-y-3">
          <Field label={t('cust.name')}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t('cust.phone')}><input className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <div className="flex gap-2 justify-end"><button className="btn btn-ghost" onClick={() => setAdding(false)}>{t('common.back')}</button><button className="btn btn-primary" onClick={add}>{t('cust.addAndUse')}</button></div>
        </div>
      )}
    </Modal>
  );
}

function BillDiscountModal({ open, onClose, subtotal }) {
  const t = useT();
  const cart = useCart();
  const [type, setType] = useState('percent'); const [val, setVal] = useState('');
  useEffect(() => { if (open) { setType(cart.billDiscount.type || 'percent'); setVal(String(cart.billDiscount.value || '')); } }, [open]); // eslint-disable-line
  const apply = async () => {
    const v = Number(val) || 0;
    const amt = type === 'percent' ? (subtotal * v) / 100 : v;
    if (subtotal > 0 && amt / subtotal > 0.2) { const ok = await askManagerPin(t('pos.bigDiscountApprove')); if (!ok) return; }
    cart.setBillDiscount({ type, value: v }); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={t('pos.billDiscount')} size="sm" icon={<Percent size={20} />}
      footer={<><button className="btn btn-ghost mr-auto" onClick={() => { cart.setBillDiscount({ type: 'amount', value: 0 }); onClose(); }}>{t('pos.removeDiscount')}</button><button className="btn btn-primary" onClick={apply}>{t('common.apply')}</button></>}>
      <div className="flex gap-2 mb-3">
        <button className={`btn flex-1 ${type === 'percent' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setType('percent')}>%</button>
        <button className={`btn flex-1 ${type === 'amount' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setType('amount')}>Rs.</button>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {(type === 'percent' ? [5, 10, 15, 20] : [100, 250, 500, 1000]).map((n) => <button key={n} className="btn btn-ghost" onClick={() => setVal(String(n))}>{n}{type === 'percent' ? '%' : ''}</button>)}
      </div>
      <input className="input text-2xl text-center" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply()} />
    </Modal>
  );
}

function HeldModal({ open, onClose }) {
  const t = useT();
  const cart = useCart();
  const held = useLiveQuery(() => db.held.orderBy('date').reverse().toArray(), []) || [];
  const resume = async (h) => {
    if (cart.lines.length && !(await confirmDialog({ message: t('pos.replaceBill') }))) return;
    cart.load({ ...h.snapshot, heldId: h.id }); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={t('pos.heldBills')} icon={<ListRestart size={20} />}>
      {!held.length ? <Empty icon={<PauseCircle size={28} />} title={t('pos.noHeld')} text={t('pos.noHeldText')} /> : (
        <div className="space-y-2">
          {held.map((h) => (
            <div key={h.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold">{h.snapshot.customer?.name || t('pos.walkIn')} · {h.count} {t('pos.itemsShort')}</p>
                <p className="muted text-sm">{new Date(h.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {h.userName}</p>
              </div>
              <p className="font-bold">{money(h.total)}</p>
              <button className="btn btn-primary btn-sm" onClick={() => resume(h)}>{t('pos.resume')}</button>
              <button className="icon-btn" onClick={() => db.held.delete(h.id)} aria-label={t('common.delete')}><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PaymentModal({ open, onClose, totals, onFinish }) {
  const t = useT();
  const settings = useSettings();
  const cart = useCart();
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [pays, setPays] = useState([]);
  const [voucher, setVoucher] = useState(null);
  const [print, setPrint] = useState(true);
  const amtRef = useRef(null);
  const busy = useRef(false); // guards against a double sale from a double Enter
  useEffect(() => {
    if (open) { setPays([]); setMethod('cash'); setAmount(''); setRef(''); setVoucher(null); setPrint(settings.receipt.autoPrint); setTimeout(() => amtRef.current?.focus(), 60); }
  }, [open]); // eslint-disable-line
  if (!open) return null;
  const paid = round2(sum(pays, (p) => p.amount));
  const due = round2(Math.max(0, totals.total - paid));
  const change = round2(Math.max(0, paid - totals.total));
  const cust = cart.customer;

  const methods = PAYMENT_METHODS.filter((m) => (m !== 'credit' && m !== 'points') || cust).filter((m) => m !== 'points' || settings.loyalty.enabled);
  const addPay = async (m = method, value = amount) => {
    let v = round2(Number(value === '' ? due : value) || 0);
    if (v <= 0) return;
    if (m !== 'cash' && v > due) v = due; // only cash can be more than the bill
    if (m === 'points') {
      const used = sum(pays.filter((p) => p.method === 'points'), (p) => p.amount);
      const max = (cust.points || 0) * (settings.loyalty.pointValue || 1) - used;
      if (v > max) return toast.err(t('pay.notEnoughPoints', { max: num(max) }));
    }
    if (m === 'voucher') {
      if (!voucher) return toast.err(t('pay.scanVoucher'));
      if (v > voucher.balance) v = voucher.balance;
    }
    if (m === 'credit') {
      const ok = await askManagerPin(t('pay.creditApprove', { name: cust.name })); if (!ok) return;
    }
    setPays([...pays, { method: m, amount: v, ref: m === 'voucher' ? voucher.code : ref, voucherId: m === 'voucher' ? voucher.id : undefined }]);
    setAmount(''); setRef(''); setVoucher(null); setMethod('cash');
    setTimeout(() => amtRef.current?.focus(), 30);
  };
  const lookVoucher = async (code) => {
    const v = await db.vouchers.where('code').equals(code.trim().toUpperCase()).first();
    if (!v || v.status !== 'active' || v.balance <= 0) return toast.err(t('pay.voucherInvalid'));
    if (v.expiresAt && v.expiresAt < Date.now()) return toast.err(t('pay.voucherExpired'));
    setVoucher(v); setAmount(String(Math.min(v.balance, due)));
  };
  const completeNow = () => {
    let list = pays;
    if (due > 0) {
      const v = round2(Number(amount === '' ? due : amount) || 0);
      if (method === 'cash' && v >= due) list = [...pays, { method: 'cash', amount: v, ref: '' }];
      else if (method !== 'cash' && v >= due && !['voucher', 'points', 'credit'].includes(method)) list = [...pays, { method, amount: due, ref }];
      else return toast.err(t('pay.stillDue', { amount: num(due) }));
    }
    onFinish(list, print);
  };
  const quick = [...new Set([due, Math.ceil(due / 100) * 100, Math.ceil(due / 500) * 500, Math.ceil(due / 1000) * 1000, Math.ceil(due / 5000) * 5000])].filter((n) => n > 0).slice(0, 5);
  const typed = Number(amount) || 0;
  const liveChange = method === 'cash' && typed > due ? round2(typed - due) : change;

  return (
    <Modal open onClose={onClose} title={t('pay.title')} size="lg" icon={<Wallet size={20} />}>
      {/* Enter completes the sale from anywhere in this window (except buttons and the voucher box) */}
      <div className="grid md:grid-cols-[1fr_1.15fr] gap-5" onKeyDown={(e) => {
        if (e.key !== 'Enter' || e.repeat || e.target.tagName === 'BUTTON' || e.target.dataset?.scanTarget) return;
        e.preventDefault(); e.stopPropagation();
        if (!busy.current) { busy.current = true; completeNow(); setTimeout(() => { busy.current = false; }, 1500); }
      }}>
        <div className="space-y-3">
          <div className="rounded-2xl p-4 bg-indigo-700 text-white">
            <p className="text-indigo-200 font-bold">{t('pay.total')}</p>
            <p className="font-display text-4xl font-extrabold">{money(totals.total, settings.currency)}</p>
            <div className="flex justify-between mt-3 text-lg"><span>{t('pay.paid')}</span><span className="font-bold">{num(paid)}</span></div>
            <div className="flex justify-between text-lg"><span>{t('pay.due')}</span><span className="font-bold text-saffron-300">{num(due)}</span></div>
          </div>
          <div className={`rounded-2xl p-4 text-center ${liveChange > 0 ? 'bg-leaf-500 text-white' : ''}`} style={liveChange > 0 ? undefined : { background: 'var(--surface-2)' }}>
            <p className="font-bold">{t('pay.change')}</p>
            <p className="font-display text-4xl font-extrabold">{money(liveChange, settings.currency)}</p>
          </div>
          {pays.length ? (
            <div className="space-y-1.5">
              {pays.map((p, i) => {
                const I = PAY_ICONS[p.method];
                return <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--surface-2)' }}><I size={18} /><span className="flex-1 font-bold">{t('pay.' + p.method)} {p.ref ? <span className="muted text-sm">({p.ref})</span> : null}</span><span className="font-bold">{num(p.amount)}</span><button onClick={() => setPays(pays.filter((_, j) => j !== i))} className="icon-btn !w-8 !h-8" aria-label={t('common.remove')}><X size={16} /></button></div>;
              })}
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {methods.map((m) => {
              const I = PAY_ICONS[m];
              return (
                <button key={m} onClick={() => { setMethod(m); setAmount(m === 'cash' ? '' : String(due)); }} className={`rounded-xl border-2 p-2 flex flex-col items-center gap-1 font-bold text-xs ${method === m ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-800' : 'line'}`}>
                  <I size={22} /> {t('pay.' + m)}
                </button>
              );
            })}
          </div>
          {method === 'voucher' ? (
            <div className="flex gap-2">
              <input className="input" placeholder={t('pay.voucherCode')} data-scan-target="1" onKeyDown={(e) => e.key === 'Enter' && lookVoucher(e.currentTarget.value)} />
              {voucher ? <span className="badge badge-green self-center whitespace-nowrap">{voucher.code} · {num(voucher.balance)}</span> : null}
            </div>
          ) : null}
          {method === 'points' && cust ? <p className="badge badge-gold">★ {cust.points || 0} = {money((cust.points || 0) * (settings.loyalty.pointValue || 1))}</p> : null}
          {method === 'credit' && cust ? <p className="badge badge-red">{t('cust.owes')}: {num(cust.creditBalance || 0)}</p> : null}
          {['card', 'qr', 'bank'].includes(method) ? <input className="input" placeholder={t('pay.refPh')} value={ref} onChange={(e) => setRef(e.target.value)} /> : null}
          <input ref={amtRef} className="input text-3xl text-center !h-16 font-bold" inputMode="decimal" placeholder={num(due)} value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
          {method === 'cash' ? (
            <div className="grid grid-cols-5 gap-2">{quick.map((n) => <button key={n} className="btn btn-outline btn-sm !h-11" onClick={() => setAmount(String(n))}>{num(n).replace('.00', '')}</button>)}</div>
          ) : null}
          <button className="btn btn-outline w-full" onClick={() => addPay()} disabled={due <= 0}><Plus size={18} /> {t('pay.addSplit')}</button>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="w-5 h-5" checked={print} onChange={(e) => setPrint(e.target.checked)} /> <Printer size={18} /> {t('pay.printReceipt')}</label>
          <button className="btn btn-success btn-lg w-full !h-16 text-xl" onClick={() => { if (busy.current) return; busy.current = true; completeNow(); setTimeout(() => { busy.current = false; }, 1500); }}><CheckCircle2 /> {t('pay.complete')}</button>
          <p className="text-center text-xs muted">{t('pay.enterHint')}</p>
        </div>
      </div>
    </Modal>
  );
}

function DoneModal({ sale, onClose }) {
  const t = useT();
  const settings = useSettings();
  useEffect(() => {
    if (!sale) return;
    const onKey = (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onClose(); } };
    const id = setTimeout(() => window.addEventListener('keydown', onKey), 400);
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey); };
  }, [sale, onClose]);
  if (!sale) return null;
  return (
    <Modal open onClose={onClose} title={t('done.title')} size="sm" icon={<CheckCircle2 size={20} />}
      footer={<><button className="btn btn-outline" onClick={() => printReceipt(sale, settings)}><Printer size={18} /> {t('done.print')}</button><button data-autofocus className="btn btn-primary" onClick={onClose}>{t('done.next')}</button></>}>
      <div className="text-center">
        <p className="muted font-bold">{sale.billNo}</p>
        <p className="font-bold mt-2">{t('pay.change')}</p>
        <p className="font-display text-5xl font-extrabold text-leaf-600">{money(sale.change, settings.currency)}</p>
        <p className="mt-3">{t('pay.total')}: <b>{money(sale.total, settings.currency)}</b></p>
        {sale.pointsEarned ? <p className="badge badge-gold mt-2">★ +{sale.pointsEarned} {t('done.points')}</p> : null}
      </div>
    </Modal>
  );
}
