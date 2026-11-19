# Redi POS — Server package

This package runs the whole system on one Ubuntu server (Hostinger VPS or any other):
the POS app **and** its API on the same address, e.g. `https://pos.nodemor.io`.

```
public/    the POS app (production build: no demo data)
api/       the PHP API (sync, health, stats, export)
deploy/    install.sh · backup.sh · restore.sh
```

---

## 1. Point the address at the server (once)

hPanel → **Domains → nodemor.io → DNS / Nameservers → DNS records → Add record**

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `pos` | `189.31.33.36` | 3600 |

Wait 5–30 minutes. Check from your PC: `ping pos.nodemor.io` should show `189.31.33.36`.

## 2. Copy the package to the server

From Windows PowerShell (or Mac/Linux terminal), in the folder with the zip:

```bash
scp redipos-server-*.zip root@189.31.33.36:/root/
```

## 3. Install (about 5 minutes)

Connect: `ssh root@189.31.33.36` (or hPanel → VPS → **Web console**), then:

```bash
apt-get install -y unzip
cd /root && unzip -o redipos-server-*.zip && cd redipos-server
bash deploy/install.sh --domain pos.nodemor.io --email you@example.com
```

The installer:
- checks what serves ports 80/443 first. If it's something other than nginx, it **stops without changing anything** and tells you why;
- installs nginx, PHP, MariaDB and a free SSL certificate (HTTPS);
- adds the POS as a **separate** site, so `www`, `academy` and `ci` keep working exactly as before;
- creates the database, a random database password and a random **secret key**;
- sets up nightly server backups and checks the API answers.

At the end it prints the **secret key**. Write it down. It's also saved (root only) in
`/var/www/redipos-pos.nodemor.io/INSTALL-INFO.txt`.

## 4. First counter

1. Open `https://pos.nodemor.io` in **Google Chrome** or **Microsoft Edge**.
2. Choose **Start a new shop**. Server address is filled in; paste the secret key; counter code `T1`.
3. Sign in as **Owner**, PIN **1234**. Go to **Staff** and change the PIN immediately.
4. **Settings → Shop details** (name, address, logo).
5. **Settings → Backup & reset → Choose backup folder.** Pick a folder in Google Drive / OneDrive on this PC, or a USB drive.
6. In Chrome: menu → **Install Redi POS** (works like an app, opens without internet).

## 5. Every other counter

Open `https://pos.nodemor.io` → **Connect to the shop's server** → paste the key → counter code `T2`, `T3`…
It downloads all products, stock, customers and staff. Everyone signs in with their usual PIN.

## 6. Where the data lives (three independent copies)

| Copy | Where | When |
|---|---|---|
| 1. Each counter | Inside the browser on that PC | Instantly, every sale. Works with no internet |
| 2. Shop server | MariaDB on this VPS | Every 2 minutes while online (and on demand) |
| 3a. Server backups | `/var/backups/redipos/pos.nodemor.io/` | Nightly 02:30 — SQL dump + JSON export, 35 days |
| 3b. Folder backups | The chosen folder on the PC (`RediPOS/…`) | Every 2 hours + when the day is closed — full backup (31 days) + Excel sheets |

Also: **Settings → Cloud backup → Check the server copy** compares every table on the PC with the server.
Keep Hostinger's own VPS snapshots on as a further safety net.

## 7. Updating to a new version

Copy the new zip to the server, then:

```bash
cd /root && rm -rf redipos-server && unzip -o redipos-server-NEW.zip && cd redipos-server
bash deploy/install.sh --domain pos.nodemor.io --email you@example.com
```

The database, the secret key and every counter's data are kept. Counters pick up the new version on next open.

## 8a. Adding the client's own domain (same server, same data)

1. Client's DNS: add an **A record** for e.g. `pos.colombokade.lk` → `189.31.33.36`.
2. On the server, run the install command again with `--alias`:

```bash
cd /root/redipos-server
bash deploy/install.sh --domain pos.nodemor.io --email you@example.com --alias pos.colombokade.lk
```

Both addresses now open **the same shop and the same data**, each with HTTPS.
3. On every counter: first at the OLD address press **Settings → Cloud backup → Back up now**, then **Compare now** → “Everything matches”.
   Then open the NEW address → **Connect to the shop's server** → secret key. (Browsers keep data per address, so the new address downloads from the server.)

## 8b. Moving to the client's own server / domain later

1. On the new server: run this same package's `install.sh` with the new domain, and allow the old address to upload to it:
   `bash deploy/install.sh --domain pos.clientshop.lk --email you@example.com --allow-origin https://pos.nodemor.io`
2. Copy the data. Either:
   - **(a) database copy** — on the old server: `redipos-backup /var/www/redipos-pos.nodemor.io`, copy the newest `db-*.sql.gz` to the new server, then
     `redipos-restore /var/www/redipos-pos.clientshop.lk db-YYYY-MM-DD.sql.gz`; or
   - **(b) from a counter** — on one up-to-date counter (old address): Settings → Cloud backup → enter the *new* server address + key → **Upload everything to this server** → **Compare now** must show “Everything matches”.
3. Open the **new address** on each counter → **Connect to the shop's server**. (Browsers keep data per website address, so a new address always starts by downloading from the server.)
4. Keep the old server running for a few days until every counter shows “Everything matches” at the new address.

## 9. Zebra ZD230 label printer (3 labels across, 1.2 × 0.8 in)

1. Windows → Printers → **ZDesigner ZD230-203dpi ZPL** → Printing preferences → Page Setup → **New**: width **97 mm**, height **20 mm**. Select it.
2. Options: **Darkness ≈ 20**, **Speed 3 ips** (the printer was at 30 / 6 ips — too dark and fast for sharp barcodes).
3. Ribbon loaded (thermal transfer). Calibrate: hold FEED until it flashes twice.
4. POS → Barcode labels → **Print alignment test**. Adjust **Left / Gap / Top** until every box sits on its sticker.

## 10. Problems

| Problem | Fix |
|---|---|
| Installer stopped: port 80 used by apache2/docker | Nothing was changed. Send the message to the developer. |
| “SSL could not be issued” | DNS A record missing or new. Wait, then run the install command again. |
| Counter says “Not backed up” | Check internet. Settings → Cloud backup → Back up now. Error text shows the reason. |
| Lost the secret key | `cat /var/www/redipos-pos.nodemor.io/INSTALL-INFO.txt` |
| Check server backups | `ls -lh /var/backups/redipos/pos.nodemor.io/` and `tail /var/log/redipos-backup.log` |
