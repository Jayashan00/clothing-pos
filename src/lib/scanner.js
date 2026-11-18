import { useEffect, useRef } from 'react';

// USB / Bluetooth barcode scanners act like a very fast keyboard that ends with Enter.
// This hook tells a scanner apart from a person typing by the time between keys.
export function useBarcodeScanner(onScan, { enabled = true, minLength = 4, maxGap = 45 } = {}) {
  const buf = useRef('');
  const last = useRef(0);
  const fast = useRef(0);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const now = performance.now();
      const gap = now - last.current;
      last.current = now;
      if (e.key === 'Enter') {
        const code = buf.current;
        const wasScanner = code.length >= minLength && fast.current >= code.length - 2;
        buf.current = ''; fast.current = 0;
        if (wasScanner) {
          const t = e.target;
          const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
          if (inField && t.dataset && t.dataset.scanTarget) return; // field handles it
          e.preventDefault(); e.stopPropagation();
          if (inField && t.tagName === 'INPUT' && t.value.endsWith(code)) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(t, t.value.slice(0, -code.length));
            t.dispatchEvent(new Event('input', { bubbles: true }));
          }
          cb.current(code.trim());
        }
        return;
      }
      if (e.key.length !== 1) return;
      if (gap > 300) { buf.current = ''; fast.current = 0; }
      if (buf.current.length && gap < maxGap) fast.current += 1;
      buf.current += e.key;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, minLength, maxGap]);
}

let audioCtx;
export function beep(ok = true) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.frequency.value = ok ? 1240 : 280; o.type = 'square';
    g.gain.value = 0.04; o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + (ok ? 0.08 : 0.25));
  } catch { /* sound is optional */ }
}
