<?php

namespace App\Services;

use App\Models\Company;
use App\Models\PlatformBackup;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class PlatformBackupService
{
    private const EXCLUDED_TABLES = [
        'cache',
        'cache_locks',
        'failed_jobs',
        'job_batches',
        'jobs',
        'password_reset_tokens',
        'personal_access_tokens',
        'sessions',
    ];

    private const PLATFORM_TABLES = [
        'companies',
        'company_branding_profiles',
        'company_feature_flags',
        'company_subscriptions',
        'integration_connectors',
        'notification_events',
    ];

    /** @var array<string, array<int, string>> */
    private array $columnsByTable = [];

    public function createBackup(
        string $backupType,
        ?Company $company = null,
        ?string $storagePath = null,
        array $metadata = [],
        ?int $createdBy = null,
    ): PlatformBackup {
        $backupType = $this->normalizeBackupType($backupType);

        if ($backupType === 'tenant' && ! $company) {
            throw new RuntimeException('Tenant backups require a company.');
        }

        $backupNumber = $this->nextBackupNumber();
        $backup = PlatformBackup::query()->create([
            'company_id' => $company?->id,
            'backup_number' => $backupNumber,
            'backup_type' => $backupType,
            'status' => 'running',
            'storage_path' => $storagePath ?: $this->storagePath($backupType, $backupNumber, $company),
            'started_at' => now(),
            'created_by' => $createdBy,
            'metadata' => [
                ...$metadata,
                'encrypted' => true,
                'format' => 'json+laravel-encrypted',
                'frequency' => $metadata['frequency'] ?? null,
            ],
        ]);

        try {
            $snapshot = $this->snapshot($backup, $company);
            $plainText = json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $encrypted = Crypt::encryptString($plainText);
            $disk = $this->disk();

            Storage::disk($disk)->put($backup->storage_path, $encrypted);
            if (! Storage::disk($disk)->exists($backup->storage_path)) {
                throw new RuntimeException('Backup snapshot could not be written to storage.');
            }

            $verified = json_decode(Crypt::decryptString((string) Storage::disk($disk)->get($backup->storage_path)), true, flags: JSON_THROW_ON_ERROR);
            if (($verified['backup_number'] ?? null) !== $backup->backup_number) {
                throw new RuntimeException('Backup snapshot verification failed.');
            }

            $backup->update([
                'status' => 'completed',
                'size_mb' => round(strlen($encrypted) / 1048576, 2),
                'completed_at' => now(),
                'verified_at' => now(),
                'metadata' => [
                    ...($backup->metadata ?? []),
                    'disk' => $disk,
                    'record_counts' => $snapshot['record_counts'] ?? [],
                    'sha256' => hash('sha256', $encrypted),
                ],
            ]);
        } catch (Throwable $exception) {
            $backup->update([
                'status' => 'failed',
                'metadata' => [
                    ...($backup->metadata ?? []),
                    'error' => $exception->getMessage(),
                ],
            ]);

            throw $exception;
        }

        return $backup->fresh('company');
    }

    public function tenantCompaniesForDailyBackup(): Collection
    {
        return Company::query()
            ->where(function ($query): void {
                $query->whereNull('tenant_key')
                    ->orWhere('tenant_key', '!=', 'navkwa-group');
            })
            ->where(function ($query): void {
                $query->whereNull('status')
                    ->orWhereNotIn('status', ['archived', 'cancelled', 'inactive']);
            })
            ->orderBy('name')
            ->get();
    }

    private function snapshot(PlatformBackup $backup, ?Company $company): array
    {
        $base = [
            'backup_number' => $backup->backup_number,
            'backup_type' => $backup->backup_type,
            'generated_at' => now()->toISOString(),
            'generated_by' => $backup->created_by,
            'app' => config('app.name'),
            'environment' => config('app.env'),
            'encrypted' => true,
        ];

        return match ($backup->backup_type) {
            'tenant' => [
                ...$base,
                'scope' => 'navkwa_build_erp',
                'company_id' => $company?->id,
                'tenant_key' => $company?->tenant_key,
                'company' => $company?->fresh(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag', 'branches', 'roles', 'users']),
                ...$this->exportCompanyData((int) $company?->id),
            ],
            'documents' => [
                ...$base,
                'scope' => 'documents',
                ...$this->exportNamedTables(['documents', 'drawings', 'drawing_revisions', 'tender_documents']),
            ],
            'database' => [
                ...$base,
                'scope' => 'database',
                ...$this->exportNamedTables($this->exportableTables()),
            ],
            default => [
                ...$base,
                'scope' => 'navkwa_build_cloud_console',
                ...$this->exportPlatformData(),
            ],
        };
    }

    private function exportCompanyData(int $companyId): array
    {
        $tables = [];

        foreach ($this->exportableTables() as $table) {
            if (! $this->hasColumn($table, 'company_id')) {
                continue;
            }

            $tables[$table] = $this->exportTableRows(
                $table,
                fn ($query) => $query->where('company_id', $companyId),
            );
        }

        return $this->withRecordCounts($tables);
    }

    private function exportPlatformData(): array
    {
        $tables = [];
        $platformCompanyId = Company::query()->where('tenant_key', 'navkwa-group')->value('id');

        foreach ($this->exportableTables() as $table) {
            if (str_starts_with($table, 'platform_') || in_array($table, self::PLATFORM_TABLES, true)) {
                $tables[$table] = $this->exportTableRows($table);
            }
        }

        if ($platformCompanyId) {
            foreach (['branches', 'roles', 'users'] as $table) {
                if (Schema::hasTable($table)) {
                    $tables[$table] = $this->exportTableRows(
                        $table,
                        fn ($query) => $query->where('company_id', $platformCompanyId),
                    );
                }
            }
        }

        if (Schema::hasTable('audit_logs')) {
            $tables['audit_logs'] = $this->exportTableRows(
                'audit_logs',
                function ($query) use ($platformCompanyId): void {
                    $query->where('action', 'like', 'platform.%');

                    if ($platformCompanyId) {
                        $query->orWhere('company_id', $platformCompanyId);
                    }
                },
            );
        }

        return $this->withRecordCounts($tables);
    }

    private function exportNamedTables(array $tableNames): array
    {
        $tables = [];

        foreach ($tableNames as $table) {
            if (Schema::hasTable($table) && ! $this->isExcludedTable($table)) {
                $tables[$table] = $this->exportTableRows($table);
            }
        }

        return $this->withRecordCounts($tables);
    }

    private function exportTableRows(string $table, ?callable $scope = null): array
    {
        $query = DB::table($table);
        $columns = $this->columns($table);

        if ($scope) {
            $scope($query);
        }

        if (in_array('id', $columns, true)) {
            $query->orderBy('id');
        }

        $rows = $query->get()
            ->map(fn (object $row): array => $this->normalizeRow((array) $row))
            ->all();

        return [
            'columns' => $columns,
            'row_count' => count($rows),
            'rows' => $rows,
        ];
    }

    private function normalizeRow(array $row): array
    {
        return collect($row)
            ->map(fn ($value) => is_resource($value) ? stream_get_contents($value) : $value)
            ->all();
    }

    private function withRecordCounts(array $tables): array
    {
        return [
            'record_counts' => collect($tables)
                ->map(fn (array $table): int => (int) ($table['row_count'] ?? 0))
                ->all(),
            'tables' => $tables,
        ];
    }

    private function exportableTables(): array
    {
        return collect(Schema::getTables())
            ->pluck('name')
            ->map(fn (string $table): string => Str::afterLast($table, '.'))
            ->reject(fn (string $table): bool => $this->isExcludedTable($table))
            ->values()
            ->all();
    }

    private function columns(string $table): array
    {
        return $this->columnsByTable[$table] ??= collect(Schema::getColumns($table))
            ->pluck('name')
            ->values()
            ->all();
    }

    private function hasColumn(string $table, string $column): bool
    {
        return in_array($column, $this->columns($table), true);
    }

    private function isExcludedTable(string $table): bool
    {
        return in_array($table, self::EXCLUDED_TABLES, true);
    }

    private function nextBackupNumber(): string
    {
        $base = 'BAK-'.now()->format('ym');
        $next = PlatformBackup::query()->where('backup_number', 'like', "{$base}-%")->count() + 1;

        do {
            $candidate = sprintf('%s-%05d', $base, $next);
            $exists = PlatformBackup::query()->where('backup_number', $candidate)->exists();
            $next++;
        } while ($exists);

        return $candidate;
    }

    private function storagePath(string $backupType, string $backupNumber, ?Company $company): string
    {
        $root = $this->rootPath();
        $scope = match ($backupType) {
            'tenant' => 'tenants/'.Str::slug((string) ($company?->tenant_key ?: $company?->name ?: $company?->id)),
            'documents' => 'documents',
            'database' => 'database',
            default => 'cloud-console',
        };

        return "{$root}/{$scope}/".now()->format('Y/m').'/'.$backupNumber.'.json.enc';
    }

    private function normalizeBackupType(string $backupType): string
    {
        return in_array($backupType, ['tenant', 'platform', 'documents', 'database'], true)
            ? $backupType
            : 'tenant';
    }

    private function disk(): string
    {
        return (string) config('backup.disk', 'local');
    }

    private function rootPath(): string
    {
        return trim((string) config('backup.path', 'navkwabuild-backups'), '/') ?: 'navkwabuild-backups';
    }
}
