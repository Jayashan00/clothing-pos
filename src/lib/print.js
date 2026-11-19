import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

let current = null;
function cleanup() {
  if (!current) return;
  try { current.root.unmount(); } catch { /* already gone */ }
  current.style.remove();
  current = null;
}

// Renders a React element into #print-root and opens the print dialog.
export async function printReact(element, { page = 'size: 80mm auto; margin: 0' } = {}) {
  cleanup();
  const host = document.getElementById('print-root');
  const style = document.createElement('style');
  style.textContent = `@page { ${page} }`;
  document.head.appendChild(style);
  const root = createRoot(host);
  current = { root, style };
  flushSync(() => root.render(element));
  try { await document.fonts.ready; } catch { /* ignore */ }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // Roll paper: "size: 80mm auto" is not valid CSS, so measure the receipt and set its
  // exact length. Otherwise Chrome falls back to A4/Letter and may shrink the text.
  if (/\bauto\b/.test(page)) {
    host.style.display = 'block'; host.style.position = 'absolute'; host.style.left = '-10000px'; host.style.top = '0';
    const mm = Math.ceil((host.scrollHeight * 25.4) / 96) + 6;
    host.removeAttribute('style');
    style.textContent = `@page { ${page.replace(/\bauto\b/, `${Math.max(mm, 40)}mm`)} }`;
  }
  const done = () => { window.removeEventListener('afterprint', done); setTimeout(cleanup, 300); };
  window.addEventListener('afterprint', done);
  window.print();
}

export const PAPER = {
  '58': { width: 58, content: 48, page: 'size: 58mm auto; margin: 0' },
  '80': { width: 80, content: 72, page: 'size: 80mm auto; margin: 0' },
  A5: { width: 148, content: 128, page: 'size: A5 portrait; margin: 10mm' },
  A4: { width: 210, content: 186, page: 'size: A4 portrait; margin: 12mm' },
};

// Label stock commonly sold in Sri Lanka. Roll labels print one label per page.
export const LABEL_TEMPLATES = {
  // Zebra ZD230 roll used by the shop: 1.2 × 0.8 in labels (30.5 × 20 mm), several across.
  // One printed "page" = one row of labels. Gap and left offset are set in Barcode labels.
  'z3-30x20': { w: 30.5, h: 20, kind: 'multi', cols: 3, name: '1.2 × 0.8 in, 3 across (Zebra roll)' },
  'z2-30x20': { w: 30.5, h: 20, kind: 'multi', cols: 2, name: '1.2 × 0.8 in, 2 across' },
  'z1-30x20': { w: 30.5, h: 20, kind: 'roll', name: '1.2 × 0.8 in, single' },
  '38x25': { w: 38, h: 25, kind: 'roll', name: '38 × 25 mm roll' },
  '40x30': { w: 40, h: 30, kind: 'roll', name: '40 × 30 mm roll' },
  '50x25': { w: 50, h: 25, kind: 'roll', name: '50 × 25 mm roll' },
  '50x30': { w: 50, h: 30, kind: 'roll', name: '50 × 30 mm roll' },
  tag35x55: { w: 35, h: 55, kind: 'roll', name: '35 × 55 mm hang tag' },
  'a4-24': { w: 70, h: 37, kind: 'sheet', cols: 3, rows: 8, name: 'A4 sheet, 24 labels (70 × 37)' },
  'a4-40': { w: 52.5, h: 29.7, kind: 'sheet', cols: 4, rows: 10, name: 'A4 sheet, 40 labels (52.5 × 29.7)' },
  'a4-65': { w: 38.1, h: 21.2, kind: 'sheet', cols: 5, rows: 13, name: 'A4 sheet, 65 labels (38.1 × 21.2)' },
};

// Width of one printed row for multi-across rolls, in mm.
export const rowWidth = (tpl, cfg) => tpl.kind === 'multi'
  ? Math.round((2 * (Number(cfg.leftMm) || 0) + tpl.cols * tpl.w + (tpl.cols - 1) * (Number(cfg.gapMm) || 0)) * 100) / 100
  : tpl.w;
