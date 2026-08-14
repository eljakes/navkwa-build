#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/navkwa-build}"
RELEASE_DIR="${RELEASE_DIR:-$(pwd)}"
CURRENT_LINK="${CURRENT_LINK:-$APP_ROOT/current}"
SHARED_DIR="${SHARED_DIR:-$APP_ROOT/shared}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

BACKEND_DIR="$RELEASE_DIR/backend"
FRONTEND_DIR="$RELEASE_DIR/frontend"
SHARED_ENV="$SHARED_DIR/.env"
SHARED_FRONTEND_ENV="$SHARED_DIR/frontend.env"
SHARED_STORAGE="$SHARED_DIR/storage"
SHARED_LOGS="$SHARED_DIR/logs"

if [[ ! -d "$BACKEND_DIR" || ! -d "$FRONTEND_DIR" ]]; then
  echo "Run this script from a Navkwa Build release directory that contains backend/ and frontend/." >&2
  exit 1
fi

case "$RELEASE_DIR" in
  "$APP_ROOT"/releases/*) ;;
  *)
    echo "RELEASE_DIR must be inside $APP_ROOT/releases for release-based deployment." >&2
    echo "Example: RELEASE_DIR=$APP_ROOT/releases/$(date -u +%Y%m%d_%H%M%S)" >&2
    exit 1
    ;;
esac

if [[ ! -f "$SHARED_ENV" ]]; then
  echo "Missing $SHARED_ENV. Copy backend/.env.production.example there and fill production values first." >&2
  exit 1
fi

mkdir -p "$SHARED_STORAGE/app/public" \
  "$SHARED_STORAGE/app/private" \
  "$SHARED_STORAGE/framework/cache/data" \
  "$SHARED_STORAGE/framework/sessions" \
  "$SHARED_STORAGE/framework/views" \
  "$SHARED_LOGS"

rm -rf "$BACKEND_DIR/storage"
ln -sfn "$SHARED_STORAGE" "$BACKEND_DIR/storage"
rm -rf "$BACKEND_DIR/storage/logs"
ln -sfn "$SHARED_LOGS" "$BACKEND_DIR/storage/logs"
ln -sfn "$SHARED_ENV" "$BACKEND_DIR/.env"

if [[ -f "$SHARED_FRONTEND_ENV" ]]; then
  ln -sfn "$SHARED_FRONTEND_ENV" "$FRONTEND_DIR/.env.production"
fi

cd "$BACKEND_DIR"
composer install --no-dev --optimize-autoloader --no-interaction
php artisan optimize:clear

cd "$FRONTEND_DIR"
npm ci
npm run build

cd "$BACKEND_DIR"
php artisan navkwabuild:production-check --strict
php artisan migrate --force
php artisan storage:link --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

sudo chown -R www-data:www-data "$SHARED_STORAGE" "$SHARED_LOGS" "$BACKEND_DIR/bootstrap/cache"
sudo chmod -R ug+rwX "$SHARED_STORAGE" "$SHARED_LOGS" "$BACKEND_DIR/bootstrap/cache"

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.next"
mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"

cd "$CURRENT_LINK/backend"
php artisan queue:restart

if command -v supervisorctl >/dev/null 2>&1; then
  sudo supervisorctl reread || true
  sudo supervisorctl update || true
  sudo supervisorctl restart 'navkwabuild-worker:*' || true
fi

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx || true
fi

if [[ -d "$APP_ROOT/releases" && "$KEEP_RELEASES" =~ ^[0-9]+$ && "$KEEP_RELEASES" -gt 0 ]]; then
  find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d \
    | sort -r \
    | tail -n +"$((KEEP_RELEASES + 1))" \
    | xargs -r rm -rf
fi

echo "Navkwa Build release deployed: $RELEASE_DIR"
