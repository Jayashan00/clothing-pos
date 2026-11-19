import { useState } from 'react';
import { Store, CloudDownload, KeyRound } from 'lucide-react';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { joinFromCloud, testConnection } from '../lib/sync';
import { createOwnerOnly } from '../db/seed';
import { Field, toast } from '../components/ui';
import { Brand, LangSwitch } from '../components/Layout';

// Shown once, on a computer that has no shop data yet (production builds have no demo data).
export default function Setup({ onDone }) {
  const t = useT();
  const sync = useSettings((s) => s.sync);
  const setSection = useSettings((s) => s.setSection);
  const [mode, setMode] = useState(null);
  const [url, setUrl] = useState(sync.url || `${window.location.origin}/api`);
  const [key, setKey] = useState(sync.key || '');
  const [code, setCode] = useState('T1');
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const ok = await testConnection(url, key);
      if (!ok.ok) { toast.err(t('setup.connFail') + ' ' + (ok.message || '')); return; }
      setSection('sync', { url: url.trim(), key: key.trim(), auto: true, intervalMin: 2 });
      setSection('terminal', { code, name: `Counter ${code.replace(/\D/g, '') || code}` });
      const r = await joinFromCloud();
      if (!r.ok) { toast.err(t('set.syncFail') + ' ' + (r.error || '')); return; }
      toast.ok(t('set.joined', { n: r.pulled }));
      onDone();
    } finally { setBusy(false); }
  };
  const fresh = async () => {
    setBusy(true);
    try {
      setSection('terminal', { code, name: `Counter ${code.replace(/\D/g, '') || code}` });
      if (key.trim()) setSection('sync', { url: url.trim(), key: key.trim(), auto: true, intervalMin: 2 });
      await createOwnerOnly();
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="weave h-2" />
      <div className="flex items-center justify-between p-5"><Brand /><LangSwitch /></div>
      <div className="max-w-2xl w-full mx-auto p-5 my-auto">
        <h1 className="font-display text-3xl font-bold mb-2">{t('setup.title')}</h1>
        <p className="muted text-lg mb-6">{t('setup.intro')}</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <button onClick={() => setMode('join')} className={`card p-5 text-left border-2 ${mode === 'join' ? '!border-indigo-600' : ''}`}>
            <CloudDownload size={30} className="text-indigo-600 mb-2" />
            <p className="font-bold text-lg">{t('setup.join')}</p>
            <p className="muted text-sm">{t('setup.joinHint')}</p>
          </button>
          <button onClick={() => setMode('new')} className={`card p-5 text-left border-2 ${mode === 'new' ? '!border-indigo-600' : ''}`}>
            <Store size={30} className="text-indigo-600 mb-2" />
            <p className="font-bold text-lg">{t('setup.new')}</p>
            <p className="muted text-sm">{t('setup.newHint')}</p>
          </button>
        </div>
        {mode ? (
          <div className="card p-5 space-y-3">
            <div className="grid sm:grid-cols-[1fr_8rem] gap-3">
              <Field label={t('set.apiUrl')}><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
              <Field label={t('set.terminalCode')}><input className="input" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></Field>
            </div>
            <Field label={t('set.apiKey')} hint={mode === 'new' ? t('setup.keyOptional') : t('setup.keyHint')}>
              <div className="relative"><KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
                <input className="input pl-10 font-mono" type="password" value={key} onChange={(e) => setKey(e.target.value)} /></div>
            </Field>
            <p className="hint">{t('set.terminalHint')}</p>
            {mode === 'join'
              ? <button className="btn btn-primary btn-lg w-full" disabled={busy || !key} onClick={connect}><CloudDownload /> {busy ? t('setup.working') : t('setup.join')}</button>
              : <button className="btn btn-primary btn-lg w-full" disabled={busy} onClick={fresh}><Store /> {t('setup.new')}</button>}
            {mode === 'new' ? <p className="text-sm muted">{t('setup.newLogin')}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
