# Navkwa Build Hetzner VPS Deployment

Use this folder for production deployment on a Hetzner VPS running Ubuntu
24.04 LTS.

Current server:

- Hetzner project: `Navkwa Production`
- Server: `navkwa-prod-01`
- Public IPv4: `49.12.103.75`
- Region: Falkenstein, `eu-central`
- Plan: CPX22, x86, 80 GB disk

Primary domains:

- Public website: `https://navkwa.com`
- ERP: `https://app.navkwa.com`
- Cloud Console: `https://app.navkwa.com/cloud-console`
- API: `https://app.navkwa.com/api/v1`

DNS records should point to the Hetzner public IP:

```text
A      @      49.12.103.75
A      app    49.12.103.75
CNAME  www    navkwa.com
```

Read the full standard first:

- [Navkwa Production Manual](./PRODUCTION_MANUAL.md)

## Production Layout

```text
/var/www/navkwa-build/
├── current -> releases/YYYYMMDD_HHMMSS/
├── releases/
└── shared/
    ├── .env
    ├── storage/
    └── logs/
```

The deployment script expects each release to live inside
`/var/www/navkwa-build/releases`.

## First Deployment

```bash
sudo mkdir -p /var/www/navkwa-build/releases /var/www/navkwa-build/shared/logs
sudo chown -R "$USER":www-data /var/www/navkwa-build
sudo chmod -R ug+rwX /var/www/navkwa-build

RELEASE="$(date -u +%Y%m%d_%H%M%S)"
git clone https://github.com/eljakes/Structra.git "/var/www/navkwa-build/releases/$RELEASE"
cd "/var/www/navkwa-build/releases/$RELEASE"

cp backend/.env.production.example /var/www/navkwa-build/shared/.env
cp frontend/.env.production.example /var/www/navkwa-build/shared/frontend.env
nano /var/www/navkwa-build/shared/.env
nano /var/www/navkwa-build/shared/frontend.env

APP_ROOT=/var/www/navkwa-build RELEASE_DIR="/var/www/navkwa-build/releases/$RELEASE" \
  ./deploy/hetzner/scripts/deploy-production.sh
```

## Server Files

Copy these templates during setup:

```bash
sudo cp deploy/hetzner/nginx/navkwabuild.conf /etc/nginx/sites-available/navkwabuild
sudo ln -sfn /etc/nginx/sites-available/navkwabuild /etc/nginx/sites-enabled/navkwabuild

sudo cp deploy/hetzner/supervisor/navkwabuild-worker.conf /etc/supervisor/conf.d/navkwabuild-worker.conf
sudo cp deploy/hetzner/cron/navkwabuild-scheduler /etc/cron.d/navkwabuild-scheduler
sudo cp deploy/hetzner/fail2ban/navkwa-build.local /etc/fail2ban/jail.d/navkwa-build.local
sudo cp deploy/hetzner/logrotate/navkwa-build /etc/logrotate.d/navkwa-build
```

Then verify:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo supervisorctl reread
sudo supervisorctl update
sudo systemctl restart fail2ban
```

## Go-Live Gate

```bash
cd /var/www/navkwa-build/current/backend
php artisan navkwabuild:production-check --strict

cd /var/www/navkwa-build/current
./deploy/hetzner/scripts/healthcheck.sh
```

Do not deploy the local database. Production must use a clean PostgreSQL
database, `NAVKWA_BUILD_SEED_DEVELOPMENT=false`, Redis-backed queues/cache/
sessions, HTTPS, real mail credentials, queue workers, the Laravel scheduler,
and tested backups.
