// The shop's secret cost code: each digit of the cost price is written as a letter,
// so staff can see the cost on the tag but customers cannot.
// Default (from the shop): S=1 A=2 R=3 E=4 H=5 L=6 I=7 Y=8 N=9 G=0, and GE = 00.
// A run of zeros is written with GE for every pair and G for an odd one left over:
//   1200 → SAGE   2500 → AHGE   1000 → SGGE   10000 → SGEGE   1250 → SAHG

export function costCode(cost, cfg) {
  const n = Math.round(Number(cost) || 0);
  if (!(n > 0)) return '';
  const digits = (cfg && cfg.digits && cfg.digits.length === 10) ? cfg.digits : 'GSAREHLIYN';
  const zz = (cfg && cfg.zz) || '';
  const str = String(n);
  let out = '';
  for (let i = 0; i < str.length;) {
    if (str[i] === '0') {
      let run = 0;
      while (str[i + run] === '0') run++;
      if (zz) out += (run % 2 ? digits[0] : '') + zz.repeat(Math.floor(run / 2));
      else out += digits[0].repeat(run);
      i += run;
    } else { out += digits[Number(str[i])]; i++; }
  }
  return out;
}

// Turn a code back into the number (used to check the letters are unambiguous).
export function decodeCost(code, cfg) {
  const digits = (cfg && cfg.digits) || 'GSAREHLIYN';
  const zz = (cfg && cfg.zz) || '';
  let out = ''; let s = String(code || '').toUpperCase();
  while (s.length) {
    if (zz && s.startsWith(zz.toUpperCase())) { out += '00'; s = s.slice(zz.length); continue; }
    const d = digits.toUpperCase().indexOf(s[0]);
    if (d < 0) return NaN;
    out += String(d); s = s.slice(1);
  }
  return Number(out);
}
