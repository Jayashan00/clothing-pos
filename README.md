# Nodemor POS — Clothing & Textile Point of Sale

Bilingual (සිංහල / English) POS for clothing and textile shops in Sri Lanka.
Offline-first: billing never stops, even when the internet or the server is down.

**Demo logins** (tap the name, type the PIN):

| Name | Role | PIN |
|---|---|---|
| Sunil Perera (Owner) | Owner — everything | 1234 |
| Nadeesha (Manager) | Manager — approves discounts, refunds, voids | 2222 |
| Kasun (Cashier) | Cashier — billing, customers, returns, drawer | 1111 |
| Ravi (Stock) | Stock keeper — products, labels, receiving | 3333 |

---

## 1. Run it on your computer

Needs Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
```

## 2. Deploy the frontend to Vercel

The project root **is** the frontend, so Vercel needs no special settings.

1. Push this folder to a GitHub repository (the `server/` folder can stay, Vercel ignores it via `.vercelignore`).
2. In Vercel: **Add New → Project → Import** your repository.
3. Vercel detects **Vite** automatically. Check:
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Press **Deploy**. Your preview is live at `https://<project>.vercel.app`.

`vercel.json` already sends every page (`/app/pos`, `/login` …) to the app, so refreshing any page works,
and sets the right caching for the offline service worker.

Later you can add your own domain (e.g. `pos.yourshop.lk`) under **Project → Settings → Domains**.

## 3. Run it on your own server (recommended for the shop)

The shop's live system runs on an Ubuntu server (Hostinger VPS) with one command. The app and the API share one
address, with HTTPS, MariaDB, nightly backups and no demo data. Build the package with `npm run package:server`, then follow
**[deploy/SERVER-GUIDE.md](deploy/SERVER-GUIDE.md)**.

## 3b. Shared hosting only (no VPS)

The POS works fully without this. The server adds automatic backup and lets several counters share data.

1. **hPanel → Databases → MySQL Databases**: create a database and a user. Note the name, user, password.
2. **hPanel → Files → File Manager**: inside `public_html`, create a folder `api`.
3. Upload everything from this project's `server/` folder into `public_html/api/`
   (`bootstrap.php`, `sync.php`, `health.php`, `.htaccess`, `config.sample.php`, `schema.sql`).
4. Copy `config.sample.php` to `config.php` and fill in:
   - the database details from step 1,
   - `api_key`: a long random secret (40+ characters),
   - `allowed_origins`: your Vercel address, e.g. `https://your-project.vercel.app` (and your own domain if you add one).
5. Make sure the site has **SSL** on (hPanel → Security → SSL). The POS must reach the API over `https://`.
6. In the POS: **Settings → Cloud backup**
   - Server address: `https://yourdomain.com/api`
   - Secret key: the same `api_key`
   - Press **Test connection**, then **Back up now**.

The table is created automatically on first use (`schema.sql` is there if you prefer phpMyAdmin).
Requirements: PHP 7.4 or newer (PHP 8.x recommended), MySQL 5.7+ / MariaDB 10.3+ — standard on all Hostinger plans.

### Adding a second counter

On the new computer, open the POS, go to **Settings → Cloud backup**, enter the same server address and key,
then press **Set up this computer from the cloud**. It clears that computer and downloads the whole shop.
Then go to **Settings → This counter** and give it a different counter code (`T2`). Bill numbers start with this code, so they never clash.

## 4. Going live checklist

1. Sign in as the owner (PIN 1234).
2. **Settings → Backup & reset → Clear demo data and start fresh.** (A backup is downloaded first.)
3. Sign in again as `admin` / PIN `1234`, go to **Staff** and change the PIN. Add your staff.
4. **Settings → Shop details**: name in English and Sinhala, address, phone, upload the logo.
5. **Settings → Receipt**: paper size (80 mm / 58 mm / A4), thank-you line, return policy.
6. **Settings → Printer setup**: follow the steps and print the test page on each printer.
7. Add categories and products (or **Products → Import** from Excel/CSV), print labels, receive stock.
8. Connect the cloud backup (section 3). Also download a backup file weekly.

## 5. The everyday workflow: add → tag → sell

**1. Put the stock into the system: Stock → Add items fast**
- One row per size and colour: name, size, colour, selling price, **quantity (number of pieces)**, cost.
- Type the same name again (or press the copy button) for the other sizes. They join into one product.
- The **icon and category are picked from the name** (in English or Sinhala). Just check the category.
- Leave **Barcode** empty and a unique barcode is made. If the item already has a maker's barcode, click the box and scan it.
- If an item, size and colour already exist, the quantity is **added to its stock** (no duplicates).
- Typed rows are kept even if the computer restarts before you save.

**2. Print a tag for every piece**
- After saving, press **Print tags now**. One tag prints for every piece (4 shirts → 4 tags). Cloth by the metre gets one tag for the roll.
- **Barcode labels** page shortcuts: **Not printed yet**, **Price changed, reprint**, **Add whole category**.
- Stick a tag on each item.

**3. Sell**
- The cashier scans the tag. Name, size, colour and price appear on the bill.
- On payment, **stock goes down automatically**. Returns put stock back. Receiving goods adds stock.
- **Price check (F3)** from any page: scan a tag to see the item, price and stock in every size.

**Changing a price:** edit the product. The tags for it appear under **Price changed, reprint**.

## 6. Printing — how sharpness is guaranteed

- Fonts (Atkinson Hyperlegible + Noto Sans Sinhala) are **bundled inside the app**, so Sinhala never falls back to a missing or blurry font, even offline.
- Barcodes are drawn as vector lines sized in millimetres. The default bar is **0.25 mm = exactly 2 dots on a 203-dpi thermal printer** (the industry “10 mil” standard), so edges are clean.
- Receipts set the exact page size (e.g. 80 mm × the bill's length), so the browser never shrinks them onto A4/Letter.
- Everything prints pure black, no grey.
- Verified in testing: every receipt and label size decodes with a barcode reader at 203 dpi.

In Chrome's print window: **Margins: None, Scale: 100%, Headers and footers: off.**
For printing without the dialog, start Chrome with `--kiosk-printing` (details in Settings → Printer setup).

Supported: 58/80 mm thermal printers (Xprinter, Epson TM, etc.), label printers (Xprinter XP-365B, TSC, Zebra),
A4/A5 office printers, any USB/Bluetooth barcode scanner (keyboard mode + Enter), or the phone/laptop camera.

Label stock: 38×25, 40×30, 50×25, 50×30 mm rolls, 35×55 mm hang tags, A4 sheets of 24, 40 or 65 labels.

## 7. Keyboard shortcuts (Billing)

| Key | Action |
|---|---|
| F2 | Search / scan |
| F4 or F12 | Pay |
| F6 | Customer |
| F7 | Hold bill |
| F8 | Held bills |
| F10 | Bill discount |
| F9 | Go to billing from any page |
| F3 | Price check (scan any tag) |
| F1 | Help for the current page |

## 8. How “never goes down” works

```
Counter (browser)  ──►  IndexedDB on this computer  ──►  Hostinger API (when online)
   bill instantly          saved instantly, survives          backup + shared with
                           refresh / power cut                 other counters
```

- Every sale is written to the browser's own database **before** anything else. The bill being built is also saved, so a power cut doesn't lose it.
- The app installs as a PWA (Chrome → Install) and loads with no internet.
- The browser is asked to keep the data permanently (persistent storage).
- Sync is incremental, retries automatically, and the newest version of each record wins.
- Hostinger downtime only delays the backup; the counters keep selling.

### Stock with several counters (stock ledger)

Every stock change is saved as a movement (sale, return, delivery, adjustment, count).
An item's stock is always **the sum of its movements**, recalculated after every sync, so sales made
at different counters at the same time add up correctly. Tested: two counters selling 2 and 3 of the
same item before syncing both end at 10 − 5 = 5.

### Data safety

- Upload works in verified chunks: the server must confirm every record, or the sync fails and repeats.
- Bill, return, delivery, voucher and barcode numbers can never repeat, even on a new computer or a new address.
- **Settings → Cloud backup → Check the server copy** compares every table on the PC with the server.
- Automatic backup folder (PC / USB / Google Drive folder): full backup every 2 hours and at day close, 31 days kept, plus daily and monthly Excel workbooks.
- Server: nightly SQL dump + JSON export, 35 days kept.

## 9. Customising the brand

- Shop name, logo, receipts: in the app under **Settings** (no code needed).
- Product name “Nodemor POS”: `src/components/Layout.jsx` (`Brand`), `index.html`, `vite.config.js` (PWA manifest).
- Colours: `tailwind.config.js` (`indigo` = handloom indigo, `saffron` = accent, `maroon`, `leaf`).
- Landing page text: `src/i18n/en.js` and `src/i18n/si.js` (keys starting with `land.`).
- App icon: `public/favicon.svg`.

## 10. Project structure

```
src/
  App.jsx               routes
  pages/                Landing, Login, Dashboard, POS, QuickAdd, Products, Categories, Labels, Inventory,
                        Purchases, Suppliers, Customers, Sales, Returns, Promotions, Expenses,
                        Shifts, Reports, Users, Settings
  components/           layout, dialogs, help panel, icon picker, barcode, camera scanner
  icons/clothing.jsx    45 clothing/textile icons + name→icon recommender (English & Sinhala)
  print/templates.jsx   receipts, labels, vouchers, shift reports, printer test page
  lib/                  pos logic, scanner detection, printing, sync, backup
  db/                   IndexedDB schema (Dexie) and demo data
  i18n/                 en.js, si.js (840 entries each, incl. help for every page)
server/                 Hostinger PHP + MySQL sync API
```

## 11. Security notes

- Staff PINs are stored hashed (SHA-256 with a per-user salt). PINs control who does what at the counter; they are not a replacement for keeping the computer itself secure.
- The API checks a secret key on every request (constant-time comparison), uses prepared statements only, accepts only known table names, and refuses requests from websites not listed in `allowed_origins`.
- `.htaccess` blocks direct access to `config.php`.
- Always use HTTPS for the API.
