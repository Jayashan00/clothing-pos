import { db, setMeta, getMeta, syncState } from './db';
import { uid, round2, pad } from '../lib/util';
import { ean13CheckDigit } from '../lib/barcode';
import { hashPin } from '../store/auth';

const CATS = [
  ['sarees', 'Sarees', 'සාරි', 'saree', '#8C1C3A'],
  ['shirts', 'Gents shirts', 'පිරිමි කමිස', 'shirt', '#1F2A5C'],
  ['tshirts', 'T-shirts', 'ටී ෂර්ට්', 'tshirt', '#3D4C92'],
  ['bottoms', 'Trousers & jeans', 'කලිසම් සහ ජීන්ස්', 'jeans', '#2D3A79'],
  ['frocks', 'Frocks & dresses', 'ගවුම්', 'frock', '#B02A4C'],
  ['tops', 'Ladies tops', 'හැට්ට සහ ටොප්', 'blouse', '#C4840C'],
  ['kids', 'Kids wear', 'ළමා ඇඳුම්', 'kidsfrock', '#138A6C'],
  ['baby', 'Baby wear', 'ළදරු ඇඳුම්', 'baby', '#0E7058'],
  ['sarongs', 'Sarongs', 'සරම්', 'sarong', '#744B0E'],
  ['inner', 'Innerwear', 'යට ඇඳුම්', 'underwear', '#6E1530'],
  ['school', 'School uniforms', 'පාසල් නිල ඇඳුම්', 'uniform', '#5E6DAF'],
  ['fabric', 'Fabric by metre', 'රෙදි (මීටර්)', 'fabric', '#9A640C'],
  ['home', 'Home textiles', 'නිවාස රෙදිපිළි', 'bedsheet', '#0B5A47'],
  ['acc', 'Accessories', 'උපාංග', 'shawl', '#4E330C'],
  ['foot', 'Footwear', 'පාවහන්', 'sandals', '#172046'],
];

// [en, si, cat, icon, unit, cost, price, mrp, sizes, colors, brand, material, supplierIdx]
const PRODUCTS = [
  ['Handloom cotton saree', 'අත්යන්ත්‍ර කපු සාරිය', 'sarees', 'saree', 'pcs', 3200, 5450, 5950, null, ['Maroon', 'Green', 'Blue'], 'Dumbara Weaves', 'Cotton', 0],
  ['Wedding silk saree', 'මංගල සේද සාරිය', 'sarees', 'saree', 'pcs', 9500, 16500, 18000, null, ['Gold', 'Red'], 'Ceylon Threads', 'Silk', 1],
  ['Printed georgette saree', 'මුද්‍රිත ජෝර්ජට් සාරිය', 'sarees', 'saree', 'pcs', 2100, 3650, 0, null, ['Pink', 'Purple', 'Teal'], 'Ceylon Threads', 'Georgette', 1],
  ['Kandyan osariya set', 'කන්ද උඩරට ඔසරි කට්ටලය', 'sarees', 'osariya', 'pcs', 7800, 12900, 0, null, ['Ivory', 'Peach'], 'Dumbara Weaves', 'Silk blend', 0],
  ["Men's office shirt, long sleeve", 'පිරිමි කාර්යාල කමිසය', 'shirts', 'shirt', 'pcs', 1450, 2650, 2950, ['15', '15.5', '16', '16.5'], ['White', 'Light blue'], 'Lanka Weave', 'Cotton', 2],
  ['Batik shirt, short sleeve', 'බතික් කමිසය', 'shirts', 'batik', 'pcs', 1800, 3250, 0, ['M', 'L', 'XL'], null, 'Ruhuna Batik', 'Cotton', 3],
  ['Casual check shirt', 'කැෂුවල් චෙක් කමිසය', 'shirts', 'shirt', 'pcs', 1250, 2250, 0, ['S', 'M', 'L', 'XL'], null, 'Lanka Weave', 'Cotton', 2],
  ['Crew neck T-shirt', 'රවුම් බෙල්ල ටී ෂර්ට්', 'tshirts', 'tshirt', 'pcs', 650, 1290, 1490, ['S', 'M', 'L', 'XL', 'XXL'], ['Black', 'White', 'Navy'], 'Kelani Cotton', 'Cotton', 4],
  ['Polo T-shirt', 'පෝලෝ ටී ෂර්ට්', 'tshirts', 'polo', 'pcs', 980, 1890, 0, ['M', 'L', 'XL'], ['Maroon', 'Grey'], 'Kelani Cotton', 'Pique cotton', 4],
  ['Kids printed T-shirt', 'ළමා මුද්‍රිත ටී ෂර්ට්', 'kids', 'tshirt', 'pcs', 420, 890, 0, ['2-3Y', '4-5Y', '6-7Y', '8-9Y'], null, 'Island Kids', 'Cotton', 5],
  ['Slim fit denim jeans', 'ස්ලිම් ෆිට් ඩෙනිම් ජීන්ස්', 'bottoms', 'jeans', 'pcs', 2400, 4250, 4950, ['30', '32', '34', '36'], null, 'Lanka Weave', 'Denim', 2],
  ['Formal trousers', 'ෆෝමල් කලිසම', 'bottoms', 'trousers', 'pcs', 1600, 2950, 0, ['30', '32', '34', '36', '38'], ['Black', 'Grey'], 'Lanka Weave', 'Poly viscose', 2],
  ['Ladies denim jeans', 'කාන්තා ඩෙනිම් ජීන්ස්', 'bottoms', 'jeans', 'pcs', 2200, 3950, 0, ['26', '28', '30', '32'], null, 'Lanka Weave', 'Stretch denim', 2],
  ['Cargo shorts', 'කාගෝ කොට කලිසම', 'bottoms', 'shorts', 'pcs', 900, 1690, 0, ['M', 'L', 'XL'], null, 'Lanka Weave', 'Cotton twill', 2],
  ['Party frock', 'පාටි ගවුම', 'frocks', 'frock', 'pcs', 2600, 4750, 0, ['S', 'M', 'L'], null, 'Ceylon Threads', 'Chiffon', 1],
  ['Office midi dress', 'කාර්යාල මිඩි ගවුම', 'frocks', 'frock', 'pcs', 2300, 3990, 0, ['S', 'M', 'L', 'XL'], null, 'Ceylon Threads', 'Crepe', 1],
  ['Maxi long gown', 'දිගු මැක්සි ගවුම', 'frocks', 'gown', 'pcs', 2900, 5250, 0, ['M', 'L', 'XL'], null, 'Ceylon Threads', 'Rayon', 1],
  ['Office blouse', 'කාර්යාල හැට්ටය', 'tops', 'blouse', 'pcs', 1200, 2290, 0, ['S', 'M', 'L', 'XL'], ['White', 'Black'], 'Ceylon Threads', 'Chiffon', 1],
  ['Kurta top', 'කුර්තා ටොප්', 'tops', 'kurta', 'pcs', 1650, 2950, 0, ['M', 'L', 'XL'], null, 'Ceylon Threads', 'Cotton', 1],
  ['Cotton leggings', 'කපු ලෙගින්ස්', 'tops', 'leggings', 'pcs', 480, 950, 0, ['S/M', 'L/XL'], ['Black', 'Navy'], 'Kelani Cotton', 'Cotton lycra', 4],
  ['Girls party frock', 'ගැහැණු ළමා පාටි ගවුම', 'kids', 'kidsfrock', 'pcs', 1500, 2850, 0, ['2-3Y', '4-5Y', '6-7Y'], null, 'Island Kids', 'Net', 5],
  ['Baby romper set', 'ළදරු රොම්පර් කට්ටලය', 'baby', 'baby', 'pcs', 650, 1350, 0, ['0-3M', '3-6M', '6-12M'], null, 'Island Kids', 'Soft cotton', 5],
  ['Newborn gift pack', 'අලුත උපන් බිළිඳු තෑගි පැකේජය', 'baby', 'gift', 'pcs', 1800, 3450, 0, null, null, 'Island Kids', 'Cotton', 5],
  ['Batik sarong', 'බතික් සරම', 'sarongs', 'sarong', 'pcs', 1100, 1950, 0, null, ['Blue', 'Brown'], 'Ruhuna Batik', 'Cotton', 3],
  ['Cotton check sarong', 'කපු චෙක් සරම', 'sarongs', 'sarong', 'pcs', 850, 1550, 0, null, null, 'Kelani Cotton', 'Cotton', 4],
  ["Men's briefs, 3 pack", 'පිරිමි යට ඇඳුම් (3 පැක්)', 'inner', 'underwear', 'pcs', 750, 1450, 0, ['M', 'L', 'XL'], null, 'Kelani Cotton', 'Cotton', 4],
  ['Ladies panties, 3 pack', 'කාන්තා යට ඇඳුම් (3 පැක්)', 'inner', 'underwear', 'pcs', 600, 1190, 0, ['S', 'M', 'L'], null, 'Kelani Cotton', 'Cotton', 4],
  ['Cotton bra', 'කපු බ්‍රා', 'inner', 'bra', 'pcs', 650, 1290, 0, ['32B', '34B', '36B'], null, 'Kelani Cotton', 'Cotton', 4],
  ['Cotton vest (banian)', 'කපු බැනියම', 'inner', 'vest', 'pcs', 280, 550, 0, ['M', 'L', 'XL'], null, 'Kelani Cotton', 'Cotton', 4],
  ['School shirt, white', 'පාසල් කමිසය (සුදු)', 'school', 'uniform', 'pcs', 750, 1350, 0, ['24', '26', '28', '30', '32'], null, 'Lanka Weave', 'Poplin', 2],
  ['School uniform cloth, white', 'පාසල් නිල ඇඳුම් රෙදි (සුදු)', 'school', 'fabric', 'm', 380, 650, 0, null, null, 'Kelani Cotton', 'Poplin', 4],
  ['Poplin cloth', 'පොප්ලින් රෙදි', 'fabric', 'fabric', 'm', 290, 520, 0, null, ['White', 'Sky blue', 'Cream'], 'Kelani Cotton', 'Poplin', 4],
  ['Linen fabric', 'ලිනන් රෙදි', 'fabric', 'fabric', 'm', 950, 1650, 0, null, ['Natural', 'Olive'], 'Pettah Traders', 'Linen', 1],
  ['Saree blouse material', 'සාරි හැට්ට රෙදි', 'fabric', 'fabric', 'm', 420, 790, 0, null, null, 'Pettah Traders', 'Cotton silk', 1],
  ['Bath towel, large', 'ලොකු තුවාය', 'home', 'towel', 'pcs', 780, 1490, 0, null, ['White', 'Blue', 'Pink'], 'Kelani Cotton', 'Terry cotton', 4],
  ['Double bed sheet set', 'ඩබල් ඇඳ ඇතිරිලි කට්ටලය', 'home', 'bedsheet', 'pcs', 2400, 4250, 0, null, null, 'Kelani Cotton', 'Cotton', 4],
  ['Curtain fabric', 'තිර රෙදි', 'home', 'curtain', 'm', 520, 980, 0, null, ['Beige', 'Maroon'], 'Pettah Traders', 'Polyester', 1],
  ['Handkerchiefs, pack of 6', 'ලේන්සු (6 පැක්)', 'acc', 'handkerchief', 'pcs', 320, 650, 0, null, null, 'Kelani Cotton', 'Cotton', 4],
  ['Cotton shawl', 'කපු සාලුව', 'acc', 'shawl', 'pcs', 650, 1250, 0, null, null, 'Dumbara Weaves', 'Cotton', 0],
  ['Leather belt', 'සම් පටිය', 'acc', 'belt', 'pcs', 900, 1750, 0, ['32', '34', '36'], null, 'Lanka Weave', 'Leather', 2],
  ['Socks, 3 pairs', 'මේස් (යුගල 3)', 'acc', 'socks', 'pcs', 380, 750, 0, null, null, 'Kelani Cotton', 'Cotton', 4],
  ['Cotton cap', 'කපු කැප් තොප්පිය', 'acc', 'cap', 'pcs', 450, 950, 0, null, ['Black', 'Navy'], 'Kelani Cotton', 'Cotton', 4],
  ['Rubber slippers', 'රබර් සෙරෙප්පු', 'foot', 'sandals', 'pcs', 350, 690, 0, ['7', '8', '9', '10'], null, 'Island Kids', 'Rubber', 5],
  ['Sports jersey', 'ක්‍රීඩා ජර්සිය', 'tshirts', 'sportswear', 'pcs', 850, 1650, 0, ['M', 'L', 'XL'], null, 'Kelani Cotton', 'Dri-fit', 4],
  ['Pullover hoodie', 'හූඩි', 'tshirts', 'hoodie', 'pcs', 2100, 3850, 0, ['M', 'L', 'XL'], null, 'Lanka Weave', 'Fleece', 2],
  ['Denim jacket', 'ඩෙනිම් ජැකට්', 'bottoms', 'jacket', 'pcs', 3200, 5950, 0, ['M', 'L', 'XL'], null, 'Lanka Weave', 'Denim', 2],
  ['Night dress', 'රාත්‍රී ගවුම', 'frocks', 'nightwear', 'pcs', 900, 1750, 0, ['M', 'L', 'XL'], null, 'Ceylon Threads', 'Cotton', 1],
];

const CUSTOMERS = [
  ['Kamal Perera', '0771234501'], ['Nimali Fernando', '0712345602'], ['Saman Kumara', '0763456703'],
  ['Dilini Jayasinghe', '0754567804'], ['Ruwan Bandara', '0705678905'], ['Chathurika Silva', '0726789006'],
  ['Mohamed Rizwan', '0777890107'], ['Priya Rajendran', '0718901208'], ['Tharindu Wijesekara', '0769012309'],
  ['Anoma Rathnayake', '0750123410'], ['Sunil Gunawardena', '0781234511'], ['Ishara Madushani', '0702345612'],
  ['Lahiru Dissanayake', '0773456713'], ['Fathima Nusra', '0714567814'], ['Kasun Herath', '0765678915'],
];

const SUPPLIERS = [
  ['Dumbara Handloom Weavers', 'Kandy', '0812223344'],
  ['Pettah Textile Traders', 'Colombo 11', '0112434567'],
  ['Ceylon Garments Wholesale', 'Katunayake', '0112256789'],
  ['Ruhuna Batik House', 'Matara', '0412223456'],
  ['Kelani Cotton Mills', 'Kelaniya', '0112911222'],
  ['Island Kids Wear', 'Negombo', '0312234567'],
];

let rng = 7;
const rand = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => Math.floor(a + rand() * (b - a + 1));

export async function seedIfEmpty() {
  if (await getMeta('seeded')) return false;
  if ((await db.users.count()) > 0) { await setMeta('seeded', true); return false; }
  await seedDemo();
  return true;
}

export async function createOwnerOnly() {
  const id = uid();
  await db.users.add({ id, name: 'Owner', username: 'admin', role: 'admin', active: true, pinHash: await hashPin(id, '1234') });
  await setMeta('seeded', true);
}

export async function seedDemo() {
  syncState.applying = false;
  const now = Date.now();
  const users = [
    ['Sunil Perera (Owner)', 'admin', 'admin', '1234'],
    ['Nadeesha (Manager)', 'manager', 'manager', '2222'],
    ['Kasun (Cashier)', 'cashier', 'cashier', '1111'],
    ['Ravi (Stock)', 'stock', 'stock', '3333'],
  ];
  const userRows = [];
  for (const [name, username, role, pin] of users) {
    const id = uid();
    userRows.push({ id, name, username, role, active: true, pinHash: await hashPin(id, pin) });
  }

  const cats = CATS.map(([key, en, si, icon, color], i) => ({ id: uid(), key, nameEn: en, nameSi: si, icon, color, sort: i }));
  const catByKey = Object.fromEntries(cats.map((c) => [c.key, c]));
  const suppliers = SUPPLIERS.map(([name, city, phone]) => ({ id: uid(), name, contact: '', phone, email: '', address: city, balance: between(0, 6) * 25000, note: '' }));

  let seq = 0;
  const products = []; const variants = [];
  PRODUCTS.forEach(([en, si, cat, icon, unit, cost, price, mrp, sizes, colors, brand, material, sup]) => {
    const p = { id: uid(), nameEn: en, nameSi: si, categoryId: catByKey[cat].id, icon, unit, brand, material, supplierId: suppliers[sup].id, taxable: true, active: true, description: '', createdAt: now };
    products.push(p);
    const sz = sizes || [''];
    const cl = colors || [''];
    sz.forEach((s) => cl.forEach((c) => {
      seq += 1;
      const body = '20' + pad(seq, 10);
      const stock = unit === 'pcs' ? between(2, 36) : between(20, 140);
      variants.push({ id: uid(), productId: p.id, size: s, color: c, barcode: body + ean13CheckDigit(body), sku: `${cat.slice(0, 3).toUpperCase()}-${pad(seq, 4)}`, cost, price, mrp, wholesale: round2(price * 0.9), stock, reorderLevel: unit === 'pcs' ? 4 : 15 });
    }));
  });
  // a few low-stock items so alerts show in the demo
  variants[3].stock = 1; variants[17].stock = 2; variants[40].stock = 0; variants[61].stock = 3;

  const customers = CUSTOMERS.map(([name, phone], i) => ({
    id: uid(), name, phone, email: '', address: pick(['Kandy', 'Peradeniya', 'Katugastota', 'Gampola', 'Kundasale', 'Digana']), nic: '',
    birthday: `1990-${pad((i % 12) + 1, 2)}-${pad((i * 3) % 27 + 1, 2)}`, points: 0, creditBalance: i % 5 === 0 ? 2500 : 0,
    totalSpent: 0, visits: 0, createdAt: now - between(30, 400) * 864e5, note: '',
  }));

  // 45 days of history
  const sales = []; let bill = 0;
  const cashiers = userRows.filter((u) => ['admin', 'cashier', 'manager'].includes(u.role));
  const pcsVariants = variants.filter((v) => products.find((p) => p.id === v.productId).unit === 'pcs');
  for (let d = 45; d >= 0; d--) {
    const day = new Date(now - d * 864e5);
    const weekend = [0, 6].includes(day.getDay());
    const nBills = between(weekend ? 10 : 5, weekend ? 20 : 13);
    // bill times for the day, in order, so bill numbers follow the clock
    const times = Array.from({ length: nBills }, () => { const x = new Date(day); x.setHours(between(9, 19), between(0, 59), between(0, 59), 0); return x.getTime(); })
      .filter((tm) => tm < now - 5 * 60000).sort((a, b) => a - b);
    for (const tm of times) {
      day.setTime(tm);
      const items = [];
      const nItems = between(1, 4);
      for (let k = 0; k < nItems; k++) {
        const v = rand() < 0.85 ? pick(pcsVariants) : pick(variants);
        const p = products.find((x) => x.id === v.productId);
        const qty = p.unit === 'pcs' ? (rand() < 0.8 ? 1 : 2) : between(2, 6) / 2 + 1;
        const gross = round2(v.price * qty);
        const disc = rand() < 0.15 ? round2(gross * 0.1) : 0;
        items.push({ variantId: v.id, productId: p.id, categoryId: p.categoryId, nameEn: p.nameEn, nameSi: p.nameSi, icon: p.icon, size: v.size, color: v.color, barcode: v.barcode, unit: p.unit, qty, price: v.price, mrp: v.mrp, cost: v.cost, gross, discount: disc, promoName: '', net: round2(gross - disc), paidUnit: round2((gross - disc) / qty), returnedQty: 0 });
      }
      const subtotal = round2(items.reduce((s, i) => s + i.gross, 0));
      const itemDiscount = round2(items.reduce((s, i) => s + i.discount, 0));
      const total = round2(subtotal - itemDiscount);
      const method = rand() < 0.62 ? 'cash' : rand() < 0.7 ? 'card' : 'qr';
      const cashGiven = method === 'cash' ? Math.ceil(total / 500) * 500 : total;
      const cust = rand() < 0.35 ? pick(customers) : null;
      const cashier = pick(cashiers);
      bill += 1;
      const pts = cust ? Math.floor(total / 100) : 0;
      if (cust) { cust.points += pts; cust.totalSpent = round2(cust.totalSpent + total); cust.visits += 1; cust.lastVisit = day.getTime(); }
      sales.push({
        id: uid(), billNo: `T1-${pad(bill, 6)}`, date: day.getTime(), terminal: 'T1', items, subtotal, itemDiscount, billDiscount: 0, tax: 0, total,
        savings: itemDiscount, payments: [{ method, amount: cashGiven, ref: '' }], paid: cashGiven, cashReceived: method === 'cash' ? cashGiven : 0,
        change: round2(cashGiven - total), customerId: cust?.id || null, customerName: cust?.name || '', customerPhone: cust?.phone || '',
        cashierId: cashier.id, cashierName: cashier.name, shiftId: null, status: 'completed', pointsEarned: pts, pointsUsed: 0, note: '',
      });
    }
  }

  const expenses = [];
  for (let d = 40; d >= 1; d -= between(3, 6)) {
    expenses.push({ id: uid(), date: now - d * 864e5, category: pick(['electricity', 'transport', 'staffMeals', 'packaging', 'repairs']), amount: between(8, 60) * 100, note: '', paidBy: 'cash', fromDrawer: false, terminal: 'T1', userId: userRows[0].id });
  }
  expenses.push({ id: uid(), date: now - 20 * 864e5, category: 'rent', amount: 85000, note: 'Monthly shop rent', paidBy: 'bank', fromDrawer: false, terminal: 'T1', userId: userRows[0].id });
  expenses.push({ id: uid(), date: now - 15 * 864e5, category: 'salary', amount: 145000, note: 'Staff salaries', paidBy: 'bank', fromDrawer: false, terminal: 'T1', userId: userRows[0].id });

  const promotions = [
    { id: uid(), name: 'Saree festival 10% off', nameSi: 'සාරි උත්සවය 10% වට්ටම්', type: 'percent', value: 10, scope: 'category', targetIds: [catByKey.sarees.id], startDate: now - 5 * 864e5, endDate: now + 25 * 864e5, active: true },
    { id: uid(), name: 'Kids week Rs. 150 off', nameSi: 'ළමා සතිය රු. 150 අඩු', type: 'amount', value: 150, scope: 'category', targetIds: [catByKey.kids.id], startDate: now + 10 * 864e5, endDate: now + 17 * 864e5, active: true },
  ];
  const vouchers = [
    { id: uid(), code: 'GV0000001', type: 'gift', amount: 2500, balance: 2500, status: 'active', issuedAt: now - 10 * 864e5, expiresAt: now + 170 * 864e5, customerId: null, ref: 'Gift voucher', buyer: 'Walk-in' },
  ];

  await db.transaction('rw', [db.users, db.categories, db.suppliers, db.products, db.variants, db.customers, db.sales, db.expenses, db.promotions, db.vouchers, db.meta], async () => {
    await db.users.bulkAdd(userRows);
    await db.categories.bulkAdd(cats);
    await db.suppliers.bulkAdd(suppliers);
    await db.products.bulkAdd(products);
    await db.variants.bulkAdd(variants);
    await db.customers.bulkAdd(customers);
    await db.sales.bulkAdd(sales);
    await db.expenses.bulkAdd(expenses);
    await db.promotions.bulkAdd(promotions);
    await db.vouchers.bulkAdd(vouchers);
    await db.meta.bulkPut([
      { key: 'seq:barcode', value: seq }, { key: 'seq:bill:T1', value: bill }, { key: 'seq:voucher', value: 1 },
      { key: 'seeded', value: true }, { key: 'demo', value: true },
    ]);
  });
}
