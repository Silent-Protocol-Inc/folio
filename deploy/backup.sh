#!/bin/bash
# Online backup of Folio's SQLite database (safe while the app runs, WAL mode); keeps the newest KEEP copies.
#   FOLIO_DB_PATH=/path/folio.sqlite BACKUP_DIR=/path/backups deploy/backup.sh
# Daily from cron, for example: 35 3 * * * FOLIO_DB_PATH=... BACKUP_DIR=... /path/to/folio/deploy/backup.sh
set -euo pipefail
umask 077
src=${FOLIO_DB_PATH:-$(dirname "$0")/../data/folio.sqlite}
dir=${BACKUP_DIR:-$(dirname "$0")/../backups}
keep=${KEEP:-30}
mkdir -p "$dir"
out="$dir/folio-$(date +%Y%m%d).sqlite"
sqlite3 "$src" ".backup '$out'"
[ "$(sqlite3 "$out" 'pragma integrity_check')" = ok ] || { echo "folio backup failed integrity check: $out" >&2; exit 1; }
ls -1t "$dir"/folio-*.sqlite | tail -n +$((keep + 1)) | xargs -r rm -f
