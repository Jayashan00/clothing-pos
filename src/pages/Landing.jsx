import { Link } from 'react-router-dom';
import {
  ScanBarcode, Printer, WifiOff, Languages, Users, BarChart3, Boxes, Truck, Undo2, BadgePercent, Wallet, Ticket, ReceiptText,
  HelpCircle, AArrowUp, Cloud, HardDrive, MonitorSmartphone, ShieldCheck, ArrowRight, Shirt, Barcode, Camera, Star,
} from 'lucide-react';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { Brand, LangSwitch } from '../components/Layout';
import { ICONS, ClothingIcon } from '../icons/clothing';
import { Receipt, Label } from '../print/templates';
import { LABEL_TEMPLATES } from '../lib/print';

const SAMPLE = {
  billNo: 'T1-000248', date: Date.now(), cashierName: 'Kasun', customerName: 'Nimali F.', customerId: 'x',
  items: [
    { nameEn: 'Handloom cotton saree', nameSi: 'අත්යන්ත්‍ර කපු සාරිය', color: 'Maroon', unit: 'pcs', qty: 1, price: 5450, gross: 5450, discount: 545, promoName: 'Saree festival 10%', net: 4905 },
    { nameEn: 'School uniform cloth', nameSi: 'පාසල් නිල ඇඳුම් රෙදි', color: 'White', unit: 'm', qty: 2.5, price: 650, gross: 1625, discount: 0, net: 1625 },
  ],
  subtotal: 7075, itemDiscount: 545, billDiscount: 0, tax: 0, total: 6530, savings: 545, payments: [{ method: 'cash', amount: 7000 }], change: 470, pointsEarned: 65,
};
const TAG = { nameEn: 'Batik shirt, short sleeve', nameSi: 'බතික් කමිසය', size: 'L', color: 'Blue', barcode: '2000000000268', price: 3250 };
const SHIRT = { nameEn: 'Crew neck T-shirt', nameSi: 'ටී ෂර්ට්', size: 'M', color: 'Navy', barcode: '2000000000411', price: 1290 };

export default function Landing() {
  const t = useT();
  const settings = useSettings();
  const cfg = { ...settings.labels, showShop: true, showPrice: true, showVariant: true, format: 'EAN13', moduleMm: 0.25 };

  const modules = [
    [ScanBarcode, 'nav.pos'], [ReceiptText, 'nav.sales'], [Undo2, 'nav.returns'], [Users, 'nav.customers'], [Wallet, 'nav.shifts'],
    [Shirt, 'nav.products'], [Barcode, 'nav.labels'], [Boxes, 'nav.inventory'], [Truck, 'nav.purchases'], [BadgePercent, 'nav.promotions'],
    [Ticket, 'land.vouchers'], [BarChart3, 'nav.reports'], [ShieldCheck, 'nav.users'], [Cloud, 'land.cloud'],
  ];

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-30 border-b line backdrop-blur" style={{ background: 'color-mix(in srgb, var(--surface) 88%, transparent)', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <Brand compact />
          <span className="font-display font-extrabold text-lg">Nodemor POS</span>
          <div className="flex-1" />
          <LangSwitch />
          <Link to="/login" className="btn btn-primary hidden sm:inline-flex">{t('land.open')}</Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-indigo-700 text-white">
        <div className="weave h-2" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-20 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-saffron-300 mb-6"><Shirt size={16} /> {t('land.kicker')}</p>
            <h1 className="font-display font-extrabold text-[2.6rem] sm:text-6xl leading-[1.02] tracking-tight">{t('land.h1')}</h1>
            <p className="text-xl text-indigo-100 mt-6 max-w-xl leading-relaxed">{t('land.sub')}</p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/login" className="btn btn-accent btn-lg">{t('land.try')} <ArrowRight size={20} /></Link>
              <a href="#features" className="btn btn-lg text-white border-2 border-white/30 hover:bg-white/10">{t('land.see')}</a>
            </div>
            <p className="text-sm text-indigo-200 mt-5">{t('land.demoNote')}</p>
          </div>
          {/* the counter: real receipt + real hang tags */}
          <div className="relative h-[460px] sm:h-[520px]" aria-hidden="true">
            <div className="absolute left-0 sm:left-6 top-2 bg-white text-black rounded-sm shadow-pop origin-top-left" style={{ transform: 'rotate(-4deg) scale(.92)' }}>
              <Receipt sale={SAMPLE} settings={{ ...settings, receipt: { ...settings.receipt, paper: '80', bilingual: true, showLogo: false } }} />
            </div>
            <div className="absolute right-0 sm:right-4 top-10 bg-white text-black rounded-md shadow-pop" style={{ transform: 'rotate(6deg) scale(1.55)', transformOrigin: 'top right' }}>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-gray-300 bg-indigo-700" />
              <Label item={TAG} cfg={cfg} tpl={LABEL_TEMPLATES.tag35x55} shop={settings.shop} cur="Rs." />
            </div>
            <div className="absolute right-6 bottom-6 bg-white text-black rounded shadow-pop" style={{ transform: 'rotate(-3deg) scale(1.5)', transformOrigin: 'bottom right' }}>
              <Label item={SHIRT} cfg={cfg} tpl={LABEL_TEMPLATES['38x25']} shop={settings.shop} cur="Rs." />
            </div>
          </div>
        </div>
      </section>

      {/* works with */}
      <section className="border-b line" style={{ background: 'var(--surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center gap-x-8 gap-y-3 font-bold">
          <span className="muted">{t('land.worksWith')}</span>
          {[[Printer, 'land.w.thermal'], [Barcode, 'land.w.label'], [Printer, 'land.w.a4'], [ScanBarcode, 'land.w.scanner'], [Camera, 'land.w.camera'], [MonitorSmartphone, 'land.w.devices']].map(([I, k]) => (
            <span key={k} className="inline-flex items-center gap-2"><I size={20} className="text-indigo-600" /> {t(k)}</span>
          ))}
        </div>
      </section>

      {/* FEATURE 1: billing */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight">{t('land.f1.title')}</h2>
          <p className="text-lg muted mt-4">{t('land.f1.text')}</p>
          <ul className="mt-6 space-y-3">
            {(t('land.f1.points') || []).map((x, i) => <li key={i} className="flex gap-3"><span className="mt-1 w-6 h-6 rounded-full bg-saffron-500 text-ink grid place-items-center shrink-0"><Star size={13} /></span><span className="text-lg">{x}</span></li>)}
          </ul>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3"><div className="input flex items-center gap-2 muted"><ScanBarcode size={18} /> 2000000000268</div><span className="badge badge-green whitespace-nowrap">{t('land.scanned')}</span></div>
          {[['batik', 'Batik shirt · L', 'බතික් කමිසය', '3,250.00', '#1F2A5C'], ['saree', 'Handloom cotton saree', 'කපු සාරිය', '4,905.00', '#8C1C3A'], ['fabric', 'Poplin cloth · 2.5 m', 'පොප්ලින් රෙදි', '1,300.00', '#9A640C'], ['baby', 'Baby romper set · 3-6M', 'ළදරු රොම්පර්', '1,350.00', '#0E7058']].map(([ic, en, si, p, c]) => (
            <div key={en} className="flex items-center gap-3 py-2.5 border-b line">
              <div className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: c + '18', color: c }}><ClothingIcon id={ic} size={28} /></div>
              <div className="flex-1"><p className="font-bold">{t.lang === 'si' ? si : en}</p></div><b>{p}</b>
            </div>
          ))}
          <div className="flex justify-between items-end mt-4"><span className="font-display text-lg font-bold">{t('pos.total')}</span><span className="font-display text-3xl font-extrabold text-indigo-700 dark:text-saffron-300">Rs. 10,805.00</span></div>
          <div className="grid grid-cols-4 gap-2 mt-3">{['cash', 'card', 'qr', 'voucher'].map((m) => <div key={m} className="rounded-xl border-2 line p-2 text-center text-sm font-bold">{t('pay.' + m)}</div>)}</div>
        </div>
      </section>

      {/* FEATURE 2: icons */}
      <section className="py-20" style={{ background: 'var(--surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl font-extrabold leading-tight">{t('land.f2.title')}</h2>
            <p className="text-lg muted mt-4">{t('land.f2.text')}</p>
          </div>
          <div className="mt-10 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
            {ICONS.map((i, n) => (
              <div key={i.id} className="rounded-2xl p-3 flex flex-col items-center gap-2 text-center" style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: ['#1F2A5C', '#8C1C3A', '#0E7058', '#9A640C'][n % 4] }}><ClothingIcon id={i.id} size={36} /></span>
                <span className="text-xs font-bold leading-tight">{t.lang === 'si' ? i.si : i.en}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE 3: print */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="order-2 lg:order-1 flex flex-wrap gap-6 items-end justify-center rounded-3xl p-8" style={{ background: 'repeating-linear-gradient(45deg, var(--surface-2) 0 12px, var(--surface) 12px 24px)' }}>
          {['38x25', '50x30', 'tag35x55'].map((k) => (
            <div key={k} className="text-center">
              <div className="bg-white text-black shadow-lift inline-block"><Label item={k === 'tag35x55' ? TAG : SHIRT} cfg={cfg} tpl={LABEL_TEMPLATES[k]} shop={settings.shop} cur="Rs." /></div>
              <p className="text-xs muted mt-2 font-bold">{LABEL_TEMPLATES[k].name}</p>
            </div>
          ))}
        </div>
        <div className="order-1 lg:order-2">
          <h2 className="font-display text-4xl font-extrabold leading-tight">{t('land.f3.title')}</h2>
          <p className="text-lg muted mt-4">{t('land.f3.text')}</p>
          <ul className="mt-6 space-y-3">{(t('land.f3.points') || []).map((x, i) => <li key={i} className="flex gap-3"><Printer className="text-indigo-600 shrink-0 mt-0.5" size={20} /><span className="text-lg">{x}</span></li>)}</ul>
        </div>
      </section>

      {/* FEATURE 4: language + elders */}
      <section className="bg-indigo-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-3 max-w-2xl mb-4">
            <h2 className="font-display text-4xl font-extrabold leading-tight">{t('land.f4.title')}</h2>
            <p className="text-lg text-indigo-100 mt-4">{t('land.f4.text')}</p>
          </div>
          {[[Languages, 'land.f4.a'], [AArrowUp, 'land.f4.b'], [HelpCircle, 'land.f4.c']].map(([I, k]) => (
            <div key={k} className="border-t-2 border-saffron-400 pt-5">
              <I size={32} className="text-saffron-300 mb-3" />
              <p className="font-display text-xl font-bold">{t(k + '.title')}</p>
              <p className="text-indigo-100 mt-2">{t(k + '.text')}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURE 5: never stops */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl font-extrabold leading-tight">{t('land.f5.title')}</h2>
          <p className="text-lg muted mt-4">{t('land.f5.text')}</p>
        </div>
        <div className="mt-10 grid md:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4">
          {[[ScanBarcode, 'land.f5.a'], null, [HardDrive, 'land.f5.b'], null, [Cloud, 'land.f5.c']].map((x, i) => {
            if (!x) return <div key={i} className="hidden md:flex items-center justify-center"><div className="weave-thin h-2 w-16 rounded" /></div>;
            const [I, k] = x;
            return <div key={i} className="card p-5"><I size={30} className="text-indigo-600 mb-2" /><p className="font-bold text-lg">{t(k + '.title')}</p><p className="muted">{t(k + '.text')}</p></div>;
          })}
        </div>
        <p className="mt-6 inline-flex items-center gap-2 badge badge-gold text-sm"><WifiOff size={16} /> {t('land.f5.note')}</p>
      </section>

      {/* everything */}
      <section className="py-20" style={{ background: 'var(--surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-4xl font-extrabold leading-tight max-w-2xl">{t('land.all.title')}</h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-6">
            {modules.map(([I, k]) => (
              <div key={k} className="flex gap-4">
                <I size={26} className="text-indigo-600 shrink-0 mt-0.5" />
                <div><p className="font-bold text-lg">{t(k)}</p><p className="muted">{t('land.m.' + k.split('.')[1])}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="font-display text-4xl sm:text-5xl font-extrabold">{t('land.cta')}</h2>
        <p className="text-lg muted mt-4">{t('land.ctaSub')}</p>
        <Link to="/login" className="btn btn-accent btn-lg mt-8">{t('land.try')} <ArrowRight size={20} /></Link>
      </section>
      <footer className="border-t line">
        <div className="weave h-1.5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap gap-4 items-center justify-between text-sm muted">
          <span>© {new Date().getFullYear()} Nodemor POS · {t('land.footer')}</span>
          <span>{settings.shop.nameEn}</span>
        </div>
      </footer>
    </div>
  );
}
