import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ICONS, ClothingIcon, recommendIcons } from '../icons/clothing';
import { useT } from '../i18n';

export default function IconPicker({ value, onChange, text, color = '#1F2A5C' }) {
  const t = useT();
  const [q, setQ] = useState('');
  const recommended = useMemo(() => recommendIcons(text, 4), [text]);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return ICONS.filter((i) => !s || i.en.toLowerCase().includes(s) || i.si.includes(q) || i.kw.some((k) => k.includes(s)));
  }, [q]);
  const Tile = ({ icon, rec }) => (
    <button type="button" onClick={() => onChange(icon.id)} title={t.lang === 'si' ? icon.si : icon.en}
      className={`relative flex flex-col items-center gap-1 rounded-xl p-2 border-2 transition ${value === icon.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-800' : 'border-transparent hover:border-indigo-200'}`}>
      {rec ? <Sparkles size={13} className="absolute top-1 right-1 text-saffron-600" /> : null}
      <span style={{ color }}><ClothingIcon id={icon.id} size={30} /></span>
      <span className="text-[11px] leading-tight text-center font-bold line-clamp-2">{t.lang === 'si' ? icon.si : icon.en}</span>
    </button>
  );
  return (
    <div>
      {recommended.length ? (
        <div className="mb-3 rounded-xl p-3 bg-saffron-50 dark:bg-saffron-900/30">
          <p className="text-sm font-bold flex items-center gap-1.5 mb-2 text-saffron-800 dark:text-saffron-200"><Sparkles size={16} /> {t('icons.suggested')}</p>
          <div className="grid grid-cols-4 gap-2">
            {recommended.map((id) => <Tile key={id} icon={ICONS.find((i) => i.id === id)} rec />)}
          </div>
        </div>
      ) : null}
      <input className="input mb-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('icons.search')} />
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-64 overflow-y-auto scroll-thin pr-1">
        {list.map((i) => <Tile key={i.id} icon={i} />)}
      </div>
    </div>
  );
}
