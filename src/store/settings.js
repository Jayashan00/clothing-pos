import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Shop logo prepared at the receipt printer's exact resolution (8 dots per mm, 38 mm wide = 304 dots),
// pure black and white, so the printer copies it dot for dot without resizing or blurring.
const SHOP_LOGO = 'data:image/png;base64,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';
// The earlier picture logo, replaced automatically on counters that still use it.
const OLD_PNG_LOGO = 'data:image/png;base64,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';

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
    logo: SHOP_LOGO,
    logoWidthMm: 38, // printed size; the picture has exactly 8 pixels per mm (304 × 227 px)
    logoHeightMm: 28.375,
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
    gapMm: 1.5,      // space between labels side by side (measured on the shop's Zebra roll)
    leftMm: 0.5,     // move the whole row right (+) or left (−)
    topMm: 0.8,      // move everything down (+) or up (−)
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
      version: 4,
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
        if (version < 3 && st.labels) {
          // first real print showed the old spacing drifting right and cutting the top: use the measured values
          const l = st.labels;
          if (Number(l.gapMm) === 2.5 || l.gapMm === undefined) l.gapMm = 1.5;
          if (Number(l.leftMm) === 0.25 || l.leftMm === undefined) l.leftMm = 0.5;
          if (Number(l.topMm) === 0 || l.topMm === undefined) l.topMm = 0.8;
        }
        if (version < 4 && st.shop && (!st.shop.logo || st.shop.logo === OLD_PNG_LOGO)) {
          st.shop = { ...st.shop, logo: SHOP_LOGO, logoWidthMm: 38, logoHeightMm: 28.375 };
        }
        return st;
      },
    }
  )
);

export const getSettings = () => useSettings.getState();
