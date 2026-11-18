import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Delete, LogIn, ArrowLeft } from 'lucide-react';
import { db, getMeta } from '../db/db';
import { useAuth } from '../store/auth';
import { useT } from '../i18n';
import { Brand, LangSwitch } from '../components/Layout';
import { HelpButton, HelpDrawer } from '../components/Help';

export default function Login() {
  const t = useT();
  const nav = useNavigate();
  const users = useLiveQuery(() => db.users.toArray(), []) || [];
  const login = useAuth((s) => s.login);
  const current = useAuth((s) => s.user);
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [demo, setDemo] = useState(false);
  useEffect(() => { getMeta('demo').then(setDemo); }, []);
  useEffect(() => { if (current) nav('/app', { replace: true }); }, [current, nav]);

  const submit = async (p = pin) => {
    if (!sel) return;
    const r = await login(sel.username, p);
    if (r.ok) nav(r.user.role === 'cashier' ? '/app/pos' : '/app', { replace: true });
    else { setErr(t(r.error)); setPin(''); }
  };
  const press = (d) => {
    setErr('');
    const next = (pin + d).slice(0, 6);
    setPin(next);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (!sel) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      else if (e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const demoPins = { admin: '1234', manager: '2222', cashier: '1111', stock: '3333' };
  const active = users.filter((u) => u.active);

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden lg:flex flex-col bg-indigo-700 text-white p-10 relative overflow-hidden">
        <div className="weave h-2 absolute top-0 inset-x-0" />
        <Link to="/" className="inline-flex items-center gap-2 text-indigo-200 font-bold mb-10"><ArrowLeft size={18} /> {t('login.back')}</Link>
        <Brand light />
        <p className="font-display text-5xl font-extrabold leading-[1.05] mt-auto max-w-md">{t('login.welcome')}</p>
        <p className="text-indigo-200 text-lg mt-4 max-w-md">{t('login.welcomeSub')}</p>
        <div className="weave-thin h-3 mt-10 opacity-80" />
      </div>
      <div className="flex flex-col p-5 sm:p-10">
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="lg:hidden"><Brand /></div>
          <div className="flex-1" />
          <LangSwitch />
          <HelpButton page="login" />
        </div>
        <div className="max-w-md w-full mx-auto my-auto">
          <h1 className="font-display text-3xl font-bold mb-1">{sel ? t('login.enterPin') : t('login.whoAreYou')}</h1>
          <p className="muted mb-6">{sel ? sel.name : t('login.tapName')}</p>
          {!sel ? (
            <div className="grid grid-cols-2 gap-3">
              {active.map((u) => (
                <button key={u.id} onClick={() => { setSel(u); setPin(''); setErr(''); }}
                  className="card p-4 text-left hover:border-indigo-400 transition flex flex-col gap-2">
                  <span className="w-12 h-12 rounded-full bg-saffron-500 text-ink grid place-items-center text-xl font-bold">{u.name.slice(0, 1)}</span>
                  <span className="font-bold leading-tight">{u.name}</span>
                  <span className="badge badge-blue self-start">{t('role.' + u.role)}</span>
                  {demo ? <span className="text-xs muted">{t('login.demoPin')}: {demoPins[u.username] || '—'}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <div className="flex justify-center gap-3 mb-3" aria-live="polite">
                {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                  <span key={i} className={`w-5 h-5 rounded-full border-2 ${i < pin.length ? 'bg-indigo-700 border-indigo-700' : 'line'}`} />
                ))}
              </div>
              <p className="text-center text-maroon-600 font-bold h-6">{err}</p>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button key={d} className="btn btn-outline btn-lg text-2xl !h-16" onClick={() => press(d)}>{d}</button>
                ))}
                <button className="btn btn-ghost btn-lg !h-16" onClick={() => setPin((p) => p.slice(0, -1))} aria-label={t('common.delete')}><Delete /></button>
                <button className="btn btn-outline btn-lg text-2xl !h-16" onClick={() => press('0')}>0</button>
                <button className="btn btn-primary btn-lg !h-16" onClick={() => submit()} aria-label={t('login.signIn')}><LogIn /></button>
              </div>
              <button className="btn btn-ghost w-full mt-4" onClick={() => { setSel(null); setPin(''); }}>{t('login.otherUser')}</button>
            </div>
          )}
        </div>
      </div>
      <HelpDrawer />
    </div>
  );
}
