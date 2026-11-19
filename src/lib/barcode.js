import { nextUnique } from '../db/db';

export function ean13CheckDigit(d12) {
  const s = d12.split('').reduce((acc, ch, i) => acc + Number(ch) * (i % 2 ? 3 : 1), 0);
  return String((10 - (s % 10)) % 10);
}
export const isValidEan13 = (code) => /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === code[12];

// In-store barcodes. EAN-13 with prefix "20".."29" is the GS1 range reserved for
// in-store use, so codes never clash with manufacturer barcodes. Every scanner reads EAN-13.
export async function generateBarcode(format = 'EAN13', prefix = '20') {
  if (format === 'EAN13') {
    const p = (prefix || '20').replace(/\D/g, '').slice(0, 3).padEnd(2, '0');
    return nextUnique('barcode:' + p, 'variants', 'barcode', p,
      (n) => { const body = p + String(n).padStart(12 - p.length, '0'); return body + ean13CheckDigit(body); },
      (v) => (/^\d{13}$/.test(v) ? parseInt(v.slice(p.length, 12), 10) : 0));
  }
  const p = (prefix || '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
  return nextUnique('barcode128:' + p, 'variants', 'barcode', p, (n) => p + String(n).padStart(6, '0'), (v) => parseInt(v.slice(p.length), 10) || 0);
}

export function barcodeFormatFor(code, preferred) {
  if (preferred === 'EAN13' && isValidEan13(code)) return 'EAN13';
  return 'CODE128';
}
