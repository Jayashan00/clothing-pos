import { useEffect, useState } from 'react';
import { Settings as Gear, Store, ReceiptText, Barcode, Percent, MonitorSmartphone, Printer, Cloud, DatabaseBackup, Upload, Download, RefreshCw, Trash2, CheckCircle2, AlertTriangle, ImagePlus } from 'lucide-react';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { syncNow, testConnection, joinFromCloud, compareWithServer, downloadServerExport, unsyncedCount } from '../lib/sync';
import { folderSupported, folderState, chooseFolder, allowFolder, runFolderBackup } from '../lib/autobackup';
import { downloadExcel, monthRange, monthKey } from '../lib/excel';
import { useSearchParams } from 'react-router-dom';
import { FolderOpen, FileSpreadsheet, Scale, CloudUpload } from 'lucide-react';
import { startOfDay, endOfDay } from '../lib/util';
import { exportAll, importAll, wipeBusinessData } from '../lib/backup';
import { db } from '../db/db';
import { seedDemo, createOwnerOnly } from '../db/seed';
import { downloadText, fmtDateTime } from '../lib/util';
import { Field, Toggle, toast, confirmDialog, Tabs } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { Receipt, printTestPage } from '../print/templates';

const SAMPLE = {
  billNo: 'T1-000123', date: Date.now(), cashierName: 'Kasun', customerName: 'Nimali Fernando', customerPhone: '0712345602', customerId: 'x',
  items: [
    { nameEn: 'Handloom cotton saree', nameSi: 'අත්යන්ත්‍ර කපු සාරිය', size: '', color: 'Maroon', unit: 'pcs', qty: 1, price: 5450, gross: 5450, discount: 545, promoName: 'Saree festival 10% off', net: 4905 },
    { nameEn: 'Poplin cloth', nameSi: 'පොප්ලින් රෙදි', size: '', color: 'White', unit: 'm', qty: 2.5, price: 520, gross: 1300, discount: 0, net: 1300 },
    { nameEn: 'Crew neck T-shirt', nameSi: 'රවුම් බෙල්ල ටී ෂර්ට්', size: 'L', color: 'Navy', unit: 'pcs', qty: 2, price: 1290, gross: 2580, discount: 0, net: 2580 },
  ],
  subtotal: 9330, itemDiscount: 545, billDiscount: 0, tax: 0, total: 8785, savings: 545,
  payments: [{ method: 'cash', amount: 10000 }], change: 1215, pointsEarned: 87, pointsUsed: 0,
};

function resizeImage(file, max = 360) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const r = new FileReader();
    r.onload = () => { img.src = r.result; };
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject; r.readAsDataURL(file);
  });
}

export default function Settings() {
  const t = useT();
  const s = useSettings();
  const user = useAuth((x) => x.user);
  const logout = useAuth((x) => x.logout);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'shop');
  const [fstate, setFstate] = useState(null);
  const [cmp, setCmp] = useState(null);
  const [busy, setBusy] = useState('');
  const refreshFolder = async () => setFstate(await folderState());
  useEffect(() => { refreshFolder(); }, []);
  const [usage, setUsage] = useState(null);
  const [testing, setTesting] = useState(false);
  useEffect(() => { navigator.storage?.estimate?.().then(setUsage).catch(() => {}); }, []);
  const shop = (k) => ({ value: s.shop[k] || '', onChange: (e) => s.setSection('shop', { [k]: e.target.value }) });
  const rc = (k) => ({ value: s.receipt[k] ?? '', onChange: (e) => s.setSection('receipt', { [k]: e.target.value }) });

  const TABS = [
    ['shop', Store], ['receipt', ReceiptText], ['labels', Barcode], ['tax', Percent], ['terminal', MonitorSmartphone], ['printers', Printer], ['sync', Cloud], ['backup', DatabaseBackup],
  ];

  const doBackup = async () => { const data = await exportAll(); downloadText(`redipos-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data)); toast.ok(t('set.backupDone')); };
  const excel = async (which) => {
    const now = Date.now();
    if (which === 'today') return downloadExcel(startOfDay(), endOfDay(), 'Today', `redipos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (which === 'month') { const [a, b] = monthRange(); return downloadExcel(a, b, `Month ${monthKey()}`, `redipos-${monthKey()}.xlsx`); }
    if (which === 'last') { const p = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15).getTime(); const [a, b] = monthRange(p); return downloadExcel(a, b, `Month ${monthKey(p)}`, `redipos-${monthKey(p)}.xlsx`); }
    return downloadExcel(0, now, 'All time', `redipos-all-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const doRestore = async (file) => {
    if (!(await confirmDialog({ title: t('set.restore'), message: t('set.restoreMsg'), danger: true, okText: t('set.restore') }))) return;
    await doBackup(); // safety copy of what is on this computer now
    try { await importAll(JSON.parse(await file.text())); toast.ok(t('set.restored')); setTimeout(() => window.location.reload(), 800); } catch (e) { toast.err(String(e.message || e)); }
  };
  const startFresh = async () => {
    if (!(await confirmDialog({ title: t('set.fresh'), message: t('set.freshMsg'), danger: true, okText: t('set.fresh') }))) return;
    await doBackup();
    await wipeBusinessData({ keepProducts: false });
    await db.users.clear(); await db.meta.clear();
    await createOwnerOnly();
    logout(); window.location.reload();
  };
  const reloadDemo = async () => {
    if (!(await confirmDialog({ title: t('set.demo'), message: t('set.demoMsg'), danger: true }))) return;
    await Promise.all(db.tables.map((tb) => tb.clear()));
    await seedDemo(); logout(); window.location.reload();
  };

  return (
    <Page>
      <PageHeader title={t('nav.settings')} help="settings" icon={<Gear size={24} />} />
      <div className="grid lg:grid-cols-[230px_1fr] gap-4">
        <nav className="card p-2 h-fit flex lg:flex-col overflow-x-auto gap-1">
          {TABS.map(([id, I]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-3 px-3 h-11 rounded-xl font-bold whitespace-nowrap ${tab === id ? 'bg-indigo-700 text-white' : ''}`}><I size={19} /> {t('set.t.' + id)}</button>
          ))}
        </nav>
        <div className="card p-5">
          {tab === 'shop' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed line grid place-items-center overflow-hidden bg-white">{s.shop.logo ? <img src={s.shop.logo} alt="logo" className="max-w-full max-h-full object-contain" /> : <ImagePlus className="text-gray-400" />}</div>
                <div className="space-y-2">
                  <label className="btn btn-outline cursor-pointer"><Upload size={18} /> {t('set.uploadLogo')}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files[0]; if (f) s.setSection('shop', { logo: await resizeImage(f) }); }} /></label>
                  {s.shop.logo ? <button className="btn btn-ghost btn-sm block" onClick={() => s.setSection('shop', { logo: '' })}>{t('common.remove')}</button> : null}
                  <p className="hint">{t('set.logoHint')}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={t('set.shopNameEn')}><input className="input" {...shop('nameEn')} /></Field>
                <Field label={t('set.shopNameSi')}><input className="input" {...shop('nameSi')} /></Field>
                <Field label={t('set.addressEn')}><input className="input" {...shop('addressEn')} /></Field>
                <Field label={t('set.addressSi')}><input className="input" {...shop('addressSi')} /></Field>
                <Field label={t('cust.phone')}><input className="input" {...shop('phone')} /></Field>
                <Field label={t('set.phone2')}><input className="input" {...shop('phone2')} /></Field>
                <Field label={t('cust.email')}><input className="input" {...shop('email')} /></Field>
                <Field label={t('set.regNo')}><input className="input" {...shop('regNo')} placeholder="BR / VAT No." /></Field>
              </div>
            </div>
          ) : null}

          {tab === 'receipt' ? (
            <div className="grid xl:grid-cols-[1fr_auto] gap-6">
              <div className="space-y-3">
                <Field label={t('set.paper')}><select className="input" value={s.receipt.paper} onChange={(e) => s.setSection('receipt', { paper: e.target.value })}><option value="80">80 mm {t('set.thermal')}</option><option value="58">58 mm {t('set.thermal')}</option><option value="A5">A5</option><option value="A4">A4</option></select></Field>
                <Toggle label={t('set.bilingual')} checked={s.receipt.bilingual} onChange={(v) => s.setSection('receipt', { bilingual: v })} />
                <Toggle label={t('set.showLogo')} checked={s.receipt.showLogo} onChange={(v) => s.setSection('receipt', { showLogo: v })} />
                <Toggle label={t('set.showBarcode')} checked={s.receipt.showBarcode} onChange={(v) => s.setSection('receipt', { showBarcode: v })} />
                <Toggle label={t('set.showSavings')} checked={s.receipt.showSavings} onChange={(v) => s.setSection('receipt', { showSavings: v })} />
                <Toggle label={t('set.showCashier')} checked={s.receipt.showCashier} onChange={(v) => s.setSection('receipt', { showCashier: v })} />
                <Toggle label={t('set.autoPrint')} checked={s.receipt.autoPrint} onChange={(v) => s.setSection('receipt', { autoPrint: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('set.copies')}><select className="input" value={s.receipt.copies} onChange={(e) => s.setSection('receipt', { copies: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></Field>
                  <Field label={t('set.fontScale')}><select className="input" value={s.receipt.fontScale} onChange={(e) => s.setSection('receipt', { fontScale: Number(e.target.value) })}>{[0.9, 1, 1.1, 1.2].map((n) => <option key={n} value={n}>{Math.round(n * 100)}%</option>)}</select></Field>
                </div>
                <Field label={t('set.footerEn')}><input className="input" {...rc('footerEn')} /></Field>
                <Field label={t('set.footerSi')}><input className="input" {...rc('footerSi')} /></Field>
                <Field label={t('set.policyEn')}><textarea className="input" rows={2} {...rc('policyEn')} /></Field>
                <Field label={t('set.policySi')}><textarea className="input" rows={2} {...rc('policySi')} /></Field>
                <button className="btn btn-outline" onClick={() => printTestPage(s, s.receipt.paper)}><Printer size={18} /> {t('set.testPrint')}</button>
              </div>
              <div>
                <p className="label">{t('labels.preview')}</p>
                <div className="rounded-2xl p-4 overflow-auto max-h-[80vh]" style={{ background: 'var(--surface-2)' }}>
                  <div className="bg-white shadow-lift mx-auto" style={{ width: s.receipt.paper === '58' ? '58mm' : s.receipt.paper === '80' ? '80mm' : '150mm' }}><Receipt sale={SAMPLE} settings={s} /></div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'labels' ? (
            <div className="space-y-3 max-w-xl">
              <Field label={t('set.barcodeFormat')} hint={t('set.barcodeFormatHint')}><select className="input" value={s.labels.format} onChange={(e) => s.setSection('labels', { format: e.target.value })}><option value="EAN13">EAN-13 ({t('set.recommended')})</option><option value="CODE128">Code 128</option></select></Field>
              <Field label={t('set.prefix')} hint={t('set.prefixHint')}><input className="input" value={s.labels.prefix} onChange={(e) => s.setSection('labels', { prefix: e.target.value })} /></Field>
              <p className="muted">{t('set.labelsMore')}</p>
            </div>
          ) : null}

          {tab === 'tax' ? (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="font-display text-lg font-bold">{t('set.tax')}</p>
                <Toggle label={t('set.taxEnabled')} checked={s.tax.enabled} onChange={(v) => s.setSection('tax', { enabled: v })} />
                <Field label={t('set.taxLabel')}><input className="input" value={s.tax.label} onChange={(e) => s.setSection('tax', { label: e.target.value })} /></Field>
                <Field label={t('set.taxRate')}><input className="input" inputMode="decimal" value={s.tax.rate} onChange={(e) => s.setSection('tax', { rate: Number(e.target.value) || 0 })} /></Field>
                <Toggle label={t('set.taxInclusive')} checked={s.tax.inclusive} onChange={(v) => s.setSection('tax', { inclusive: v })} />
                <p className="hint">{t('set.taxHint')}</p>
              </div>
              <div className="space-y-3">
                <p className="font-display text-lg font-bold">{t('set.loyalty')}</p>
                <Toggle label={t('set.loyaltyEnabled')} checked={s.loyalty.enabled} onChange={(v) => s.setSection('loyalty', { enabled: v })} />
                <Field label={t('set.rsPerPoint')}><input className="input" inputMode="decimal" value={s.loyalty.rsPerPoint} onChange={(e) => s.setSection('loyalty', { rsPerPoint: Number(e.target.value) || 100 })} /></Field>
                <Field label={t('set.pointValue')}><input className="input" inputMode="decimal" value={s.loyalty.pointValue} onChange={(e) => s.setSection('loyalty', { pointValue: Number(e.target.value) || 1 })} /></Field>
              </div>
            </div>
          ) : null}

          {tab === 'terminal' ? (
            <div className="space-y-3 max-w-xl">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('set.terminalCode')} hint={t('set.terminalHint')}><input className="input" value={s.terminal.code} maxLength={4} onChange={(e) => s.setSection('terminal', { code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></Field>
                <Field label={t('set.terminalName')}><input className="input" value={s.terminal.name} onChange={(e) => s.setSection('terminal', { name: e.target.value })} /></Field>
              </div>
              <Field label={t('set.lowDefault')}><input className="input" inputMode="numeric" value={s.stock.lowDefault} onChange={(e) => s.setSection('stock', { lowDefault: Number(e.target.value) || 0 })} /></Field>
              <Toggle label={t('set.allowNegative')} checked={s.stock.allowNegative} onChange={(v) => s.setSection('stock', { allowNegative: v })} />
              <Toggle label={t('set.sound')} checked={s.sound} onChange={(v) => s.set({ sound: v })} />
              <Toggle label={t('prefs.bigText')} checked={s.bigText} onChange={(v) => s.set({ bigText: v })} />
              <Toggle label={t('prefs.dark')} checked={s.theme === 'dark'} onChange={(v) => s.set({ theme: v ? 'dark' : 'light' })} />
            </div>
          ) : null}

          {tab === 'printers' ? (
            <div className="space-y-4 max-w-3xl">
              <p className="text-lg">{t('set.printIntro')}</p>
              {['chrome', 'thermal', 'label', 'silent', 'scanner'].map((k) => (
                <div key={k} className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}>
                  <p className="font-bold mb-2">{t(`set.pg.${k}.title`)}</p>
                  <ul className="list-disc pl-5 space-y-1">{(t(`set.pg.${k}.steps`) || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-outline" onClick={() => printTestPage(s, '80')}><Printer size={18} /> 80 mm</button>
                <button className="btn btn-outline" onClick={() => printTestPage(s, '58')}><Printer size={18} /> 58 mm</button>
                <button className="btn btn-outline" onClick={() => printTestPage(s, 'A4')}><Printer size={18} /> A4</button>
              </div>
            </div>
          ) : null}

          {tab === 'sync' ? (
            <div className="space-y-3 max-w-xl">
              <p>{t('set.syncIntro')}</p>
              <Field label={t('set.apiUrl')} hint="https://yourshop.com/api"><input className="input" value={s.sync.url} onChange={(e) => s.setSection('sync', { url: e.target.value.trim() })} /></Field>
              <Field label={t('set.apiKey')}><input className="input" type="password" value={s.sync.key} onChange={(e) => s.setSection('sync', { key: e.target.value.trim() })} /></Field>
              <Toggle label={t('set.autoSync')} checked={s.sync.auto} onChange={(v) => s.setSection('sync', { auto: v })} />
              <Field label={t('set.syncEvery')}><select className="input" value={s.sync.intervalMin} onChange={(e) => s.setSection('sync', { intervalMin: Number(e.target.value) })}>{[1, 2, 5, 10, 15, 30].map((n) => <option key={n} value={n}>{n} min</option>)}</select></Field>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-outline" disabled={testing} onClick={async () => { setTesting(true); const r = await testConnection(s.sync.url, s.sync.key); setTesting(false); r.ok ? toast.ok(t('set.connOk')) : toast.err(t('set.connFail') + ' ' + r.message); }}><CheckCircle2 size={18} /> {t('set.testConn')}</button>
                <button className="btn btn-primary" onClick={async () => { const r = await syncNow(); r.ok ? toast.ok(t('set.synced', { up: r.pushed, down: r.pulled })) : toast.err(t('set.syncFail') + ' ' + (r.error || '')); }}><RefreshCw size={18} /> {t('set.syncNow')}</button>
              </div>
              {!s.sync.url ? <button className="btn btn-ghost btn-sm" onClick={() => s.setSection('sync', { url: `${window.location.origin}/api` })}>{t('srv.useThis')}</button> : null}
              <div className="rounded-2xl p-4 border-2 line space-y-3">
                <p className="font-bold flex items-center gap-2"><Scale size={18} /> {t('srv.compare')}</p>
                <p className="text-sm muted">{t('srv.compareHint')}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-outline" disabled={!!busy} onClick={async () => { setBusy('cmp'); try { setCmp(await compareWithServer()); } catch (e) { toast.err(String(e.message || e)); } setBusy(''); }}><Scale size={18} /> {t('srv.compareBtn')}</button>
                  {user.role === 'admin' ? <button className="btn btn-outline" disabled={!!busy} onClick={async () => {
                    if (!(await confirmDialog({ title: t('srv.uploadAll'), message: t('srv.uploadAllMsg') }))) return;
                    setBusy('up'); const r = await syncNow({ full: true }); setBusy('');
                    if (r.ok) { toast.ok(t('set.synced', { up: r.pushed, down: r.pulled })); setCmp(await compareWithServer()); } else toast.err(t('set.syncFail') + ' ' + (r.error || ''));
                  }}><CloudUpload size={18} /> {busy === 'up' ? t('setup.working') : t('srv.uploadAll')}</button> : null}
                  <button className="btn btn-outline" disabled={!!busy} onClick={async () => { try { await downloadServerExport(); } catch (e) { toast.err(String(e.message || e)); } }}><Download size={18} /> {t('srv.download')}</button>
                </div>
                {cmp ? (
                  <div className="overflow-x-auto"><table className="table text-sm">
                    <thead><tr><th>{t('srv.what')}</th><th className="text-right">{t('srv.here')}</th><th className="text-right">{t('srv.server')}</th><th /></tr></thead>
                    <tbody>{cmp.map((r) => <tr key={r.table}><td>{r.table}</td><td className="text-right">{r.local}</td><td className="text-right">{r.server}</td>
                      <td>{r.local === r.server ? <span className="badge badge-green">✓ {t('srv.same')}</span> : <span className="badge badge-gold">{r.local > r.server ? t('srv.notUploaded') : t('srv.notDownloaded')}</span>}</td></tr>)}</tbody>
                  </table>
                  <p className={`font-bold mt-2 ${cmp.every((r) => r.local === r.server) ? 'text-leaf-600' : 'text-saffron-700'}`}>{cmp.every((r) => r.local === r.server) ? t('srv.allSame') : t('srv.notSame')}</p></div>
                ) : null}
              </div>
              {user.role === 'admin' ? (
                <div className="rounded-2xl p-4 border-2 border-dashed line space-y-2">
                  <p className="font-bold">{t('set.joinCloud')}</p>
                  <p className="text-sm muted">{t('set.joinCloudHint')}</p>
                  <button className="btn btn-outline" onClick={async () => {
                    const pending = await unsyncedCount();
                    if (pending > 0) { toast.err(t('srv.pendingBlock', { n: pending })); return; }
                    if (!(await confirmDialog({ title: t('set.joinCloud'), message: t('set.joinCloudMsg'), danger: true, okText: t('set.joinCloud') }))) return;
                    await doBackup();
                    const r = await joinFromCloud();
                    if (r.ok) { toast.ok(t('set.joined', { n: r.pulled })); logout(); setTimeout(() => window.location.reload(), 900); }
                    else toast.err(t('set.syncFail') + ' ' + (r.error || ''));
                  }}><Download size={18} /> {t('set.joinCloud')}</button>
                </div>
              ) : null}
              <div className="rounded-2xl p-4 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
                <p>{t('set.lastOk')}: <b>{s.sync.lastOk ? fmtDateTime(s.sync.lastOk) : '—'}</b> {s.sync.lastResult}</p>
                {s.sync.lastError ? <p className="text-maroon-600 flex gap-1"><AlertTriangle size={16} /> {s.sync.lastError}</p> : null}
              </div>
            </div>
          ) : null}

          {tab === 'backup' ? (
            <div className="space-y-4 max-w-2xl">
              <div className="rounded-2xl p-4 border-2 line space-y-3">
                <p className="font-bold flex items-center gap-2"><FolderOpen size={18} /> {t('bk.folderTitle')}</p>
                <p className="text-sm">{t('bk.folderIntro')}</p>
                {!folderSupported() ? <p className="text-sm text-maroon-600 font-bold">{t('bk.unsupported')}</p> : (<>
                  {fstate?.configured ? (
                    <div className="text-sm rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                      <p>{t('bk.folder')}: <b>{fstate.name}</b> · {fstate.permission === 'granted' ? <span className="badge badge-green">{t('bk.active')}</span> : <span className="badge badge-gold">{t('bk.needsAllow')}</span>}</p>
                      <p>{t('bk.last')}: <b>{fstate.last ? fmtDateTime(fstate.last) : '—'}</b></p>
                      {fstate.lastError ? <p className="text-maroon-600">{fstate.lastError}</p> : null}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary" onClick={async () => { try { await chooseFolder(); const r = await runFolderBackup({ force: true }); r.ok ? toast.ok(t('bk.savedFolder')) : toast.err(r.error || r.reason); } catch (e) { if (e.name !== 'AbortError') toast.err(String(e.message || e)); } refreshFolder(); }}><FolderOpen size={18} /> {fstate?.configured ? t('bk.change') : t('bk.choose')}</button>
                    {fstate?.configured ? <button className="btn btn-outline" onClick={async () => { if (fstate.permission !== 'granted' && !(await allowFolder())) return; const r = await runFolderBackup({ force: true }); r.ok ? toast.ok(t('bk.savedFolder')) : toast.err(r.error || r.reason); refreshFolder(); }}><RefreshCw size={18} /> {t('bk.now')}</button> : null}
                  </div>
                  <p className="hint">{t('bk.folderTip')}</p>
                </>)}
              </div>
              <div className="rounded-2xl p-4 border-2 line space-y-3">
                <p className="font-bold flex items-center gap-2"><FileSpreadsheet size={18} /> {t('bk.excelTitle')}</p>
                <p className="text-sm">{t('bk.excelIntro')}</p>
                <div className="flex flex-wrap gap-2">
                  {['today', 'month', 'last', 'all'].map((w) => <button key={w} className="btn btn-outline" onClick={() => excel(w)}><FileSpreadsheet size={18} /> {t('bk.x.' + w)}</button>)}
                </div>
              </div>
              <p>{t('set.backupIntro')}</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={doBackup}><Download size={18} /> {t('set.backup')}</button>
                <label className="btn btn-outline cursor-pointer"><Upload size={18} /> {t('set.restore')}<input type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files[0] && doRestore(e.target.files[0])} /></label>
              </div>
              {usage ? <p className="muted text-sm">{t('set.storage')}: {(usage.usage / 1048576).toFixed(1)} MB / {(usage.quota / 1073741824).toFixed(1)} GB</p> : null}
              {user.role === 'admin' && import.meta.env.VITE_DEMO !== 'false' ? (
                <div className="rounded-2xl p-4 border-2 border-maroon-500/40 space-y-2">
                  <p className="font-bold text-maroon-600">{t('set.danger')}</p>
                  <p className="text-sm">{t('set.freshHint')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-danger" onClick={startFresh}><Trash2 size={18} /> {t('set.fresh')}</button>
                    {import.meta.env.VITE_DEMO !== 'false' ? <button className="btn btn-outline" onClick={reloadDemo}><RefreshCw size={18} /> {t('set.demo')}</button> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
