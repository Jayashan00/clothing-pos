export const uid = () =>
  (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

const nf = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n, cur = 'Rs.') => `${cur} ${nf.format(Number(n) || 0)}`;
export const num = (n) => nf.format(Number(n) || 0);
export const qtyFmt = (q, unit) => (unit && unit !== 'pcs' ? (Math.round(q * 100) / 100).toString() : String(q));
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const pad = (n, l) => String(n).padStart(l, '0');
export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1, 2)}-${pad(x.getDate(), 2)}`;
};
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
export const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); };
export const fmtDate = (t) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtTime = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (t) => `${fmtDate(t)} ${fmtTime(t)}`;
export const toInputDate = (t) => dayKey(t);

export async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h;
  }
}

export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function toCSV(rows, columns) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(',')).join('\n');
  return '\uFEFF' + head + '\n' + body; // BOM so Excel opens Sinhala correctly
}

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
