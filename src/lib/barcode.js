import { db, nextSeq } from '../db/db';

export function ean13CheckDigit(d12) {
  const s = d12.split('').reduce((acc, ch, i) => acc + Number(ch) * (i % 2 ? 3 : 1), 0);
  return String((10 - (s % 10)) % 10);
}
export const isValidEan13 = (code) => /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === code[12];

// In-store barcodes. EAN-13 with prefix "20".."29" is the GS1 range reserved for
// in-store use, so codes never clash with manufacturer barcodes. Every scanner reads EAN-13.
export async function generateBarcode(format = 'EAN13', prefix = '20') {
  for (let attempt = 0; attempt < 50; attempt++) {
    const seq = await nextSeq('barcode');
    let code;
    if (format === 'EAN13') {
      const p = (prefix || '20').replace(/\D/g, '').slice(0, 3).padEnd(2, '0');
      const body = p + String(seq).padStart(12 - p.length, '0');
      code = body + ean13CheckDigit(body);
    } else {
      const p = (prefix || '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
      code = p + String(seq).padStart(6, '0');
    }
    const exists = await db.variants.where('barcode').equals(code).first();
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique barcode');
}

export function barcodeFormatFor(code, preferred) {
  if (preferred === 'EAN13' && isValidEan13(code)) return 'EAN13';
  return 'CODE128';
}
