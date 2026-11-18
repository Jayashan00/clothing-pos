import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../lib/util';

// The bill being built. Saved to the browser so a power cut or refresh never loses it.
const emptyCart = { lines: [], customer: null, billDiscount: { type: 'amount', value: 0 }, note: '', heldId: null };

export const useCart = create(
  persist(
    (set, get) => ({
      ...emptyCart,
      lastAddedKey: null,
      addVariant(variant, product, qty = 1) {
        const lines = [...get().lines];
        const i = lines.findIndex((l) => l.variantId === variant.id && !l.manualPrice);
        if (i >= 0) {
          lines[i] = { ...lines[i], qty: Math.round((lines[i].qty + qty) * 100) / 100 };
          set({ lines, lastAddedKey: lines[i].key });
          return;
        }
        const key = uid();
        lines.push({
          key,
          variantId: variant.id,
          productId: product.id,
          categoryId: product.categoryId,
          nameEn: product.nameEn,
          nameSi: product.nameSi || '',
          icon: product.icon,
          size: variant.size || '',
          color: variant.color || '',
          barcode: variant.barcode,
          unit: product.unit || 'pcs',
          price: Number(variant.price) || 0,
          mrp: Number(variant.mrp) || 0,
          cost: Number(variant.cost) || 0,
          qty,
          discount: 0,
          stock: variant.stock,
        });
        set({ lines, lastAddedKey: key });
      },
      setQty(key, qty) {
        const q = Math.max(0, Math.round(Number(qty) * 100) / 100);
        set({ lines: get().lines.map((l) => (l.key === key ? { ...l, qty: q } : l)).filter((l) => l.qty > 0) });
      },
      inc(key, step = 1) { const l = get().lines.find((x) => x.key === key); if (l) get().setQty(key, l.qty + step); },
      dec(key, step = 1) { const l = get().lines.find((x) => x.key === key); if (l) get().setQty(key, l.qty - step); },
      remove(key) { set({ lines: get().lines.filter((l) => l.key !== key) }); },
      updateLine(key, patch) { set({ lines: get().lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }); },
      setCustomer(customer) { set({ customer }); },
      setBillDiscount(billDiscount) { set({ billDiscount }); },
      setNote(note) { set({ note }); },
      load(snapshot) { set({ ...emptyCart, ...snapshot }); },
      clear() { set({ ...emptyCart, lastAddedKey: null }); },
    }),
    { name: 'redipos-cart' }
  )
);
