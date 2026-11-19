#!/usr/bin/env bash
# Redi POS nightly server backup.  Usage: redipos-backup /var/www/redipos-<domain>
# Makes two independent copies every night and keeps 35 days:
#   db-YYYY-MM-DD.sql.gz         full database dump (restore with redipos-restore)
#   redipos-YYYY-MM-DD.json.gz   full export in Redi POS backup format (restore in the app)
set -euo pipefail
SITE="${1:?Usage: redipos-backup /var/www/redipos-<domain>}"
CONF="$SITE/config.php"
[ -f "$CONF" ] || { echo "No config at $CONF"; exit 1; }
DOMAIN="$(basename "$SITE" | sed 's/^redipos-//')"
DBNAME="$(php -r "\$c=require '$CONF'; echo \$c['db_name'];")"
OUT="/var/backups/redipos/$DOMAIN"
mkdir -p "$OUT"; chmod 700 "$OUT"
DAY="$(date +%F)"
mysqldump --single-transaction --quick --routines "$DBNAME" | gzip -9 > "$OUT/db-$DAY.sql.gz.tmp"
mv "$OUT/db-$DAY.sql.gz.tmp" "$OUT/db-$DAY.sql.gz"
php "$SITE/public/api/export-cli.php" "$OUT/redipos-$DAY.json.tmp"
gzip -9 -c "$OUT/redipos-$DAY.json.tmp" > "$OUT/redipos-$DAY.json.gz"; rm -f "$OUT/redipos-$DAY.json.tmp"
find "$OUT" -name '*.gz' -mtime +35 -delete
echo "$(date '+%F %T') backup OK: $(du -sh "$OUT/db-$DAY.sql.gz" | cut -f1) db, $(du -sh "$OUT/redipos-$DAY.json.gz" | cut -f1) json"
