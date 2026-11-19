import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { X, CheckCircle2, AlertTriangle, Info, Search, KeyRound } from 'lucide-react';
import { useT } from '../i18n';
import { ClothingIcon } from '../icons/clothing';
import { useAuth } from '../store/auth';

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, size = 'md', icon }) {
  const ref = useRef(null);
  // Keep the latest onClose without re-running the effect: parents pass a new function on
  // every render, and re-running would move the cursor back to the first box on each keystroke.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    // focus the first box only once, when the window opens
    const id = setTimeout(() => ref.current?.querySelector('input,select,textarea,button[data-autofocus]')?.focus(), 30);
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-indigo-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} className={`relative w-full ${w} max-h-[94vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-pop anim-pop`} style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          {icon ? <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 grid place-items-center dark:bg-indigo-800 dark:text-indigo-100">{icon}</div> : null}
          <h2 className="font-display text-xl font-bold flex-1">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto scroll-thin flex-1">{children}</div>
        {footer ? <div className="px-5 py-4 border-t line flex flex-wrap gap-2 justify-end">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
const useToasts = create((set) => ({
  items: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ items: [...s.items, { id, ...t }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), t.ms || 3200);
  },
}));
export const toast = {
  ok: (msg) => useToasts.getState().push({ type: 'ok', msg }),
  err: (msg) => useToasts.getState().push({ type: 'err', msg, ms: 5000 }),
  info: (msg) => useToasts.getState().push({ type: 'info', msg }),
};
export function ToastHost() {
  const items = useToasts((s) => s.items);
  return (
    <div className="fixed z-[70] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-end pointer-events-none" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto anim-slide flex items-center gap-3 rounded-2xl px-4 py-3 shadow-pop text-white font-bold max-w-md ${t.type === 'ok' ? 'bg-leaf-600' : t.type === 'err' ? 'bg-maroon-600' : 'bg-indigo-700'}`}>
          {t.type === 'ok' ? <CheckCircle2 size={20} /> : t.type === 'err' ? <AlertTriangle size={20} /> : <Info size={20} />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Confirm & manager PIN (promise based) ---------- */
const useDialog = create((set) => ({ confirm: null, pin: null, set }));
export const confirmDialog = (opts) => new Promise((resolve) => useDialog.getState().set({ confirm: { ...opts, resolve } }));
export const askManagerPin = (reason) => new Promise((resolve) => useDialog.getState().set({ pin: { reason, resolve } }));

export function DialogHost() {
  const t = useT();
  const { confirm, pin, set } = useDialog();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const verify = useAuth((s) => s.verifyPin);
  const closeC = (v) => { confirm?.resolve(v); set({ confirm: null }); };
  const closeP = (v) => { pin?.resolve(v); set({ pin: null }); setCode(''); setErr(''); };
  return (
    <>
      <Modal open={!!confirm} onClose={() => closeC(false)} title={confirm?.title || t('common.areYouSure')} size="sm"
        footer={<>
          <button className="btn btn-ghost" onClick={() => closeC(false)}>{t('common.cancel')}</button>
          <button data-autofocus className={`btn ${confirm?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => closeC(true)}>{confirm?.okText || t('common.yes')}</button>
        </>}>
        <p className="text-base">{confirm?.message}</p>
      </Modal>
      <Modal open={!!pin} onClose={() => closeP(null)} title={t('pin.title')} size="sm" icon={<KeyRound size={20} />}
        footer={<>
          <button className="btn btn-ghost" onClick={() => closeP(null)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={async () => { const u = await verify(code); if (u) closeP(u); else setErr(t('pin.wrong')); }}>{t('pin.approve')}</button>
        </>}>
        <p className="muted mb-3">{pin?.reason}</p>
        <input className="input text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={6} value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr(''); }}
          onKeyDown={async (e) => { if (e.key === 'Enter') { const u = await verify(code); if (u) closeP(u); else setErr(t('pin.wrong')); } }} />
        {err ? <p className="text-maroon-600 font-bold mt-2">{err}</p> : null}
      </Modal>
    </>
  );
}

/* ---------- Small building blocks ---------- */
export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label ? <span className="label">{label}</span> : null}
      {children}
      {hint ? <span className="hint block">{hint}</span> : null}
    </label>
  );
}

export function SearchBox({ value, onChange, placeholder, autoFocus, inputRef, onKeyDown, scanTarget }) {
  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 muted" size={20} />
      <input ref={inputRef} className="input pl-11" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoFocus={autoFocus} onKeyDown={onKeyDown} data-scan-target={scanTarget ? '1' : undefined} type="search" />
    </div>
  );
}

export function ProductIcon({ icon, color = '#1F2A5C', size = 44, iconSize }) {
  return (
    <div className="grid place-items-center rounded-xl shrink-0" style={{ width: size, height: size, background: color + '18', color }}>
      <ClothingIcon id={icon} size={iconSize || Math.round(size * 0.62)} stroke={1.7} />
    </div>
  );
}

export function Empty({ icon, title, text, action }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="mx-auto w-16 h-16 rounded-2xl grid place-items-center bg-indigo-50 text-indigo-700 mb-4 dark:bg-indigo-800 dark:text-indigo-100">{icon}</div>
      <p className="font-display text-lg font-bold">{title}</p>
      {text ? <p className="muted mt-1 max-w-sm mx-auto">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone = 'indigo' }) {
  const tones = { indigo: 'bg-indigo-50 text-indigo-700', gold: 'bg-saffron-50 text-saffron-700', green: 'bg-leaf-50 text-leaf-600', red: 'bg-maroon-50 text-maroon-600' };
  return (
    <div className="card p-4 flex gap-3 items-start">
      <div className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="muted text-sm font-bold">{label}</p>
        <p className="font-display text-2xl font-bold leading-tight truncate">{value}</p>
        {sub ? <p className="muted text-xs mt-0.5">{sub}</p> : null}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)' }} role="tablist">
      {tabs.map((tb) => (
        <button key={tb.id} role="tab" aria-selected={value === tb.id} className={`tab ${value === tb.id ? 'tab-active' : ''}`} onClick={() => onChange(tb.id)}>{tb.label}</button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="font-bold">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition shrink-0 ${checked ? 'bg-leaf-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </label>
  );
}
