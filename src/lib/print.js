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
// Thermal printers print in whole dots (8 per mm at 203 dpi). Chrome places each barcode on its own
// 1/96-inch pixel grid, which does not line up with the dot grid, so a 2-dot gap can become 1 or 3 dots
// and the barcode reads badly. This moves the bars of every barcode so each bar edge falls exactly on a
// printer dot, measured from the page's left edge. Run while the print copy is laid out.
const DOTS_PER_MM = 8;
function alignBarcodesToDots(host) {
  host.querySelectorAll('[data-dot-page]').forEach((pg) => {
    const pageLeft = pg.getBoundingClientRect().left;
    pg.querySelectorAll('svg.bc-svg').forEach((svg) => {
      const unitMm = Number(svg.dataset.unitMm);
      const vb = (svg.getAttribute('viewBox') || '').split(' ').map(Number);
      if (!unitMm || vb.length !== 4) return;
      const leftPx = Math.round(svg.getBoundingClientRect().left - pageLeft); // Chrome snaps to whole CSS px
      const dots = (leftPx * 25.4 / 96) * DOTS_PER_MM;
      const frac = dots - Math.floor(dots);
      const shiftDots = frac < 1e-6 || frac > 1 - 1e-6 ? 0 : 1 - frac;
      const shiftUnits = (shiftDots / DOTS_PER_MM) / unitMm;
      svg.setAttribute('viewBox', `${(-shiftUnits).toFixed(5)} ${vb[1]} ${vb[2]} ${vb[3]}`);
    });
    // dot-exact pictures (the logo): nudge so each picture pixel sits on exactly one printer dot
    const pageTop = pg.getBoundingClientRect().top;
    pg.querySelectorAll('img.dot-img').forEach((img) => {
      const r = img.getBoundingClientRect();
      const toShift = (px) => { const d = (Math.round(px) * 25.4 / 96) * DOTS_PER_MM; const f = d - Math.floor(d); return (f < 1e-6 || f > 1 - 1e-6 ? 0 : 1 - f) / DOTS_PER_MM; };
      img.style.transform = `translate(${toShift(r.left - pageLeft).toFixed(4)}mm, ${toShift(r.top - pageTop).toFixed(4)}mm)`;
    });
  });
}

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
  // lay the print copy out off-screen for a moment so positions can be measured
  host.style.display = 'block'; host.style.position = 'absolute'; host.style.left = '-10000px'; host.style.top = '0';
  try { alignBarcodesToDots(host); } catch { /* printing still works without it */ }
  host.removeAttribute('style');
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
  'z3-30x20': { w: 30.5, h: 20, kind: 'multi', cols: 3, pageW: 97, name: '1.2 × 0.8 in, 3 across (Zebra roll)' },
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
// A fixed page width (pageW) keeps the page equal to the size set once in the printer driver,
// so moving the labels (Left / Gap) never changes the page and the printer never rescales it.
export const rowWidth = (tpl, cfg) => tpl.kind === 'multi'
  ? tpl.pageW || Math.round((2 * (Number(cfg.leftMm) || 0) + tpl.cols * tpl.w + (tpl.cols - 1) * (Number(cfg.gapMm) || 0)) * 100) / 100
  : tpl.w;
