#!/bin/bash
# Daily online backup of Folio's SQLite database (safe while the app runs, WAL mode), newest 30 kept.
# Cron (service user): 35 3 * * * /opt/folio/deploy/backup.sh
set -euo pipefail
umask 077
src=/var/lib/folio/folio.sqlite
dir=/var/backups/folio
mkdir -p "$dir"
out="$dir/folio-$(date +%Y%m%d).sqlite"
sqlite3 "$src" ".backup '$out'"
[ "$(sqlite3 "$out" 'pragma integrity_check')" = ok ] || { echo "folio backup failed integrity check: $out" >&2; exit 1; }
ls -1t "$dir"/folio-*.sqlite | tail -n +31 | xargs -r rm -f
