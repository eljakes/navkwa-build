<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\Branch;
use App\Models\Company;
use App\Models\CompanyBrandingProfile;
use App\Models\CompanyFeatureFlag;
use App\Models\CompanySubscription;
use App\Models\Document;
use App\Models\DrawingRevision;
use App\Models\IntegrationConnector;
use App\Models\Invoice;
use App\Models\NotificationEvent;
use App\Models\Payment;
use App\Models\PlatformBackup;
use App\Models\PlatformBillingRecord;
use App\Models\PlatformDeployment;
use App\Models\PlatformFeatureFlag;
use App\Models\PlatformSecurityEvent;
use App\Models\PlatformSetting;
use App\Models\PlatformSubscriptionPlan;
use App\Models\PlatformSupportTicket;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\Role;
use App\Models\TenderDocument;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\PersonalAccessToken;
use Throwable;

class PlatformAdminController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->ensurePlatformCatalog($request);

        $companies = Company::query()
            ->with([
                'subscriptions.plan',
                'brandingProfile',
                'featureFlags.flag',
                'branches:id,company_id,name,code',
                'roles:id,company_id,name,slug,permissions,is_system',
                'users:id,company_id,branch_id,role_id,name,email,status,last_login_at',
            ])
            ->withCount(['branches', 'users'])
            ->latest()
            ->limit(250)
            ->get()
            ->map(fn (Company $company): array => $this->companyPayload($company))
            ->values();
        $archivedCompanies = Company::onlyTrashed()
            ->with(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag'])
            ->latest('deleted_at')
            ->limit(200)
            ->get()
            ->map(fn (Company $company): array => $this->companyPayload($company))
            ->values();
        $plans = PlatformSubscriptionPlan::query()
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', '!=', 'archived'))
            ->withCount('subscriptions')
            ->orderBy('monthly_price')
            ->get();
        $featureFlags = PlatformFeatureFlag::query()
            ->withCount([
                'companyFlags as enabled_companies_count' => fn ($query) => $query->where('is_enabled', true),
            ])
            ->orderBy('module')
            ->orderBy('category')
            ->orderBy('name')
            ->get();
        $subscriptions = CompanySubscription::query()->with(['company:id,name,country,status', 'plan:id,name,code'])->latest()->limit(200)->get();
        $billing = PlatformBillingRecord::query()->with(['company:id,name', 'subscription.plan:id,name,code'])->latest()->limit(200)->get();
        $tickets = PlatformSupportTicket::query()->with(['company:id,name', 'assignee:id,name'])->latest()->limit(200)->get();
        $deployments = PlatformDeployment::query()->latest()->limit(120)->get();
        $securityEvents = PlatformSecurityEvent::query()->with(['company:id,name'])->latest()->limit(160)->get();
        $backups = PlatformBackup::query()->with(['company:id,name'])->latest()->limit(160)->get();
        $settings = PlatformSetting::query()->orderBy('setting_key')->get();
        $integrations = IntegrationConnector::query()->with('company:id,name')->latest()->limit(160)->get();
        $notifications = NotificationEvent::query()->with(['company:id,name', 'user:id,name,email'])->latest()->limit(160)->get();
        $auditLogs = AuditLog::query()->with('company:id,name')->latest('created_at')->limit(200)->get();
        $automationRules = AutomationRule::query()->with('company:id,name')->withCount('runs')->latest()->limit(160)->get();
        $automationRuns = AutomationRun::query()->with(['company:id,name', 'rule:id,name,module'])->latest('started_at')->limit(160)->get();
        $summary = $this->summary();

        return response()->json([
            'summary' => $summary,
            'command_center' => $this->commandCenter($summary, $companies, $subscriptions, $billing, $tickets, $deployments, $securityEvents, $backups),
            'companies' => $companies,
            'archived_companies' => $archivedCompanies,
            'plans' => $plans,
            'subscriptions' => $subscriptions,
            'feature_flags' => $featureFlags,
            'billing_records' => $billing,
            'support_tickets' => $tickets,
            'deployments' => $deployments,
            'security_events' => $securityEvents,
            'backups' => $backups,
            'settings' => $settings,
            'integrations' => $integrations,
            'notifications' => $notifications,
            'audit_logs' => $auditLogs,
            'automation_workflows' => $this->automationWorkflows($automationRules, $automationRuns),
            'support_metrics' => $this->supportMetrics($tickets),
            'platform_staff' => $this->platformStaff($request),
            'search_results' => $this->searchResults($request),
            'analytics' => $this->analytics($companies, $featureFlags),
            'monitoring' => $this->monitoring(),
            'catalog' => [
                'console_layers' => $this->consoleLayers(),
                'modules' => $this->moduleCatalog(),
                'countries' => $this->africanCountryCodes(),
                'currencies' => $this->africanCurrencyCodes(),
                'plans' => $plans->map(fn (PlatformSubscriptionPlan $plan): array => ['id' => $plan->id, 'name' => $plan->name, 'code' => $plan->code])->values(),
                'statuses' => ['trial', 'active', 'past_due', 'suspended', 'cancelled', 'inactive'],
                'plan_statuses' => ['active', 'inactive', 'archived'],
                'subscription_statuses' => ['trial', 'active', 'past_due', 'suspended', 'cancelled'],
                'billing_intervals' => ['monthly', 'yearly', 'custom'],
                'support_levels' => ['standard', 'priority', 'enterprise', 'dedicated'],
                'support_priorities' => ['low', 'medium', 'high', 'urgent', 'critical'],
                'support_ticket_statuses' => ['open', 'assigned', 'waiting_customer', 'resolved', 'closed'],
                'billing_record_types' => ['invoice', 'payment', 'refund', 'credit', 'renewal', 'failed_payment'],
                'billing_statuses' => ['draft', 'issued', 'paid', 'failed', 'refunded', 'void'],
                'backup_types' => ['tenant', 'platform', 'documents', 'database'],
                'deployment_scopes' => ['all_customers', 'enterprise', 'country', 'beta_testers', 'selected_companies'],
                'platform_permissions' => $this->platformPermissionCatalog(),
            ],
        ]);
    }

    public function storeCompany(Request $request): JsonResponse
    {
        $this->ensurePlatformCatalog($request);
        $companyId = null;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'registration_number' => ['nullable', 'string', 'max:120'],
            'industry' => ['nullable', 'string', 'max:120'],
            'country' => ['required', 'string', 'size:2'],
            'city' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:2000'],
            'phone' => ['nullable', 'string', 'max:60'],
            'email' => ['nullable', 'email', 'max:255'],
            'website' => ['nullable', 'url', 'max:255'],
            'tax_id' => ['nullable', 'string', 'max:120'],
            'currency' => ['required', 'string', 'size:3'],
            'timezone' => ['nullable', 'string', 'max:80'],
            'language' => ['nullable', 'string', 'max:12'],
            'date_format' => ['nullable', 'string', 'max:32'],
            'fiscal_year_start' => ['nullable', 'string', 'max:5'],
            'primary_contact_name' => ['required', 'string', 'max:255'],
            'primary_contact_email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'primary_contact_phone' => ['nullable', 'string', 'max:60'],
            'admin_password' => ['nullable', $this->passwordRule()],
            'subscription_plan_id' => ['nullable', 'integer', 'exists:platform_subscription_plans,id'],
            'status' => ['nullable', Rule::in(['trial', 'active', 'suspended', 'inactive'])],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'storage_limit_mb' => ['nullable', 'integer', 'min:1'],
            'employee_limit' => ['nullable', 'integer', 'min:1'],
            'project_limit' => ['nullable', 'integer', 'min:1'],
            'branch_limit' => ['nullable', 'integer', 'min:1'],
            'enabled_feature_keys' => ['nullable', 'array'],
            'enabled_feature_keys.*' => ['string', 'max:120'],
            'branding' => ['nullable', 'array'],
            'branding.primary_color' => ['nullable', 'string', 'max:20'],
            'branding.secondary_color' => ['nullable', 'string', 'max:20'],
            'branding.accent_color' => ['nullable', 'string', 'max:20'],
            'branding.sidebar_color' => ['nullable', 'string', 'max:20'],
            'branding.button_color' => ['nullable', 'string', 'max:20'],
            'branding.typography' => ['nullable', 'string', 'max:120'],
            'branding.login_welcome_message' => ['nullable', 'string', 'max:1000'],
            'branding.company_motto' => ['nullable', 'string', 'max:255'],
        ]);

        $temporaryPassword = $data['admin_password'] ?? $this->temporaryPassword();
        $plan = ! empty($data['subscription_plan_id'])
            ? PlatformSubscriptionPlan::query()->whereKey($data['subscription_plan_id'])->first()
            : PlatformSubscriptionPlan::query()->where('code', 'professional')->first();
        $enabledKeys = $data['enabled_feature_keys'] ?? array_values(array_unique([
            ...($plan?->modules ?? collect($this->moduleCatalog())->pluck('flag_key')->all()),
            ...($plan?->features ?? []),
        ]));

        $payload = DB::transaction(function () use ($request, $data, $temporaryPassword, $plan, $enabledKeys, &$companyId): array {
            $trialEndsAt = now()->addDays((int) ($data['trial_days'] ?? 14));
            $tenantKey = $this->uniqueTenantKey($data['name']);
            $company = Company::query()->create([
                'tenant_key' => $tenantKey,
                'name' => $data['name'],
                'registration_number' => $data['registration_number'] ?? null,
                'tax_id' => $data['tax_id'] ?? null,
                'industry' => $data['industry'] ?? null,
                'default_currency' => strtoupper($data['currency']),
                'country' => strtoupper($data['country']),
                'city' => $data['city'] ?? null,
                'address' => $data['address'] ?? null,
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
                'website' => $data['website'] ?? null,
                'base_timezone' => $data['timezone'] ?? 'Africa/Accra',
                'language' => $data['language'] ?? 'en',
                'date_format' => $data['date_format'] ?? 'Y-m-d',
                'fiscal_year_start' => $data['fiscal_year_start'] ?? '01-01',
                'status' => $data['status'] ?? 'trial',
                'trial_ends_at' => $trialEndsAt,
                'storage_limit_mb' => $data['storage_limit_mb'] ?? $plan?->maximum_storage_mb,
                'employee_limit' => $data['employee_limit'] ?? $plan?->maximum_users,
                'project_limit' => $data['project_limit'] ?? $plan?->maximum_projects,
                'branch_limit' => $data['branch_limit'] ?? 1,
                'provisioned_at' => now(),
                'settings' => [
                    'tenant_mode' => 'single_database_scoped',
                    'storage_root' => "tenants/{$tenantKey}",
                    'platform_created_by' => $this->user($request)->id,
                    'appearance' => ['theme' => 'light'],
                ],
            ]);
            $companyId = $company->id;

            $branch = Branch::query()->create([
                'company_id' => $company->id,
                'name' => 'Head Office',
                'code' => 'HQ',
                'city' => $company->city,
                'country' => $company->country,
                'phone' => $company->phone,
                'email' => $company->email,
                'address' => $company->address,
            ]);

            $adminRole = Role::query()->create([
                'company_id' => $company->id,
                'name' => 'Company Administrator',
                'slug' => 'company-administrator',
                'permissions' => ['*'],
                'is_system' => true,
            ]);

            foreach ($this->tenantDefaultRoles() as $role) {
                Role::query()->create(['company_id' => $company->id, ...$role]);
            }

            $admin = User::query()->create([
                'company_id' => $company->id,
                'branch_id' => $branch->id,
                'role_id' => $adminRole->id,
                'name' => $data['primary_contact_name'],
                'email' => strtolower($data['primary_contact_email']),
                'phone' => $data['primary_contact_phone'] ?? null,
                'job_title' => 'Company Administrator',
                'password' => $temporaryPassword,
                'password_changed_at' => now(),
                'status' => 'active',
            ]);

            $subscription = $this->createSubscription($company, $plan, $data['status'] ?? 'trial', $trialEndsAt, $request);
            $brandingData = $data['branding'] ?? [];
            $branding = CompanyBrandingProfile::query()->create([
                'company_id' => $company->id,
                'primary_color' => $brandingData['primary_color'] ?? '#2364d8',
                'secondary_color' => $brandingData['secondary_color'] ?? '#188a5a',
                'accent_color' => $brandingData['accent_color'] ?? '#b66a05',
                'sidebar_color' => $brandingData['sidebar_color'] ?? '#102033',
                'button_color' => $brandingData['button_color'] ?? '#2364d8',
                'typography' => $brandingData['typography'] ?? 'Inter',
                'login_welcome_message' => $brandingData['login_welcome_message'] ?? 'Welcome to Navkwa Build.',
                'company_motto' => $brandingData['company_motto'] ?? null,
                'updated_by' => $this->user($request)->id,
            ]);

            $this->syncCompanyFeatureFlags($company, $enabledKeys, $this->user($request)->id);
            Storage::disk('local')->makeDirectory("tenants/{$company->tenant_key}");
            $welcome = $this->sendWelcomeEmail($company, $admin, $temporaryPassword);
            $this->audit($request, 'platform.company.provisioned', $company, null, [
                'tenant_key' => $company->tenant_key,
                'admin_user_id' => $admin->id,
                'subscription_id' => $subscription->id,
                'welcome_email' => $welcome['status'],
            ]);

            return [
                'company' => $this->companyPayload($company->fresh(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag', 'branches', 'roles', 'users'])),
                'admin_user' => $admin->fresh(['branch', 'role']),
                'subscription' => $subscription->fresh('plan'),
                'branding' => $branding,
                'temporary_password' => $temporaryPassword,
                'login_url' => rtrim((string) config('app.url'), '/').'/login?tenant='.$company->tenant_key,
                'welcome_email' => $welcome,
            ];
        });

        return response()->json($payload, 201);
    }

    public function updateCompanyAccount(Request $request, Company $company): JsonResponse
    {
        abort_if($company->is($this->platformCompany($request)), 422, 'The Navkwa Build Cloud Console tenant cannot be edited from customer account management.');
        $before = $company->toArray();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'registration_number' => ['nullable', 'string', 'max:120'],
            'industry' => ['nullable', 'string', 'max:120'],
            'country' => ['sometimes', 'string', 'size:2'],
            'city' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:2000'],
            'phone' => ['nullable', 'string', 'max:60'],
            'email' => ['nullable', 'email', 'max:255'],
            'website' => ['nullable', 'url', 'max:255'],
            'tax_id' => ['nullable', 'string', 'max:120'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'timezone' => ['nullable', 'string', 'max:80'],
            'language' => ['nullable', 'string', 'max:12'],
            'date_format' => ['nullable', 'string', 'max:32'],
            'fiscal_year_start' => ['nullable', 'string', 'max:5'],
            'status' => ['sometimes', Rule::in(['trial', 'active', 'past_due', 'suspended', 'cancelled', 'inactive'])],
            'trial_ends_at' => ['nullable', 'date'],
            'storage_limit_mb' => ['nullable', 'integer', 'min:1'],
            'employee_limit' => ['nullable', 'integer', 'min:1'],
            'project_limit' => ['nullable', 'integer', 'min:1'],
            'branch_limit' => ['nullable', 'integer', 'min:1'],
            'subscription_plan_id' => ['nullable', 'integer', 'exists:platform_subscription_plans,id'],
        ]);

        $companyData = collect($data)->except(['currency', 'timezone', 'subscription_plan_id'])->all();
        if (array_key_exists('currency', $data)) {
            $companyData['default_currency'] = strtoupper($data['currency']);
        }
        if (array_key_exists('timezone', $data)) {
            $companyData['base_timezone'] = $data['timezone'];
        }
        if (array_key_exists('country', $companyData)) {
            $companyData['country'] = strtoupper($companyData['country']);
        }

        DB::transaction(function () use ($request, $company, $companyData, $data): void {
            $company->update($companyData);

            if (array_key_exists('subscription_plan_id', $data)) {
                $plan = $data['subscription_plan_id']
                    ? PlatformSubscriptionPlan::query()->whereKey($data['subscription_plan_id'])->first()
                    : null;
                $subscription = CompanySubscription::query()->where('company_id', $company->id)->latest()->first();

                if ($subscription) {
                    $subscription->update([
                        'platform_subscription_plan_id' => $plan?->id,
                        'amount' => $plan?->monthly_price ?? $subscription->amount,
                        'currency' => $plan?->currency ?? $company->default_currency,
                        'status' => $data['status'] ?? $subscription->status,
                        'updated_by' => $this->user($request)->id,
                    ]);
                } elseif ($plan) {
                    $this->createSubscription($company, $plan, $data['status'] ?? $company->status, $company->trial_ends_at, $request);
                }
            }

            if (in_array($company->status, ['suspended', 'cancelled', 'inactive'], true)) {
                User::query()->where('company_id', $company->id)->get()->each(fn (User $user) => $user->tokens()->delete());
            }
        });

        $fresh = $company->fresh(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag', 'branches', 'roles', 'users']);
        $this->audit($request, 'platform.company.updated', $fresh, $before, $fresh->toArray());

        return response()->json(['company' => $this->companyPayload($fresh)]);
    }

    public function archiveCompany(Request $request, Company $company): JsonResponse
    {
        abort_if($company->is($this->platformCompany($request)), 422, 'The Navkwa Build Cloud Console tenant cannot be archived.');
        $before = $company->toArray();

        DB::transaction(function () use ($company): void {
            $settings = $company->settings ?? [];
            $company->forceFill([
                'status' => 'archived',
                'settings' => [
                    ...$settings,
                    'archived_from_status' => $company->status,
                    'archived_at' => now()->toISOString(),
                ],
            ])->save();
            User::query()->where('company_id', $company->id)->get()->each(fn (User $user) => $user->tokens()->delete());
            $company->delete();
        });

        $this->audit($request, 'platform.company.archived', $company, $before, ['deleted_at' => $company->deleted_at?->toISOString(), 'status' => 'archived']);

        return response()->json(['message' => 'Company archived.']);
    }

    public function restoreCompany(Request $request, int $companyId): JsonResponse
    {
        $company = Company::withTrashed()->whereKey($companyId)->firstOrFail();
        abort_if($company->is($this->platformCompany($request)), 422, 'The Navkwa Build Cloud Console tenant cannot be restored from customer account management.');
        $before = $company->toArray();
        $settings = $company->settings ?? [];
        $restoredStatus = data_get($settings, 'archived_from_status', 'active');

        DB::transaction(function () use ($company, $settings, $restoredStatus): void {
            if ($company->trashed()) {
                $company->restore();
            }

            unset($settings['archived_from_status']);
            $company->forceFill([
                'status' => in_array($restoredStatus, ['trial', 'active', 'past_due', 'suspended', 'cancelled', 'inactive'], true) ? $restoredStatus : 'active',
                'settings' => [
                    ...$settings,
                    'restored_at' => now()->toISOString(),
                ],
            ])->save();
        });

        $fresh = $company->fresh(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag', 'branches', 'roles', 'users']);
        $this->audit($request, 'platform.company.restored', $fresh, $before, $fresh->toArray());

        return response()->json(['company' => $this->companyPayload($fresh)]);
    }

    public function permanentlyDeleteCompany(Request $request, int $companyId): JsonResponse
    {
        $company = Company::onlyTrashed()->whereKey($companyId)->firstOrFail();
        $platformCompany = $this->platformCompany($request);

        abort_if(
            (int) $company->id === (int) $platformCompany->id || $company->tenant_key === $platformCompany->tenant_key,
            422,
            'The Navkwa Build Cloud Console tenant cannot be permanently deleted from customer account management.',
        );

        $before = $company->toArray();
        $tenantKey = $company->tenant_key;

        DB::transaction(function () use ($company): void {
            User::query()
                ->where('company_id', $company->id)
                ->get()
                ->each(function (User $user): void {
                    $user->tokens()->delete();
                    $user->delete();
                });

            $company->forceDelete();
        });

        $tenantStorageDeleted = filled($tenantKey)
            ? Storage::disk('local')->deleteDirectory("tenants/{$tenantKey}")
            : false;
        $companyStorageDeleted = Storage::disk('local')->deleteDirectory("navkwabuild/companies/{$companyId}");

        $this->audit($request, 'platform.company.permanently_deleted', 'platform', $before, [
            'deleted_company_id' => $companyId,
            'name' => $before['name'] ?? null,
            'tenant_key' => $tenantKey,
            'tenant_storage_deleted' => $tenantStorageDeleted,
            'company_storage_deleted' => $companyStorageDeleted,
        ]);

        return response()->json(['message' => 'Company permanently deleted.']);
    }

    public function storePlan(Request $request): JsonResponse
    {
        $data = $this->validatePlan($request);
        $plan = PlatformSubscriptionPlan::query()->create([
            ...$data,
            'code' => Str::slug(filled($data['code'] ?? null) ? $data['code'] : $data['name']),
            'currency' => strtoupper($data['currency'] ?? 'GHS'),
            'created_by' => $this->user($request)->id,
        ]);
        $this->audit($request, 'platform.plan.created', $plan, null, $plan->toArray());

        return response()->json(['plan' => $plan], 201);
    }

    public function updatePlan(Request $request, PlatformSubscriptionPlan $plan): JsonResponse
    {
        $before = $plan->toArray();
        $data = $this->validatePlan($request, true);
        if (array_key_exists('code', $data)) {
            $data['code'] = Str::slug(filled($data['code']) ? $data['code'] : ($data['name'] ?? $plan->name));
        }
        if (array_key_exists('currency', $data)) {
            $data['currency'] = strtoupper($data['currency']);
        }

        $plan->update($data);
        $this->audit($request, 'platform.plan.updated', $plan, $before, $plan->fresh()->toArray());

        return response()->json(['plan' => $plan->fresh()]);
    }

    public function destroyPlan(Request $request, PlatformSubscriptionPlan $plan): JsonResponse
    {
        $before = $plan->toArray();
        $hasSubscriptions = CompanySubscription::query()
            ->where('platform_subscription_plan_id', $plan->id)
            ->exists();

        $plan->forceFill(['status' => 'archived'])->save();

        if (! $hasSubscriptions) {
            $plan->delete();
        }

        $this->audit($request, 'platform.plan.deleted', $plan, $before, [
            'status' => 'archived',
            'deleted' => ! $hasSubscriptions,
            'retained_for_subscription_history' => $hasSubscriptions,
        ]);

        return response()->json(['message' => 'Subscription plan deleted.']);
    }

    public function updateSubscription(Request $request, CompanySubscription $subscription): JsonResponse
    {
        $before = $subscription->toArray();
        $data = $this->validateSubscriptionUpdate($request);

        if (array_key_exists('currency', $data) && filled($data['currency'])) {
            $data['currency'] = strtoupper($data['currency']);
        }

        if (($data['status'] ?? null) === 'cancelled' && blank($subscription->cancelled_at)) {
            $data['cancelled_at'] = now();
        }

        DB::transaction(function () use ($request, $subscription, $data): void {
            $subscription->update([...$data, 'updated_by' => $this->user($request)->id]);
            $companyStatus = $this->companyStatusFromSubscription($subscription->status);

            if ($companyStatus) {
                $subscription->company()->update(['status' => $companyStatus]);
            }

            if (in_array($companyStatus, ['suspended', 'cancelled', 'inactive'], true)) {
                User::query()->where('company_id', $subscription->company_id)->get()->each(fn (User $user) => $user->tokens()->delete());
            }
        });

        $fresh = $subscription->fresh(['company:id,name,country,status', 'plan:id,name,code']);
        $this->audit($request, 'platform.subscription.updated', $fresh, $before, $fresh->toArray());

        return response()->json(['subscription' => $fresh]);
    }

    public function upgradeSubscription(Request $request, CompanySubscription $subscription): JsonResponse
    {
        $data = $request->validate([
            'platform_subscription_plan_id' => ['required', 'integer', $this->activePlanExistsRule()],
            'billing_interval' => ['nullable', Rule::in(['monthly', 'yearly'])],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'seats' => ['nullable', 'integer', 'min:1'],
            'renewal_at' => ['nullable', 'date'],
        ]);
        $plan = PlatformSubscriptionPlan::query()->whereKey($data['platform_subscription_plan_id'])->firstOrFail();
        $company = $subscription->company()->firstOrFail();
        $before = $subscription->toArray();
        $interval = $data['billing_interval'] ?? $subscription->billing_interval ?: 'monthly';
        $amount = array_key_exists('amount', $data) && $data['amount'] !== null
            ? $data['amount']
            : ($interval === 'yearly' ? $plan->yearly_price : $plan->monthly_price);
        $renewalAt = $data['renewal_at'] ?? ($interval === 'yearly' ? now()->addYear() : now()->addMonth());
        $metadata = $subscription->metadata ?? [];

        DB::transaction(function () use ($request, $subscription, $company, $plan, $data, $interval, $amount, $renewalAt, $metadata): void {
            $subscription->update([
                'platform_subscription_plan_id' => $plan->id,
                'status' => 'active',
                'billing_interval' => $interval,
                'amount' => $amount,
                'currency' => $plan->currency,
                'seats' => $data['seats'] ?? $plan->maximum_users ?? $subscription->seats,
                'current_period_starts_at' => now(),
                'current_period_ends_at' => Carbon::parse($renewalAt),
                'renewal_at' => Carbon::parse($renewalAt),
                'cancelled_at' => null,
                'metadata' => [
                    ...$metadata,
                    'upgraded_at' => now()->toISOString(),
                    'upgraded_by' => $this->user($request)->id,
                    'upgraded_to_plan_id' => $plan->id,
                ],
                'updated_by' => $this->user($request)->id,
            ]);
            $company->update([
                'default_currency' => $plan->currency,
                'status' => 'active',
                'storage_limit_mb' => $plan->maximum_storage_mb ?? $company->storage_limit_mb,
                'employee_limit' => $plan->maximum_users ?? $company->employee_limit,
                'project_limit' => $plan->maximum_projects ?? $company->project_limit,
            ]);
            $this->syncCompanyFeatureFlags($company, array_values(array_unique([
                ...($plan->modules ?? []),
                ...($plan->features ?? []),
            ])), $this->user($request)->id);
        });

        $fresh = $subscription->fresh(['company:id,name,country,status', 'plan:id,name,code']);
        $this->audit($request, 'platform.subscription.upgraded', $fresh, $before, $fresh->toArray());

        return response()->json([
            'subscription' => $fresh,
            'company' => $this->companyPayload($company->fresh(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag', 'branches', 'roles', 'users'])),
        ]);
    }

    public function destroySubscription(Request $request, CompanySubscription $subscription): JsonResponse
    {
        $before = $subscription->toArray();
        $company = $subscription->company()->first();

        DB::transaction(function () use ($request, $subscription, $company): void {
            $subscription->forceFill([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'metadata' => [
                    ...($subscription->metadata ?? []),
                    'deleted_at' => now()->toISOString(),
                    'deleted_by' => $this->user($request)->id,
                ],
                'updated_by' => $this->user($request)->id,
            ])->save();
            $subscription->delete();

            $hasOtherActiveSubscription = CompanySubscription::query()
                ->where('company_id', $subscription->company_id)
                ->whereKeyNot($subscription->id)
                ->whereIn('status', ['trial', 'active', 'past_due'])
                ->exists();

            if ($company && ! $hasOtherActiveSubscription) {
                $company->update(['status' => 'cancelled']);
                User::query()->where('company_id', $company->id)->get()->each(fn (User $user) => $user->tokens()->delete());
            }
        });

        $this->audit($request, 'platform.subscription.deleted', $subscription, $before, [
            'status' => 'cancelled',
            'deleted' => true,
        ]);

        return response()->json(['message' => 'Subscription deleted.']);
    }

    public function updateCompanyFeature(Request $request, Company $company, PlatformFeatureFlag $flag): JsonResponse
    {
        $data = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'limit_value' => ['nullable', 'integer', 'min:0'],
            'configuration' => ['nullable', 'array'],
        ]);
        $before = CompanyFeatureFlag::query()
            ->where('company_id', $company->id)
            ->where('platform_feature_flag_id', $flag->id)
            ->first()?->toArray();
        $companyFlag = CompanyFeatureFlag::query()->updateOrCreate(
            ['company_id' => $company->id, 'platform_feature_flag_id' => $flag->id],
            [
                'is_enabled' => $data['is_enabled'],
                'limit_value' => $data['limit_value'] ?? null,
                'configuration' => $data['configuration'] ?? null,
                'enabled_at' => $data['is_enabled'] ? now() : null,
                'disabled_at' => $data['is_enabled'] ? null : now(),
                'updated_by' => $this->user($request)->id,
            ],
        );
        $this->audit($request, 'platform.feature.updated', $companyFlag, $before, $companyFlag->fresh('flag')->toArray());

        return response()->json(['feature' => $companyFlag->fresh('flag'), 'company' => $this->companyPayload($company->fresh(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag', 'branches', 'roles', 'users']))]);
    }

    public function updateFeatureFlag(Request $request, PlatformFeatureFlag $flag): JsonResponse
    {
        $before = $flag->toArray();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'module' => ['sometimes', 'string', 'max:80'],
            'category' => ['sometimes', Rule::in(['module', 'feature'])],
            'description' => ['nullable', 'string', 'max:2000'],
            'default_enabled' => ['sometimes', 'boolean'],
            'rollout_status' => ['sometimes', Rule::in(['planned', 'beta', 'active', 'paused', 'retired'])],
            'rollout_percentage' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'pricing_tier' => ['nullable', 'string', 'max:80'],
            'requires_subscription' => ['sometimes', 'boolean'],
            'configuration' => ['nullable', 'array'],
        ]);

        $flag->update($data);
        $this->audit($request, 'platform.feature_release.updated', $flag, $before, $flag->fresh()->toArray());

        return response()->json(['feature' => $flag->fresh()->loadCount([
            'companyFlags as enabled_companies_count' => fn ($query) => $query->where('is_enabled', true),
        ])]);
    }

    public function updateBranding(Request $request, Company $company): JsonResponse
    {
        $data = $request->validate([
            'primary_color' => ['nullable', 'string', 'max:20'],
            'secondary_color' => ['nullable', 'string', 'max:20'],
            'accent_color' => ['nullable', 'string', 'max:20'],
            'sidebar_color' => ['nullable', 'string', 'max:20'],
            'button_color' => ['nullable', 'string', 'max:20'],
            'typography' => ['nullable', 'string', 'max:120'],
            'login_welcome_message' => ['nullable', 'string', 'max:1000'],
            'company_motto' => ['nullable', 'string', 'max:255'],
            'email_templates' => ['nullable', 'array'],
            'pdf_templates' => ['nullable', 'array'],
            'invoice_template' => ['nullable', 'array'],
            'quotation_template' => ['nullable', 'array'],
            'letterhead' => ['nullable', 'array'],
            'report_header' => ['nullable', 'array'],
            'logo' => ['nullable', 'file', 'max:5120'],
            'dark_logo' => ['nullable', 'file', 'max:5120'],
            'light_logo' => ['nullable', 'file', 'max:5120'],
            'favicon' => ['nullable', 'file', 'max:2048'],
            'login_background' => ['nullable', 'file', 'max:10240'],
            'dashboard_background' => ['nullable', 'file', 'max:10240'],
            'watermark' => ['nullable', 'file', 'max:5120'],
        ]);
        $branding = CompanyBrandingProfile::query()->firstOrCreate(['company_id' => $company->id], ['updated_by' => $this->user($request)->id]);
        $before = $branding->toArray();
        $fileFields = [
            'logo' => 'logo_path',
            'dark_logo' => 'dark_logo_path',
            'light_logo' => 'light_logo_path',
            'favicon' => 'favicon_path',
            'login_background' => 'login_background_path',
            'dashboard_background' => 'dashboard_background_path',
            'watermark' => 'watermark_path',
        ];
        $payload = collect($data)->except(array_keys($fileFields))->all();

        foreach ($fileFields as $input => $column) {
            if ($request->hasFile($input)) {
                $payload[$column] = $request->file($input)->store("tenants/{$company->tenant_key}/branding", 'local');
            }
        }

        $branding->update([...$payload, 'updated_by' => $this->user($request)->id]);
        $this->audit($request, 'platform.branding.updated', $branding, $before, $branding->fresh()->toArray());

        return response()->json(['branding' => $branding->fresh(), 'company' => $this->companyPayload($company->fresh(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag', 'branches', 'roles', 'users']))]);
    }

    public function updateCompanySuccess(Request $request, Company $company): JsonResponse
    {
        $data = $request->validate([
            'success_manager' => ['nullable', 'string', 'max:255'],
            'last_meeting_at' => ['nullable', 'date'],
            'next_meeting_at' => ['nullable', 'date'],
            'training_completed_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'adoption_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'risk_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'expansion_opportunity' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $before = $company->settings ?? [];
        $company->forceFill([
            'settings' => [
                ...$before,
                'customer_success' => $data,
            ],
        ])->save();

        $this->audit($request, 'platform.customer_success.updated', $company, $before, $company->settings ?? []);

        return response()->json([
            'company' => $this->companyPayload($company->fresh(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag', 'branches', 'roles', 'users'])),
        ]);
    }

    public function storePlatformUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', $this->passwordRule()],
            'phone' => ['nullable', 'string', 'max:60'],
            'job_title' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'suspended'])],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:120'],
        ]);

        $company = $this->platformCompany($request);
        $role = $this->ensurePlatformStaffRole($company);
        $branch = $this->platformBranch($company);
        $permissions = $this->normalizePlatformPermissions($data['permissions'] ?? ['platform.manage']);

        $user = User::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'role_id' => $role->id,
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'phone' => $data['phone'] ?? null,
            'job_title' => $data['job_title'] ?? 'Cloud Console User',
            'status' => $data['status'] ?? 'active',
            'password' => $data['password'],
            'password_changed_at' => now(),
            'permissions' => $permissions,
        ]);
        $this->audit($request, 'platform.staff.created', $user, null, $this->staffPayload($user->fresh(['branch', 'role'])));

        return response()->json(['user' => $this->staffPayload($user->fresh(['branch', 'role']))], 201);
    }

    public function updatePlatformUser(Request $request, User $user): JsonResponse
    {
        $this->assertPlatformStaffUser($request, $user);
        $before = $this->staffPayload($user->fresh(['branch', 'role']));
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', $this->passwordRule()],
            'phone' => ['nullable', 'string', 'max:60'],
            'job_title' => ['nullable', 'string', 'max:120'],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'suspended'])],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:120'],
        ]);

        $passwordChanged = filled($data['password'] ?? null);
        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }
        if (array_key_exists('email', $data)) {
            $data['email'] = strtolower($data['email']);
        }
        if (array_key_exists('permissions', $data)) {
            $data['permissions'] = $this->normalizePlatformPermissions($data['permissions']);
        }

        abort_if($user->is($this->user($request)) && in_array($data['status'] ?? $user->status, ['inactive', 'suspended'], true), 422, 'You cannot deactivate your own Cloud Console account.');
        abort_if($user->status === 'active' && in_array($data['status'] ?? 'active', ['inactive', 'suspended'], true) && $this->activePlatformManagerCount($request) <= 1, 422, 'At least one active Cloud Console administrator must remain.');

        $user->update($data);

        if (in_array($user->status, ['inactive', 'suspended'], true)) {
            $user->tokens()->delete();
        }
        if ($passwordChanged) {
            $user->forceFill(['password_changed_at' => now()])->save();
            $user->tokens()->delete();
        }

        $fresh = $user->fresh(['branch', 'role']);
        $this->audit($request, 'platform.staff.updated', $fresh, $before, $this->staffPayload($fresh));

        return response()->json(['user' => $this->staffPayload($fresh)]);
    }

    public function destroyPlatformUser(Request $request, User $user): JsonResponse
    {
        $this->assertPlatformStaffUser($request, $user);
        abort_if($user->is($this->user($request)), 422, 'You cannot delete your own Cloud Console account.');
        abort_if($user->status === 'active' && $this->activePlatformManagerCount($request) <= 1, 422, 'At least one active Cloud Console administrator must remain.');

        $before = $this->staffPayload($user->fresh(['branch', 'role']));
        $user->tokens()->delete();
        $user->delete();
        $this->audit($request, 'platform.staff.deleted', $user, $before, ['deleted' => true]);

        return response()->json(['message' => 'Cloud Console user deleted.']);
    }

    public function updatePlatformProfile(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $before = $this->staffPayload($user->fresh(['branch', 'role']));
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:60'],
            'job_title' => ['nullable', 'string', 'max:120'],
            'current_password' => ['nullable', 'string'],
            'password' => ['nullable', 'confirmed', $this->passwordRule()],
        ]);

        $passwordChanged = filled($data['password'] ?? null);
        if ((filled($data['email'] ?? null) && $data['email'] !== $user->email) || $passwordChanged) {
            abort_if(! Hash::check((string) ($data['current_password'] ?? ''), $user->password), 422, 'Your current password is incorrect.');
        }

        unset($data['current_password'], $data['password_confirmation']);
        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }
        if (array_key_exists('email', $data)) {
            $data['email'] = strtolower($data['email']);
        }

        $user->update($data);
        if ($passwordChanged) {
            $user->forceFill(['password_changed_at' => now()])->save();
            $this->revokeOtherTokens($request, $user);
        }
        $fresh = $user->fresh(['company.branches', 'branch', 'role']);
        $this->audit($request, 'platform.profile.updated', $fresh, $before, $this->staffPayload($fresh));

        return response()->json(['user' => $this->staffPayload($fresh)]);
    }

    public function storeBillingRecord(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => ['required', 'integer', 'exists:companies,id'],
            'company_subscription_id' => ['nullable', 'integer', 'exists:company_subscriptions,id'],
            'record_type' => ['required', Rule::in(['invoice', 'payment', 'refund', 'credit', 'renewal', 'failed_payment'])],
            'status' => ['nullable', Rule::in(['draft', 'issued', 'paid', 'failed', 'refunded', 'void'])],
            'amount' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'issued_on' => ['nullable', 'date'],
            'due_on' => ['nullable', 'date'],
            'paid_at' => ['nullable', 'date'],
            'metadata' => ['nullable', 'array'],
        ]);
        $record = PlatformBillingRecord::query()->create([
            ...$data,
            'record_number' => $this->nextGlobalNumber('BILL', PlatformBillingRecord::class, 'record_number'),
            'currency' => strtoupper($data['currency'] ?? 'GHS'),
            'created_by' => $this->user($request)->id,
        ]);
        $this->audit($request, 'platform.billing.created', $record, null, $record->toArray());

        return response()->json(['billing_record' => $record->fresh(['company', 'subscription.plan'])], 201);
    }

    public function storeSupportTicket(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
            'title' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:80'],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high', 'urgent', 'critical'])],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'description' => ['nullable', 'string', 'max:4000'],
            'sla_due_at' => ['nullable', 'date'],
        ]);
        $ticket = PlatformSupportTicket::query()->create([
            ...$data,
            'ticket_number' => $this->nextGlobalNumber('SUP', PlatformSupportTicket::class, 'ticket_number'),
            'category' => $data['category'] ?? 'support',
            'priority' => $data['priority'] ?? 'medium',
            'status' => 'open',
            'created_by' => $this->user($request)->id,
        ]);
        $this->audit($request, 'platform.support.created', $ticket, null, $ticket->toArray());

        return response()->json(['ticket' => $ticket->fresh(['company', 'assignee'])], 201);
    }

    public function updateSupportTicket(Request $request, PlatformSupportTicket $ticket): JsonResponse
    {
        $before = $ticket->toArray();
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'assigned', 'waiting_customer', 'resolved', 'closed'])],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high', 'urgent', 'critical'])],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'resolution_notes' => ['nullable', 'string', 'max:4000'],
        ]);
        if (($data['status'] ?? null) === 'closed' || ($data['status'] ?? null) === 'resolved') {
            $data['closed_at'] = now();
        }
        $ticket->update($data);
        $this->audit($request, 'platform.support.updated', $ticket, $before, $ticket->fresh()->toArray());

        return response()->json(['ticket' => $ticket->fresh(['company', 'assignee'])]);
    }

    public function storeDeployment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'release_version' => ['nullable', 'string', 'max:80'],
            'target_scope' => ['required', Rule::in(['all_customers', 'enterprise', 'country', 'beta_testers', 'selected_companies'])],
            'target_filter' => ['nullable', 'array'],
            'scheduled_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);
        $deployment = PlatformDeployment::query()->create([
            ...$data,
            'deployment_number' => $this->nextGlobalNumber('DEP', PlatformDeployment::class, 'deployment_number'),
            'status' => filled($data['scheduled_at'] ?? null) ? 'scheduled' : 'ready',
            'created_by' => $this->user($request)->id,
        ]);
        $this->audit($request, 'platform.deployment.created', $deployment, null, $deployment->toArray());

        return response()->json(['deployment' => $deployment], 201);
    }

    public function storeBackup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
            'backup_type' => ['nullable', Rule::in(['tenant', 'platform', 'documents', 'database'])],
            'storage_path' => ['nullable', 'string', 'max:255'],
            'metadata' => ['nullable', 'array'],
        ]);
        $backupType = $data['backup_type'] ?? 'tenant';
        abort_if($backupType === 'tenant' && empty($data['company_id']), 422, 'Select a company for tenant backups.');
        $backupNumber = $this->nextGlobalNumber('BAK', PlatformBackup::class, 'backup_number');
        $storagePath = filled($data['storage_path'] ?? null)
            ? $data['storage_path']
            : 'platform-backups/'.now()->format('Y/m')."/{$backupNumber}.json";
        $company = filled($data['company_id'] ?? null)
            ? Company::query()->with(['subscriptions.plan', 'brandingProfile', 'featureFlags.flag', 'branches', 'roles', 'users'])->findOrFail($data['company_id'])
            : null;
        $backup = PlatformBackup::query()->create([
            ...$data,
            'backup_number' => $backupNumber,
            'backup_type' => $backupType,
            'status' => 'running',
            'storage_path' => $storagePath,
            'started_at' => now(),
            'created_by' => $this->user($request)->id,
        ]);

        try {
            $snapshot = $this->backupSnapshot($backup, $company);
            $contents = json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            Storage::disk('local')->put($storagePath, $contents);
            abort_if(! Storage::disk('local')->exists($storagePath), 500, 'Backup snapshot could not be verified.');

            $backup->update([
                'status' => 'completed',
                'size_mb' => round(strlen($contents) / 1048576, 2),
                'completed_at' => now(),
                'verified_at' => now(),
                'metadata' => [
                    ...($data['metadata'] ?? []),
                    'record_counts' => $snapshot['record_counts'] ?? [],
                    'generated_by' => $this->user($request)->id,
                ],
            ]);
        } catch (Throwable $exception) {
            $backup->update([
                'status' => 'failed',
                'metadata' => [
                    ...($data['metadata'] ?? []),
                    'error' => $exception->getMessage(),
                ],
            ]);

            throw $exception;
        }

        $this->audit($request, 'platform.backup.completed', $backup, null, $backup->fresh()->toArray());

        return response()->json(['backup' => $backup->fresh('company')], 201);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'settings' => ['required', 'array'],
        ]);
        $settings = collect($data['settings'])->map(function ($value, string $key) use ($request): PlatformSetting {
            return PlatformSetting::query()->updateOrCreate(
                ['setting_key' => $key],
                ['setting_value' => is_array($value) ? $value : ['value' => $value], 'updated_by' => $this->user($request)->id],
            );
        })->values();
        $this->audit($request, 'platform.settings.updated', new PlatformSetting, null, $data['settings']);

        return response()->json(['settings' => $settings]);
    }

    public function startImpersonation(Request $request, Company $company): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'reason' => ['required', 'string', 'max:1000'],
            'authorization_reference' => ['required', 'string', 'max:255'],
            'expires_minutes' => ['nullable', 'integer', 'min:5', 'max:120'],
        ]);
        $targetUser = User::query()->where('company_id', $company->id)->whereKey($data['user_id'])->firstOrFail();
        $token = $targetUser->createToken(
            'platform-impersonation',
            ['impersonation'],
            now()->addMinutes((int) ($data['expires_minutes'] ?? 30)),
        )->plainTextToken;
        $event = PlatformSecurityEvent::query()->create([
            'company_id' => $company->id,
            'user_id' => $targetUser->id,
            'event_type' => 'user_impersonation_started',
            'severity' => 'high',
            'status' => 'open',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'description' => $data['reason'],
            'metadata' => [
                'authorization_reference' => $data['authorization_reference'],
                'platform_user_id' => $this->user($request)->id,
                'expires_minutes' => (int) ($data['expires_minutes'] ?? 30),
            ],
            'created_by' => $this->user($request)->id,
        ]);
        $this->audit($request, 'platform.impersonation.started', $targetUser, null, [
            'company_id' => $company->id,
            'authorization_reference' => $data['authorization_reference'],
            'security_event_id' => $event->id,
        ]);

        return response()->json([
            'token' => $token,
            'expires_at' => now()->addMinutes((int) ($data['expires_minutes'] ?? 30))->toISOString(),
            'user' => $targetUser->fresh(['company', 'branch', 'role']),
            'security_event' => $event,
        ]);
    }

    private function summary(): array
    {
        $companies = Company::query();
        $subscriptions = CompanySubscription::query()->with('plan')->get();
        $activeSubscriptions = $subscriptions->whereIn('status', ['active', 'trial']);
        $mrr = $activeSubscriptions->sum(fn (CompanySubscription $subscription): float => $this->monthlySubscriptionAmount($subscription));
        $supportTotal = PlatformSupportTicket::query()->count();
        $supportCompliant = PlatformSupportTicket::query()
            ->where(function ($query): void {
                $query->whereNull('sla_due_at')
                    ->orWhere('sla_due_at', '>=', now())
                    ->orWhereNotNull('closed_at');
            })
            ->count();
        $storageUsed = (int) Document::query()->sum('size_bytes')
            + (int) DrawingRevision::query()->sum('size_bytes')
            + (int) TenderDocument::query()->sum('size_bytes');
        $paidBilling = PlatformBillingRecord::query()->where('status', 'paid');
        $outstandingInvoices = PlatformBillingRecord::query()
            ->where('record_type', 'invoice')
            ->whereNotIn('status', ['paid', 'void']);

        $monitoring = $this->platformMonitoringSnapshot($storageUsed);

        $aiSettings = PlatformSetting::query()->where('setting_key', 'ai')->first()?->setting_value ?? [];

        return [
            'total_companies' => (clone $companies)->count(),
            'active_companies' => (clone $companies)->where('status', 'active')->count(),
            'trial_companies' => (clone $companies)->where('status', 'trial')->count(),
            'enterprise_customers' => $activeSubscriptions->filter(fn (CompanySubscription $subscription): bool => in_array($subscription->plan?->code, ['enterprise', 'custom'], true))->count(),
            'new_companies_this_month' => Company::query()->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])->count(),
            'monthly_recurring_revenue' => round($mrr, 2),
            'annual_recurring_revenue' => round($mrr * 12, 2),
            'average_revenue_per_account' => $activeSubscriptions->count() > 0 ? round($mrr / $activeSubscriptions->count(), 2) : 0,
            'customer_lifetime_value' => $activeSubscriptions->count() > 0 ? round(($mrr / $activeSubscriptions->count()) * 24, 2) : 0,
            'churn_rate' => $subscriptions->count() > 0 ? round(($subscriptions->where('status', 'cancelled')->count() / $subscriptions->count()) * 100, 2) : 0,
            'renewal_rate' => $subscriptions->count() > 0 ? round(($activeSubscriptions->count() / $subscriptions->count()) * 100, 2) : 0,
            'average_subscription_age_days' => round((float) $activeSubscriptions->avg(fn (CompanySubscription $subscription): int => $subscription->started_at ? (int) $subscription->started_at->diffInDays(now()) : 0), 1),
            'monthly_signups' => Company::query()->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])->count(),
            'converted_companies_this_month' => CompanySubscription::query()->where('status', 'active')->whereBetween('started_at', [now()->startOfMonth(), now()->endOfMonth()])->distinct('company_id')->count('company_id'),
            'cancelled_companies_this_month' => CompanySubscription::query()->where('status', 'cancelled')->whereBetween('updated_at', [now()->startOfMonth(), now()->endOfMonth()])->distinct('company_id')->count('company_id'),
            'active_users_today' => User::query()->whereDate('last_login_at', now()->toDateString())->count(),
            'companies_online_today' => User::query()->whereDate('last_login_at', now()->toDateString())->distinct('company_id')->count('company_id'),
            'projects_managed' => Project::query()->count(),
            'invoices_processed' => Invoice::query()->whereNotIn('status', ['draft', 'void'])->count(),
            'purchase_orders_created' => PurchaseOrder::query()->count(),
            'storage_used_mb' => round($storageUsed / 1048576, 2),
            'storage_usage_percent' => $this->platformStorageUsagePercent($storageUsed),
            'api_requests' => AuditLog::query()->whereDate('created_at', '>=', now()->startOfMonth()->toDateString())->count(),
            'revenue_today' => (clone $paidBilling)->whereDate('paid_at', now()->toDateString())->sum('amount'),
            'revenue_this_week' => (clone $paidBilling)->whereBetween('paid_at', [now()->startOfWeek(), now()->endOfWeek()])->sum('amount'),
            'revenue_this_month' => (clone $paidBilling)->whereBetween('paid_at', [now()->startOfMonth(), now()->endOfMonth()])->sum('amount'),
            'outstanding_invoices' => (clone $outstandingInvoices)->count(),
            'outstanding_invoice_amount' => (clone $outstandingInvoices)->sum('amount'),
            'renewals_due_30_days' => CompanySubscription::query()->whereIn('status', ['trial', 'active', 'past_due'])->whereBetween('renewal_at', [now(), now()->addDays(30)])->count(),
            'expansion_revenue' => PlatformBillingRecord::query()->where('status', 'paid')->whereIn('record_type', ['renewal', 'credit'])->whereBetween('paid_at', [now()->startOfMonth(), now()->endOfMonth()])->sum('amount'),
            'deployments_running' => PlatformDeployment::query()->whereIn('status', ['running', 'deploying'])->count(),
            'platform_uptime' => data_get($monitoring, 'uptime_percent'),
            'average_response_time_ms' => data_get($monitoring, 'average_response_time_ms'),
            'monitoring_status' => data_get($monitoring, 'status'),
            'monitoring_last_checked_at' => data_get($monitoring, 'last_checked_at'),
            'ai_enabled' => (bool) data_get($aiSettings, 'enabled', false),
            'ai_usage_percent' => data_get($aiSettings, 'usage_percent'),
            'ai_monthly_token_limit' => data_get($aiSettings, 'monthly_token_limit'),
            'ai_monthly_budget' => data_get($aiSettings, 'monthly_budget'),
            'ai_cost_month_to_date' => data_get($aiSettings, 'cost_month_to_date'),
            'support_tickets_open' => PlatformSupportTicket::query()->whereNotIn('status', ['closed', 'resolved'])->count(),
            'support_sla_compliance' => $supportTotal > 0 ? round(($supportCompliant / $supportTotal) * 100, 2) : null,
            'failed_background_jobs' => $this->tableCount('failed_jobs'),
            'security_alerts' => PlatformSecurityEvent::query()->whereIn('status', ['open', 'investigating'])->count(),
        ];
    }

    private function analytics(Collection $companies, Collection $featureFlags): array
    {
        return [
            'monthly_revenue' => PlatformBillingRecord::query()
                ->where('status', 'paid')
                ->whereNotNull('paid_at')
                ->get()
                ->groupBy(fn (PlatformBillingRecord $record): string => $record->paid_at?->format('Y-m') ?? 'unknown')
                ->map(fn (Collection $items, string $month): array => ['month' => $month, 'revenue' => (float) $items->sum('amount')])
                ->values(),
            'company_growth' => Company::query()
                ->get()
                ->groupBy(fn (Company $company): string => $company->created_at?->format('Y-m') ?? 'unknown')
                ->map(fn (Collection $items, string $month): array => ['month' => $month, 'companies' => $items->count()])
                ->values(),
            'companies_by_country' => $companies->groupBy('country')->map(fn (Collection $items, string $country): array => ['country' => $country ?: 'Unknown', 'companies' => $items->count()])->values(),
            'subscription_types' => CompanySubscription::query()->with('plan')->get()->groupBy(fn (CompanySubscription $subscription): string => $subscription->plan?->name ?? 'Unassigned')->map(fn (Collection $items, string $plan): array => ['plan' => $plan, 'companies' => $items->count()])->values(),
            'module_adoption' => $featureFlags->where('category', 'module')->map(fn (PlatformFeatureFlag $flag): array => ['module' => $flag->name, 'companies' => $flag->enabled_companies_count])->values(),
            'feature_usage' => $featureFlags->where('category', 'feature')->take(18)->map(fn (PlatformFeatureFlag $flag): array => ['feature' => $flag->name, 'companies' => $flag->enabled_companies_count])->values(),
            'top_companies_by_usage' => $companies->sortByDesc(fn (array $company): float => (float) data_get($company, 'usage.score', 0))->take(10)->values(),
            'customer_health' => $companies->map(fn (array $company): array => ['company' => $company['name'], 'score' => data_get($company, 'health_score')])->values(),
        ];
    }

    private function monitoring(): array
    {
        return [
            ...$this->platformMonitoringSnapshot(),
            'latest_deployment' => PlatformDeployment::query()->latest()->first(),
            'latest_backup' => PlatformBackup::query()->latest()->first(),
        ];
    }

    private function commandCenter(array $summary, Collection $companies, Collection $subscriptions, Collection $billing, Collection $tickets, Collection $deployments, Collection $securityEvents, Collection $backups): array
    {
        $monitoringStatus = $summary['monitoring_status'] ?? null;
        $healthStatus = in_array($monitoringStatus, ['degraded', 'critical'], true) || ($summary['failed_background_jobs'] ?? 0) > 0 || ($summary['security_alerts'] ?? 0) > 0
            ? 'attention'
            : 'healthy';
        $healthSub = $summary['platform_uptime'] === null
            ? 'Monitoring unavailable'
            : $summary['platform_uptime'].'% checks passing | DB '.($summary['average_response_time_ms'] ?? 'N/A').' ms';

        $renewalsDue = $subscriptions
            ->filter(fn (CompanySubscription $subscription): bool => $subscription->renewal_at && $subscription->renewal_at->between(now(), now()->addDays(14)))
            ->values();
        $urgentTickets = $tickets->whereIn('priority', ['urgent', 'critical'])->whereNotIn('status', ['resolved', 'closed'])->values();
        $overdueInvoices = $billing
            ->where('record_type', 'invoice')
            ->whereNotIn('status', ['paid', 'void'])
            ->filter(fn (PlatformBillingRecord $record): bool => $record->due_on && $record->due_on->isPast())
            ->values();

        $alerts = collect([
            $summary['failed_background_jobs'] > 0 ? ['type' => 'jobs', 'severity' => 'critical', 'title' => 'Failed background jobs', 'count' => $summary['failed_background_jobs']] : null,
            $summary['security_alerts'] > 0 ? ['type' => 'security', 'severity' => 'critical', 'title' => 'Open security events', 'count' => $summary['security_alerts']] : null,
            $urgentTickets->isNotEmpty() ? ['type' => 'support', 'severity' => 'high', 'title' => 'Urgent support tickets', 'count' => $urgentTickets->count()] : null,
            $overdueInvoices->isNotEmpty() ? ['type' => 'billing', 'severity' => 'high', 'title' => 'Overdue platform invoices', 'count' => $overdueInvoices->count()] : null,
            $renewalsDue->isNotEmpty() ? ['type' => 'subscription', 'severity' => 'medium', 'title' => 'Renewals due within 14 days', 'count' => $renewalsDue->count()] : null,
            $deployments->whereIn('status', ['running', 'deploying'])->isNotEmpty() ? ['type' => 'deployment', 'severity' => 'medium', 'title' => 'Deployments running', 'count' => $deployments->whereIn('status', ['running', 'deploying'])->count()] : null,
        ])->filter()->values();

        return [
            'status' => $healthStatus,
            'status_label' => $healthStatus === 'healthy' ? 'Healthy' : 'Needs attention',
            'cards' => [
                ['key' => 'platform_health', 'label' => 'Platform Health', 'value' => $healthStatus === 'healthy' ? 'Healthy' : 'Attention', 'sub' => $healthSub, 'tone' => $healthStatus === 'healthy' ? 'good' : 'warn'],
                ['key' => 'live_users', 'label' => 'Live Users', 'value' => $summary['active_users_today'] ?? 0, 'sub' => 'Users active today', 'tone' => 'neutral'],
                ['key' => 'companies_online', 'label' => 'Companies Online', 'value' => $summary['companies_online_today'] ?? 0, 'sub' => 'Tenants with user activity today', 'tone' => 'neutral'],
                ['key' => 'revenue_today', 'label' => 'Revenue Today', 'value' => round((float) ($summary['revenue_today'] ?? 0), 2), 'format' => 'money', 'sub' => 'Paid platform billing today', 'tone' => 'good'],
                ['key' => 'pending_support', 'label' => 'Pending Support', 'value' => $summary['support_tickets_open'] ?? 0, 'sub' => (($summary['support_sla_compliance'] ?? null) === null ? 'No SLA history yet' : $summary['support_sla_compliance'].'% SLA'), 'tone' => ($summary['support_tickets_open'] ?? 0) > 0 ? 'warn' : 'good'],
                ['key' => 'deployments_running', 'label' => 'Deployments Running', 'value' => $summary['deployments_running'] ?? 0, 'sub' => 'Live release activity', 'tone' => ($summary['deployments_running'] ?? 0) > 0 ? 'warn' : 'neutral'],
                ['key' => 'security_threats', 'label' => 'Security Threats', 'value' => $summary['security_alerts'] ?? 0, 'sub' => 'Open or investigating events', 'tone' => ($summary['security_alerts'] ?? 0) > 0 ? 'bad' : 'good'],
                ['key' => 'failed_jobs', 'label' => 'Failed Jobs', 'value' => $summary['failed_background_jobs'] ?? 0, 'sub' => 'Queue failures', 'tone' => ($summary['failed_background_jobs'] ?? 0) > 0 ? 'bad' : 'good'],
                ['key' => 'storage', 'label' => 'Storage', 'value' => ($summary['storage_usage_percent'] ?? null) === null ? 'Not capped' : $summary['storage_usage_percent'].'%', 'sub' => ($summary['storage_used_mb'] ?? 0).' MB used', 'tone' => ($summary['storage_usage_percent'] ?? 0) > 85 ? 'warn' : 'neutral'],
                ['key' => 'ai_usage', 'label' => 'AI Usage', 'value' => ($summary['ai_enabled'] ?? false) ? (($summary['ai_usage_percent'] ?? null) === null ? 'No usage' : $summary['ai_usage_percent'].'%') : 'Disabled', 'sub' => ($summary['ai_monthly_budget'] ?? null) === null ? 'Platform AI settings' : 'Monthly budget '.$summary['ai_monthly_budget'], 'tone' => 'neutral'],
            ],
            'alerts' => $alerts,
            'recent_signups' => $companies->sortByDesc('created_at')->take(6)->values(),
            'companies_needing_attention' => $companies
                ->filter(fn (array $company): bool => (int) ($company['health_score'] ?? 100) < 70 || in_array($company['status'] ?? '', ['past_due', 'suspended', 'inactive'], true))
                ->sortBy('health_score')
                ->take(8)
                ->values(),
            'latest_deployment' => $deployments->first(),
            'latest_backup' => $backups->first(),
        ];
    }

    private function searchResults(Request $request): array
    {
        $query = trim((string) $request->query('q', ''));

        if ($query === '') {
            return [];
        }

        $like = '%'.$query.'%';
        $results = collect();

        Company::query()
            ->where(fn ($builder) => $builder
                ->where('name', 'like', $like)
                ->orWhere('tenant_key', 'like', $like)
                ->orWhere('email', 'like', $like)
                ->orWhere('registration_number', 'like', $like))
            ->latest()
            ->limit(8)
            ->get()
            ->each(fn (Company $company) => $results->push(['type' => 'company', 'label' => $company->name, 'detail' => $company->tenant_key, 'company_id' => $company->id]));

        User::query()
            ->with('company:id,name')
            ->where(fn ($builder) => $builder->where('name', 'like', $like)->orWhere('email', 'like', $like))
            ->latest()
            ->limit(8)
            ->get()
            ->each(fn (User $user) => $results->push(['type' => 'user', 'label' => $user->name, 'detail' => $user->email, 'company_id' => $user->company_id, 'company' => $user->company?->name]));

        PlatformSupportTicket::query()
            ->with('company:id,name')
            ->where(fn ($builder) => $builder->where('ticket_number', 'like', $like)->orWhere('title', 'like', $like))
            ->latest()
            ->limit(8)
            ->get()
            ->each(fn (PlatformSupportTicket $ticket) => $results->push(['type' => 'support', 'label' => $ticket->ticket_number, 'detail' => $ticket->title, 'company_id' => $ticket->company_id, 'company' => $ticket->company?->name]));

        PlatformBillingRecord::query()
            ->with('company:id,name')
            ->where(fn ($builder) => $builder->where('record_number', 'like', $like)->orWhere('record_type', 'like', $like))
            ->latest()
            ->limit(8)
            ->get()
            ->each(fn (PlatformBillingRecord $record) => $results->push(['type' => 'billing', 'label' => $record->record_number, 'detail' => $record->record_type.' '.$record->status, 'company_id' => $record->company_id, 'company' => $record->company?->name]));

        Project::query()
            ->with('company:id,name')
            ->where(fn ($builder) => $builder->where('code', 'like', $like)->orWhere('name', 'like', $like))
            ->latest()
            ->limit(8)
            ->get()
            ->each(fn (Project $project) => $results->push(['type' => 'project', 'label' => $project->code, 'detail' => $project->name, 'company_id' => $project->company_id, 'company' => $project->company?->name]));

        Invoice::query()
            ->with('company:id,name')
            ->where(fn ($builder) => $builder->where('invoice_number', 'like', $like)->orWhere('title', 'like', $like))
            ->latest()
            ->limit(8)
            ->get()
            ->each(fn (Invoice $invoice) => $results->push(['type' => 'invoice', 'label' => $invoice->invoice_number, 'detail' => $invoice->title, 'company_id' => $invoice->company_id, 'company' => $invoice->company?->name]));

        return $results->take(30)->values()->all();
    }

    private function platformStorageUsagePercent(int $storageUsedBytes): ?float
    {
        $limitMb = Company::query()->sum('storage_limit_mb');

        if (! $limitMb) {
            return null;
        }

        return round(($storageUsedBytes / max(1, $limitMb * 1048576)) * 100, 2);
    }

    private function automationWorkflows(Collection $rules, Collection $runs): array
    {
        return [
            'summary' => [
                'active_rules' => $rules->where('is_active', true)->count(),
                'running_runs' => $runs->whereIn('status', ['queued', 'running'])->count(),
                'failed_runs' => $runs->where('status', 'failed')->count(),
                'completed_today' => AutomationRun::query()->where('status', 'completed')->whereDate('started_at', now()->toDateString())->count(),
                'average_duration_ms' => round((float) $runs->avg('duration_ms'), 1),
            ],
            'rules' => $rules->map(fn (AutomationRule $rule): array => [
                'id' => $rule->id,
                'company' => $rule->company?->only(['id', 'name']),
                'name' => $rule->name,
                'module' => $rule->module,
                'status' => $rule->status,
                'is_active' => $rule->is_active,
                'trigger_event' => $rule->trigger_event,
                'execution_mode' => $rule->execution_mode,
                'runs_count' => $rule->runs_count,
                'last_run_at' => $rule->last_run_at?->toISOString(),
                'nodes' => collect(data_get($rule->workflow_definition, 'nodes', []))
                    ->map(fn (array $node): array => [
                        'id' => $node['id'] ?? null,
                        'type' => $node['type'] ?? null,
                        'label' => $node['label'] ?? Str::headline($node['type'] ?? 'step'),
                    ])
                    ->values()
                    ->all(),
            ])->values(),
            'recent_runs' => $runs->take(30)->map(fn (AutomationRun $run): array => [
                'id' => $run->id,
                'run_number' => $run->run_number,
                'company' => $run->company?->only(['id', 'name']),
                'rule' => $run->rule?->only(['id', 'name', 'module']),
                'status' => $run->status,
                'trigger_event' => $run->trigger_event,
                'actions_executed' => $run->actions_executed,
                'duration_ms' => $run->duration_ms,
                'started_at' => $run->started_at?->toISOString(),
                'finished_at' => $run->finished_at?->toISOString(),
            ])->values(),
        ];
    }

    private function supportMetrics(Collection $tickets): array
    {
        $closedTickets = $tickets->filter(fn (PlatformSupportTicket $ticket): bool => filled($ticket->closed_at));
        $supportSettings = PlatformSetting::query()->where('setting_key', 'support')->first()?->setting_value ?? [];

        return [
            'open_tickets' => $tickets->whereNotIn('status', ['resolved', 'closed'])->count(),
            'escalated_tickets' => $tickets->whereIn('priority', ['urgent', 'critical'])->whereNotIn('status', ['resolved', 'closed'])->count(),
            'awaiting_customer' => $tickets->where('status', 'waiting_customer')->count(),
            'resolved_today' => $tickets->filter(fn (PlatformSupportTicket $ticket): bool => in_array($ticket->status, ['resolved', 'closed'], true) && $ticket->updated_at?->isToday())->count(),
            'average_resolution_hours' => $closedTickets->isEmpty()
                ? null
                : round((float) $closedTickets->avg(fn (PlatformSupportTicket $ticket): float => $ticket->created_at && $ticket->closed_at ? $ticket->created_at->diffInMinutes($ticket->closed_at) / 60 : 0), 1),
            'customer_satisfaction_score' => data_get($supportSettings, 'customer_satisfaction_score'),
            'customer_satisfaction_source' => data_get($supportSettings, 'customer_satisfaction_source'),
        ];
    }

    private function redisHealth(): array
    {
        $redisRequired = in_array(config('cache.default'), ['redis'], true)
            || in_array(config('queue.default'), ['redis'], true)
            || in_array(config('session.driver'), ['redis'], true);

        if (! $redisRequired) {
            return ['label' => 'Redis', 'status' => 'neutral', 'value' => 'Not used by current config'];
        }

        try {
            $pong = Redis::connection()->ping();

            return ['label' => 'Redis', 'status' => 'healthy', 'value' => is_string($pong) ? $pong : 'Connected'];
        } catch (Throwable $exception) {
            return ['label' => 'Redis', 'status' => 'critical', 'value' => 'Connection failed'];
        }
    }

    private function cacheHealth(array $redisHealth): array
    {
        $store = (string) config('cache.default');

        if ($store === 'database') {
            return [
                'label' => 'Cache',
                'status' => Schema::hasTable('cache') ? 'healthy' : 'warning',
                'value' => Schema::hasTable('cache') ? 'Database cache table ready' : 'Cache table missing',
            ];
        }

        if ($store === 'file') {
            $path = storage_path('framework/cache');

            return [
                'label' => 'Cache',
                'status' => is_dir($path) && is_writable($path) ? 'healthy' : 'warning',
                'value' => is_dir($path) && is_writable($path) ? 'File cache writable' : 'File cache not writable',
            ];
        }

        if ($store === 'redis') {
            return ['label' => 'Cache', 'status' => $redisHealth['status'], 'value' => 'Redis cache '.$redisHealth['value']];
        }

        return ['label' => 'Cache', 'status' => 'neutral', 'value' => Str::headline($store ?: 'not configured')];
    }

    private function sslHealth(): array
    {
        $url = (string) config('app.url');
        $host = parse_url($url, PHP_URL_HOST);
        $isLocalHttp = app()->environment(['local', 'testing'])
            && Str::startsWith($url, 'http://')
            && in_array($host, ['localhost', '127.0.0.1', '::1'], true);

        if ($isLocalHttp) {
            return ['label' => 'SSL', 'status' => 'neutral', 'value' => 'Local HTTP preview'];
        }

        return Str::startsWith($url, 'https://')
            ? ['label' => 'SSL', 'status' => 'healthy', 'value' => 'HTTPS configured']
            : ['label' => 'SSL', 'status' => 'warning', 'value' => 'HTTPS not configured'];
    }

    private function backupHealth(): array
    {
        $latestBackup = PlatformBackup::query()->latest()->first();

        if (! $latestBackup) {
            return ['label' => 'Backups', 'status' => 'warning', 'value' => 'No backups recorded'];
        }

        return [
            'label' => 'Backups',
            'status' => in_array($latestBackup->status, ['completed', 'verified'], true) ? 'healthy' : ($latestBackup->status === 'failed' ? 'critical' : 'warning'),
            'value' => Str::headline($latestBackup->status).' '.$latestBackup->backup_number,
        ];
    }

    private function apiHealth(?float $databaseResponseMs): array
    {
        return [
            'label' => 'API',
            'status' => $databaseResponseMs === null ? 'warning' : 'healthy',
            'value' => $databaseResponseMs === null ? 'Database check unavailable' : 'API reachable, DB '.$databaseResponseMs.' ms',
        ];
    }

    private function platformMonitoringSnapshot(?int $storageUsedBytes = null): array
    {
        $storageUsedBytes ??= (int) Document::query()->sum('size_bytes')
            + (int) DrawingRevision::query()->sum('size_bytes')
            + (int) TenderDocument::query()->sum('size_bytes');
        $settings = $this->monitoringSettings();
        $startedAt = hrtime(true);
        $databaseStatus = 'online';
        $databaseResponseMs = null;

        try {
            DB::select('select 1');
            $databaseResponseMs = round((hrtime(true) - $startedAt) / 1000000, 2);
        } catch (Throwable) {
            $databaseStatus = 'offline';
        }

        $jobsPending = $this->tableCount('jobs');
        $failedJobs = $this->tableCount('failed_jobs');
        $activeConnectors = IntegrationConnector::query()->whereIn('status', ['configured', 'connected', 'active'])->count();
        $connectorIssues = IntegrationConnector::query()->whereNotIn('status', ['configured', 'connected', 'active'])->count();
        $openSecurityEvents = PlatformSecurityEvent::query()->whereIn('status', ['open', 'investigating'])->count();
        $storageUsagePercent = $this->platformStorageUsagePercent($storageUsedBytes);
        $redisHealth = $this->redisHealth();
        $cacheHealth = $this->cacheHealth($redisHealth);
        $sslHealth = $this->sslHealth();
        $backupHealth = $this->backupHealth();
        $apiHealth = $this->apiHealth($databaseResponseMs);
        $scheduledAutomationRules = AutomationRule::query()
            ->whereNotIn('status', ['archived', 'inactive'])
            ->where(fn ($query) => $query
                ->where('schedule_config->frequency', '!=', 'manual')
                ->orWhere('trigger_event', 'schedule_due'))
            ->count();
        $loadAverage = function_exists('sys_getloadavg') ? sys_getloadavg() : null;
        $serverCount = data_get($settings, 'server_count');
        $serversOnline = data_get($settings, 'servers_online');
        $appVersion = config('app.version');

        $checks = [
            'api' => $apiHealth,
            'database' => [
                'label' => 'Database',
                'status' => $databaseStatus === 'offline'
                    ? 'critical'
                    : ($databaseResponseMs !== null && $databaseResponseMs >= $settings['database_critical_ms'] ? 'critical' : ($databaseResponseMs !== null && $databaseResponseMs >= $settings['database_warning_ms'] ? 'warning' : 'healthy')),
                'value' => $databaseStatus === 'online' ? $databaseResponseMs.' ms' : 'Offline',
            ],
            'queue' => [
                'label' => 'Queue',
                'status' => $failedJobs >= $settings['failed_jobs_critical'] ? 'critical' : ($jobsPending >= $settings['queue_pending_warning'] ? 'warning' : 'healthy'),
                'value' => "{$jobsPending} pending, {$failedJobs} failed",
            ],
            'background_jobs' => [
                'label' => 'Background Jobs',
                'status' => $failedJobs >= $settings['failed_jobs_critical'] ? 'critical' : 'healthy',
                'value' => "{$failedJobs} failed",
            ],
            'redis' => $redisHealth,
            'cache' => $cacheHealth,
            'storage' => [
                'label' => 'Storage',
                'status' => $storageUsagePercent === null
                    ? 'healthy'
                    : ($storageUsagePercent >= $settings['storage_critical_percent'] ? 'critical' : ($storageUsagePercent >= $settings['storage_warning_percent'] ? 'warning' : 'healthy')),
                'value' => $storageUsagePercent === null ? 'No platform cap' : $storageUsagePercent.'%',
            ],
            'security' => [
                'label' => 'Security',
                'status' => $openSecurityEvents >= $settings['security_alert_critical'] ? 'critical' : 'healthy',
                'value' => "{$openSecurityEvents} open event".($openSecurityEvents === 1 ? '' : 's'),
            ],
            'email' => [
                'label' => 'Email',
                'status' => config('mail.default') ? 'healthy' : 'warning',
                'value' => config('mail.default') ?: 'No mailer',
            ],
            'scheduler' => [
                'label' => 'Scheduler',
                'status' => $scheduledAutomationRules > 0 ? 'healthy' : 'neutral',
                'value' => "{$scheduledAutomationRules} scheduled automation rule".($scheduledAutomationRules === 1 ? '' : 's'),
            ],
            'backups' => $backupHealth,
            'ssl' => $sslHealth,
            'integrations' => [
                'label' => 'Integrations',
                'status' => $connectorIssues > 0 ? 'warning' : 'healthy',
                'value' => "{$activeConnectors} active, {$connectorIssues} needing attention",
            ],
        ];

        $criticalChecks = collect($checks)->where('status', 'critical')->count();
        $warningChecks = collect($checks)->where('status', 'warning')->count();
        $checkCount = max(1, count($checks));
        $healthScore = round(max(0, (($checkCount - $criticalChecks - ($warningChecks * 0.5)) / $checkCount) * 100), 2);

        return [
            'configured' => true,
            'status' => $criticalChecks > 0 ? 'critical' : ($warningChecks > 0 ? 'degraded' : 'operational'),
            'status_label' => $criticalChecks > 0 ? 'Critical' : ($warningChecks > 0 ? 'Degraded' : 'Operational'),
            'uptime_percent' => $healthScore,
            'average_response_time_ms' => $databaseResponseMs,
            'database_status' => $databaseStatus,
            'database_response_time_ms' => $databaseResponseMs,
            'queue_connection' => config('queue.default'),
            'queue_worker_status' => config('queue.default') === 'sync' ? 'Sync driver' : 'External workers not monitored',
            'jobs_pending' => $jobsPending,
            'failed_jobs' => $failedJobs,
            'storage_used_mb' => round($storageUsedBytes / 1048576, 2),
            'storage_usage_percent' => $storageUsagePercent,
            'active_connectors' => $activeConnectors,
            'connector_issues' => $connectorIssues,
            'open_security_events' => $openSecurityEvents,
            'mail_driver' => config('mail.default'),
            'cache_store' => config('cache.default'),
            'session_driver' => config('session.driver'),
            'app_version' => $appVersion ?: null,
            'environment' => config('app.env'),
            'php_version' => PHP_VERSION,
            'server_load_1m' => $loadAverage[0] ?? null,
            'server_load_5m' => $loadAverage[1] ?? null,
            'php_memory_usage_mb' => round(memory_get_usage(true) / 1048576, 2),
            'php_memory_peak_mb' => round(memory_get_peak_usage(true) / 1048576, 2),
            'servers_online' => $serversOnline,
            'server_count' => $serverCount,
            'servers_online_label' => $serverCount ? (($serversOnline ?? 0).' / '.$serverCount) : null,
            'scheduled_automation_rules' => $scheduledAutomationRules,
            'notification_events_pending' => NotificationEvent::query()->where('status', 'unread')->count(),
            'sms_events' => NotificationEvent::query()->whereJsonContains('channels', 'sms')->count(),
            'last_checked_at' => now()->toISOString(),
            'checks' => $checks,
            'thresholds' => $settings,
        ];
    }

    private function monitoringSettings(): array
    {
        $stored = PlatformSetting::query()->where('setting_key', 'monitoring')->first()?->setting_value ?? [];
        $cleanStored = collect($stored)
            ->reject(fn ($value): bool => $value === null || $value === '')
            ->all();

        $settings = array_replace($this->defaultMonitoringSettings(), $cleanStored);

        foreach (['database_warning_ms', 'database_critical_ms', 'queue_pending_warning', 'failed_jobs_critical', 'storage_warning_percent', 'storage_critical_percent', 'security_alert_critical'] as $key) {
            $settings[$key] = (float) $settings[$key];
        }
        foreach (['server_count', 'servers_online'] as $key) {
            $settings[$key] = $settings[$key] === null || $settings[$key] === ''
                ? null
                : max(0, (int) $settings[$key]);
        }
        $settings['enabled'] = (bool) $settings['enabled'];

        return $settings;
    }

    private function defaultMonitoringSettings(): array
    {
        return [
            'enabled' => true,
            'database_warning_ms' => 250,
            'database_critical_ms' => 1000,
            'queue_pending_warning' => 50,
            'failed_jobs_critical' => 1,
            'storage_warning_percent' => 85,
            'storage_critical_percent' => 95,
            'security_alert_critical' => 1,
            'server_count' => null,
            'servers_online' => null,
        ];
    }

    private function tableCount(string $table): int
    {
        if (! Schema::hasTable($table)) {
            return 0;
        }

        return DB::table($table)->count();
    }

    private function africanCountryCodes(): array
    {
        return [
            'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER',
            'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ',
            'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW',
            'EH',
        ];
    }

    private function africanCurrencyCodes(): array
    {
        return [
            'DZD', 'AOA', 'XOF', 'BWP', 'BIF', 'CVE', 'XAF', 'KMF', 'CDF', 'DJF', 'EGP', 'ERN', 'SZL', 'ETB', 'GMD',
            'GHS', 'GNF', 'KES', 'LSL', 'LRD', 'LYD', 'MGA', 'MWK', 'MRU', 'MUR', 'MAD', 'MZN', 'NAD', 'NGN', 'RWF',
            'STN', 'SCR', 'SLE', 'SOS', 'ZAR', 'SSP', 'SDG', 'TZS', 'TND', 'UGX', 'ZMW', 'ZWL', 'USD',
        ];
    }

    private function platformStaff(Request $request): array
    {
        return User::query()
            ->with(['branch:id,name,code', 'role:id,name,slug,permissions'])
            ->where('company_id', $this->platformCompany($request)->id)
            ->orderBy('name')
            ->get()
            ->filter(fn (User $user): bool => $this->isPlatformUser($user))
            ->map(fn (User $user): array => $this->staffPayload($user))
            ->values()
            ->all();
    }

    private function platformCompany(Request $request): Company
    {
        return $this->user($request)->company()->firstOrFail();
    }

    private function platformBranch(Company $company): Branch
    {
        return Branch::query()->firstOrCreate(
            ['company_id' => $company->id, 'code' => 'HQ'],
            ['name' => 'Head Office', 'country' => $company->country],
        );
    }

    private function ensurePlatformStaffRole(Company $company): Role
    {
        return Role::query()->updateOrCreate(
            ['company_id' => $company->id, 'slug' => 'platform-staff'],
            ['name' => 'Cloud Console Staff', 'permissions' => ['platform.manage'], 'is_system' => true],
        );
    }

    private function assertPlatformStaffUser(Request $request, User $user): void
    {
        abort_if((int) $user->company_id !== (int) $this->platformCompany($request)->id, 404);
        abort_if(! $this->isPlatformUser($user), 422, 'This is not a Cloud Console user.');
    }

    private function isPlatformUser(User $user): bool
    {
        $permissions = $user->accessPermissions();

        return in_array('platform.*', $permissions, true)
            || in_array('platform.manage', $permissions, true)
            || in_array($user->role?->slug, ['platform-super-admin', 'platform-staff'], true);
    }

    private function normalizePlatformPermissions(?array $permissions): array
    {
        $allowed = collect($this->platformPermissionCatalog())->pluck('key')->all();
        $selected = collect($permissions ?? ['platform.manage'])
            ->map(fn (string $permission): string => trim($permission))
            ->filter(fn (string $permission): bool => in_array($permission, $allowed, true))
            ->unique()
            ->values();

        if ($selected->isEmpty()) {
            $selected = collect(['platform.manage']);
        }

        return $selected->all();
    }

    private function activePlatformManagerCount(Request $request): int
    {
        return User::query()
            ->with('role:id,permissions,slug')
            ->where('company_id', $this->platformCompany($request)->id)
            ->where('status', 'active')
            ->get()
            ->filter(fn (User $user): bool => $this->isPlatformUser($user))
            ->count();
    }

    private function staffPayload(User $user): array
    {
        $user->loadMissing(['company.branches', 'branch', 'role']);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'job_title' => $user->job_title,
            'status' => $user->status,
            'company_id' => $user->company_id,
            'branch_id' => $user->branch_id,
            'role_id' => $user->role_id,
            'branch' => $user->branch,
            'role' => $user->role,
            'company' => $user->company,
            'permissions' => $user->permissions,
            'effective_permissions' => $user->accessPermissions(),
            'mfa_enabled' => filled($user->mfa_secret) && filled($user->mfa_enabled_at),
            'mfa_enabled_at' => $user->mfa_enabled_at?->toISOString(),
            'locked_until' => $user->locked_until?->toISOString(),
            'last_login_at' => $user->last_login_at?->toISOString(),
            'created_at' => $user->created_at?->toISOString(),
            'updated_at' => $user->updated_at?->toISOString(),
        ];
    }

    private function passwordRule(): Password
    {
        return Password::min(12)->letters()->mixedCase()->numbers();
    }

    private function revokeOtherTokens(Request $request, User $user): void
    {
        $currentToken = $request->user()?->currentAccessToken();
        $currentTokenId = $currentToken instanceof PersonalAccessToken ? $currentToken->id : null;
        $query = $user->tokens();

        if ($currentTokenId) {
            $query->where('id', '!=', $currentTokenId);
        }

        $query->delete();
    }

    private function companyPayload(Company $company): array
    {
        $subscription = $company->subscriptions->sortByDesc('created_at')->first();
        $usage = $this->companyUsage($company);
        $healthReasons = $this->healthReasons($company, $usage);

        return [
            ...$company->toArray(),
            'subscription' => $subscription,
            'branding_profile' => $company->brandingProfile,
            'enabled_features' => $company->featureFlags->filter(fn (CompanyFeatureFlag $flag): bool => $flag->is_enabled)->map(fn (CompanyFeatureFlag $flag): array => [
                'id' => $flag->id,
                'flag_id' => $flag->platform_feature_flag_id,
                'key' => $flag->flag?->key,
                'name' => $flag->flag?->name,
                'module' => $flag->flag?->module,
                'category' => $flag->flag?->category,
                'limit_value' => $flag->limit_value,
            ])->values(),
            'usage' => $usage,
            'health_score' => $this->healthScore($company, $usage),
            'health_reasons' => $healthReasons,
            'customer_success' => $this->customerSuccess($company, $usage, $subscription),
            'timeline' => $this->companyTimeline($company),
            'workspace' => $this->companyWorkspace($company),
        ];
    }

    private function companyUsage(Company $company): array
    {
        $storageBytes = (int) Document::query()->where('company_id', $company->id)->sum('size_bytes')
            + (int) DrawingRevision::query()->where('company_id', $company->id)->sum('size_bytes')
            + (int) TenderDocument::query()->where('company_id', $company->id)->sum('size_bytes');
        $projects = Project::query()->where('company_id', $company->id)->count();
        $users = User::query()->where('company_id', $company->id)->count();
        $employees = DB::table('employee_profiles')->where('company_id', $company->id)->count();

        return [
            'storage_mb' => round($storageBytes / 1048576, 2),
            'storage_limit_mb' => $company->storage_limit_mb,
            'projects' => $projects,
            'project_limit' => $company->project_limit,
            'employees' => $employees,
            'employee_limit' => $company->employee_limit,
            'users' => $users,
            'user_limit' => $company->employee_limit,
            'documents' => Document::query()->where('company_id', $company->id)->count(),
            'api_calls' => AuditLog::query()->where('company_id', $company->id)->count(),
            'automation_runs' => DB::table('automation_runs')->where('company_id', $company->id)->count(),
            'emails_sent' => DB::table('notification_events')->where('company_id', $company->id)->where('delivery_status->email', 'sent')->count(),
            'portal_users' => DB::table('portal_users')->where('company_id', $company->id)->count(),
            'backups' => PlatformBackup::query()->where('company_id', $company->id)->count(),
            'last_login_at' => User::query()->where('company_id', $company->id)->max('last_login_at'),
            'score' => $projects + $users + (int) round($storageBytes / 1048576),
        ];
    }

    private function customerSuccess(Company $company, array $usage, ?CompanySubscription $subscription): array
    {
        $stored = data_get($company->settings ?? [], 'customer_success', []);
        $moduleCount = PlatformFeatureFlag::query()->where('category', 'module')->count();
        $enabledModuleCount = CompanyFeatureFlag::query()
            ->where('company_id', $company->id)
            ->where('is_enabled', true)
            ->whereHas('flag', fn ($query) => $query->where('category', 'module'))
            ->count();
        $calculatedAdoption = $moduleCount > 0 ? (int) round(($enabledModuleCount / $moduleCount) * 100) : null;
        $health = $this->healthScore($company, $usage);

        return [
            'success_manager' => data_get($stored, 'success_manager'),
            'last_meeting_at' => data_get($stored, 'last_meeting_at'),
            'next_meeting_at' => data_get($stored, 'next_meeting_at'),
            'renewal_date' => $subscription?->renewal_at?->toISOString(),
            'training_completed_percent' => data_get($stored, 'training_completed_percent'),
            'adoption_percent' => data_get($stored, 'adoption_percent', $calculatedAdoption),
            'risk_percent' => data_get($stored, 'risk_percent', 100 - $health),
            'expansion_opportunity' => data_get($stored, 'expansion_opportunity', $this->expansionOpportunity($company, $usage)),
            'notes' => data_get($stored, 'notes'),
            'health_score' => $health,
            'health_status' => $health >= 80 ? 'healthy' : ($health >= 60 ? 'watch' : 'at_risk'),
        ];
    }

    private function expansionOpportunity(Company $company, array $usage): ?string
    {
        if ($company->project_limit && $usage['projects'] >= $company->project_limit * 0.8) {
            return 'Project limit upgrade';
        }

        if ($company->employee_limit && $usage['users'] >= $company->employee_limit * 0.8) {
            return 'Seat expansion';
        }

        if (! CompanyFeatureFlag::query()
            ->where('company_id', $company->id)
            ->where('is_enabled', true)
            ->whereHas('flag', fn ($query) => $query->where('key', 'platform.api_access'))
            ->exists()) {
            return 'API access add-on';
        }

        return null;
    }

    private function healthReasons(Company $company, array $usage): array
    {
        $reasons = [];
        $lastLogin = $usage['last_login_at'] ? Carbon::parse($usage['last_login_at']) : null;
        $openTickets = PlatformSupportTicket::query()->where('company_id', $company->id)->whereNotIn('status', ['closed', 'resolved'])->count();
        $overdueBilling = PlatformBillingRecord::query()
            ->where('company_id', $company->id)
            ->where('record_type', 'invoice')
            ->whereNotIn('status', ['paid', 'void'])
            ->whereDate('due_on', '<', now()->toDateString())
            ->count();

        if ($company->status !== 'active') {
            $reasons[] = ['tone' => 'bad', 'label' => 'Company status is '.Str::headline($company->status)];
        }

        if (! $lastLogin) {
            $reasons[] = ['tone' => 'warn', 'label' => 'No recorded user login'];
        } elseif ($lastLogin->lt(now()->subDays(28))) {
            $reasons[] = ['tone' => 'bad', 'label' => 'No login for '.$lastLogin->diffInDays(now()).' days'];
        } elseif ($lastLogin->gte(now()->subDays(7))) {
            $reasons[] = ['tone' => 'good', 'label' => 'High recent login activity'];
        }

        if ($openTickets > 0) {
            $reasons[] = ['tone' => 'warn', 'label' => "{$openTickets} unresolved support ticket".($openTickets === 1 ? '' : 's')];
        } else {
            $reasons[] = ['tone' => 'good', 'label' => 'No unresolved support tickets'];
        }

        if ($overdueBilling > 0) {
            $reasons[] = ['tone' => 'bad', 'label' => "{$overdueBilling} overdue platform invoice".($overdueBilling === 1 ? '' : 's')];
        }

        if ($company->storage_limit_mb && $usage['storage_mb'] >= $company->storage_limit_mb * 0.9) {
            $reasons[] = ['tone' => 'warn', 'label' => 'Storage limit above 90%'];
        }

        return $reasons;
    }

    private function companyTimeline(Company $company): array
    {
        $events = collect([
            ['occurred_at' => $company->created_at, 'type' => 'company', 'title' => 'Account created', 'detail' => $company->name],
            ['occurred_at' => $company->provisioned_at, 'type' => 'company', 'title' => 'Tenant provisioned', 'detail' => $company->tenant_key],
        ])->filter(fn (array $event): bool => filled($event['occurred_at']));

        CompanySubscription::query()
            ->with('plan:id,name')
            ->where('company_id', $company->id)
            ->latest()
            ->limit(8)
            ->get()
            ->each(fn (CompanySubscription $subscription) => $events->push([
                'occurred_at' => $subscription->created_at,
                'type' => 'subscription',
                'title' => 'Subscription '.$subscription->status,
                'detail' => $subscription->plan?->name.' '.$subscription->billing_interval,
            ]));

        CompanyFeatureFlag::query()
            ->with('flag:id,name,key')
            ->where('company_id', $company->id)
            ->whereNotNull('enabled_at')
            ->latest('enabled_at')
            ->limit(8)
            ->get()
            ->each(fn (CompanyFeatureFlag $flag) => $events->push([
                'occurred_at' => $flag->enabled_at,
                'type' => 'module',
                'title' => $flag->flag?->name.' enabled',
                'detail' => $flag->flag?->key,
            ]));

        PlatformBillingRecord::query()
            ->where('company_id', $company->id)
            ->latest()
            ->limit(8)
            ->get()
            ->each(fn (PlatformBillingRecord $record) => $events->push([
                'occurred_at' => $record->paid_at ?? $record->created_at,
                'type' => 'billing',
                'title' => Str::headline($record->record_type).' '.$record->status,
                'detail' => $record->record_number.' '.$record->currency.' '.$record->amount,
            ]));

        PlatformSupportTicket::query()
            ->where('company_id', $company->id)
            ->latest()
            ->limit(8)
            ->get()
            ->each(fn (PlatformSupportTicket $ticket) => $events->push([
                'occurred_at' => $ticket->created_at,
                'type' => 'support',
                'title' => 'Support ticket '.$ticket->status,
                'detail' => $ticket->ticket_number.' '.$ticket->title,
            ]));

        AuditLog::query()
            ->where('company_id', $company->id)
            ->latest('created_at')
            ->limit(8)
            ->get()
            ->each(fn (AuditLog $log) => $events->push([
                'occurred_at' => $log->created_at,
                'type' => 'audit',
                'title' => Str::headline($log->action),
                'detail' => class_basename($log->auditable_type),
            ]));

        return $events
            ->sortByDesc('occurred_at')
            ->take(20)
            ->map(fn (array $event): array => [
                ...$event,
                'occurred_at' => $event['occurred_at']?->toISOString(),
            ])
            ->values()
            ->all();
    }

    private function companyWorkspace(Company $company): array
    {
        return [
            'branches' => Branch::query()->where('company_id', $company->id)->orderBy('name')->limit(50)->get(),
            'users' => User::query()->with(['branch:id,name', 'role:id,name'])->where('company_id', $company->id)->latest()->limit(80)->get(),
            'projects' => Project::query()->where('company_id', $company->id)->latest()->limit(50)->get(),
            'invoices' => Invoice::query()->where('company_id', $company->id)->latest()->limit(50)->get(),
            'payments' => Payment::query()->with('invoice:id,invoice_number')->where('company_id', $company->id)->latest()->limit(50)->get(),
            'support_tickets' => PlatformSupportTicket::query()->where('company_id', $company->id)->latest()->limit(50)->get(),
            'billing_records' => PlatformBillingRecord::query()->where('company_id', $company->id)->latest()->limit(50)->get(),
            'backups' => PlatformBackup::query()->where('company_id', $company->id)->latest()->limit(50)->get(),
            'audit_logs' => AuditLog::query()->where('company_id', $company->id)->latest('created_at')->limit(50)->get(),
            'security_events' => PlatformSecurityEvent::query()->where('company_id', $company->id)->latest()->limit(50)->get(),
            'integrations' => IntegrationConnector::query()->where('company_id', $company->id)->latest()->limit(50)->get(),
            'domains' => [
                ['type' => 'tenant_login', 'value' => '/login?tenant='.$company->tenant_key, 'status' => $company->tenant_key ? 'active' : 'not_configured'],
                ['type' => 'website', 'value' => $company->website, 'status' => $company->website ? 'active' : 'not_configured'],
            ],
            'api' => [
                'access_enabled' => CompanyFeatureFlag::query()
                    ->where('company_id', $company->id)
                    ->where('is_enabled', true)
                    ->whereHas('flag', fn ($query) => $query->where('key', 'platform.api_access'))
                    ->exists(),
                'api_calls' => AuditLog::query()->where('company_id', $company->id)->count(),
            ],
        ];
    }

    private function backupSnapshot(PlatformBackup $backup, ?Company $company): array
    {
        $base = [
            'backup_number' => $backup->backup_number,
            'backup_type' => $backup->backup_type,
            'generated_at' => now()->toISOString(),
            'generated_by' => $backup->created_by,
            'app' => config('app.name'),
            'environment' => config('app.env'),
        ];

        if ($backup->backup_type === 'tenant' && $company) {
            return [
                ...$base,
                'scope' => 'tenant',
                'tenant_key' => $company->tenant_key,
                'record_counts' => [
                    'branches' => Branch::query()->where('company_id', $company->id)->count(),
                    'users' => User::query()->where('company_id', $company->id)->count(),
                    'roles' => Role::query()->where('company_id', $company->id)->count(),
                    'projects' => Project::query()->where('company_id', $company->id)->count(),
                    'invoices' => Invoice::query()->where('company_id', $company->id)->count(),
                    'payments' => Payment::query()->where('company_id', $company->id)->count(),
                    'documents' => Document::query()->where('company_id', $company->id)->count(),
                    'audit_logs' => AuditLog::query()->where('company_id', $company->id)->count(),
                    'support_tickets' => PlatformSupportTicket::query()->where('company_id', $company->id)->count(),
                    'billing_records' => PlatformBillingRecord::query()->where('company_id', $company->id)->count(),
                ],
                'company' => $this->companyPayload($company),
            ];
        }

        if ($backup->backup_type === 'documents') {
            return [
                ...$base,
                'scope' => 'documents',
                'record_counts' => [
                    'documents' => Document::query()->count(),
                    'drawing_revisions' => DrawingRevision::query()->count(),
                    'tender_documents' => TenderDocument::query()->count(),
                ],
                'documents' => Document::query()->select(['id', 'company_id', 'project_id', 'document_number', 'title', 'status', 'size_bytes', 'created_at'])->latest()->limit(1000)->get(),
                'drawing_revisions' => DrawingRevision::query()->select(['id', 'company_id', 'drawing_id', 'revision_code', 'status', 'size_bytes', 'created_at'])->latest()->limit(1000)->get(),
                'tender_documents' => TenderDocument::query()->select(['id', 'company_id', 'tender_id', 'document_number', 'title', 'status', 'size_bytes', 'created_at'])->latest()->limit(1000)->get(),
            ];
        }

        return [
            ...$base,
            'scope' => $backup->backup_type,
            'record_counts' => [
                'companies' => Company::withTrashed()->count(),
                'subscriptions' => CompanySubscription::withTrashed()->count(),
                'plans' => PlatformSubscriptionPlan::withTrashed()->count(),
                'feature_flags' => PlatformFeatureFlag::withTrashed()->count(),
                'company_feature_flags' => CompanyFeatureFlag::query()->count(),
                'billing_records' => PlatformBillingRecord::withTrashed()->count(),
                'support_tickets' => PlatformSupportTicket::withTrashed()->count(),
                'deployments' => PlatformDeployment::withTrashed()->count(),
                'security_events' => PlatformSecurityEvent::query()->count(),
                'audit_logs' => AuditLog::query()->count(),
            ],
            'settings' => PlatformSetting::query()->orderBy('setting_key')->get(),
            'plans' => PlatformSubscriptionPlan::withTrashed()->orderBy('monthly_price')->get(),
            'feature_flags' => PlatformFeatureFlag::withTrashed()->orderBy('module')->orderBy('name')->get(),
        ];
    }

    private function healthScore(Company $company, array $usage): int
    {
        $score = 100;
        $openTickets = PlatformSupportTicket::query()->where('company_id', $company->id)->whereNotIn('status', ['closed', 'resolved'])->count();
        $securityEvents = PlatformSecurityEvent::query()->where('company_id', $company->id)->whereIn('status', ['open', 'investigating'])->count();
        $storagePressure = $company->storage_limit_mb ? ($usage['storage_mb'] / max(1, $company->storage_limit_mb)) * 100 : 0;
        $projectPressure = $company->project_limit ? ($usage['projects'] / max(1, $company->project_limit)) * 100 : 0;

        if ($company->status !== 'active') {
            $score -= 15;
        }
        $score -= min(25, $openTickets * 5);
        $score -= min(25, $securityEvents * 10);
        $score -= $storagePressure > 90 ? 12 : 0;
        $score -= $projectPressure > 90 ? 8 : 0;

        return max(0, min(100, $score));
    }

    private function createSubscription(Company $company, ?PlatformSubscriptionPlan $plan, string $status, $trialEndsAt, Request $request): CompanySubscription
    {
        $amount = $plan?->monthly_price ?? 0;

        return CompanySubscription::query()->create([
            'company_id' => $company->id,
            'platform_subscription_plan_id' => $plan?->id,
            'subscription_number' => $this->nextScopedCompanyNumber('SUB', CompanySubscription::class, 'subscription_number', $company->id),
            'status' => $status,
            'billing_interval' => 'monthly',
            'amount' => $amount,
            'currency' => $plan?->currency ?? $company->default_currency,
            'seats' => $company->employee_limit,
            'started_at' => now(),
            'trial_ends_at' => $trialEndsAt,
            'current_period_starts_at' => now(),
            'current_period_ends_at' => now()->addMonth(),
            'renewal_at' => now()->addMonth(),
            'metadata' => ['provisioned_from' => 'platform_admin'],
            'created_by' => $this->user($request)->id,
            'updated_by' => $this->user($request)->id,
        ]);
    }

    private function syncCompanyFeatureFlags(Company $company, array $enabledKeys, int $userId): void
    {
        $enabled = collect($enabledKeys)->filter()->unique()->values();
        PlatformFeatureFlag::query()->get()->each(function (PlatformFeatureFlag $flag) use ($company, $enabled, $userId): void {
            $isEnabled = $enabled->contains($flag->key) || ($enabled->isEmpty() && $flag->default_enabled);
            CompanyFeatureFlag::query()->updateOrCreate(
                ['company_id' => $company->id, 'platform_feature_flag_id' => $flag->id],
                [
                    'is_enabled' => $isEnabled,
                    'enabled_at' => $isEnabled ? now() : null,
                    'disabled_at' => $isEnabled ? null : now(),
                    'updated_by' => $userId,
                ],
            );
        });
    }

    private function validateSubscriptionUpdate(Request $request): array
    {
        return $request->validate([
            'platform_subscription_plan_id' => ['nullable', 'integer', $this->activePlanExistsRule()],
            'status' => ['nullable', Rule::in(['trial', 'active', 'past_due', 'suspended', 'cancelled'])],
            'billing_interval' => ['nullable', Rule::in(['monthly', 'yearly', 'custom'])],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'seats' => ['nullable', 'integer', 'min:1'],
            'started_at' => ['nullable', 'date'],
            'trial_ends_at' => ['nullable', 'date'],
            'current_period_starts_at' => ['nullable', 'date'],
            'current_period_ends_at' => ['nullable', 'date'],
            'renewal_at' => ['nullable', 'date'],
        ]);
    }

    private function activePlanExistsRule()
    {
        return Rule::exists('platform_subscription_plans', 'id')
            ->where(fn ($query) => $query
                ->whereNull('deleted_at')
                ->where(fn ($inner) => $inner->whereNull('status')->orWhere('status', '!=', 'archived')));
    }

    private function companyStatusFromSubscription(?string $status): ?string
    {
        return match ($status) {
            'trial', 'active', 'past_due', 'suspended', 'cancelled' => $status,
            default => null,
        };
    }

    private function validatePlan(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'code' => [$partial ? 'sometimes' : 'nullable', 'nullable', 'string', 'max:80', Rule::unique('platform_subscription_plans', 'code')->ignore($request->route('plan'))],
            'name' => [$required, 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'archived'])],
            'currency' => ['nullable', 'string', 'size:3'],
            'monthly_price' => ['nullable', 'numeric', 'min:0'],
            'yearly_price' => ['nullable', 'numeric', 'min:0'],
            'maximum_users' => ['nullable', 'integer', 'min:1'],
            'maximum_projects' => ['nullable', 'integer', 'min:1'],
            'maximum_storage_mb' => ['nullable', 'integer', 'min:1'],
            'portal_users' => ['nullable', 'integer', 'min:0'],
            'automation_limit' => ['nullable', 'integer', 'min:0'],
            'ai_credits' => ['nullable', 'integer', 'min:0'],
            'support_level' => ['nullable', 'string', 'max:80'],
            'api_access' => ['nullable', 'boolean'],
            'custom_branding' => ['nullable', 'boolean'],
            'sso_available' => ['nullable', 'boolean'],
            'modules' => ['nullable', 'array'],
            'features' => ['nullable', 'array'],
            'settings' => ['nullable', 'array'],
        ]);
    }

    private function ensurePlatformCatalog(Request $request): void
    {
        foreach ($this->moduleCatalog() as $module) {
            PlatformFeatureFlag::query()->firstOrCreate(
                ['key' => $module['flag_key']],
                [
                    'name' => $module['label'],
                    'module' => $module['id'],
                    'category' => 'module',
                    'description' => 'Controls access to the '.$module['label'].' module.',
                    'default_enabled' => true,
                    'rollout_status' => 'active',
                    'rollout_percentage' => 100,
                    'created_by' => $this->user($request)->id,
                ],
            );
        }

        foreach ($this->featureCatalog() as $feature) {
            PlatformFeatureFlag::query()->firstOrCreate(
                ['key' => $feature['key']],
                [
                    'name' => $feature['name'],
                    'module' => $feature['module'],
                    'category' => 'feature',
                    'description' => $feature['description'],
                    'default_enabled' => $feature['default_enabled'],
                    'rollout_status' => 'active',
                    'rollout_percentage' => $feature['default_enabled'] ? 100 : 0,
                    'pricing_tier' => $feature['pricing_tier'] ?? null,
                    'created_by' => $this->user($request)->id,
                ],
            );
        }

        foreach ($this->planCatalog() as $plan) {
            PlatformSubscriptionPlan::query()->firstOrCreate(
                ['code' => $plan['code']],
                [...$plan, 'created_by' => $this->user($request)->id],
            );
        }

        $this->ensurePlatformMonitoring($request);
    }

    private function ensurePlatformMonitoring(Request $request): void
    {
        $setting = PlatformSetting::query()->firstOrNew(['setting_key' => 'monitoring']);
        $setting->setting_value = array_replace($this->defaultMonitoringSettings(), $setting->setting_value ?? []);
        $setting->updated_by ??= $this->user($request)->id;
        $setting->save();
    }

    private function consoleLayers(): array
    {
        return [
            [
                'id' => 'platform',
                'label' => 'Platform',
                'primary_tab' => 'executive',
                'items' => [
                    ['id' => 'executive', 'label' => 'Executive Dashboard'],
                    ['id' => 'operations-center', 'label' => 'Operations Center'],
                    ['id' => 'reports', 'label' => 'Reports'],
                ],
            ],
            [
                'id' => 'customers',
                'label' => 'Customers',
                'primary_tab' => 'companies',
                'items' => [
                    ['id' => 'companies', 'label' => 'Companies'],
                    ['id' => 'subscriptions', 'label' => 'Subscriptions'],
                    ['id' => 'customer-success', 'label' => 'Customer Success'],
                    ['id' => 'support', 'label' => 'Support'],
                    ['id' => 'billing', 'label' => 'Billing'],
                    ['id' => 'payments', 'label' => 'Payments'],
                ],
            ],
            [
                'id' => 'product',
                'label' => 'Product',
                'primary_tab' => 'features',
                'items' => [
                    ['id' => 'features', 'label' => 'Feature Management'],
                    ['id' => 'deployment', 'label' => 'Deployments'],
                    ['id' => 'marketplace', 'label' => 'Marketplace'],
                    ['id' => 'ai', 'label' => 'AI Services'],
                    ['id' => 'localization', 'label' => 'Localization'],
                ],
            ],
            [
                'id' => 'security',
                'label' => 'Security & Compliance',
                'primary_tab' => 'security',
                'items' => [
                    ['id' => 'security', 'label' => 'Security Center'],
                    ['id' => 'audit', 'label' => 'Audit Logs'],
                    ['id' => 'backups', 'label' => 'Backups'],
                    ['id' => 'data', 'label' => 'Data Management'],
                    ['id' => 'identity', 'label' => 'Identity & Access'],
                    ['id' => 'roles', 'label' => 'Roles'],
                    ['id' => 'users', 'label' => 'Cloud Console Users'],
                ],
            ],
            [
                'id' => 'engineering',
                'label' => 'Engineering',
                'primary_tab' => 'monitoring',
                'items' => [
                    ['id' => 'monitoring', 'label' => 'Platform Monitoring'],
                    ['id' => 'automation', 'label' => 'Automation'],
                    ['id' => 'integrations', 'label' => 'Integrations'],
                    ['id' => 'developer', 'label' => 'Developer Tools'],
                    ['id' => 'notifications', 'label' => 'Notification Center'],
                    ['id' => 'usage', 'label' => 'Usage'],
                    ['id' => 'licenses', 'label' => 'Licenses'],
                    ['id' => 'settings', 'label' => 'System Settings'],
                ],
            ],
        ];
    }

    private function platformPermissionCatalog(): array
    {
        return [
            ['key' => 'platform.manage', 'label' => 'Cloud Console Access', 'description' => 'Can sign in to Navkwa Build Cloud Console and operate platform administration tools.'],
            ['key' => 'platform.*', 'label' => 'Super Admin Access', 'description' => 'Full unrestricted Cloud Console authority for executive platform administrators.'],
        ];
    }

    private function moduleCatalog(): array
    {
        return [
            ['id' => 'projects', 'label' => 'Projects', 'flag_key' => 'module.projects'],
            ['id' => 'procurement', 'label' => 'Procurement', 'flag_key' => 'module.procurement'],
            ['id' => 'finance', 'label' => 'Finance', 'flag_key' => 'module.finance'],
            ['id' => 'hr', 'label' => 'HR & Workforce', 'flag_key' => 'module.hr'],
            ['id' => 'crm', 'label' => 'CRM', 'flag_key' => 'module.crm'],
            ['id' => 'tendering', 'label' => 'Tendering', 'flag_key' => 'module.tendering'],
            ['id' => 'estimating', 'label' => 'Estimating', 'flag_key' => 'module.estimating'],
            ['id' => 'inventory', 'label' => 'Inventory', 'flag_key' => 'module.inventory'],
            ['id' => 'field', 'label' => 'Site Management & Attendance', 'flag_key' => 'module.field'],
            ['id' => 'equipment', 'label' => 'Equipment', 'flag_key' => 'module.equipment'],
            ['id' => 'qa_hse', 'label' => 'QA/HSE', 'flag_key' => 'module.qa_hse'],
            ['id' => 'portals', 'label' => 'Portals', 'flag_key' => 'module.portals'],
            ['id' => 'documents', 'label' => 'Documents', 'flag_key' => 'module.documents'],
            ['id' => 'reports', 'label' => 'Reports', 'flag_key' => 'module.reports'],
            ['id' => 'bi', 'label' => 'Intelligence', 'flag_key' => 'module.bi'],
            ['id' => 'automation', 'label' => 'Automation', 'flag_key' => 'module.automation'],
        ];
    }

    private function featureCatalog(): array
    {
        return [
            ['key' => 'finance.invoices', 'name' => 'Invoices', 'module' => 'finance', 'description' => 'Customer invoices, payments, and receivables.', 'default_enabled' => true],
            ['key' => 'finance.payroll_integration', 'name' => 'Payroll Integration', 'module' => 'finance', 'description' => 'Post payroll costs into finance.', 'default_enabled' => true],
            ['key' => 'finance.retention', 'name' => 'Retention', 'module' => 'finance', 'description' => 'Contract retention tracking and release.', 'default_enabled' => true],
            ['key' => 'finance.multi_currency', 'name' => 'Multi Currency', 'module' => 'finance', 'description' => 'Multi-currency ledgers and exchange rates.', 'default_enabled' => false, 'pricing_tier' => 'business'],
            ['key' => 'finance.ai_forecasting', 'name' => 'AI Forecasting', 'module' => 'finance', 'description' => 'Predictive revenue, cost, and cash forecasting.', 'default_enabled' => false, 'pricing_tier' => 'enterprise'],
            ['key' => 'projects.gantt_chart', 'name' => 'Gantt Chart', 'module' => 'projects', 'description' => 'Visual schedule and dependencies.', 'default_enabled' => true],
            ['key' => 'projects.bim_integration', 'name' => 'BIM Integration', 'module' => 'projects', 'description' => 'BIM coordination and model links.', 'default_enabled' => false, 'pricing_tier' => 'enterprise'],
            ['key' => 'projects.client_portal', 'name' => 'Client Portal', 'module' => 'projects', 'description' => 'Client-facing project collaboration.', 'default_enabled' => true],
            ['key' => 'projects.ai_scheduling', 'name' => 'AI Scheduling', 'module' => 'projects', 'description' => 'AI delay prediction and schedule recovery suggestions.', 'default_enabled' => false, 'pricing_tier' => 'enterprise'],
            ['key' => 'automation.advanced_rules', 'name' => 'Advanced Automation Rules', 'module' => 'automation', 'description' => 'Multi-step conditional automations.', 'default_enabled' => true],
            ['key' => 'platform.custom_branding', 'name' => 'Custom Branding', 'module' => 'platform', 'description' => 'Tenant logos, colors, templates, and letterheads.', 'default_enabled' => true],
            ['key' => 'platform.sso', 'name' => 'Single Sign-On', 'module' => 'platform', 'description' => 'Enterprise SSO configuration.', 'default_enabled' => false, 'pricing_tier' => 'enterprise'],
            ['key' => 'platform.api_access', 'name' => 'API Access', 'module' => 'platform', 'description' => 'External API access and developer tools.', 'default_enabled' => false, 'pricing_tier' => 'business'],
        ];
    }

    private function planCatalog(): array
    {
        $allModules = collect($this->moduleCatalog())->pluck('flag_key')->all();
        $baseFeatures = ['finance.invoices', 'finance.payroll_integration', 'finance.retention', 'projects.gantt_chart', 'projects.client_portal', 'automation.advanced_rules', 'platform.custom_branding'];

        return [
            ['code' => 'starter', 'name' => 'Starter', 'status' => 'active', 'currency' => 'GHS', 'monthly_price' => 1200, 'yearly_price' => 12000, 'maximum_users' => 15, 'maximum_projects' => 5, 'maximum_storage_mb' => 10240, 'portal_users' => 10, 'automation_limit' => 200, 'ai_credits' => 0, 'support_level' => 'standard', 'api_access' => false, 'custom_branding' => false, 'sso_available' => false, 'modules' => ['module.projects', 'module.procurement', 'module.finance', 'module.documents', 'module.reports'], 'features' => $baseFeatures],
            ['code' => 'professional', 'name' => 'Professional', 'status' => 'active', 'currency' => 'GHS', 'monthly_price' => 3500, 'yearly_price' => 35000, 'maximum_users' => 50, 'maximum_projects' => 25, 'maximum_storage_mb' => 51200, 'portal_users' => 50, 'automation_limit' => 1000, 'ai_credits' => 500, 'support_level' => 'priority', 'api_access' => false, 'custom_branding' => true, 'sso_available' => false, 'modules' => array_values(array_diff($allModules, ['module.bi'])), 'features' => $baseFeatures],
            ['code' => 'business', 'name' => 'Business', 'status' => 'active', 'currency' => 'GHS', 'monthly_price' => 8500, 'yearly_price' => 85000, 'maximum_users' => 150, 'maximum_projects' => 100, 'maximum_storage_mb' => 204800, 'portal_users' => 250, 'automation_limit' => 5000, 'ai_credits' => 2500, 'support_level' => 'enterprise', 'api_access' => true, 'custom_branding' => true, 'sso_available' => false, 'modules' => $allModules, 'features' => [...$baseFeatures, 'finance.multi_currency', 'platform.api_access']],
            ['code' => 'enterprise', 'name' => 'Enterprise', 'status' => 'active', 'currency' => 'GHS', 'monthly_price' => 18000, 'yearly_price' => 180000, 'maximum_users' => null, 'maximum_projects' => null, 'maximum_storage_mb' => null, 'portal_users' => null, 'automation_limit' => null, 'ai_credits' => 10000, 'support_level' => 'dedicated', 'api_access' => true, 'custom_branding' => true, 'sso_available' => true, 'modules' => $allModules, 'features' => collect($this->featureCatalog())->pluck('key')->all()],
            ['code' => 'custom', 'name' => 'Custom', 'status' => 'active', 'currency' => 'GHS', 'monthly_price' => 0, 'yearly_price' => 0, 'maximum_users' => null, 'maximum_projects' => null, 'maximum_storage_mb' => null, 'portal_users' => null, 'automation_limit' => null, 'ai_credits' => null, 'support_level' => 'dedicated', 'api_access' => true, 'custom_branding' => true, 'sso_available' => true, 'modules' => $allModules, 'features' => collect($this->featureCatalog())->pluck('key')->all()],
        ];
    }

    private function tenantDefaultRoles(): array
    {
        return [
            ['name' => 'Project Director', 'slug' => 'project-director', 'permissions' => ['projects.manage', 'procurement.approve', 'documents.manage', 'field.manage', 'attendance.manage', 'equipment.manage', 'quality.manage', 'safety.manage', 'portals.manage', 'bi.manage', 'automation.manage', 'reports.view'], 'is_system' => true],
            ['name' => 'Finance Manager', 'slug' => 'finance-manager', 'permissions' => ['finance.manage', 'payroll.manage', 'reports.view', 'procurement.approve'], 'is_system' => true],
            ['name' => 'Business Development', 'slug' => 'business-development', 'permissions' => ['crm.manage', 'tenders.manage', 'estimating.manage', 'reports.view'], 'is_system' => true],
            ['name' => 'Procurement Manager', 'slug' => 'procurement-manager', 'permissions' => ['procurement.manage', 'inventory.manage', 'suppliers.manage', 'reports.view'], 'is_system' => true],
            ['name' => 'Site Engineer', 'slug' => 'site-engineer', 'permissions' => ['projects.manage', 'field.manage', 'attendance.manage', 'quality.manage', 'safety.manage', 'reports.view'], 'is_system' => true],
        ];
    }

    private function monthlySubscriptionAmount(CompanySubscription $subscription): float
    {
        $amount = (float) $subscription->amount;

        return $subscription->billing_interval === 'yearly' ? $amount / 12 : $amount;
    }

    private function sendWelcomeEmail(Company $company, User $admin, string $password): array
    {
        try {
            Mail::raw(
                implode("\n\n", [
                    "Welcome to Navkwa Build, {$admin->name}.",
                    "Your company workspace {$company->name} has been provisioned.",
                    'Login URL: '.rtrim((string) config('app.url'), '/').'/login?tenant='.$company->tenant_key,
                    "Temporary password: {$password}",
                    'Please change this password after your first login.',
                ]),
                fn ($mail) => $mail->to($admin->email, $admin->name)->subject('Your Navkwa Build workspace is ready'),
            );

            return ['status' => 'sent', 'sent_at' => now()->toISOString()];
        } catch (Throwable $exception) {
            report($exception);

            return ['status' => 'failed', 'error' => $exception->getMessage()];
        }
    }

    private function audit(Request $request, string $action, $model, ?array $before, array $after): void
    {
        AuditLog::query()->create([
            'company_id' => $model instanceof Company ? $model->id : ($model->company_id ?? null),
            'user_id' => $this->user($request)->id,
            'auditable_type' => is_object($model) ? $model::class : 'platform',
            'auditable_id' => is_object($model) ? (int) ($model->id ?? 0) : 0,
            'action' => $action,
            'before' => AuditLog::sanitizePayload($before),
            'after' => AuditLog::sanitizePayload($after),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);
    }

    private function uniqueTenantKey(string $name): string
    {
        $base = Str::slug($name) ?: 'tenant';
        $key = $base;
        $next = 2;

        while (Company::query()->where('tenant_key', $key)->exists()) {
            $key = "{$base}-{$next}";
            $next++;
        }

        return $key;
    }

    private function temporaryPassword(): string
    {
        return 'NavkwaBuild'.now()->format('ymd').Str::upper(Str::random(6)).'1';
    }

    private function nextGlobalNumber(string $prefix, string $modelClass, string $column): string
    {
        $base = $prefix.'-'.now()->format('ym');
        $next = DB::table((new $modelClass)->getTable())->where($column, 'like', "{$base}-%")->count() + 1;

        do {
            $candidate = sprintf('%s-%05d', $base, $next);
            $exists = DB::table((new $modelClass)->getTable())->where($column, $candidate)->exists();
            $next++;
        } while ($exists);

        return $candidate;
    }

    private function nextScopedCompanyNumber(string $prefix, string $modelClass, string $column, int $companyId): string
    {
        $base = $prefix.'-'.now()->format('ym');
        $next = DB::table((new $modelClass)->getTable())->where('company_id', $companyId)->where($column, 'like', "{$base}-%")->count() + 1;

        do {
            $candidate = sprintf('%s-%05d', $base, $next);
            $exists = DB::table((new $modelClass)->getTable())->where('company_id', $companyId)->where($column, $candidate)->exists();
            $next++;
        } while ($exists);

        return $candidate;
    }
}
