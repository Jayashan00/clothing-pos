#!/usr/bin/env bash
# Redi POS – server installer for Ubuntu (Hostinger VPS or any Ubuntu/Debian server).
#
#   sudo bash deploy/install.sh --domain pos.nodemor.io --email you@example.com
#
# Safe to run again: it updates the app files and keeps the database, the database
# password and the API key. Running it again IS how you install a new version.
#
# Options:
#   --domain NAME        website address for the POS (required), e.g. pos.nodemor.io
#   --email ADDRESS      for the free SSL certificate (Let's Encrypt) expiry notices
#   --db NAME            database name (default: redipos_<domain>)
#   --allow-origin URL   extra website allowed to use the API (e.g. a Vercel preview)
#   --no-ssl             skip HTTPS (only for testing; the POS needs HTTPS in real use)
#   --skip-apt           do not install/upgrade system packages
set -euo pipefail

DOMAIN=""; EMAIL=""; DBNAME=""; EXTRA_ORIGIN=""; SSL=1; APT=1
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --db) DBNAME="$2"; shift 2 ;;
    --allow-origin) EXTRA_ORIGIN="$2"; shift 2 ;;
    --no-ssl) SSL=0; shift ;;
    --skip-apt) APT=0; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m    ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m    ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mSTOPPED: %s\033[0m\n' "$*"; exit 1; }
svc()  { # start/restart/reload a service with systemd, or without it (containers)
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then systemctl "$1" "$2"; else service "$2" "$1"; fi
}

[ "$(id -u)" -eq 0 ] || die "Run as root: sudo bash deploy/install.sh --domain ..."
[ -n "$DOMAIN" ] || die "Give the website address: --domain pos.nodemor.io"
echo "$DOMAIN" | grep -Eq '^[a-zA-Z0-9.-]+$' || die "Domain looks wrong: $DOMAIN"
[ $SSL -eq 0 ] || [ -n "$EMAIL" ] || die "Give an email for the SSL certificate: --email you@example.com"

PKG="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$PKG/public/index.html" ] || die "Built app not found at $PKG/public. Use the server package (redipos-server-*.zip)."
[ -f "$PKG/api/sync.php" ] || die "API files not found at $PKG/api."

SLUG="$(echo "$DOMAIN" | tr -c 'a-zA-Z0-9\n' '_' | tr 'A-Z' 'a-z')"
SITE="/var/www/redipos-$DOMAIN"
PUBLIC="$SITE/public"
DBNAME="${DBNAME:-redipos_${SLUG}}"; DBNAME="${DBNAME:0:60}"
DBUSER="rp_$(echo -n "$DOMAIN" | md5sum | cut -c1-12)"

say "Redi POS install for https://$DOMAIN"
echo "    app folder : $SITE"
echo "    database   : $DBNAME (user $DBUSER)"

# ---------------------------------------------------------------- preflight
say "Checking the server"
. /etc/os-release 2>/dev/null || true
command -v apt-get >/dev/null || die "This installer needs Ubuntu or Debian (apt)."
ok "System: ${PRETTY_NAME:-unknown}"
for PORT in 80 443; do
  OWNER="$(ss -ltnp "sport = :$PORT" 2>/dev/null | awk 'NR>1{print $NF}' | grep -o '"[^"]*"' | head -1 | tr -d '"' || true)"
  if [ -n "$OWNER" ] && [ "$OWNER" != "nginx" ]; then
    die "Port $PORT is used by '$OWNER', not nginx. Other websites on this server are served by '$OWNER'.
         Nothing was changed. Send this message to your developer so the install can be adapted
         (Apache or a Docker proxy such as Traefik/Caddy needs a different setup)."
  fi
  [ -n "$OWNER" ] && ok "Port $PORT: nginx (existing sites stay untouched)" || ok "Port $PORT: free"
done
PUBIP="$(curl -s --max-time 5 https://api.ipify.org || true)"
DNSIP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)"
if [ -n "$PUBIP" ] && [ -n "$DNSIP" ] && [ "$PUBIP" != "$DNSIP" ]; then
  warn "$DOMAIN points to $DNSIP but this server is $PUBIP. Fix the DNS A record, or SSL will fail."
elif [ -z "$DNSIP" ]; then
  warn "$DOMAIN does not resolve yet. Add an A record: ${DOMAIN%%.*} → ${PUBIP:-<server IP>}"
else ok "DNS: $DOMAIN → $DNSIP"; fi

# ---------------------------------------------------------------- packages
if [ $APT -eq 1 ]; then
  say "Installing nginx, PHP, MariaDB, SSL tools (this takes a few minutes)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq nginx mariadb-server php-fpm php-mysql php-cli php-mbstring certbot python3-certbot-nginx rsync curl unzip cron >/dev/null
  ok "Packages installed"
fi
PHPV="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
SOCK="/run/php/php${PHPV}-fpm.sock"
ok "PHP $PHPV"

# PHP limits for large syncs (first upload of a big shop)
cat > "/etc/php/$PHPV/fpm/conf.d/99-redipos.ini" <<EOF
post_max_size = 64M
upload_max_filesize = 64M
memory_limit = 512M
max_execution_time = 600
EOF
svc start mariadb >/dev/null 2>&1 || svc start mysql >/dev/null 2>&1 || true
svc restart "php${PHPV}-fpm" >/dev/null
svc start cron >/dev/null 2>&1 || true
for i in $(seq 1 20); do mysqladmin ping >/dev/null 2>&1 && break; sleep 1; done
mysqladmin ping >/dev/null 2>&1 || die "MariaDB is not running."
ok "MariaDB running"

# ---------------------------------------------------------------- config + database
mkdir -p "$SITE" "$PUBLIC"
CONF="$SITE/config.php"
if [ -f "$CONF" ]; then
  DBPASS="$(php -r "\$c=require '$CONF'; echo \$c['db_pass'];")"
  APIKEY="$(php -r "\$c=require '$CONF'; echo \$c['api_key'];")"
  DBNAME="$(php -r "\$c=require '$CONF'; echo \$c['db_name'];")"
  DBUSER="$(php -r "\$c=require '$CONF'; echo \$c['db_user'];")"
  ok "Existing settings kept ($CONF)"
else
  DBPASS="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"
  APIKEY="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 48)"
fi
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`$DBNAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DBUSER'@'localhost' IDENTIFIED BY '$DBPASS';
ALTER USER '$DBUSER'@'localhost' IDENTIFIED BY '$DBPASS';
GRANT ALL PRIVILEGES ON \`$DBNAME\`.* TO '$DBUSER'@'localhost';
FLUSH PRIVILEGES;
SQL
ok "Database ready"

ORIGINS="'https://$DOMAIN', 'http://$DOMAIN'"
[ -n "$EXTRA_ORIGIN" ] && ORIGINS="$ORIGINS, '$EXTRA_ORIGIN'"
cat > "$CONF" <<EOF
<?php
// Redi POS server settings for $DOMAIN. Created by deploy/install.sh. Keep this file private.
return [
    'db_host' => 'localhost',
    'db_name' => '$DBNAME',
    'db_user' => '$DBUSER',
    'db_pass' => '$DBPASS',
    'api_key' => '$APIKEY',
    'allowed_origins' => [$ORIGINS],
];
EOF
chown root:www-data "$CONF"; chmod 640 "$CONF"
ok "Settings file: $CONF (readable only by the web server)"

# ---------------------------------------------------------------- app files
say "Copying the app"
rsync -a --delete --exclude 'api/' "$PKG/public/" "$PUBLIC/"
mkdir -p "$PUBLIC/api"
rsync -a --delete --exclude 'config.php' --exclude 'config.sample.php' --exclude 'schema.sql' "$PKG/api/" "$PUBLIC/api/"
chown -R root:www-data "$SITE"; find "$SITE" -type d -exec chmod 755 {} +; find "$PUBLIC" -type f -exec chmod 644 {} +
chmod 640 "$CONF"
ok "App installed in $PUBLIC"

# ---------------------------------------------------------------- nginx
say "Configuring the website"
# IPv6 only if this server has it (some VPS/containers don't, and nginx refuses to start then)
if [ -s /proc/net/if_inet6 ]; then LISTEN6="listen [::]:80;"; else
  LISTEN6=""
  # the stock Ubuntu "default" site also listens on IPv6; switch that line off when IPv6 is absent
  [ -f /etc/nginx/sites-available/default ] && sed -i 's/^\(\s*\)listen \[::\]:80 default_server;/\1# listen [::]:80 default_server;  (no IPv6 on this server)/' /etc/nginx/sites-available/default
fi
cat > /etc/nginx/conf.d/redipos-ratelimit.conf <<'EOF'
limit_req_zone $binary_remote_addr zone=redipos_api:10m rate=30r/s;
EOF
NGCONF="/etc/nginx/sites-available/redipos-$DOMAIN.conf"
if [ -f "$NGCONF" ] && grep -q "ssl_certificate" "$NGCONF"; then
  ok "Keeping existing website config with its SSL certificate"
  sed -i "s#fastcgi_pass unix:/run/php/php[0-9.]*-fpm.sock;#fastcgi_pass unix:$SOCK;#" "$NGCONF"
else
cat > "$NGCONF" <<EOF
# Redi POS – $DOMAIN (created by deploy/install.sh)
server {
    listen 80;
    $LISTEN6
    server_name $DOMAIN;
    root $PUBLIC;
    index index.html;
    client_max_body_size 64m;
    server_tokens off;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # the app shell and service worker are always checked for updates
    location = /index.html {
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options SAMEORIGIN always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
    }
    location = /sw.js { add_header Cache-Control "no-cache" always; }
    location = /manifest.webmanifest { add_header Cache-Control "no-cache" always; }
    location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable" always; try_files \$uri =404; }

    # only these four API files can be reached; everything else in /api is hidden
    location ^~ /api/ {
        limit_req zone=redipos_api burst=200 nodelay;
        location ~ ^/api/(sync|health|stats|export)\.php\$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:$SOCK;
            fastcgi_read_timeout 600;
            fastcgi_buffering off;
        }
        return 404;
    }

    location / { try_files \$uri \$uri/ /index.html; }
}
EOF
fi
ln -sf "$NGCONF" "/etc/nginx/sites-enabled/redipos-$DOMAIN.conf"
nginx -t >/dev/null 2>&1 || { nginx -t; die "nginx config test failed. Nothing was reloaded."; }
svc start nginx >/dev/null 2>&1 || true
svc reload nginx >/dev/null
ok "Website configured"

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null && ok "Firewall: web ports allowed"
fi

# ---------------------------------------------------------------- SSL
SCHEME=http
if [ $SSL -eq 1 ]; then
  say "Getting the free SSL certificate (HTTPS)"
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect >/tmp/redipos-certbot.log 2>&1; then
    ok "HTTPS active"; SCHEME=https
  else
    warn "SSL could not be issued yet (see /tmp/redipos-certbot.log). Usually the DNS A record is missing or new."
    warn "When DNS is ready, run the same install command again."
  fi
fi

# ---------------------------------------------------------------- backups
say "Setting up nightly server backups"
install -m 755 "$PKG/deploy/backup.sh" /usr/local/bin/redipos-backup
install -m 755 "$PKG/deploy/restore.sh" /usr/local/bin/redipos-restore
cat > "/etc/cron.d/redipos-$SLUG" <<EOF
# Redi POS nightly backup for $DOMAIN (database dump + full JSON export, 35 days kept)
30 2 * * * root /usr/local/bin/redipos-backup $SITE >> /var/log/redipos-backup.log 2>&1
EOF
chmod 644 "/etc/cron.d/redipos-$SLUG"
/usr/local/bin/redipos-backup "$SITE" >/dev/null 2>&1 && ok "First backup taken: /var/backups/redipos/$DOMAIN" || warn "First backup failed; check /var/log/redipos-backup.log"

# ---------------------------------------------------------------- check
say "Checking the API"
HEALTH=""
for i in 1 2 3 4 5 6 7 8; do  # nginx needs a moment to switch to the new config after a reload
  HEALTH="$(curl -s --max-time 15 -k --resolve "$DOMAIN:443:127.0.0.1" --resolve "$DOMAIN:80:127.0.0.1" -H "X-Api-Key: $APIKEY" "$SCHEME://$DOMAIN/api/health.php" || true)"
  echo "$HEALTH" | grep -q '"ok":true' && break; sleep 2
done
echo "$HEALTH" | grep -q '"ok":true' && ok "API answers: $HEALTH" || warn "API check failed: $HEALTH"

INFO="$SITE/INSTALL-INFO.txt"
cat > "$INFO" <<EOF
Redi POS on $DOMAIN  (installed $(date))
Open the POS:     $SCHEME://$DOMAIN
Server address:   $SCHEME://$DOMAIN/api
Secret key:       $APIKEY
Settings file:    $CONF
Database:         $DBNAME  (user $DBUSER)
Server backups:   /var/backups/redipos/$DOMAIN   (nightly 02:30, 35 days)
Update later:     unzip the new package, then run the same install command again.
EOF
chmod 600 "$INFO"

printf '\n\033[1;32m%s\033[0m\n' "==============================================================="
printf '\033[1;32m  Redi POS is installed.\033[0m\n\n'
echo "  Open the POS:    $SCHEME://$DOMAIN"
echo "  Server address:  $SCHEME://$DOMAIN/api"
echo "  Secret key:      $APIKEY"
echo
echo "  Keep the secret key private. Each counter enters it once at first start."
echo "  This information is saved in $INFO (root only)."
printf '\033[1;32m%s\033[0m\n' "==============================================================="
