# Navkwa Build

Navkwa Build is a construction operations web application built from the
construction ERP product requirements.

This repo is organized as a fullstack workspace:

- `backend/` — Laravel API, Sanctum token auth, PostgreSQL persistence
- `frontend/` — React/Vite web app for the ERP and Navkwa Build Cloud Console
- `docker-compose.yml` — PostgreSQL and Redis services for local development

## Implemented Phase 1

- Tenant-aware company, branch, role, user, client, and supplier foundation
- Token authentication with seeded owner account
- Project register with tasks, budget lines, progress and cost rollups
- Procurement workflow: requisition, submit, approve/reject, convert to PO, issue, approve, deliver, close
- Document repository with branch/project scoping and real file upload storage
- Drawing library with disciplines, revisions, status transitions, and file uploads
- Executive dashboard, reports, and audit log API
- React workspace for dashboard, projects, procurement, documents, reports, and admin

## Implemented Phase 2

- CRM: leads, qualification, opportunities, and lead-to-client conversion
- Tendering: opportunity-to-tender flow, tender submission/win/loss, tender RFIs, tender document upload
- Estimating: pricing library, estimate headers/lines, overhead/profit/tax rollups, approval, tender-to-project budget handoff
- Inventory: warehouses, inventory items, stock receipts/issues/transfers/adjustments, reorder alerts
- Supplier management: supplier price catalogs, lead times, performance reviews, rating updates
- Web field app: daily site diaries, field issues with optional photo/GPS data, report submit/approve workflow
- Time & attendance: browser clock-in/out with optional GPS and face/image verification upload
- Drawing expansion: discipline-aware library, markups, markup resolution, architect/designer review decisions

## Implemented Phase 3

- Finance: invoices, invoice lines, issue workflow, payment receipts, expenses, expense review/payment, balanced journal entries
- Payroll/people: employee profiles tied to users, leave requests/reviews, payroll run generation, payslips, approval and paid transitions
- Equipment management: plant/equipment register, project assignment/release, maintenance logs, fuel logs, availability and meter tracking
- Quality control: inspections with checklist items, inspection completion/scoring, Non-Conformance Report(NCR) creation and closure workflow
- Health, Safety, and Environment: incidents, toolbox talks, observations, work permits, corrective action and permit status transitions
- Client/consultant portals: external users, project access grants, client approvals, consultant submittals and reviews
- Dashboard/report expansion for receivables, payroll liability, equipment availability, Non-Conformance Reports(NCRs), incidents, and portal reviews

## Implemented Phase 4

- Predictive forecasts: project cost/schedule forecasts and 30-day cash-flow forecasts with confidence scores and drivers
- Business intelligence: dashboard builder, metric snapshots, executive metrics, cost/category, project health, receivables, and insight severity datasets
- Workflow automation: configurable rules for project overruns, overdue invoices, low stock, open Health, Safety, and Environment actions, and expiring permits with run history
- React workspace modules for Intelligence and Automation

## Local Setup

Backend:

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan serve
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Default local URLs:

- API: `/api/v1` through the Vite proxy, or `http://127.0.0.1:8000/api/v1` when configured with `VITE_API_URL`
- Web: `http://127.0.0.1:5173`

If `8000` is already in use, run Laravel on another port, for example
`php artisan serve --host=127.0.0.1 --port=8010`, and set
`frontend/.env.local` to `VITE_API_URL=http://127.0.0.1:8010/api/v1`.

Create the first real company workspace from the registration screen. The production path does not require seeded demo users or sample project data.

Disposable development databases can load sample records with:

```bash
NAVKWA_BUILD_SEED_DEVELOPMENT=true php artisan db:seed
```

## PostgreSQL

Fresh local environments should use the PostgreSQL database `navkwabuild` on
`127.0.0.1:5432`. Existing local environments can keep their current database
name until they are intentionally recreated.

For a portable Docker setup:

```bash
docker compose up -d postgres redis
```

Then set `backend/.env` database values to:

```bash
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=navkwabuild
DB_USERNAME=navkwabuild
DB_PASSWORD=navkwabuild_secret
```

## Production Notes

- Start from `backend/.env.production.example` and `frontend/.env.production.example`; do not deploy the local `.env.example` values.
- Hetzner deployment configs and scripts live in `deploy/hetzner/`; use `deploy/hetzner/PRODUCTION_MANUAL.md` as the go-live standard.
- Current Hetzner production server is `navkwa-prod-01` at `49.12.103.75`.
- For the initial Hetzner launch, use `https://app.navkwa.com` for the ERP, `https://app.navkwa.com/cloud-console` for Navkwa Build Cloud Console, and `/api/v1` for the Laravel API.
- Set `APP_URL=https://app.navkwa.com`, `FRONTEND_URL=https://app.navkwa.com`, and `CORS_ALLOWED_ORIGINS=https://app.navkwa.com`.
- Keep `VITE_API_URL` blank when the frontend and API are served from the same domain behind `/api/v1`; set it only for separate frontend/API domains.
- Set `APP_ENV=production`, `APP_DEBUG=false`, a real `APP_KEY`, `APP_VERSION`, secure mail/storage credentials, and a production PostgreSQL database with TLS.
- Keep `NAVKWA_BUILD_SEED_DEVELOPMENT=false` in production. Run `php artisan migrate --force`, not `migrate:fresh --seed`, on production data.
- Before release, run `composer release-check` from `backend/` with production environment variables loaded, and `npm run release-check` from `frontend/`.
- Run `composer install --no-dev --optimize-autoloader`, `php artisan migrate --force`, `php artisan storage:link --force`, `php artisan config:cache`, `php artisan route:cache`, and `php artisan view:cache` during release.
- Public project portfolio images are served from Laravel public storage. Operational documents and file downloads remain protected through authenticated API endpoints.
- Run Supervisor queue workers for `QUEUE_CONNECTION=redis`, and monitor failed jobs.
- Run Laravel's scheduler every minute, for example `* * * * * cd /var/www/navkwa-build/current/backend && php artisan schedule:run >> /dev/null 2>&1`. This triggers `php artisan navkwabuild:backup-daily` once every 24 hours.
- Set `BACKUP_DISK`, `BACKUP_PATH`, and `BACKUP_DAILY_AT`. The default creates encrypted ERP tenant and Cloud Console backups at 02:00; use off-server storage such as S3 for stronger disaster recovery.
- Create the first Navkwa Build Cloud Console administrator with `php artisan navkwabuild:platform-admin admin@navkwa.com --create`, then change the temporary password immediately and enable MFA.
- The frontend refreshes authenticated ERP data from Laravel every `VITE_LIVE_REFRESH_MS` milliseconds. Set it to `0` to disable polling when replacing it with websockets.

## Verification

Backend:

```bash
cd backend
php artisan test
```

Current backend test coverage includes Phase 1, Phase 2, Phase 3, and Phase 4 workflow tests:
auth/tenancy, projects, procurement, documents, drawings, CRM, tendering,
estimating, inventory, supplier reviews, field reports, attendance, finance,
payroll, equipment, Quality Assurance, Health, Safety, and Environment, portal approvals, AI analysis, assistant Q&A,
BI dashboards/snapshots, automation rules, tax, exchange rates, and currency conversion.

Frontend:

```bash
cd frontend
npm run lint
npm run build
```
