import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const defaultSettings = {
  lang: 'en',
  theme: 'light',
  bigText: false,
  sound: true,
  shop: {
    nameEn: 'Kolamba Kade',
    nameSi: 'කොළඹ කඩේ',
    addressEn: '',
    addressSi: '',
    phone: '',
    phone2: '',
    email: '',
    website: '',
    regNo: '',
    logo: 'data:image/png;base64,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',
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
    template: 'z3-30x20',
    gapMm: 2.5,      // space between labels side by side (multi-across rolls)
    leftMm: 0.25,    // move the whole row right (+) or left (−)
    topMm: 0,        // move everything down (+) or up (−)
    showCostCode: true,
    costCode: { digits: 'GSAREHLIYN', zz: 'GE' }, // index = digit (0..9); zz = the code for "00"
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
    {
      name: 'redipos-settings',
      version: 2,
      merge,
      // Upgrade saved settings without losing anything (server address, key, counter code…)
      migrate: (state, version) => {
        const st = state || {};
        if (version < 2) {
          if (!st.shop || !st.shop.nameEn || st.shop.nameEn === 'Nethmi Textiles & Fashion') {
            st.shop = { ...defaultSettings.shop };
          }
          if (st.labels && (!st.labels.template || st.labels.template === '38x25')) st.labels = { ...st.labels, template: 'z3-30x20' };
        }
        return st;
      },
    }
  )
);

export const getSettings = () => useSettings.getState();
