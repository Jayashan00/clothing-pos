import BarcodeSvg from '../components/BarcodeSvg';
import { PAPER, LABEL_TEMPLATES, printReact } from '../lib/print';
import { num, fmtDateTime, qtyFmt } from '../lib/util';
import { translate } from '../i18n';

// Receipt labels are always printed in both languages when "bilingual" is on,
// so every customer can read the bill whatever language the cashier uses.
const L = (lang, key, bilingual) => (bilingual ? `${translate('en', key)} / ${translate('si', key)}` : translate(lang, key));

const rule = { borderTop: '1.5px dashed #000', margin: '2mm 0' };
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2mm' };

export function Receipt({ sale, settings, reprint }) {
  const r = settings.receipt; const shop = settings.shop;
  const paper = PAPER[r.paper] || PAPER['80'];
  const small = r.paper === '58';
  const base = (small ? 11 : 12.5) * (r.fontScale || 1);
  const bi = r.bilingual; const lang = settings.lang;
  const cur = settings.currency || 'Rs.';
  const methodName = (m) => L(lang, 'pay.' + m, bi);
  const wide = r.paper === 'A4' || r.paper === 'A5';
  return (
    <div className="p-doc" style={{ width: wide ? '100%' : `${paper.width}mm`, padding: wide ? 0 : `3mm ${(paper.width - paper.content) / 2}mm 6mm`, fontSize: base, boxSizing: 'border-box' }}>
      <div style={{ textAlign: 'center' }}>
        {r.showLogo && shop.logo ? <img src={shop.logo} alt="" style={{ maxWidth: '34mm', maxHeight: '18mm', margin: '0 auto 1.5mm', display: 'block', filter: 'grayscale(1) contrast(2)' }} /> : null}
        <div style={{ fontSize: base * 1.45, fontWeight: 800, lineHeight: 1.15 }}>{shop.nameEn}</div>
        {bi && shop.nameSi ? <div style={{ fontSize: base * 1.15, fontWeight: 700 }}>{shop.nameSi}</div> : null}
        <div style={{ fontWeight: 600 }}>{shop.addressEn}</div>
        {bi && shop.addressSi ? <div style={{ fontWeight: 600 }}>{shop.addressSi}</div> : null}
        <div style={{ fontWeight: 600 }}>{[shop.phone, shop.phone2].filter(Boolean).join(' | ')}</div>
        {shop.regNo ? <div style={{ fontWeight: 600 }}>{shop.regNo}</div> : null}
        {reprint ? <div style={{ marginTop: '1.5mm', border: '1.5px solid #000', display: 'inline-block', padding: '0.5mm 2mm' }}>{L(lang, 'receipt.reprint', bi)}</div> : null}
      </div>
      <div style={rule} />
      <div style={row}><span>{L(lang, 'receipt.billNo', bi)}</span><span style={{ fontWeight: 800 }}>{sale.billNo}</span></div>
      <div style={row}><span>{L(lang, 'receipt.date', bi)}</span><span>{fmtDateTime(sale.date)}</span></div>
      {r.showCashier ? <div style={row}><span>{L(lang, 'receipt.cashier', bi)}</span><span>{sale.cashierName}</span></div> : null}
      {sale.customerName ? <div style={row}><span>{L(lang, 'receipt.customer', bi)}</span><span style={{ textAlign: 'right' }}>{sale.customerName}{sale.customerPhone ? ` (${sale.customerPhone})` : ''}</span></div> : null}
      <div style={rule} />
      {sale.items.map((it, i) => (
        <div key={i} style={{ marginBottom: '1.6mm', breakInside: 'avoid' }}>
          <div style={{ fontWeight: 800 }}>{it.nameEn}</div>
          {bi && it.nameSi ? <div style={{ fontWeight: 600 }}>{it.nameSi}</div> : null}
          {it.size || it.color ? <div style={{ fontWeight: 600 }}>{[it.size, it.color].filter(Boolean).join(' / ')}</div> : null}
          <div style={row}>
            <span>{qtyFmt(it.qty, it.unit)}{it.unit !== 'pcs' ? ' ' + it.unit : ''} × {num(it.price)}</span>
            <span style={{ fontWeight: 800 }}>{num(it.gross)}</span>
          </div>
          {it.discount > 0 ? <div style={row}><span>{it.promoName || L(lang, 'receipt.discount', bi)}</span><span>-{num(it.discount)}</span></div> : null}
        </div>
      ))}
      <div style={rule} />
      <div style={row}><span>{L(lang, 'receipt.subtotal', bi)}</span><span>{num(sale.subtotal)}</span></div>
      {sale.itemDiscount + sale.billDiscount > 0 ? <div style={row}><span>{L(lang, 'receipt.discount', bi)}</span><span>-{num(sale.itemDiscount + sale.billDiscount)}</span></div> : null}
      {sale.tax > 0 ? <div style={row}><span>{settings.tax.label} {settings.tax.rate}%{settings.tax.inclusive ? ' (incl.)' : ''}</span><span>{num(sale.tax)}</span></div> : null}
      <div style={{ ...row, alignItems: 'center', fontWeight: 800, margin: '1.5mm 0', borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '1.2mm 0' }}>
        <span style={{ fontSize: base * 1.05, lineHeight: 1.15 }}>{bi ? <>{translate('en', 'receipt.total')}<br />{translate('si', 'receipt.total')}</> : translate(lang, 'receipt.total')}</span>
        <span style={{ whiteSpace: 'nowrap', fontSize: base * (small ? 1.45 : 1.65) }}>{cur} {num(sale.total)}</span>
      </div>
      {sale.payments.map((p, i) => <div key={i} style={row}><span>{methodName(p.method)}{p.ref ? ` (${p.ref})` : ''}</span><span>{num(p.amount)}</span></div>)}
      {sale.change > 0 ? <div style={{ ...row, fontWeight: 800, fontSize: base * 1.15 }}><span>{L(lang, 'receipt.change', bi)}</span><span>{num(sale.change)}</span></div> : null}
      <div style={{ ...row, marginTop: '1mm' }}><span>{L(lang, 'receipt.items', bi)}</span><span>{sale.items.length}</span></div>
      {r.showSavings && sale.savings > 0 ? (
        <div style={{ textAlign: 'center', border: '1.5px solid #000', padding: '1.2mm', margin: '2mm 0', fontWeight: 800 }}>
          {L(lang, 'receipt.saved', bi)}: {cur} {num(sale.savings)}
        </div>
      ) : null}
      {sale.customerId && (sale.pointsEarned || sale.pointsUsed) ? (
        <div style={{ textAlign: 'center' }}>{L(lang, 'receipt.points', bi)}: +{sale.pointsEarned}{sale.pointsUsed ? ` / -${sale.pointsUsed}` : ''}</div>
      ) : null}
      <div style={rule} />
      {r.showBarcode ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '1mm 0 2mm' }}>
          <BarcodeSvg value={sale.billNo} format="CODE128" moduleMm={small ? 0.25 : 0.33} heightMm={9} maxWidthMm={paper.content} />
          <div style={{ fontSize: base * 0.9, marginTop: '0.8mm', letterSpacing: '0.5px' }}>{sale.billNo}</div>
        </div>
      ) : null}
      <div style={{ textAlign: 'center', fontWeight: 600, fontSize: base * 0.92 }}>
        {r.policyEn ? <div>{r.policyEn}</div> : null}
        {bi && r.policySi ? <div>{r.policySi}</div> : null}
        <div style={{ fontWeight: 800, fontSize: base * 1.1, marginTop: '1.5mm' }}>{r.footerEn}</div>
        {bi && r.footerSi ? <div style={{ fontWeight: 800, fontSize: base * 1.1 }}>{r.footerSi}</div> : null}
        <div style={{ marginTop: '2mm', fontSize: base * 0.8 }}>Redi POS</div>
      </div>
    </div>
  );
}

export function printReceipt(sale, settings, opts = {}) {
  const paper = PAPER[settings.receipt.paper] || PAPER['80'];
  const copies = Math.max(1, Number(settings.receipt.copies) || 1);
  return printReact(
    <div>{Array.from({ length: opts.reprint ? 1 : copies }).map((_, i) => <div key={i} className="p-page-break"><Receipt sale={sale} settings={settings} reprint={opts.reprint} /></div>)}</div>,
    { page: paper.page }
  );
}

/* ---------------- Barcode labels ---------------- */
const priceTxt = (n, cur) => `${cur} ${Number(n) % 1 === 0 ? Number(n).toLocaleString('en-LK') : num(n)}`;

export function Label({ item, cfg, tpl, shop, cur }) {
  const { w, h } = tpl;
  const tag = h > w; // portrait hang tag
  const pad = Math.max(1.2, Math.min(w, h) * 0.06);
  const fs = Math.max(6.2, Math.min(9, h * 0.3)); // pt
  const name = cfg.nameLang === 'si' && item.nameSi ? item.nameSi : item.nameEn;
  const variant = [item.size, item.color].filter(Boolean).join(' / ');
  const bcH = tag ? 13 : Math.max(6, h * 0.36);
  return (
    <div className="p-doc" style={{ width: `${w}mm`, height: `${h}mm`, padding: `${pad}mm`, boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: tag ? 'space-between' : 'center', textAlign: 'center', fontWeight: 700 }}>
      {cfg.showShop ? <div style={{ fontSize: `${fs * 0.85}pt`, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', lineHeight: 1.1 }}>{shop.nameEn}</div> : null}
      {tag ? <div style={{ borderTop: '1px solid #000', width: '60%', margin: '1mm 0' }} /> : null}
      <div style={{ fontSize: `${fs}pt`, fontWeight: 800, width: '100%', lineHeight: 1.15, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: tag ? 3 : 1, WebkitBoxOrient: 'vertical' }}>{name}</div>
      {cfg.showVariant && variant ? <div style={{ fontSize: `${fs * 0.95}pt`, fontWeight: 700, lineHeight: 1.1 }}>{variant}</div> : null}
      {tag && cfg.showPrice ? <div style={{ fontSize: `${fs * 1.9}pt`, fontWeight: 800, margin: '1.5mm 0' }}>{priceTxt(item.price, cur)}</div> : null}
      <div style={{ marginTop: '0.6mm' }}>
        <BarcodeSvg value={item.barcode} format={cfg.format} moduleMm={cfg.moduleMm || 0.25} heightMm={bcH} maxWidthMm={w - pad * 2} />
      </div>
      <div style={{ display: 'flex', width: '100%', justifyContent: !tag && cfg.showPrice ? 'space-between' : 'center', alignItems: 'baseline', gap: '1mm', lineHeight: 1.1, marginTop: '0.4mm' }}>
        <span style={{ fontSize: `${fs * 0.85}pt`, letterSpacing: '0.3px' }}>{item.barcode}</span>
        {!tag && cfg.showPrice ? <span style={{ fontSize: `${fs * 1.2}pt`, fontWeight: 800 }}>{priceTxt(item.price, cur)}</span> : null}
      </div>
    </div>
  );
}

export function LabelPrintout({ items, settings, templateId }) {
  const cfg = settings.labels;
  const tpl = LABEL_TEMPLATES[templateId || cfg.template] || LABEL_TEMPLATES['38x25'];
  const flat = items.flatMap((it) => Array.from({ length: Math.max(0, it.copies || 0) }, () => it));
  if (tpl.kind === 'roll') {
    return <div>{flat.map((it, i) => <div key={i} className="p-page-break"><Label item={it} cfg={cfg} tpl={tpl} shop={settings.shop} cur={settings.currency} /></div>)}</div>;
  }
  const per = tpl.cols * tpl.rows;
  const sheets = [];
  for (let i = 0; i < flat.length; i += per) sheets.push(flat.slice(i, i + per));
  const mx = (210 - tpl.cols * tpl.w) / 2; const my = (297 - tpl.rows * tpl.h) / 2;
  return (
    <div>
      {sheets.map((sheet, s) => (
        <div key={s} className="p-page-break" style={{ width: '210mm', height: '296mm', padding: `${my}mm ${mx}mm`, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: `repeat(${tpl.cols}, ${tpl.w}mm)`, gridAutoRows: `${tpl.h}mm`, overflow: 'hidden' }}>
          {sheet.map((it, i) => <Label key={i} item={it} cfg={cfg} tpl={tpl} shop={settings.shop} cur={settings.currency} />)}
        </div>
      ))}
    </div>
  );
}

export function printLabels(items, settings, templateId) {
  const tpl = LABEL_TEMPLATES[templateId || settings.labels.template] || LABEL_TEMPLATES['38x25'];
  const page = tpl.kind === 'roll' ? `size: ${tpl.w}mm ${tpl.h}mm; margin: 0` : 'size: A4 portrait; margin: 0';
  return printReact(<LabelPrintout items={items} settings={settings} templateId={templateId} />, { page });
}

/* ---------------- Voucher / credit note ---------------- */
export function VoucherSlip({ voucher, settings }) {
  const cur = settings.currency; const bi = settings.receipt.bilingual; const lang = settings.lang;
  const key = voucher.type === 'creditNote' ? 'voucher.creditNote' : 'voucher.gift';
  return (
    <div className="p-doc" style={{ width: '80mm', padding: '4mm', boxSizing: 'border-box', textAlign: 'center', fontSize: 12.5 }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{settings.shop.nameEn}</div>
      {bi ? <div>{settings.shop.nameSi}</div> : null}
      <div style={rule} />
      <div style={{ fontSize: 16, fontWeight: 800 }}>{L(lang, key, bi)}</div>
      <div style={{ fontSize: 28, fontWeight: 800, margin: '2mm 0' }}>{cur} {num(voucher.amount)}</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}><BarcodeSvg value={voucher.code} format="CODE128" moduleMm={0.33} heightMm={11} maxWidthMm={70} /></div>
      <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, marginTop: '1mm' }}>{voucher.code}</div>
      <div style={rule} />
      <div style={row}><span>{L(lang, 'voucher.issued', bi)}</span><span>{fmtDateTime(voucher.issuedAt)}</span></div>
      {voucher.expiresAt ? <div style={row}><span>{L(lang, 'voucher.expires', bi)}</span><span>{fmtDateTime(voucher.expiresAt).slice(0, 11)}</span></div> : null}
      {voucher.ref ? <div style={row}><span>Ref</span><span>{voucher.ref}</span></div> : null}
      <div style={{ marginTop: '2mm', fontWeight: 600 }}>{L(lang, 'voucher.terms', bi)}</div>
    </div>
  );
}
export const printVoucher = (voucher, settings) => printReact(<VoucherSlip voucher={voucher} settings={settings} />, { page: PAPER['80'].page });

/* ---------------- Shift X / Z report ---------------- */
export function ShiftSlip({ shift, summary, settings, final }) {
  const lang = settings.lang; const bi = false;
  const R = ({ k, v, b }) => <div style={{ ...row, fontWeight: b ? 800 : 700 }}><span>{k}</span><span>{v}</span></div>;
  return (
    <div className="p-doc" style={{ width: '80mm', padding: '4mm', boxSizing: 'border-box', fontSize: 12.5 }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 800 }}>{settings.shop.nameEn}</div>
      <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, marginTop: '1mm' }}>{final ? 'Z REPORT' : 'X REPORT'} · {settings.terminal.name}</div>
      <div style={rule} />
      <R k={L(lang, 'shift.cashier', bi)} v={shift.userName} />
      <R k={L(lang, 'shift.opened', bi)} v={fmtDateTime(shift.openedAt)} />
      {shift.closedAt ? <R k={L(lang, 'shift.closed', bi)} v={fmtDateTime(shift.closedAt)} /> : null}
      <div style={rule} />
      <R k={L(lang, 'shift.bills', bi)} v={summary.bills} />
      <R k={L(lang, 'shift.itemsSold', bi)} v={summary.items} />
      <R k={L(lang, 'shift.grossSales', bi)} v={num(summary.gross)} b />
      <R k={L(lang, 'shift.discounts', bi)} v={num(summary.discounts)} />
      <R k={L(lang, 'shift.returns', bi)} v={`${summary.returnsCount} / ${num(summary.returnsTotal)}`} />
      <div style={rule} />
      {Object.entries(summary.byMethod).map(([m, v]) => <R key={m} k={L(lang, 'pay.' + m, bi)} v={num(v)} />)}
      <div style={rule} />
      <R k={L(lang, 'shift.openingCash', bi)} v={num(shift.openingCash)} />
      <R k={L(lang, 'shift.cashIn', bi)} v={num(summary.cashIn)} />
      <R k={L(lang, 'shift.cashRefunds', bi)} v={`-${num(summary.cashRefunds)}`} />
      <R k={L(lang, 'shift.cashExpenses', bi)} v={`-${num(summary.cashExpenses)}`} />
      <R k={L(lang, 'shift.expected', bi)} v={num(summary.expected)} b />
      {final ? <>
        <R k={L(lang, 'shift.counted', bi)} v={num(shift.closingCash)} b />
        <R k={L(lang, 'shift.difference', bi)} v={num(shift.closingCash - summary.expected)} b />
      </> : null}
      <div style={rule} />
      <div style={{ textAlign: 'center' }}>{fmtDateTime(Date.now())}</div>
    </div>
  );
}
export const printShift = (shift, summary, settings, final) => printReact(<ShiftSlip shift={shift} summary={summary} settings={settings} final={final} />, { page: PAPER['80'].page });

/* ---------------- Printer test page ---------------- */
export function TestPage({ settings, paperId }) {
  const paper = PAPER[paperId] || PAPER['80'];
  return (
    <div className="p-doc" style={{ width: `${paper.width}mm`, padding: `3mm ${(paper.width - paper.content) / 2}mm`, boxSizing: 'border-box', fontSize: 12.5 }}>
      <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 800 }}>PRINTER TEST · {paper.width}mm</div>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 800 }}>මුද්‍රණ පරීක්ෂණය</div>
      <div style={rule} />
      <div>ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</div>
      <div>අආඇඈඉඊඋඌඍඎඏඐඑඒඓඔඕඖ කගචජටඩණතදනපබමයරලවසහළෆ</div>
      <div>ශ්‍රී ලංකා · ක්‍රීඩා · ප්‍රමාණය · රෙදිපිළි</div>
      <div style={rule} />
      <div style={{ fontSize: 10 }}>10px small text · කුඩා අකුරු</div>
      <div style={{ fontSize: 14 }}>14px normal · සාමාන්‍ය</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>Rs. 12,450.00</div>
      <div style={rule} />
      <div style={{ display: 'flex', justifyContent: 'center' }}><BarcodeSvg value="2000000000015" format="EAN13" moduleMm={0.25} heightMm={10} /></div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2mm' }}><BarcodeSvg value="T1-000123" format="CODE128" moduleMm={0.33} heightMm={10} maxWidthMm={paper.content} /></div>
      <div style={{ ...rule, borderTopStyle: 'solid' }} />
      <div style={{ textAlign: 'center' }}>{settings.shop.nameEn}</div>
    </div>
  );
}
export const printTestPage = (settings, paperId) => printReact(<TestPage settings={settings} paperId={paperId} />, { page: (PAPER[paperId] || PAPER['80']).page });
