import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ScanBarcode, ReceiptText, Undo2, Users, Wallet, Shirt, Tags, Barcode, Boxes, Truck, Factory,
  BadgePercent, Receipt, BarChart3, UserCog, Settings, Menu, X, LogOut, Moon, Sun, Wifi, WifiOff, CloudUpload, CloudOff, AArrowUp, ShieldAlert, ListPlus, ScanSearch,
} from 'lucide-react';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth, can } from '../store/auth';
import { syncNow } from '../lib/sync';
import { folderState, runFolderBackup, allowFolder } from '../lib/autobackup';
import { requestPersistence } from '../db/db';
import { HelpDrawer } from './Help';
import PriceCheck, { usePriceCheck } from './PriceCheck';
import { ClothingIcon } from '../icons/clothing';

export const NAV = [
  { group: 'nav.sell', items: [
    { to: '/app', key: 'nav.dashboard', icon: LayoutDashboard, perm: 'dashboard', end: true },
    { to: '/app/pos', key: 'nav.pos', icon: ScanBarcode, perm: 'pos', big: true },
    { to: '/app/sales', key: 'nav.sales', icon: ReceiptText, perm: 'sales' },
    { to: '/app/returns', key: 'nav.returns', icon: Undo2, perm: 'returns' },
    { to: '/app/customers', key: 'nav.customers', icon: Users, perm: 'customers' },
    { to: '/app/shifts', key: 'nav.shifts', icon: Wallet, perm: 'shifts' },
  ] },
  { group: 'nav.stock', items: [
    { to: '/app/quick-add', key: 'nav.quickAdd', icon: ListPlus, perm: 'products' },
    { to: '/app/products', key: 'nav.products', icon: Shirt, perm: 'products' },
    { to: '/app/categories', key: 'nav.categories', icon: Tags, perm: 'categories' },
    { to: '/app/labels', key: 'nav.labels', icon: Barcode, perm: 'labels' },
    { to: '/app/inventory', key: 'nav.inventory', icon: Boxes, perm: 'inventory' },
    { to: '/app/purchases', key: 'nav.purchases', icon: Truck, perm: 'purchases' },
    { to: '/app/suppliers', key: 'nav.suppliers', icon: Factory, perm: 'suppliers' },
  ] },
  { group: 'nav.business', items: [
    { to: '/app/promotions', key: 'nav.promotions', icon: BadgePercent, perm: 'promotions' },
    { to: '/app/expenses', key: 'nav.expenses', icon: Receipt, perm: 'expenses' },
    { to: '/app/reports', key: 'nav.reports', icon: BarChart3, perm: 'reports' },
  ] },
  { group: 'nav.admin', items: [
    { to: '/app/users', key: 'nav.users', icon: UserCog, perm: 'users' },
    { to: '/app/settings', key: 'nav.settings', icon: Settings, perm: 'settings' },
  ] },
];

export function Brand({ compact, light }) {
  const shop = useSettings((s) => s.shop);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {shop.logo
        ? <img src={shop.logo} alt="" className="w-10 h-10 rounded-xl object-contain bg-white" />
        : <div className="w-10 h-10 rounded-xl bg-saffron-500 text-indigo-800 grid place-items-center shrink-0"><ClothingIcon id="tshirt" size={24} stroke={2} /></div>}
      {!compact ? (
        <div className="min-w-0 leading-tight">
          <p className={`font-display font-extrabold text-lg ${light ? 'text-white' : ''}`}>Redi POS</p>
          <p className={`text-xs truncate ${light ? 'text-indigo-200' : 'muted'}`}>{shop.nameEn}</p>
        </div>
      ) : null}
    </div>
  );
}

export function LangSwitch({ dark }) {
  const lang = useSettings((s) => s.lang);
  const set = useSettings((s) => s.set);
  const base = dark ? 'text-indigo-100' : '';
  return (
    <div className={`inline-flex rounded-xl p-1 ${dark ? 'bg-white/10' : ''}`} style={dark ? undefined : { background: 'var(--surface-2)' }} role="group" aria-label="Language">
      {[['en', 'English'], ['si', 'සිංහල']].map(([k, l]) => (
        <button key={k} onClick={() => set({ lang: k })} aria-pressed={lang === k}
          className={`px-3 h-9 rounded-lg font-bold text-sm transition ${lang === k ? 'bg-saffron-500 text-ink' : base}`}>{l}</button>
      ))}
    </div>
  );
}

function SideNav({ onNavigate }) {
  const t = useT();
  const user = useAuth((s) => s.user);
  return (
    <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-4" aria-label="Main">
      {NAV.map((g) => {
        const items = g.items.filter((i) => can(user, i.perm));
        if (!items.length) return null;
        return (
          <div key={g.group} className="mt-4">
            <p className="px-3 mb-1 text-xs font-bold text-indigo-300">{t(g.group)}</p>
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate}
                className={({ isActive }) => `flex items-center gap-3 px-3 rounded-xl font-bold transition mb-0.5 ${i.big ? 'h-12' : 'h-11'} ${isActive ? 'bg-white text-indigo-800 shadow' : 'text-indigo-100 hover:bg-white/10'}`}>
                {({ isActive }) => (<>
                  <i.icon size={21} className={isActive ? 'text-indigo-700' : ''} />
                  <span className="truncate">{t(i.key)}</span>
                  {i.big && !isActive ? <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-saffron-500 text-ink">F9</span> : null}
                </>)}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true); const b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

export default function Layout() {
  const t = useT();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { theme, bigText, set, sync } = useSettings();
  const online = useOnline();

  useEffect(() => { if (!user) nav('/login', { replace: true }); }, [user, nav]);
  useEffect(() => { requestPersistence(); }, []);
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  // background cloud sync
  useEffect(() => {
    if (!sync.url || !sync.key || !sync.auto) return;
    syncNow();
    const id = setInterval(syncNow, Math.max(1, sync.intervalMin || 5) * 60000);
    window.addEventListener('online', syncNow);
    return () => { clearInterval(id); window.removeEventListener('online', syncNow); };
  }, [sync.url, sync.key, sync.auto, sync.intervalMin]);

  // Automatic backups into the chosen folder (checked every 15 minutes, written every 2 hours)
  const [folder, setFolder] = useState(null);
  useEffect(() => {
    if (!user) return undefined;
    const tick = async () => { await runFolderBackup(); setFolder(await folderState()); };
    tick();
    const id = setInterval(tick, 15 * 60000);
    return () => clearInterval(id);
  }, [user]);
  const canBackup = user && ['admin', 'manager'].includes(user.role);

  // F9 jumps to billing from anywhere
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'F9') { e.preventDefault(); nav('/app/pos'); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  if (!user) return null;
  const navItem = NAV.flatMap((g) => g.items).find((i) => i.to === loc.pathname.replace(/\/$/, ''));
  const allowed = !navItem || can(user, navItem.perm);
  const cloudOk = sync.url && sync.lastOk && (!sync.lastFail || sync.lastOk > sync.lastFail);

  return (
    <div className="h-dvh flex overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* sidebar */}
      <aside className={`fixed lg:static z-40 inset-y-0 left-0 w-72 bg-indigo-700 flex flex-col transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="weave h-1.5" />
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <Brand light />
          <button className="lg:hidden icon-btn text-white" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <SideNav onNavigate={() => setOpen(false)} />
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 text-white">
            <div className="w-10 h-10 rounded-full bg-saffron-500 text-ink grid place-items-center font-bold">{user.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate">{user.name}</p>
              <p className="text-xs text-indigo-200">{t('role.' + user.role)}</p>
            </div>
            <button className="icon-btn text-indigo-100 hover:!bg-white/10" onClick={() => { logout(); nav('/login'); }} title={t('nav.logout')} aria-label={t('nav.logout')}><LogOut size={20} /></button>
          </div>
        </div>
      </aside>
      {open ? <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} /> : null}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 flex items-center gap-2 px-3 sm:px-5 border-b line" style={{ background: 'var(--surface)' }}>
          <button className="icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu /></button>
          <div className="lg:hidden"><Brand compact /></div>
          <div className="flex-1" />
          <span className={`hidden sm:inline-flex badge ${online ? 'badge-green' : 'badge-red'}`} title={online ? t('status.onlineHint') : t('status.offlineHint')}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />} {online ? t('status.online') : t('status.offline')}
          </span>
          {sync.url ? (
            <span className={`hidden md:inline-flex badge ${cloudOk ? 'badge-blue' : 'badge-gold'}`} title={sync.lastError || sync.lastResult}>
              {cloudOk ? <CloudUpload size={14} /> : <CloudOff size={14} />} {cloudOk ? t('status.synced') : t('status.notSynced')}
            </span>
          ) : null}
          <button className="btn btn-outline btn-sm !h-10 hidden sm:inline-flex" onClick={() => usePriceCheck.getState().set({ open: true })} title="F3"><ScanSearch size={18} /> {t('pc.title')}</button>
          <button className="icon-btn sm:hidden" onClick={() => usePriceCheck.getState().set({ open: true })} aria-label={t('pc.title')}><ScanSearch size={21} /></button>
          <LangSwitch />
          <button className={`icon-btn ${bigText ? 'bg-indigo-700 text-white hover:!bg-indigo-800' : ''}`} onClick={() => set({ bigText: !bigText })} title={t('prefs.bigText')} aria-label={t('prefs.bigText')} aria-pressed={bigText}><AArrowUp size={22} /></button>
          <button className="icon-btn" onClick={() => set({ theme: theme === 'dark' ? 'light' : 'dark' })} title={t('prefs.theme')} aria-label={t('prefs.theme')}>{theme === 'dark' ? <Sun size={21} /> : <Moon size={21} />}</button>
        </header>
        {canBackup && folder && (!folder.configured || folder.permission !== 'granted') ? (
          <div className="shrink-0 px-4 py-2 bg-saffron-100 text-saffron-900 dark:bg-saffron-900/40 dark:text-saffron-100 flex flex-wrap items-center gap-3 text-sm font-bold">
            <span className="flex-1 min-w-[14rem]">{folder.configured ? t('bk.needAllow', { name: folder.name }) : t('bk.noFolder')}</span>
            {folder.configured
              ? <button className="btn btn-primary btn-sm" onClick={async () => { if (await allowFolder()) { await runFolderBackup({ force: true }); setFolder(await folderState()); } }}>{t('bk.allow')}</button>
              : <button className="btn btn-primary btn-sm" onClick={() => nav('/app/settings?tab=backup')}>{t('bk.setUp')}</button>}
          </div>
        ) : null}
        <main className="flex-1 min-h-0 overflow-y-auto scroll-thin" id="main">
          {allowed ? <Outlet /> : (
            <div className="p-10 text-center max-w-md mx-auto">
              <ShieldAlert size={44} className="mx-auto text-maroon-600 mb-3" />
              <p className="font-display text-2xl font-bold">{t('common.noAccess')}</p>
              <p className="muted mt-1">{t('common.noAccessText')}</p>
            </div>
          )}
        </main>
      </div>
      <HelpDrawer />
      <PriceCheck />
    </div>
  );
}

export function Page({ children, wide }) {
  return <div className={`p-4 sm:p-6 ${wide ? '' : 'max-w-7xl'} mx-auto`}>{children}</div>;
}
