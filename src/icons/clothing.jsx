// Hand-drawn 24×24 line icons for the clothing & textile trade.
// Each icon has English and Sinhala keywords so a new product name can suggest its icon.

const T_BODY = 'M8 3 4 5 2 9l3 1.5L6 9.5V21h12V9.5l1 1L22 9l-2-4-4-2c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3Z';
const SHIRT_BODY = 'M8.5 3 4 5 2 16l3 .5L6 10v11h12V10l1 6.5 3-.5-2-11-4.5-2';
const FROCK = 'M9 2.5 10 6.5 8.5 9.5 5 21h14L15.5 9.5 14 6.5l1-4';

export const ICONS = [
  { id: 'tshirt', en: 'T-shirt', si: 'ටී ෂර්ට්', kw: ['t-shirt', 'tshirt', 't shirt', 'tee', 'crew neck', 'v neck', 'ටීෂර්ට්', 'ටී ෂර්ට්', 'ටී-ෂර්ට්'],
    d: [T_BODY] },
  { id: 'polo', en: 'Polo shirt', si: 'පෝලෝ ෂර්ට්', kw: ['polo', 'polo t-shirt', 'polo shirt', 'collar t', 'පෝලෝ'],
    d: [T_BODY, 'M12 5.5V9.5', 'M9.6 4.6 12 7.2l2.4-2.6'], dots: [[12, 7.6]] },
  { id: 'shirt', en: 'Shirt', si: 'කමිසය', kw: ['shirt', 'formal', 'office shirt', 'long sleeve', 'කමිස', 'කමිසය', 'ෂර්ට්', 'ශර්ට්'],
    d: [SHIRT_BODY, 'M8.5 3 10.2 7 12 5.5l1.8 1.5L15.5 3', 'M12 5.5V21'], dots: [[12, 10], [12, 13.5], [12, 17]] },
  { id: 'batik', en: 'Batik shirt', si: 'බතික් කමිසය', kw: ['batik', 'බතික්', 'handloom shirt', 'අත්යන්ත්‍ර'],
    d: [SHIRT_BODY, 'M8.5 3 10.2 7 12 5.5l1.8 1.5L15.5 3', 'M7.5 12.5c1-1.6 2.6-1.6 3.4 0-.8 1.6-2.4 1.6-3.4 0Z', 'M13.3 16.5c1-1.6 2.6-1.6 3.4 0-.8 1.6-2.4 1.6-3.4 0Z', 'M14 11.5h2', 'M8 17h2'] },
  { id: 'saree', en: 'Saree', si: 'සාරිය', kw: ['saree', 'sari', 'silk saree', 'cotton saree', 'georgette', 'chiffon', 'සාරි', 'සාරිය', 'ශාරි'],
    d: ['M9 7c1-.8 5-.8 6 0l1.5 14h-9L9 7Z', 'M14.6 6.8c2 2.4 3 5.4 3.4 9.4', 'M15 7.2 9.4 13.4', 'M11 15.5V21M12.6 15.5V21M14.2 15.5V21', 'M7.8 19h8.4'], circles: [[12, 3.6, 1.7]] },
  { id: 'osariya', en: 'Kandyan osariya', si: 'ඔසරිය', kw: ['osariya', 'osari', 'kandyan', 'ඔසරි', 'ඔසරිය', 'කන්ද උඩරට'],
    d: ['M9 7c1-.8 5-.8 6 0l1.5 14h-9L9 7Z', 'M8.6 11.6q1 1.4 2 0t2 0 2 0 1.8 0', 'M14.8 7c1.8 1.8 2.6 3.4 3 5.6', 'M7.8 19h8.4'], circles: [[12, 3.6, 1.7]] },
  { id: 'sarong', en: 'Sarong', si: 'සරම', kw: ['sarong', 'sarama', 'lungi', 'vetti', 'verti', 'සරම', 'සාරම', 'ලුංගි', 'වේට්ටි'],
    d: ['M6 4h12l1 17H5L6 4Z', 'M5.9 6.5h12.2', 'M5.6 11.5h12.8', 'M5.3 16.5h13.4', 'M10 4l-.4 17', 'M14 4l.4 17'] },
  { id: 'frock', en: 'Frock / dress', si: 'ගවුම', kw: ['frock', 'dress', 'midi', 'party dress', 'ගවුම', 'ෆ්‍රොක්', 'ඩ්‍රෙස්'],
    d: [FROCK, 'M10 6.5h4', 'M8.6 9.5h6.8'] },
  { id: 'gown', en: 'Long gown', si: 'දිගු ගවුම', kw: ['gown', 'maxi', 'evening', 'abaya', 'long dress', 'ගවුන්', 'දිගු ගවුම', 'අබායා'],
    d: ['M9.5 2.5 10 6c-.8 1.8-1.6 3.4-2 5L4 21.5h16L16 11c-.4-1.6-1.2-3.2-2-5l.5-3.5', 'M9.1 9h5.8', 'M12 11v10'] },
  { id: 'kidsfrock', en: 'Kids frock', si: 'ළමා ගවුම', kw: ['kids frock', 'girls', 'baby frock', 'ළමා ගවුම', 'කෙල්ලන්ගේ', 'පොඩි'],
    d: ['M9 4q3 2 6 0l3 2-1.5 2.5-1-.5L18 20H6L8.5 8l-1 .5L6 6l3-2Z', 'M9.5 11h5', 'M11 11l-1 1.2 1 .8M13 11l1 1.2-1 .8'] },
  { id: 'blouse', en: 'Blouse / top', si: 'හැට්ටය', kw: ['blouse', 'top', 'tunic', 'crop', 'හැට්ට', 'හැට්ටය', 'බ්ලවුස්', 'ටොප්'],
    d: ['M8 3.5 4 6l1.5 3.5L7 8.8 6.5 19q5.5 2 11 0L17 8.8l1.5.7L20 6l-4-2.5Q12 7.5 8 3.5Z'] },
  { id: 'kurta', en: 'Kurta / shalwar', si: 'කුර්තා', kw: ['kurta', 'kurti', 'shalwar', 'salwar', 'churidar', 'punjabi', 'කුර්තා', 'සල්වාර්', 'පන්ජාබි', 'චුඩිදාර්'],
    d: ['M8.5 3 4.5 5 3 14l2.5.5 1-5.5-.5 12h12l-.5-12 1 5.5L21 14l-1.5-9-4-2Q12 5.5 8.5 3Z', 'M12 4.5V10', 'M6.2 17.5V21M17.8 17.5V21'] },
  { id: 'trousers', en: 'Trousers', si: 'කලිසම', kw: ['trouser', 'pant', 'slack', 'chino', 'formal pant', 'කලිසම', 'ට්‍රවුසර්', 'පැන්ට්'],
    d: ['M6 3h12l1 18h-5L12 9l-2 12H5L6 3Z', 'M5.9 5.5h12.2'] },
  { id: 'jeans', en: 'Jeans / denim', si: 'ජීන්ස්', kw: ['jean', 'denim', 'ජීන්ස්', 'ඩෙනිම්'],
    d: ['M6 3h12l1 18h-5L12 9l-2 12H5L6 3Z', 'M5.9 5.5h12.2', 'M7.4 5.5q.6 2.6 2.6 2.8', 'M16.6 5.5q-.6 2.6-2.6 2.8', 'M5.3 18.5h3.8M15 18.5h3.7'] },
  { id: 'shorts', en: 'Shorts', si: 'කොට කලිසම', kw: ['short', 'bermuda', 'කොට කලිසම', 'ෂෝට්ස්', 'කොට'],
    d: ['M6 4h12l1.5 12h-6L12 10l-1.5 6h-6L6 4Z', 'M5.9 6.5h12.2'] },
  { id: 'leggings', en: 'Leggings', si: 'ලෙගින්ස්', kw: ['legging', 'tight', 'jegging', 'ලෙගින්ස්', 'ලෙගිං'],
    d: ['M8 3h8l.5 18h-3L12 9l-1.5 12h-3L8 3Z', 'M8 5.3h8'] },
  { id: 'skirt', en: 'Skirt', si: 'සාය', kw: ['skirt', 'සාය', 'සායක', 'ස්කර්ට්'],
    d: ['M7.5 4h9L20 20q-8 2-16 0L7.5 4Z', 'M7.4 6.5h9.2', 'M10 6.5l-1.5 14.2M14 6.5l1.5 14.2M12 6.5V21'] },
  { id: 'jacket', en: 'Jacket / blazer', si: 'ජැකට්', kw: ['jacket', 'blazer', 'coat', 'suit', 'ජැකට්', 'කබාය', 'බ්ලේසර්', 'කෝට්'],
    d: ['M8 3 4 5.5 3 19h3v2h12v-2h3l-1-13.5L16 3l-4 4-4-4Z', 'M12 7v14', 'M8 3l2 7 2-3M16 3l-2 7-2-3', 'M6 10v9M18 10v9'] },
  { id: 'hoodie', en: 'Hoodie', si: 'හූඩි', kw: ['hoodie', 'hooded', 'හූඩි'],
    d: ['M9 4q0-2.5 3-2.5T15 4', 'M9 4 5 6 3 17l2.5.5 1-6.5V21h11V11l1 6.5L21 17 19 6l-4-2', 'M8.5 15.5h7l-1 3.5h-5l-1-3.5Z', 'M11 6v3M13 6v3'] },
  { id: 'sweater', en: 'Sweater / cardigan', si: 'ස්වෙටරය', kw: ['sweater', 'cardigan', 'jumper', 'pullover', 'woolen', 'ස්වෙටර්', 'කාඩිගන්', 'ලොම්'],
    d: ['M9 3.5 5 5.5 3 17l2.5.5 1-6.5V21h11V11l1 6.5L21 17 19 5.5l-4-2Q12 6 9 3.5Z', 'M6.5 19h11', 'M3.2 15.6l2.6.5M20.8 15.6l-2.6.5'] },
  { id: 'vest', en: 'Vest / banian', si: 'බැනියම', kw: ['vest', 'banian', 'singlet', 'tank', 'inner', 'බැනියම', 'බනියන්', 'වෙස්ට්'],
    d: ['M8 3q0 4 4 4t4-4l2 1q-1 4 .5 6V21h-13V10Q7 8 6 4l2-1Z'] },
  { id: 'sportswear', en: 'Sportswear', si: 'ක්‍රීඩා ඇඳුම්', kw: ['sport', 'jersey', 'gym', 'track', 'cricket', 'ක්‍රීඩා', 'ජර්සි', 'ජිම්'],
    d: ['M8 3q0 4 4 4t4-4l2 1q-1 4 .5 6V21h-13V10Q7 8 6 4l2-1Z', 'M5.5 13h13', 'M5.5 15.5h13'] },
  { id: 'uniform', en: 'School uniform', si: 'පාසල් නිල ඇඳුම', kw: ['uniform', 'school', 'නිල ඇඳුම', 'පාසල්', 'යුනිෆෝම්', 'ඉස්කෝල'],
    d: [SHIRT_BODY, 'M8.5 3 10.2 7 12 5.5l1.8 1.5L15.5 3', 'M12 6.5l-1 2 1 6 1-6-1-2Z'] },
  { id: 'baby', en: 'Baby wear', si: 'ළදරු ඇඳුම්', kw: ['baby', 'infant', 'romper', 'newborn', 'onesie', 'බබා', 'ළදරු', 'බේබි', 'කුඩා දරු'],
    d: ['M8 3q4 3 8 0l4 3-2 3-1.5-1v7l-1.5 4q-3 2.5-6 0L7.5 15V8L6 9 4 6l4-3Z'], dots: [[10.5, 18.6], [13.5, 18.6]] },
  { id: 'nightwear', en: 'Nightwear', si: 'රාත්‍රී ඇඳුම්', kw: ['night', 'pajama', 'pyjama', 'nighty', 'sleep', 'රාත්‍රී', 'නයිටි', 'පජාමා'],
    d: ['M8 4 9 7.5 6 21h11L14 7.5 15 4', 'M9 7.5h5', 'M19.2 2.8a2.4 2.4 0 1 0 2 3.6 2 2 0 0 1-2-3.6Z'] },
  { id: 'underwear', en: 'Underwear', si: 'යට ඇඳුම්', kw: ['underwear', 'brief', 'panty', 'panties', 'boxer', 'trunk', 'යට ඇඳුම්', 'ජංගි', 'යට'],
    d: ['M4 7h16l-1 3q-4 1-5.5 7h-3Q9 11 5 10L4 7Z', 'M4.3 8.6h15.4'] },
  { id: 'bra', en: 'Bra / lingerie', si: 'බ්‍රා', kw: ['bra', 'lingerie', 'brassiere', 'බ්‍රා', 'ලින්ජරි'],
    d: ['M4 9q0 6 4.5 6T12 11q.5 4 3.5 4 4.5 0 4.5-6', 'M5 9l2-5M19 9l-2-5', 'M2.5 13h1.8M19.7 13h1.8', 'M4 9q4 0 8 2 4-2 8-2'] },
  { id: 'swimwear', en: 'Swimwear', si: 'පිහිනුම් ඇඳුම්', kw: ['swim', 'bikini', 'beach', 'පිහිනුම්', 'ස්විම්'],
    d: ['M8.5 3v5q-1.5 3-1 6L5.5 20q3.5-1.5 6.5 1 3-2.5 6.5-1L16.5 14q.5-3-1-6V3', 'M8.5 8q3.5 3 7 0'] },
  { id: 'socks', en: 'Socks', si: 'මේස්', kw: ['sock', 'stocking', 'මේස්', 'මේස්ස'],
    d: ['M8 3h5v9l5.5 4q2 1.5.5 3.5T15 20l-6-3.5Q8 15.8 8 14V3Z', 'M8 6h5'] },
  { id: 'tie', en: 'Necktie', si: 'ටයි පටිය', kw: ['tie', 'necktie', 'bow tie', 'ටයි'],
    d: ['M10 3h4l-1 3 2 11-3 4-3-4 2-11-1-3Z', 'M11 6h2'] },
  { id: 'belt', en: 'Belt', si: 'පටිය', kw: ['belt', 'බෙල්ට්', 'ඉණ පටිය'],
    d: ['M2 10h20v4H2z', 'M8 8.5h4v7H8z', 'M10 12h4'], dots: [[16.5, 12], [18.5, 12]] },
  { id: 'cap', en: 'Cap', si: 'කැප් තොප්පිය', kw: ['cap', 'baseball', 'කැප්'],
    d: ['M3.5 15q0-8.5 8.5-8.5 7 0 8 6.5', 'M3.5 15H17q4.5 0 4.5-2H20', 'M12 6.5v-1.2'] },
  { id: 'hat', en: 'Hat', si: 'තොප්පිය', kw: ['hat', 'sun hat', 'තොප්පි', 'තොප්පිය'],
    d: ['M7 15q0-9 5-9t5 9', 'M2 15.5q10 4.5 20 0-10-2-20 0Z', 'M7.2 13h9.6'] },
  { id: 'shawl', en: 'Shawl / scarf', si: 'සාලුව', kw: ['shawl', 'scarf', 'dupatta', 'stole', 'hijab', 'සාලුව', 'ෂෝල්', 'ස්කාෆ්', 'ඩුපට්ටා'],
    d: ['M5 4q7 4 14 0l-2 10 2 6h-4l-1-7q-2 1-4 0l-1 7H5l2-6-2-10Z', 'M5.5 21.5v1M7 21.5v1M15.5 21.5v1M17 21.5v1M18.5 21.5v1'] },
  { id: 'handkerchief', en: 'Handkerchief', si: 'ලේන්සුව', kw: ['handkerchief', 'hanky', 'kerchief', 'ලේන්සු', 'ලේන්සුව'],
    d: ['M5 5h14v14H5z', 'M7.5 7.5h9v9h-9z', 'M15 19l4-4'] },
  { id: 'towel', en: 'Towel', si: 'තුවාය', kw: ['towel', 'bath', 'තුවා', 'තුවාය'],
    d: ['M3 4h18', 'M6 4v14q0 2 2 2h8q2 0 2-2V4', 'M6 15h12M6 16.8h12'] },
  { id: 'bedsheet', en: 'Bed linen', si: 'ඇඳ ඇතිරිලි', kw: ['bed', 'sheet', 'pillow', 'linen', 'blanket', 'quilt', 'ඇඳ', 'ඇතිරිලි', 'කොට්ට', 'බ්ලැන්කට්', 'පොරෝන'],
    d: ['M2 19V8', 'M2 13h20v6', 'M2 16h20', 'M4 13v-2.5Q4 9 5.5 9h3Q10 9 10 10.5V13', 'M11 13v-2h11v2'] },
  { id: 'curtain', en: 'Curtain', si: 'තිර රෙදි', kw: ['curtain', 'drape', 'blind', 'තිර', 'කර්ටන්'],
    d: ['M2 3.5h20', 'M4 3.5q-.5 8.5 2 16.5h3q-1-8 1-16.5', 'M20 3.5q.5 8.5-2 16.5h-3q1-8-1-16.5', 'M5.6 12.5l3.4-.8M18.4 12.5l-3.4-.8'] },
  { id: 'fabric', en: 'Fabric by metre', si: 'රෙදි (මීටර්)', kw: ['fabric', 'cloth', 'material', 'metre', 'meter', 'yard', 'roll', 'textile', 'cotton', 'linen cloth', 'රෙදි', 'රෙද්ද', 'මීටර්', 'යාර', 'රෙදිපිළි', 'කපු'],
    d: ['M6 4h14v14.5l-1-1-1 1-1-1-1 1-1-1-1 1-1-1-1 1-1-1-1 1-1-1-1 1', 'M3.5 5.5Q3.5 4 6 4q2.5 0 2.5 1.5v13Q8.5 20 6 20t-2.5-1.5v-13Z', 'M3.5 5.5q0 1.5 2.5 1.5t2.5-1.5'] },
  { id: 'tailoring', en: 'Tailoring', si: 'මැසීම', kw: ['tailor', 'alteration', 'stitching', 'sewing service', 'මැසීම', 'මහන', 'ටේලර්', 'කෙටි කිරීම'],
    d: ['M8.2 7.5 20 18', 'M8.2 16.5 20 6'], circles: [[6, 6, 2.5], [6, 18, 2.5]] },
  { id: 'haberdashery', en: 'Thread & buttons', si: 'නූල් සහ බොත්තම්', kw: ['thread', 'button', 'zip', 'lace', 'needle', 'නූල්', 'බොත්තම්', 'සිප්', 'ලේස්', 'ඉඳිකටු'],
    d: ['M4 3h8M4 13h8', 'M5.5 3v10M10.5 3v10', 'M5.5 5.5l5 2M5.5 8.5l5 2', 'M8 13v3q0 3 3 4'], circles: [[17.5, 16.5, 3.5]], dots: [[16.5, 15.5], [18.5, 15.5], [16.5, 17.5], [18.5, 17.5]] },
  { id: 'bag', en: 'Bag', si: 'බෑගය', kw: ['bag', 'handbag', 'purse', 'tote', 'school bag', 'බෑග්', 'බෑගය', 'පර්ස්'],
    d: ['M5 9h14l-1 11H6L5 9Z', 'M9 9V7q0-3 3-3t3 3v2'] },
  { id: 'shoes', en: 'Shoes', si: 'සපත්තු', kw: ['shoe', 'sneaker', 'boot', 'footwear', 'සපත්තු', 'පාවහන්'],
    d: ['M3 17v-5q0-2 2-2h3l2 3q4 1 8 2 3 .5 3 3v1H3v-2Z', 'M3 17h18', 'M10.5 13.6l1-1.6M13 14.2l1-1.6'] },
  { id: 'sandals', en: 'Sandals / slippers', si: 'සෙරෙප්පු', kw: ['sandal', 'slipper', 'flip flop', 'chappal', 'සෙරෙප්පු', 'සෙරෙප්පුව', 'සළපාවහන්'],
    d: ['M8 3q4-1 5 4l1 11q0 3-3 3t-3-3V3Z', 'M8.3 9q2.7 3 5.3 0'] },
  { id: 'gift', en: 'Gift pack', si: 'තෑගි පැකේජ', kw: ['gift', 'pack', 'set', 'combo', 'තෑගි', 'පැකේජ'],
    d: ['M4 10h16v10H4z', 'M3 7h18v3H3z', 'M12 7v13', 'M12 7Q9 2 7.5 4.5T12 7Zm0 0q3-5 4.5-2.5T12 7Z'] },
  { id: 'tag', en: 'Other item', si: 'වෙනත් භාණ්ඩ', kw: ['other', 'misc', 'accessor', 'වෙනත්'],
    d: ['M3 12 12 3h9v9l-9 9-9-9Z'], circles: [[16.5, 7.5, 1.5]] },
];

export const ICON_MAP = Object.fromEntries(ICONS.map((i) => [i.id, i]));

export function ClothingIcon({ id, size = 24, stroke = 1.6, className = '', title }) {
  const icon = ICON_MAP[id] || ICON_MAP.tag;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className} role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {icon.d.map((p, i) => <path key={i} d={p} />)}
      {(icon.circles || []).map(([cx, cy, r], i) => <circle key={'c' + i} cx={cx} cy={cy} r={r} />)}
      {(icon.dots || []).map(([cx, cy], i) => <circle key={'d' + i} cx={cx} cy={cy} r={0.55} fill="currentColor" stroke="none" />)}
    </svg>
  );
}

// Suggests icons for a product name, best match first. Works with Sinhala too.
export function recommendIcons(text, limit = 4) {
  const q = String(text || '').toLowerCase().trim();
  if (!q) return [];
  const scored = [];
  for (const icon of ICONS) {
    let best = 0;
    for (const kw of [...icon.kw, icon.en.toLowerCase(), icon.si]) {
      const k = kw.toLowerCase();
      if (k && q.includes(k)) best = Math.max(best, k.length + (q.startsWith(k) ? 2 : 0));
      else if (k.length > 3 && q.split(/\s+/).some((w) => w.length > 2 && k.startsWith(w))) best = Math.max(best, w8(k));
    }
    if (best) scored.push({ id: icon.id, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.id);
}
const w8 = (k) => Math.min(3, k.length / 3);
