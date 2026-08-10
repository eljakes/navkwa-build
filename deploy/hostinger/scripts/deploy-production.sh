#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/navkwabuild/current}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  echo "Missing $BACKEND_DIR/.env. Copy backend/.env.production.example and fill production values first." >&2
  exit 1
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
php artisan queue:restart

sudo chown -R www-data:www-data "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache"
sudo chmod -R ug+rwX "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache"

if command -v supervisorctl >/dev/null 2>&1; then
  sudo supervisorctl reread || true
  sudo supervisorctl update || true
  sudo supervisorctl restart 'navkwabuild-worker:*' || true
fi

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx || true
fi

echo "Navkwa Build deployment completed."
