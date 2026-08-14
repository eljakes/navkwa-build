<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\PlatformBackupService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

$platformAdminCommand = function (): int {
    $email = strtolower((string) $this->argument('email'));
    $name = (string) $this->option('name');
    $password = (string) ($this->option('password') ?: Str::password(24, letters: true, numbers: true, symbols: true, spaces: false));

    $validator = Validator::make(
        ['password' => $password],
        ['password' => ['required', Password::min(14)->letters()->mixedCase()->numbers()->symbols()]],
    );

    if ($validator->fails()) {
        $this->error('The platform administrator password must be at least 14 characters and include uppercase and lowercase letters, numbers, and symbols.');

        return self::FAILURE;
    }

    $company = Company::query()->firstOrCreate(
        ['tenant_key' => 'navkwa-group'],
        [
            'name' => 'Navkwa Group Ltd.',
            'default_currency' => 'GHS',
            'country' => 'GH',
            'base_timezone' => 'Africa/Accra',
            'status' => 'active',
            'settings' => ['tenant_mode' => 'platform_operator'],
        ],
    );

    $branch = Branch::query()->firstOrCreate(
        ['company_id' => $company->id, 'code' => 'HQ'],
        ['name' => 'Head Office', 'country' => $company->country],
    );

    $role = Role::query()->updateOrCreate(
        ['company_id' => $company->id, 'slug' => 'platform-super-admin'],
        ['name' => 'Platform Super Admin', 'permissions' => ['platform.manage'], 'is_system' => true],
    );

    $user = User::query()->where('email', $email)->first();

    if (! $user && ! $this->option('create')) {
        $this->error('User not found. Rerun with --create to create the account.');

        return self::FAILURE;
    }

    if (! $user) {
        $user = User::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'role_id' => $role->id,
            'name' => $name,
            'email' => $email,
            'job_title' => 'Platform Administrator',
            'password' => $password,
            'status' => 'active',
            'password_changed_at' => now(),
            'must_change_password' => true,
        ]);

        $this->info("Platform administrator created for {$email}.");
        $this->line("Temporary password: {$password}");

        return self::SUCCESS;
    }

    $permissions = array_values(array_unique([...$user->accessPermissions(), 'platform.manage']));
    $user->forceFill([
        'permissions' => $permissions,
        'status' => 'active',
    ])->save();

    if ($this->option('password')) {
        $user->forceFill([
            'password' => $password,
            'password_changed_at' => now(),
            'must_change_password' => true,
        ])->save();
        $user->tokens()->delete();
    }

    $this->info("Platform access granted to {$email}.");

    return self::SUCCESS;
};

Artisan::command('navkwabuild:platform-admin {email} {--name=Platform Administrator} {--password=} {--create}', $platformAdminCommand)
    ->purpose('Grant or create a Navkwa Build Cloud Console administrator.');

$dailyBackupCommand = function (): int {
    /** @var PlatformBackupService $backups */
    $backups = app(PlatformBackupService::class);
    $metadata = ['source' => 'scheduler', 'frequency' => '24_hours'];
    $created = [];
    $failures = [];

    if (! $this->option('tenants-only')) {
        try {
            $created[] = $backups->createBackup('platform', metadata: $metadata);
            $this->info('Cloud Console backup completed.');
        } catch (\Throwable $exception) {
            report($exception);
            $failures[] = 'Cloud Console: '.$exception->getMessage();
            $this->error('Cloud Console backup failed.');
        }
    }

    if (! $this->option('platform-only')) {
        $tenantIds = array_values(array_filter(array_map('intval', (array) $this->option('tenant-id'))));
        $tenants = $backups->tenantCompaniesForDailyBackup()
            ->when($tenantIds !== [], fn ($collection) => $collection->whereIn('id', $tenantIds));

        foreach ($tenants as $company) {
            try {
                $created[] = $backups->createBackup('tenant', company: $company, metadata: $metadata);
                $this->info("ERP backup completed for {$company->name}.");
            } catch (\Throwable $exception) {
                report($exception);
                $failures[] = "{$company->name}: ".$exception->getMessage();
                $this->error("ERP backup failed for {$company->name}.");
            }
        }
    }

    if ($failures !== []) {
        $this->error('Navkwa Build daily backup completed with failures.');
        foreach ($failures as $failure) {
            $this->line(" - {$failure}");
        }

        return self::FAILURE;
    }

    $this->info('Navkwa Build daily backup completed successfully. Backups created: '.count($created).'.');

    return self::SUCCESS;
};

Artisan::command('navkwabuild:backup-daily {--tenant-id=* : Restrict tenant ERP backups to specific company IDs} {--platform-only : Only back up Navkwa Build Cloud Console data} {--tenants-only : Only back up Navkwa Build ERP tenant data}', $dailyBackupCommand)
    ->purpose('Create encrypted 24-hour backups for Navkwa Build ERP tenants and Navkwa Build Cloud Console.');

$productionCheckCommand = function (): int {
    $failures = [];
    $warnings = [];
    $strict = (bool) $this->option('strict');
    $environment = (string) config('app.env');
    $envValue = fn (string $key, mixed $default = ''): string => trim((string) env($key, $default));
    $envFlag = fn (string $key, bool $default = false): bool => filter_var(env($key, $default), FILTER_VALIDATE_BOOLEAN);
    $isLocalValue = fn (string $value): bool => Str::contains(Str::lower($value), ['localhost', '127.0.0.1', '::1']);
    $requiresHttps = function (string $key, string $value) use (&$failures, $isLocalValue): void {
        if ($value === '') {
            $failures[] = "{$key} must be set.";

            return;
        }

        if (! Str::startsWith($value, 'https://') || $isLocalValue($value)) {
            $failures[] = "{$key} must be a real HTTPS production URL.";
        }
    };

    if ($strict && $environment !== 'production') {
        $failures[] = 'APP_ENV must be production for deployment.';
    }

    if (! $strict && $environment !== 'production') {
        $warnings[] = 'Run this command with --strict after loading production environment variables.';
    }

    if ($strict || $environment === 'production') {
        if ((bool) config('app.debug')) {
            $failures[] = 'APP_DEBUG must be false.';
        }

        if ($envValue('APP_KEY') === '') {
            $failures[] = 'APP_KEY must be generated before deployment.';
        }

        if ($envValue('APP_VERSION') === '') {
            $failures[] = 'APP_VERSION must identify the release being deployed.';
        }

        $requiresHttps('APP_URL', (string) config('app.url'));
        $requiresHttps('FRONTEND_URL', $envValue('FRONTEND_URL'));

        $corsOrigins = array_values(array_filter(array_map('trim', explode(',', $envValue('CORS_ALLOWED_ORIGINS')))));
        if ($corsOrigins === []) {
            $failures[] = 'CORS_ALLOWED_ORIGINS must contain the production frontend origin.';
        }
        foreach ($corsOrigins as $origin) {
            if ($origin === '*' || ! Str::startsWith($origin, 'https://') || $isLocalValue($origin)) {
                $failures[] = "CORS_ALLOWED_ORIGINS contains an unsafe origin: {$origin}";
            }
        }

        if ($envFlag('NAVKWA_BUILD_SEED_DEVELOPMENT')) {
            $failures[] = 'NAVKWA_BUILD_SEED_DEVELOPMENT must be false in production.';
        }

        if (config('database.default') !== 'pgsql') {
            $failures[] = 'DB_CONNECTION should be pgsql for the production deployment.';
        }
        if ($envValue('DB_DATABASE') === '' || $envValue('DB_USERNAME') === '' || $envValue('DB_PASSWORD') === '') {
            $failures[] = 'DB_DATABASE, DB_USERNAME, and DB_PASSWORD must be set.';
        }
        if ($envValue('DB_PASSWORD') === 'navkwabuild_secret') {
            $failures[] = 'DB_PASSWORD must not use the local development password.';
        }
        if (! in_array($envValue('DB_SSLMODE', 'prefer'), ['require', 'verify-ca', 'verify-full'], true)) {
            $failures[] = 'DB_SSLMODE should require TLS in production.';
        }

        if (in_array((string) config('mail.default'), ['log', 'array'], true)) {
            $failures[] = 'MAIL_MAILER must send real mail in production.';
        }
        if ($envValue('MAIL_FROM_ADDRESS') === '' || Str::contains($envValue('MAIL_FROM_ADDRESS'), 'example.com')) {
            $failures[] = 'MAIL_FROM_ADDRESS must be a real sender address.';
        }
        if ((string) config('mail.default') === 'smtp' && $envValue('MAIL_HOST') === '') {
            $failures[] = 'MAIL_HOST must be set when MAIL_MAILER=smtp.';
        }

        if ((string) config('queue.default') === 'sync') {
            $failures[] = 'QUEUE_CONNECTION must use a worker-backed queue, not sync.';
        }
        if ($envValue('BACKUP_DISK', config('backup.disk')) === '') {
            $failures[] = 'BACKUP_DISK must be set for scheduled backups.';
        }
        if ($envValue('BACKUP_DAILY_AT', config('backup.daily_at')) === '') {
            $failures[] = 'BACKUP_DAILY_AT must be set for 24-hour scheduled backups.';
        }
        if ($envValue('BACKUP_DISK', config('backup.disk')) === 'local') {
            $warnings[] = 'BACKUP_DISK is local. Use off-server storage such as S3 for stronger disaster recovery.';
        }
        if (! $envFlag('SECURITY_REQUIRE_MFA_FOR_PLATFORM_ADMINS')) {
            $failures[] = 'SECURITY_REQUIRE_MFA_FOR_PLATFORM_ADMINS must be true in production.';
        }
        if (! $envFlag('SECURITY_REVOKE_OTHER_WEB_TOKENS_ON_LOGIN', true)) {
            $failures[] = 'SECURITY_REVOKE_OTHER_WEB_TOKENS_ON_LOGIN must remain true in production.';
        }
        if ((int) env('SECURITY_WEB_TOKEN_LIFETIME_MINUTES', 240) > 240) {
            $failures[] = 'SECURITY_WEB_TOKEN_LIFETIME_MINUTES must be 240 minutes or less in production.';
        }
        if ((int) env('SECURITY_LOGIN_RATE_LIMIT_PER_MINUTE', 5) > 5) {
            $failures[] = 'SECURITY_LOGIN_RATE_LIMIT_PER_MINUTE must be 5 or lower in production.';
        }
        if (! (bool) config('session.encrypt')) {
            $failures[] = 'SESSION_ENCRYPT must be true.';
        }
        if (! (bool) config('session.secure')) {
            $failures[] = 'SESSION_SECURE_COOKIE must be true.';
        }
        if ($envValue('LOG_LEVEL', 'debug') === 'debug') {
            $failures[] = 'LOG_LEVEL should not be debug in production.';
        }

        try {
            DB::connection()->getPdo();
        } catch (\Throwable $exception) {
            $failures[] = 'Database connection failed: '.$exception->getMessage();
        }
    }

    foreach ($warnings as $warning) {
        $this->warn($warning);
    }

    if ($failures !== []) {
        $this->error('Navkwa Build production readiness check failed.');
        foreach ($failures as $failure) {
            $this->line(" - {$failure}");
        }

        return self::FAILURE;
    }

    $this->info('Navkwa Build production readiness check passed.');

    return self::SUCCESS;
};

Artisan::command('navkwabuild:production-check {--strict : Fail unless the loaded environment is production-ready}', $productionCheckCommand)
    ->purpose('Validate production environment and deployment safety settings.');
