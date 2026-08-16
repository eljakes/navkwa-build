# Navkwa Production Manual

This is the deployment standard for Navkwa Build ERP, Navkwa Build Cloud
Console, and the public Navkwa website on a Hetzner VPS or any clean Ubuntu
24.04 LTS server.

The target architecture is:

```text
Internet
  -> Cloudflare
  -> Ubuntu 24.04 LTS
  -> UFW firewall
  -> Fail2Ban
  -> Nginx
  -> PHP-FPM
  -> Navkwa website
  -> Navkwa Build ERP/API/Cloud Console
  -> PostgreSQL
  -> Redis
  -> queue workers
  -> Laravel scheduler
```

The target filesystem layout is:

```text
/var/www/
├── navkwa-build/
│   ├── current -> releases/20260814_001/
│   ├── releases/
│   │   ├── 20260814_001/
│   │   └── 20260820_001/
│   └── shared/
│       ├── .env
│       ├── storage/
│       └── logs/
└── navkwa-website/
    ├── current
    ├── releases
    └── shared
```

## Deployment Philosophy

Every production step must answer five questions:

- What are we installing?
- Why do we need it?
- What problem does it solve?
- How do we verify it is working?
- How do we troubleshoot it?

The goal is not to memorize commands. The goal is to understand what each layer
does and how to prove it is healthy.

## Phase 1 - Infrastructure

Status: completed.

What:
Domain, DNS, Cloudflare, VPS, Ubuntu, SSH, administrator account, and Git.

Current Hetzner server:

```text
Project: Navkwa Production
Server: navkwa-prod-01
IPv4: 49.12.103.75
Location: Falkenstein, eu-central
Plan: CPX22, x86, 80 GB disk
```

Recommended DNS records:

```text
A      @      49.12.103.75
A      app    49.12.103.75
CNAME  www    navkwa.com
```

Why:
These are the foundation. The application cannot be secure or reliable if DNS,
server access, and source control are unclear.

Problem solved:
Gives us one controlled server, one source of truth in GitHub, and one edge
network through Cloudflare.

Verify:

```bash
hostnamectl
lsb_release -a
whoami
git --version
ssh -V
```

Troubleshoot:
If SSH fails, confirm the VPS IP, Cloudflare DNS records, SSH key, and whether
the firewall is blocking port 22. If Git fails, confirm outbound HTTPS access
and the GitHub repository URL.

## Phase 2 - Security

### Hetzner Cloud Firewall

What:
Provider-level firewall rules in Hetzner Cloud.

Why:
Traffic should be filtered before it reaches Ubuntu.

Problem solved:
Adds a first protective layer even if the server firewall is temporarily
misconfigured.

Recommended inbound rules:

```text
22/tcp   trusted administrator IPs only
80/tcp   any IPv4/IPv6
443/tcp  any IPv4/IPv6
```

Verify:
In Hetzner Console, open the server's Firewall tab and confirm only those
inbound services are allowed.

Troubleshoot:
If SSH fails, use the Hetzner Console web terminal and check both the Hetzner
firewall and UFW.

### UFW Firewall

What:
Ubuntu's uncomplicated firewall.

Why:
Only SSH, HTTP, and HTTPS should be reachable from the internet.

Problem solved:
Blocks accidental exposure of PostgreSQL, Redis, PHP-FPM, and other internal
services.

Install and configure:

```bash
sudo apt update
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Verify:

```bash
sudo ufw status verbose
```

Troubleshoot:
If you lock yourself out, use the Hetzner VPS console to disable or correct
UFW. Do not expose PostgreSQL port 5432 or Redis port 6379 publicly.

### SSH Hardening

What:
Safer SSH settings for administrator access.

Why:
SSH is the main door into the server.

Problem solved:
Reduces password guessing and root-login risk.

Recommended settings in `/etc/ssh/sshd_config`:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
X11Forwarding no
```

Reload:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

Verify:
Open a second terminal and confirm you can still SSH in before closing your
current session.

Troubleshoot:
If the new session fails, keep the existing session open and revert the setting
that caused the issue.

### Automatic Security Updates

What:
Ubuntu unattended security upgrades.

Why:
Security patches should not wait for manual maintenance.

Problem solved:
Reduces exposure to known operating-system vulnerabilities.

Install:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Verify:

```bash
systemctl status unattended-upgrades
```

Troubleshoot:
Check `/var/log/unattended-upgrades/` if updates are not applying.

### Fail2Ban

What:
A log-watching blocker for repeated malicious requests.

Why:
It slows down brute-force SSH and noisy HTTP attacks.

Problem solved:
Automatically bans IPs that repeatedly hit risky endpoints or fail auth rules.

Install:

```bash
sudo apt install -y fail2ban
sudo cp deploy/hetzner/fail2ban/navkwa-build.local /etc/fail2ban/jail.d/navkwa-build.local
sudo systemctl enable --now fail2ban
```

Cloudflare note:
When Cloudflare proxying is enabled, configure Nginx real visitor IP handling
from Cloudflare's current official IP ranges before relying on HTTP Fail2Ban
jails. Otherwise Nginx logs may show Cloudflare edge IPs, and Fail2Ban could ban
the edge instead of the attacker. Keep that snippet updated from Cloudflare's
published IP list.

Verify:

```bash
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

Troubleshoot:
If a trusted IP is banned, unban it:

```bash
sudo fail2ban-client set sshd unbanip YOUR_IP_ADDRESS
```

### Time And Hostname

What:
NTP time synchronization and a clear hostname.

Why:
TLS certificates, logs, backups, and audits depend on correct time.

Problem solved:
Avoids confusing logs and certificate validation issues.

Configure:

```bash
sudo timedatectl set-timezone UTC
sudo timedatectl set-ntp true
sudo hostnamectl set-hostname navkwa-prod-01
```

Verify:

```bash
timedatectl
hostnamectl
```

Troubleshoot:
If time is wrong, check `systemd-timesyncd` and whether UDP time sync is blocked
by the hosting provider.

## Phase 3 - Runtime

What:
PHP 8.3, PHP-FPM, Composer, Node.js/npm, PostgreSQL, Redis, Supervisor, Git, and
supporting PHP extensions.

Why:
Laravel runs on PHP-FPM, React builds with Node/npm, PostgreSQL stores the
business data, Redis powers cache/session/queues, and Supervisor keeps queue
workers alive.

Problem solved:
Provides the runtime needed for both the ERP/API and Cloud Console.

Install base packages:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y \
  nginx supervisor cron git unzip curl ca-certificates logrotate \
  postgresql postgresql-contrib postgresql-client \
  redis-server redis-tools \
  php8.3-cli php8.3-fpm php8.3-pgsql php8.3-mbstring php8.3-xml \
  php8.3-bcmath php8.3-curl php8.3-zip php8.3-gd php8.3-intl php8.3-redis
```

Install Composer:

```bash
EXPECTED_CHECKSUM="$(php -r 'copy("https://composer.github.io/installer.sig", "php://stdout");')"
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
ACTUAL_CHECKSUM="$(php -r "echo hash_file('sha384', 'composer-setup.php');")"
test "$EXPECTED_CHECKSUM" = "$ACTUAL_CHECKSUM"
sudo php composer-setup.php --install-dir=/usr/local/bin --filename=composer
rm composer-setup.php
```

Install Node.js using a trusted LTS source for Ubuntu, then verify it.

Verify:

```bash
php -v
php-fpm8.3 -v
composer --version
node -v
npm -v
psql --version
redis-cli ping
supervisorctl version
```

Expected Redis result:

```text
PONG
```

Troubleshoot:
If PHP-FPM is missing, check `/run/php/php8.3-fpm.sock`. If Redis does not
return `PONG`, run `sudo systemctl status redis-server`. If Composer fails,
confirm PHP CLI is installed and outbound HTTPS is available.

## Phase 4 - Web Layer

What:
Nginx virtual hosts, HTTP to HTTPS, compression, and cache headers.

Why:
Nginx receives public traffic, serves the React frontend, and forwards API
requests to Laravel through PHP-FPM.

Problem solved:
Separates static frontend delivery from dynamic Laravel API execution.

Install the Navkwa Build virtual host:

```bash
sudo cp deploy/hetzner/nginx/navkwabuild.conf /etc/nginx/sites-available/navkwabuild
sudo ln -sfn /etc/nginx/sites-available/navkwabuild /etc/nginx/sites-enabled/navkwabuild
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Verify:

```bash
sudo nginx -t
curl -I http://app.navkwa.com
```

Troubleshoot:
If Nginx returns 502, check the PHP-FPM socket path:

```bash
ls /run/php/php*-fpm.sock
sudo systemctl status php8.3-fpm
```

If static assets are missing, confirm `frontend/dist` exists inside the current
release.

## Phase 5 - Applications

### Directory Layout

What:
Release-based folders with a stable `current` symlink and persistent `shared`
state.

Why:
Code releases should be replaceable, but `.env`, uploaded files, logs, and
storage must survive deployments.

Problem solved:
Enables safer rollbacks and later zero-downtime deployment.

Create the layout:

```bash
sudo mkdir -p /var/www/navkwa-build/releases /var/www/navkwa-build/shared/logs
sudo chown -R "$USER":www-data /var/www/navkwa-build
sudo chmod -R ug+rwX /var/www/navkwa-build
```

First release:

```bash
RELEASE="$(date -u +%Y%m%d_%H%M%S)"
git clone https://github.com/eljakes/Structra.git "/var/www/navkwa-build/releases/$RELEASE"
cd "/var/www/navkwa-build/releases/$RELEASE"
cp backend/.env.production.example /var/www/navkwa-build/shared/.env
cp frontend/.env.production.example /var/www/navkwa-build/shared/frontend.env
nano /var/www/navkwa-build/shared/.env
nano /var/www/navkwa-build/shared/frontend.env
```

Production `.env` must use real values:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://app.navkwa.com
FRONTEND_URL=https://app.navkwa.com
CORS_ALLOWED_ORIGINS=https://app.navkwa.com
NAVKWA_BUILD_SEED_DEVELOPMENT=false
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=navkwabuild
DB_USERNAME=navkwabuild_app
DB_PASSWORD=<strong-production-password>
DB_SSLMODE=require
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
MAIL_MAILER=smtp
MAIL_HOST=<smtp-host>
MAIL_USERNAME=<smtp-user>
MAIL_PASSWORD=<smtp-password>
MAIL_FROM_ADDRESS=no-reply@navkwa.com
SECURITY_REQUIRE_MFA_FOR_PLATFORM_ADMINS=true
SESSION_ENCRYPT=true
SESSION_SECURE_COOKIE=true
BACKUP_DISK=<off-server-disk-recommended>
BACKUP_DAILY_AT=02:00
```

Generate `APP_KEY`:

```bash
cd "/var/www/navkwa-build/releases/$RELEASE/backend"
php artisan key:generate --show
```

Paste the generated value into `/var/www/navkwa-build/shared/.env`.

Deploy the release:

```bash
cd "/var/www/navkwa-build/releases/$RELEASE"
APP_ROOT=/var/www/navkwa-build RELEASE_DIR="/var/www/navkwa-build/releases/$RELEASE" \
  ./deploy/hetzner/scripts/deploy-production.sh
```

Verify:

```bash
readlink -f /var/www/navkwa-build/current
cd /var/www/navkwa-build/current/backend
php artisan navkwabuild:production-check --strict
```

Troubleshoot:
If deployment fails before switching `current`, fix the release and rerun the
script. If a bad release is already active, point `current` back to the previous
release and restart workers:

```bash
sudo ln -sfn /var/www/navkwa-build/releases/PREVIOUS_RELEASE /var/www/navkwa-build/current
cd /var/www/navkwa-build/current/backend
php artisan queue:restart
sudo supervisorctl restart 'navkwabuild-worker:*'
sudo systemctl reload nginx
```

### PostgreSQL

What:
Clean production database and application user.

Why:
Production must never use the local development database or seed data.

Problem solved:
Separates real customer data from development/demo data.

Create the database:

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE USER navkwabuild_app WITH PASSWORD 'PASTE_STRONG_PASSWORD_HERE';
CREATE DATABASE navkwabuild OWNER navkwabuild_app;
GRANT CONNECT ON DATABASE navkwabuild TO navkwabuild_app;
\c navkwabuild
GRANT USAGE, CREATE ON SCHEMA public TO navkwabuild_app;
\q
```

Verify:

```bash
PGPASSWORD='PASTE_STRONG_PASSWORD_HERE' psql \
  -h 127.0.0.1 \
  -p 5432 \
  -U navkwabuild_app \
  -d navkwabuild \
  -c 'select current_database(), current_user;'
```

Troubleshoot:
If authentication fails, reset the password inside `psql` with
`ALTER USER navkwabuild_app WITH PASSWORD 'NEW_PASSWORD';` and update `.env`.

## Phase 6 - Production Operations

### SSL And Cloudflare

What:
TLS certificate, HTTPS redirect, and Cloudflare proxy.

Why:
All login, ERP, Cloud Console, and API traffic must be encrypted.

Problem solved:
Protects credentials, sessions, customer records, uploads, and admin actions in
transit.

Issue TLS after DNS points to the server:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.navkwa.com
sudo certbot renew --dry-run
```

Cloudflare should use Full Strict SSL mode after the server certificate is
active.

Verify:

```bash
curl -I https://app.navkwa.com
sudo certbot certificates
```

Troubleshoot:
If certificate issuance fails, confirm DNS resolves to the VPS and that ports
80 and 443 are open.

### Queue Workers

What:
Supervisor-managed Laravel queue workers using Redis.

Why:
Long-running background work must continue after SSH disconnects and server
reboots.

Problem solved:
Keeps mail, jobs, automation, imports, and other async work processing.

Install:

```bash
sudo cp deploy/hetzner/supervisor/navkwabuild-worker.conf /etc/supervisor/conf.d/navkwabuild-worker.conf
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status
```

Verify:

```bash
sudo supervisorctl status 'navkwabuild-worker:*'
```

Troubleshoot:
Read the worker log:

```bash
sudo tail -n 100 /var/www/navkwa-build/shared/logs/worker.log
```

### Laravel Scheduler

What:
Cron calling `php artisan schedule:run` every minute.

Why:
Laravel decides which scheduled task is due, including the 24-hour backup job.

Problem solved:
Runs scheduled backups and other timed maintenance reliably.

Install:

```bash
sudo cp deploy/hetzner/cron/navkwabuild-scheduler /etc/cron.d/navkwabuild-scheduler
sudo chmod 0644 /etc/cron.d/navkwabuild-scheduler
```

Verify:

```bash
cd /var/www/navkwa-build/current/backend
php artisan schedule:list
```

Troubleshoot:
Check cron and Laravel logs:

```bash
sudo systemctl status cron
sudo tail -n 100 /var/www/navkwa-build/shared/logs/laravel.log
```

### Backups

What:
Application-level encrypted backups plus PostgreSQL/storage exports.

Why:
VM snapshots alone are not enough. We need recoverable data artifacts.

Problem solved:
Protects ERP tenant data, Cloud Console data, uploaded files, and the database.

Application backup command:

```bash
cd /var/www/navkwa-build/current/backend
php artisan navkwabuild:backup-daily
```

PostgreSQL and storage export:

```bash
sudo mkdir -p /etc/navkwabuild
sudo cp deploy/hetzner/backup.env.example /etc/navkwabuild/backup.env
sudo chmod 0600 /etc/navkwabuild/backup.env
sudo nano /etc/navkwabuild/backup.env
sudo ./deploy/hetzner/scripts/backup-postgres-and-storage.sh
```

Verify:

```bash
ls -lah /var/backups/navkwabuild/postgres
ls -lah /var/backups/navkwabuild/storage
cd /var/www/navkwa-build/current/backend
php artisan schedule:list
```

Troubleshoot:
If backups fail, confirm database credentials, disk space, directory
permissions, and that `APP_KEY` has not changed. Encrypted Laravel backups need
the same `APP_KEY` to decrypt.

### Log Rotation

What:
Daily compression and rotation for shared app logs.

Why:
Logs grow forever unless rotated.

Problem solved:
Prevents logs from filling the server disk.

Install:

```bash
sudo cp deploy/hetzner/logrotate/navkwa-build /etc/logrotate.d/navkwa-build
sudo logrotate -d /etc/logrotate.d/navkwa-build
```

Verify:

```bash
sudo logrotate -d /etc/logrotate.d/navkwa-build
```

Troubleshoot:
If rotation fails, check file ownership and whether `/var/www/navkwa-build/shared/logs`
exists.

### Health Checks

What:
Scripted checks for frontend, protected API, Redis, production settings, and
Supervisor.

Why:
Deployment is not done until the system proves it is reachable and protected.

Problem solved:
Prevents going live with a blank frontend, exposed API, missing Redis, or failed
workers.

Run:

```bash
cd /var/www/navkwa-build/current
./deploy/hetzner/scripts/healthcheck.sh
```

Verify:
Expected results are frontend `200`, protected API `401`, Redis `PONG`, strict
production check passed, and Supervisor workers running.

Troubleshoot:
Use the failing line to choose the layer: DNS/Cloudflare, Nginx, PHP-FPM,
Laravel env, Redis, or Supervisor.

## Phase 7 - CI/CD

Goal:

```text
MacBook -> git push -> GitHub -> GitHub Actions -> production server
```

Why:
No FTP, no cPanel upload, no ZIP files. Git becomes the deployment trigger.

Target behavior:

1. GitHub Actions connects to the server by SSH.
2. It creates `/var/www/navkwa-build/releases/YYYYMMDD_HHMMSS`.
3. It clones the exact commit into that release.
4. It runs `deploy-production.sh`.
5. The script builds, checks, migrates, and atomically switches `current`.
6. The old release stays available for rollback.

Verify:
Each deployment should print the commit SHA, release path, production check
result, migration result, and final `current` symlink target.

Troubleshoot:
If CI/CD fails before symlink switch, production keeps running the previous
release. If it fails after switch, roll back the symlink to the previous release
and inspect the failed release logs.

## Go-Live Gate

Do not open Navkwa Build to customers until this passes on production:

```bash
cd /var/www/navkwa-build/current/backend
php artisan navkwabuild:production-check --strict
cd /var/www/navkwa-build/current
./deploy/hetzner/scripts/healthcheck.sh
```

Also confirm:

- Cloudflare SSL mode is Full Strict.
- `STRUCTRA` or old brand values are not visible to users.
- `NAVKWA_BUILD_SEED_DEVELOPMENT=false`.
- No local database was copied to production.
- Platform admin temporary password has been changed.
- MFA is enabled for the Cloud Console administrator.
- Queue workers are running.
- Scheduler is installed.
- Backups have been tested manually once.
