#!/usr/bin/env bash
# Restore a Redi POS server database from a nightly dump.
#   redipos-restore /var/www/redipos-<domain> /var/backups/redipos/<domain>/db-YYYY-MM-DD.sql.gz
# A safety dump of the current database is taken first.
set -euo pipefail
SITE="${1:?site folder}"; DUMP="${2:?dump file .sql.gz}"
CONF="$SITE/config.php"; [ -f "$CONF" ] && [ -f "$DUMP" ] || { echo "Missing $CONF or $DUMP"; exit 1; }
DBNAME="$(php -r "\$c=require '$CONF'; echo \$c['db_name'];")"
read -r -p "Replace ALL data in database $DBNAME with $DUMP ? Type YES: " A
[ "$A" = "YES" ] || { echo "Cancelled."; exit 1; }
SAFE="/var/backups/redipos/before-restore-$(date +%F-%H%M%S).sql.gz"
mkdir -p /var/backups/redipos
mysqldump --single-transaction "$DBNAME" | gzip > "$SAFE"
echo "Safety copy of the current data: $SAFE"
gunzip -c "$DUMP" | mysql "$DBNAME"
echo "Restored. Counters will receive the restored data at their next sync."
