import { useEffect } from 'react';
import { create } from 'zustand';
import { HelpCircle, Lightbulb, Keyboard } from 'lucide-react';
import { useT } from '../i18n';
import { Modal } from './ui';

export const useHelp = create((set) => ({ page: 'dashboard', open: false, set }));

export function HelpButton({ page, className = '' }) {
  const t = useT();
  const set = useHelp((s) => s.set);
  return (
    <button className={`icon-btn bg-saffron-100 text-saffron-800 hover:!bg-saffron-200 dark:bg-saffron-900/40 dark:text-saffron-200 ${className}`}
      onClick={() => set({ page, open: true })} aria-label={t('help.open')} title={t('help.open') + ' (F1)'}>
      <HelpCircle size={24} />
    </button>
  );
}

export function HelpDrawer() {
  const t = useT();
  const { page, open, set } = useHelp();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'F1') { e.preventDefault(); set({ open: true }); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [set]);
  const steps = t(`help.${page}.steps`);
  const tips = t(`help.${page}.tips`);
  const keys = t(`help.${page}.keys`);
  return (
    <Modal open={open} onClose={() => set({ open: false })} title={t(`help.${page}.title`)} icon={<HelpCircle size={20} />}>
      <p className="text-lg mb-4">{t(`help.${page}.intro`)}</p>
      {Array.isArray(steps) ? (
        <ol className="space-y-3 mb-5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-8 h-8 shrink-0 rounded-full bg-indigo-700 text-white grid place-items-center font-bold">{i + 1}</span>
              <span className="pt-1">{s}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {Array.isArray(tips) ? (
        <div className="rounded-2xl p-4 bg-saffron-50 dark:bg-saffron-900/30 mb-4">
          <p className="font-bold flex items-center gap-2 mb-2"><Lightbulb size={18} /> {t('help.tips')}</p>
          <ul className="list-disc pl-5 space-y-1">{tips.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      ) : null}
      {Array.isArray(keys) ? (
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}>
          <p className="font-bold flex items-center gap-2 mb-2"><Keyboard size={18} /> {t('help.shortcuts')}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {keys.map((k, i) => {
              const [key, desc] = k.split('|');
              return <div key={i} className="flex items-center gap-2"><kbd className="px-2 py-1 rounded-md bg-indigo-700 text-white text-sm font-bold min-w-[3rem] text-center">{key}</kbd><span>{desc}</span></div>;
            })}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function PageHeader({ title, subtitle, help, actions, icon }) {
  const set = useHelp((s) => s.set);
  useEffect(() => { if (help) set({ page: help }); }, [help, set]);
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {icon ? <div className="w-12 h-12 rounded-2xl bg-indigo-700 text-white grid place-items-center shrink-0">{icon}</div> : null}
      <div className="flex-1 min-w-[12rem]">
        <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {help ? <HelpButton page={help} /> : null}
      </div>
    </div>
  );
}
