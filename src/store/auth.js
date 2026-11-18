import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, audit } from '../db/db';
import { sha256 } from '../lib/util';

export const ROLES = ['admin', 'manager', 'cashier', 'stock'];

// What each role can open. Admin can do everything.
export const PERMS = {
  admin: ['*'],
  manager: ['dashboard', 'pos', 'products', 'categories', 'labels', 'inventory', 'purchases', 'suppliers', 'customers', 'sales', 'returns', 'promotions', 'expenses', 'shifts', 'reports', 'settings', 'discount', 'void', 'price-edit'],
  cashier: ['dashboard', 'pos', 'customers', 'sales', 'returns', 'shifts', 'discount'],
  stock: ['dashboard', 'products', 'categories', 'labels', 'inventory', 'purchases', 'suppliers'],
};

export const can = (user, perm) => {
  if (!user) return false;
  const list = PERMS[user.role] || [];
  return list.includes('*') || list.includes(perm);
};

export const useAuth = create(
  persist(
    (set, get) => ({
      user: null,
      async login(username, pin) {
        const u = await db.users.where('username').equals(String(username).trim().toLowerCase()).first();
        if (!u || !u.active) return { ok: false, error: 'login.notFound' };
        const h = await sha256(u.id + ':' + pin);
        if (h !== u.pinHash) return { ok: false, error: 'login.wrongPin' };
        const safe = { id: u.id, name: u.name, username: u.username, role: u.role };
        set({ user: safe });
        audit(u.id, 'login');
        return { ok: true, user: safe };
      },
      async verifyPin(pin, minRole = ['admin', 'manager']) {
        const users = await db.users.toArray();
        for (const u of users) {
          if (!u.active || !minRole.includes(u.role)) continue;
          if ((await sha256(u.id + ':' + pin)) === u.pinHash) return u;
        }
        return null;
      },
      logout() {
        const u = get().user; if (u) audit(u.id, 'logout');
        set({ user: null });
      },
    }),
    { name: 'redipos-auth' }
  )
);

export async function hashPin(userId, pin) { return sha256(userId + ':' + pin); }
