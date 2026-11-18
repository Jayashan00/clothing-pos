import { useLayoutEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { barcodeFormatFor } from '../lib/barcode';

// Vector barcode sized in millimetres. Each bar is a whole number of printer dots
// (0.25 mm = 2 dots at 203 dpi, 3 dots at 300 dpi), so thermal printers print it sharp.
export default function BarcodeSvg({ value, format = 'EAN13', moduleMm = 0.25, heightMm = 10, maxWidthMm, className = '', style }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el || !value) return;
    try {
      const fmt = barcodeFormatFor(String(value), format);
      JsBarcode(el, String(value), { format: fmt, width: 1, height: 100, margin: 0, displayValue: false, flat: true, background: '#ffffff', lineColor: '#000000' });
      // JsBarcode writes sizes like "190px", so read the number part only
      const w = parseFloat(el.getAttribute('width')); const h = parseFloat(el.getAttribute('height'));
      if (!(w > 0) || !(h > 0)) throw new Error('bad barcode size');
      let mm = moduleMm;
      if (maxWidthMm && w * mm > maxWidthMm) {
        // step down in whole printer dots until it fits
        const steps = [0.375, 0.33, 0.25, 0.1875, 0.17, 0.125];
        mm = steps.find((s) => w * s <= maxWidthMm) || maxWidthMm / w;
      }
      el.setAttribute('viewBox', `0 0 ${w} ${h}`);
      el.setAttribute('preserveAspectRatio', 'none');
      el.setAttribute('width', `${(w * mm).toFixed(3)}mm`);
      el.setAttribute('height', `${heightMm}mm`);
      el.style.removeProperty('transform');
    } catch {
      el.innerHTML = '';
    }
  }, [value, format, moduleMm, heightMm, maxWidthMm]);
  return <svg ref={ref} className={className} style={{ display: 'block', shapeRendering: 'crispEdges', ...style }} />;
}
