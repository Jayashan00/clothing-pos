import { useMemo, useEffect } from 'react';
import { useSettings } from '../store/settings';
import en from './en';
import si from './si';

const dicts = { en, si };

export function translate(lang, key, vars) {
  let s = (dicts[lang] && dicts[lang][key]) ?? en[key] ?? key;
  if (vars && typeof s === 'string') for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

export function useT() {
  const lang = useSettings((s) => s.lang);
  return useMemo(() => {
    const t = (key, vars) => translate(lang, key, vars);
    t.lang = lang;
    // pick the right language field from a record, e.g. name(product) -> nameSi / nameEn
    // Function.name is read-only, so it must be (re)defined rather than assigned.
    Object.defineProperty(t, 'name', { value: (obj, field = 'name') => (obj ? (lang === 'si' && obj[field + 'Si']) || obj[field + 'En'] || obj[field] || '' : ''), configurable: true });
    return t;
  }, [lang]);
}

export function useApplyHtmlPrefs() {
  const { lang, theme, bigText } = useSettings();
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.classList.toggle('dark', theme === 'dark');
    el.classList.toggle('big-text', !!bigText);
  }, [lang, theme, bigText]);
}
