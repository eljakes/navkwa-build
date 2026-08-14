#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/navkwabuild/backup.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing backup env file: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/navkwabuild}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
APP_DIR="${APP_DIR:-/var/www/navkwa-build/current}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

umask 077
mkdir -p "$BACKUP_DIR/postgres" "$BACKUP_DIR/storage"

pg_dump \
  --host="$PGHOST" \
  --port="${PGPORT:-5432}" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --format=custom \
  --file="$BACKUP_DIR/postgres/${PGDATABASE}-${STAMP}.dump"

tar -C "$APP_DIR/backend" -czf "$BACKUP_DIR/storage/storage-${STAMP}.tar.gz" storage/app

find "$BACKUP_DIR/postgres" -type f -name "*.dump" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR/storage" -type f -name "*.tar.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Backup completed in $BACKUP_DIR."
