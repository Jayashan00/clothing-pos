import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const defaultSettings = {
  lang: 'en',
  theme: 'light',
  bigText: false,
  sound: true,
  shop: {
    nameEn: 'Nethmi Textiles & Fashion',
    nameSi: 'නෙත්මි ටෙක්ස්ටයිල්ස් ඇන්ඩ් ෆැෂන්',
    addressEn: 'No. 45, Main Street, Kandy',
    addressSi: 'අංක 45, ප්‍රධාන වීදිය, මහනුවර',
    phone: '081 222 3456',
    phone2: '077 123 4567',
    email: '',
    website: '',
    regNo: '',
    logo: '',
  },
  receipt: {
    paper: '80',
    showLogo: true,
    bilingual: true,
    showBarcode: true,
    showSavings: true,
    showCashier: true,
    footerEn: 'Thank you! Please come again.',
    footerSi: 'ස්තූතියි! නැවත එන්න.',
    policyEn: 'Exchange within 7 days with this bill. No cash refunds on sale items.',
    policySi: 'මෙම බිල්පත සමඟ දින 7ක් ඇතුළත මාරු කළ හැක.',
    autoPrint: true,
    copies: 1,
    fontScale: 1,
  },
  labels: {
    template: '38x25',
    format: 'EAN13',
    prefix: '20',
    moduleMm: 0.25,
    showShop: true,
    showPrice: true,
    showVariant: true,
    nameLang: 'en',
  },
  tax: { enabled: false, rate: 18, inclusive: true, label: 'VAT' },
  loyalty: { enabled: true, rsPerPoint: 100, pointValue: 1 },
  terminal: { code: 'T1', name: 'Counter 1' },
  stock: { lowDefault: 5, allowNegative: false },
  sync: { url: '', key: '', auto: true, intervalMin: 5, lastPush: 0, lastPull: 0, lastResult: '' },
  currency: 'Rs.',
};

const merge = (persisted, current) => {
  const out = { ...current, ...persisted };
  for (const k of Object.keys(defaultSettings)) {
    if (defaultSettings[k] && typeof defaultSettings[k] === 'object' && !Array.isArray(defaultSettings[k])) {
      out[k] = { ...defaultSettings[k], ...(persisted?.[k] || {}) };
    }
  }
  return out;
};

export const useSettings = create(
  persist(
    (set) => ({
      ...defaultSettings,
      set: (patch) => set(patch),
      setSection: (section, patch) => set((s) => ({ [section]: { ...s[section], ...patch } })),
      reset: () => set({ ...defaultSettings }),
    }),
    { name: 'redipos-settings', version: 1, merge }
  )
);

export const getSettings = () => useSettings.getState();
