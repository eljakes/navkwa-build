<?php

namespace Tests\Feature;

use App\Http\Middleware\CheckPermission;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Company;
use App\Models\CompanyFeatureFlag;
use App\Models\CompanySubscription;
use App\Models\IntegrationConnector;
use App\Models\PlatformBackup;
use App\Models\PlatformFeatureFlag;
use App\Models\PlatformSetting;
use App\Models\PlatformSubscriptionPlan;
use App\Models\PlatformSupportTicket;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class PlatformAdminApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_admin_guest_requests_return_json_unauthenticated_response(): void
    {
        $this->getJson('/api/v1/platform-admin')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_platform_administration_requires_explicit_platform_permission(): void
    {
        [$tenantUser] = $this->userWithPermissions(['*']);
        [$platformUser] = $this->userWithPermissions(['platform.manage']);

        Sanctum::actingAs($tenantUser);

        $this->getJson('/api/v1/platform-admin')
            ->assertForbidden();

        Sanctum::actingAs($platformUser);

        $response = $this->getJson('/api/v1/platform-admin')
            ->assertOk()
            ->assertJsonStructure([
                'summary',
                'command_center' => ['status', 'cards', 'alerts'],
                'monitoring' => ['configured', 'checks', 'thresholds'],
                'platform_staff',
                'companies',
                'archived_companies',
                'plans',
                'feature_flags',
                'catalog' => ['console_layers', 'modules', 'countries', 'currencies', 'platform_permissions'],
            ]);

        $catalog = $response->json('catalog');
        $this->assertGreaterThanOrEqual(55, count($catalog['countries']));
        $this->assertContains('DZ', $catalog['countries']);
        $this->assertContains('GH', $catalog['countries']);
        $this->assertContains('ZW', $catalog['countries']);
        $this->assertContains('DZD', $catalog['currencies']);
        $this->assertContains('GHS', $catalog['currencies']);
        $this->assertContains('ZWL', $catalog['currencies']);

        $this->assertDatabaseHas('platform_feature_flags', ['key' => 'module.projects']);
        $this->assertDatabaseHas('platform_subscription_plans', ['code' => 'professional']);
        $this->assertDatabaseHas('platform_settings', ['setting_key' => 'monitoring']);
    }

    public function test_platform_admin_web_tokens_are_not_misclassified_as_impersonation_sessions(): void
    {
        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        $middleware = app(CheckPermission::class);

        $webToken = $platformUser->createToken('navkwabuild-web', ['*'])->accessToken;
        $webRequest = Request::create('/api/v1/platform-admin', 'GET');
        $webRequest->setUserResolver(fn (): User => $platformUser->withAccessToken($webToken));

        $response = $middleware->handle($webRequest, fn () => response()->json(['ok' => true]), 'platform.manage');

        $this->assertSame(200, $response->getStatusCode());

        $impersonationToken = $platformUser->createToken('platform-impersonation', ['impersonation'])->accessToken;
        $impersonationRequest = Request::create('/api/v1/platform-admin', 'GET');
        $impersonationRequest->setUserResolver(fn (): User => $platformUser->withAccessToken($impersonationToken));

        try {
            $middleware->handle($impersonationRequest, fn () => response()->json(['ok' => true]), 'platform.manage');
            $this->fail('Impersonation tokens must not access Navkwa Build Cloud Console administration.');
        } catch (HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
            $this->assertSame('Impersonation sessions cannot access Navkwa Build Cloud Console administration.', $exception->getMessage());
        }
    }

    public function test_platform_monitoring_uses_real_ops_configuration_for_local_preview(): void
    {
        Storage::fake('local');
        config([
            'app.url' => 'http://127.0.0.1:8010',
            'app.version' => 'test-version',
        ]);

        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $this->getJson('/api/v1/platform-admin')
            ->assertOk()
            ->assertJsonPath('monitoring.checks.ssl.status', 'neutral')
            ->assertJsonPath('monitoring.checks.ssl.value', 'Local HTTP preview')
            ->assertJsonPath('monitoring.thresholds.server_count', null)
            ->assertJsonPath('monitoring.servers_online_label', null)
            ->assertJsonPath('monitoring.app_version', 'test-version');

        $this->patchJson('/api/v1/platform-admin/settings', [
            'settings' => [
                'monitoring' => [
                    'database_warning_ms' => 250,
                    'database_critical_ms' => 1000,
                    'queue_pending_warning' => 50,
                    'failed_jobs_critical' => 1,
                    'storage_warning_percent' => 85,
                    'storage_critical_percent' => 95,
                    'security_alert_critical' => 1,
                    'server_count' => 2,
                    'servers_online' => 2,
                ],
            ],
        ])->assertOk();

        $backup = $this->postJson('/api/v1/platform-admin/backups', [
            'backup_type' => 'platform',
        ])
            ->assertCreated()
            ->assertJsonPath('backup.status', 'completed')
            ->json('backup');

        Storage::disk('local')->assertExists($backup['storage_path']);

        $this->getJson('/api/v1/platform-admin')
            ->assertOk()
            ->assertJsonPath('monitoring.status', 'operational')
            ->assertJsonPath('monitoring.servers_online_label', '2 / 2')
            ->assertJsonPath('monitoring.checks.backups.status', 'healthy')
            ->assertJsonPath('monitoring.checks.backups.value', 'Completed '.$backup['backup_number'])
            ->assertJsonPath('command_center.status', 'healthy');
    }

    public function test_daily_backup_command_creates_encrypted_cloud_console_and_erp_backups(): void
    {
        Storage::fake('local');

        [, $tenantCompany] = $this->userWithPermissions(['reports.view']);
        $platformCompany = Company::query()->create([
            'tenant_key' => 'navkwa-group',
            'name' => 'Navkwa Group Ltd.',
            'default_currency' => 'GHS',
            'country' => 'GH',
            'status' => 'active',
            'settings' => ['tenant_mode' => 'platform_operator'],
        ]);
        $platformBranch = Branch::query()->create([
            'company_id' => $platformCompany->id,
            'name' => 'Head Office',
            'code' => 'HQ',
            'country' => 'GH',
        ]);
        $platformRole = Role::query()->create([
            'company_id' => $platformCompany->id,
            'name' => 'Platform Super Admin',
            'slug' => 'platform-super-admin',
            'permissions' => ['platform.manage'],
            'is_system' => true,
        ]);
        User::query()->create([
            'company_id' => $platformCompany->id,
            'branch_id' => $platformBranch->id,
            'role_id' => $platformRole->id,
            'name' => 'Platform Admin',
            'email' => 'platform.backup@navkwa.test',
            'password' => 'NavkwaBuild2026!',
            'status' => 'active',
        ]);

        $this->artisan('navkwabuild:backup-daily')
            ->expectsOutput('Cloud Console backup completed.')
            ->expectsOutput("ERP backup completed for {$tenantCompany->name}.")
            ->assertSuccessful();

        $platformBackup = PlatformBackup::query()->where('backup_type', 'platform')->firstOrFail();
        $tenantBackup = PlatformBackup::query()->where('backup_type', 'tenant')->where('company_id', $tenantCompany->id)->firstOrFail();

        Storage::disk('local')->assertExists($platformBackup->storage_path);
        Storage::disk('local')->assertExists($tenantBackup->storage_path);

        $platformSnapshot = json_decode(Crypt::decryptString(Storage::disk('local')->get($platformBackup->storage_path)), true, 512, JSON_THROW_ON_ERROR);
        $tenantSnapshot = json_decode(Crypt::decryptString(Storage::disk('local')->get($tenantBackup->storage_path)), true, 512, JSON_THROW_ON_ERROR);

        $this->assertSame('navkwa_build_cloud_console', $platformSnapshot['scope']);
        $this->assertSame('navkwa_build_erp', $tenantSnapshot['scope']);
        $this->assertArrayHasKey('platform_backups', $platformSnapshot['tables']);
        $this->assertArrayHasKey('users', $tenantSnapshot['tables']);
        $this->assertTrue($platformBackup->metadata['encrypted']);
        $this->assertTrue($tenantBackup->metadata['encrypted']);
    }

    public function test_platform_admin_can_manage_navkwa_cloud_console_users_and_own_login_details(): void
    {
        config(['security.auth.require_mfa_for_platform_admins' => false]);

        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $workerId = $this->postJson('/api/v1/platform-admin/users', [
            'name' => 'Navkwa Support Lead',
            'email' => 'support.lead@navkwa.test',
            'password' => 'WorkerPass2026!',
            'phone' => '+233300000010',
            'job_title' => 'Customer Success Lead',
            'permissions' => ['platform.manage'],
        ])
            ->assertCreated()
            ->assertJsonPath('user.email', 'support.lead@navkwa.test')
            ->assertJsonPath('user.job_title', 'Customer Success Lead')
            ->assertJsonPath('user.effective_permissions.0', 'platform.manage')
            ->json('user.id');

        $worker = User::query()->findOrFail($workerId);
        Sanctum::actingAs($worker);
        $this->getJson('/api/v1/platform-admin')
            ->assertOk()
            ->assertJsonFragment(['email' => 'support.lead@navkwa.test']);

        Sanctum::actingAs($platformUser);
        $this->patchJson("/api/v1/platform-admin/users/{$workerId}", [
            'name' => 'Navkwa Console Operator',
            'email' => 'console.operator@navkwa.test',
            'password' => 'WorkerPass2027!',
            'job_title' => 'Platform Operator',
            'status' => 'active',
            'permissions' => ['platform.manage'],
        ])
            ->assertOk()
            ->assertJsonPath('user.name', 'Navkwa Console Operator')
            ->assertJsonPath('user.email', 'console.operator@navkwa.test');

        $this->postJson('/api/v1/auth/login', [
            'email' => 'console.operator@navkwa.test',
            'password' => 'WorkerPass2027!',
        ])->assertOk();

        $this->patchJson('/api/v1/platform-admin/profile', [
            'name' => 'CEO Updated',
            'phone' => '+233300000099',
            'job_title' => 'Chief Executive Officer',
        ])
            ->assertOk()
            ->assertJsonPath('user.name', 'CEO Updated')
            ->assertJsonPath('user.phone', '+233300000099');

        $this->patchJson('/api/v1/platform-admin/profile', [
            'email' => 'ceo@navkwa.test',
            'current_password' => 'WrongPassword2026',
        ])->assertStatus(422);

        $this->patchJson('/api/v1/platform-admin/profile', [
            'email' => 'ceo@navkwa.test',
            'current_password' => 'NavkwaBuild2026!',
            'password' => 'NewCeoPass2026!',
            'password_confirmation' => 'NewCeoPass2026!',
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'ceo@navkwa.test');

        $this->postJson('/api/v1/auth/login', [
            'email' => 'ceo@navkwa.test',
            'password' => 'NewCeoPass2026!',
        ])->assertOk();

        $this->deleteJson("/api/v1/platform-admin/users/{$workerId}")
            ->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $workerId]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.staff.created']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.staff.updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.profile.updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.staff.deleted']);
    }

    public function test_platform_admin_can_be_bootstrapped_from_artisan(): void
    {
        $this->artisan('navkwabuild:platform-admin bootstrap@navkwa.test --create --password=NavkwaBuild2026AA1!')
            ->assertSuccessful();

        $user = User::query()->where('email', 'bootstrap@navkwa.test')->firstOrFail();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/platform-admin')
            ->assertOk();

        $this->assertDatabaseHas('companies', ['tenant_key' => 'navkwa-group']);
        $this->assertDatabaseHas('roles', ['company_id' => $user->company_id, 'slug' => 'platform-super-admin']);
    }

    public function test_platform_admin_provisions_real_tenant_records(): void
    {
        Mail::fake();
        Storage::fake('local');

        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $this->getJson('/api/v1/platform-admin')->assertOk();
        $plan = PlatformSubscriptionPlan::query()->where('code', 'professional')->firstOrFail();

        $response = $this->postJson('/api/v1/platform-admin/companies', [
            'name' => 'Volta Build Ltd',
            'registration_number' => 'VR-2607-001',
            'industry' => 'construction',
            'country' => 'GH',
            'city' => 'Ho',
            'phone' => '+233300000001',
            'email' => 'hello@voltabuild.test',
            'tax_id' => 'TIN-2607',
            'currency' => 'GHS',
            'timezone' => 'Africa/Accra',
            'language' => 'en',
            'date_format' => 'Y-m-d',
            'fiscal_year_start' => '01-01',
            'primary_contact_name' => 'Ama Mensah',
            'primary_contact_email' => 'ama.mensah@voltabuild.test',
            'primary_contact_phone' => '+233300000002',
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
            'trial_days' => 0,
            'storage_limit_mb' => 2048,
            'employee_limit' => 25,
            'project_limit' => 10,
            'branch_limit' => 2,
        ])
            ->assertCreated()
            ->assertJsonPath('company.name', 'Volta Build Ltd')
            ->assertJsonPath('company.subscription.plan.code', 'professional')
            ->assertJsonPath('admin_user.email', 'ama.mensah@voltabuild.test')
            ->assertJsonPath('welcome_email.status', 'sent')
            ->assertJsonStructure([
                'company' => [
                    'customer_success',
                    'timeline',
                    'workspace' => ['users', 'branches', 'projects', 'invoices', 'support_tickets', 'billing_records', 'backups', 'audit_logs', 'domains', 'api'],
                ],
            ]);

        $companyId = $response->json('company.id');
        $company = Company::query()->findOrFail($companyId);

        $this->assertNotNull($company->tenant_key);
        $this->assertTrue(Storage::disk('local')->directoryExists("tenants/{$company->tenant_key}"));
        $this->assertDatabaseHas('branches', ['company_id' => $companyId, 'code' => 'HQ']);
        $this->assertDatabaseHas('roles', ['company_id' => $companyId, 'slug' => 'company-administrator']);
        $this->assertDatabaseHas('users', ['company_id' => $companyId, 'email' => 'ama.mensah@voltabuild.test']);
        $this->assertDatabaseHas('company_subscriptions', ['company_id' => $companyId, 'platform_subscription_plan_id' => $plan->id, 'status' => 'active']);
        $this->assertDatabaseHas('company_branding_profiles', ['company_id' => $companyId]);
        $this->assertGreaterThan(0, CompanyFeatureFlag::query()->where('company_id', $companyId)->count());
        $this->assertDatabaseHas('audit_logs', ['company_id' => $companyId, 'action' => 'platform.company.provisioned']);

        $this->postJson('/api/v1/platform-admin/billing-records', [
            'company_id' => $companyId,
            'record_type' => 'invoice',
            'status' => 'issued',
            'amount' => 3500,
            'currency' => 'GHS',
            'issued_on' => now()->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('billing_record.company.id', $companyId);

        $this->postJson('/api/v1/platform-admin/support-tickets', [
            'company_id' => $companyId,
            'title' => 'Onboarding support',
            'priority' => 'high',
            'description' => 'Help customer configure branches.',
        ])
            ->assertCreated()
            ->assertJsonPath('ticket.company.id', $companyId)
            ->assertJsonPath('ticket.status', 'open');

        $this->patchJson('/api/v1/platform-admin/settings', [
            'settings' => [
                'monitoring' => [
                    'database_warning_ms' => 200,
                    'database_critical_ms' => 800,
                    'queue_pending_warning' => 25,
                    'failed_jobs_critical' => 1,
                    'storage_warning_percent' => 80,
                    'storage_critical_percent' => 92,
                    'security_alert_critical' => 1,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('settings.0.setting_key', 'monitoring');

        $this->patchJson("/api/v1/platform-admin/companies/{$companyId}/success", [
            'success_manager' => 'Esi Owusu',
            'next_meeting_at' => now()->addWeek()->toDateString(),
            'training_completed_percent' => 80,
            'adoption_percent' => 72,
            'risk_percent' => 18,
            'expansion_opportunity' => 'Finance add-on',
            'notes' => 'Finance team is ready for onboarding.',
        ])
            ->assertOk()
            ->assertJsonPath('company.customer_success.success_manager', 'Esi Owusu')
            ->assertJsonPath('company.customer_success.adoption_percent', 72);

        $this->getJson('/api/v1/platform-admin?q=Volta')
            ->assertOk()
            ->assertJsonPath('search_results.0.type', 'company')
            ->assertJsonPath('search_results.0.label', 'Volta Build Ltd');
    }

    public function test_provisioning_wizard_module_selection_is_exact(): void
    {
        Mail::fake();
        Storage::fake('local');

        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $this->getJson('/api/v1/platform-admin')->assertOk();

        $companyId = $this->postJson('/api/v1/platform-admin/companies', [
            'name' => 'Selective Modules Ltd',
            'country' => 'GH',
            'currency' => 'GHS',
            'primary_contact_name' => 'Module Admin',
            'primary_contact_email' => 'module.admin@selective.test',
            'enabled_feature_keys' => ['module.projects', 'module.finance', 'platform.custom_branding'],
            'branding' => [
                'primary_color' => '#1155cc',
                'login_welcome_message' => 'Welcome to Selective Modules Ltd.',
            ],
        ])->assertCreated()->json('company.id');

        $financeFlag = PlatformFeatureFlag::query()->where('key', 'module.finance')->firstOrFail();
        $crmFlag = PlatformFeatureFlag::query()->where('key', 'module.crm')->firstOrFail();

        $this->assertDatabaseHas('company_feature_flags', [
            'company_id' => $companyId,
            'platform_feature_flag_id' => $financeFlag->id,
            'is_enabled' => true,
        ]);
        $this->assertDatabaseHas('company_feature_flags', [
            'company_id' => $companyId,
            'platform_feature_flag_id' => $crmFlag->id,
            'is_enabled' => false,
        ]);
        $this->assertDatabaseHas('company_branding_profiles', [
            'company_id' => $companyId,
            'primary_color' => '#1155cc',
            'login_welcome_message' => 'Welcome to Selective Modules Ltd.',
        ]);
    }

    public function test_platform_admin_can_edit_archive_and_restore_company_accounts(): void
    {
        Mail::fake();
        Storage::fake('local');

        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $this->getJson('/api/v1/platform-admin')->assertOk();
        $professional = PlatformSubscriptionPlan::query()->where('code', 'professional')->firstOrFail();
        $enterprise = PlatformSubscriptionPlan::query()->where('code', 'enterprise')->firstOrFail();

        $response = $this->postJson('/api/v1/platform-admin/companies', [
            'name' => 'Archive Ready Builders',
            'country' => 'GH',
            'currency' => 'GHS',
            'primary_contact_name' => 'Tenant Admin',
            'primary_contact_email' => 'tenant.admin@archive-ready.test',
            'admin_password' => 'TenantPass2026!',
            'subscription_plan_id' => $professional->id,
            'status' => 'active',
        ])->assertCreated();

        $companyId = $response->json('company.id');
        $tenantKey = $response->json('company.tenant_key');

        $this->patchJson("/api/v1/platform-admin/companies/{$companyId}", [
            'name' => 'Archive Ready Builders Ltd',
            'registration_number' => 'ARB-2607-001',
            'industry' => 'construction',
            'country' => 'GH',
            'city' => 'Takoradi',
            'email' => 'hello@archive-ready.test',
            'currency' => 'GHS',
            'timezone' => 'Africa/Accra',
            'language' => 'en',
            'date_format' => 'Y-m-d',
            'fiscal_year_start' => '01-01',
            'status' => 'active',
            'storage_limit_mb' => 8192,
            'employee_limit' => 75,
            'project_limit' => 20,
            'branch_limit' => 4,
            'subscription_plan_id' => $enterprise->id,
        ])
            ->assertOk()
            ->assertJsonPath('company.name', 'Archive Ready Builders Ltd')
            ->assertJsonPath('company.city', 'Takoradi')
            ->assertJsonPath('company.subscription.plan.code', 'enterprise');

        $this->assertDatabaseHas('company_subscriptions', [
            'company_id' => $companyId,
            'platform_subscription_plan_id' => $enterprise->id,
        ]);
        $this->postJson('/api/v1/auth/login', [
            'email' => 'tenant.admin@archive-ready.test',
            'password' => 'TenantPass2026!',
        ])->assertOk();

        Sanctum::actingAs($platformUser);
        $this->deleteJson("/api/v1/platform-admin/companies/{$companyId}")
            ->assertOk()
            ->assertJsonPath('message', 'Company archived.');

        $this->assertSoftDeleted('companies', ['id' => $companyId]);
        $this->assertSame('archived', Company::withTrashed()->findOrFail($companyId)->status);
        $this->assertDatabaseHas('audit_logs', ['company_id' => $companyId, 'action' => 'platform.company.archived']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'tenant.admin@archive-ready.test',
            'password' => 'TenantPass2026!',
        ])->assertStatus(422);

        Sanctum::actingAs($platformUser);
        $archivedCompanies = $this->getJson('/api/v1/platform-admin')
            ->assertOk()
            ->json('archived_companies');
        $archivedCompany = collect($archivedCompanies)->firstWhere('id', $companyId);

        $this->assertSame($tenantKey, $archivedCompany['tenant_key']);
        $this->assertSame('Archive Ready Builders Ltd', $archivedCompany['name']);
        $this->assertSame('archived', $archivedCompany['status']);
        $this->assertSame('Takoradi', $archivedCompany['city']);
        $this->assertSame(8192, $archivedCompany['storage_limit_mb']);

        $this->postJson("/api/v1/platform-admin/companies/{$companyId}/restore")
            ->assertOk()
            ->assertJsonPath('company.id', $companyId)
            ->assertJsonPath('company.status', 'active')
            ->assertJsonPath('company.subscription.plan.code', 'enterprise');

        $this->assertNotSoftDeleted('companies', ['id' => $companyId]);
        $this->assertDatabaseHas('audit_logs', ['company_id' => $companyId, 'action' => 'platform.company.restored']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'tenant.admin@archive-ready.test',
            'password' => 'TenantPass2026!',
        ])->assertOk();
    }

    public function test_platform_admin_can_permanently_delete_archived_company_accounts(): void
    {
        Mail::fake();
        Storage::fake('local');

        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $this->getJson('/api/v1/platform-admin')->assertOk();
        $professional = PlatformSubscriptionPlan::query()->where('code', 'professional')->firstOrFail();

        $response = $this->postJson('/api/v1/platform-admin/companies', [
            'name' => 'Permanent Delete Builders',
            'country' => 'GH',
            'currency' => 'GHS',
            'primary_contact_name' => 'Tenant Admin',
            'primary_contact_email' => 'tenant.admin@permanent-delete.test',
            'admin_password' => 'TenantPass2026!',
            'subscription_plan_id' => $professional->id,
            'status' => 'active',
        ])->assertCreated();

        $companyId = $response->json('company.id');
        $tenantKey = $response->json('company.tenant_key');

        Storage::disk('local')->put("tenants/{$tenantKey}/branding/logo.txt", 'logo');
        Storage::disk('local')->put("navkwabuild/companies/{$companyId}/documents/spec.txt", 'spec');

        $this->deleteJson("/api/v1/platform-admin/companies/{$companyId}/permanent")
            ->assertNotFound();

        $this->deleteJson("/api/v1/platform-admin/companies/{$companyId}")
            ->assertOk()
            ->assertJsonPath('message', 'Company archived.');

        $this->assertSoftDeleted('companies', ['id' => $companyId]);

        $this->deleteJson("/api/v1/platform-admin/companies/{$companyId}/permanent")
            ->assertOk()
            ->assertJsonPath('message', 'Company permanently deleted.');

        $this->assertDatabaseMissing('companies', ['id' => $companyId]);
        $this->assertDatabaseMissing('company_subscriptions', ['company_id' => $companyId]);
        $this->assertDatabaseMissing('users', ['email' => 'tenant.admin@permanent-delete.test']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.company.permanently_deleted']);
        Storage::disk('local')->assertMissing("tenants/{$tenantKey}/branding/logo.txt");
        Storage::disk('local')->assertMissing("navkwabuild/companies/{$companyId}/documents/spec.txt");

        $archivedCompanies = $this->getJson('/api/v1/platform-admin')
            ->assertOk()
            ->json('archived_companies');

        $this->assertNull(collect($archivedCompanies)->firstWhere('id', $companyId));
    }

    public function test_platform_admin_can_edit_delete_and_upgrade_subscriptions(): void
    {
        Mail::fake();
        Storage::fake('local');

        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $this->getJson('/api/v1/platform-admin')->assertOk();
        $starter = PlatformSubscriptionPlan::query()->where('code', 'starter')->firstOrFail();
        $business = PlatformSubscriptionPlan::query()->where('code', 'business')->firstOrFail();

        $planId = $this->postJson('/api/v1/platform-admin/plans', [
            'name' => 'Site Growth',
            'status' => 'active',
            'currency' => 'GHS',
            'monthly_price' => 2200,
            'yearly_price' => 22000,
            'maximum_users' => 30,
            'maximum_projects' => 12,
            'maximum_storage_mb' => 25000,
            'support_level' => 'priority',
            'api_access' => true,
            'custom_branding' => true,
            'sso_available' => false,
        ])
            ->assertCreated()
            ->assertJsonPath('plan.code', 'site-growth')
            ->json('plan.id');

        $this->patchJson("/api/v1/platform-admin/plans/{$planId}", [
            'code' => '',
            'name' => 'Site Growth Plus',
            'monthly_price' => 2600,
            'yearly_price' => 26000,
            'maximum_users' => 35,
            'status' => 'active',
        ])
            ->assertOk()
            ->assertJsonPath('plan.code', 'site-growth-plus')
            ->assertJsonPath('plan.name', 'Site Growth Plus');

        $this->deleteJson("/api/v1/platform-admin/plans/{$planId}")
            ->assertOk()
            ->assertJsonPath('message', 'Subscription plan deleted.');

        $this->assertSoftDeleted('platform_subscription_plans', ['id' => $planId]);

        $companyId = $this->postJson('/api/v1/platform-admin/companies', [
            'name' => 'Subscription Managed Builders',
            'country' => 'GH',
            'currency' => 'GHS',
            'primary_contact_name' => 'Subscription Admin',
            'primary_contact_email' => 'subscription.admin@builders.test',
            'admin_password' => 'TenantPass2026!',
            'subscription_plan_id' => $starter->id,
            'status' => 'active',
        ])
            ->assertCreated()
            ->assertJsonPath('company.subscription.plan.code', 'starter')
            ->json('company.id');

        $subscription = CompanySubscription::query()->where('company_id', $companyId)->firstOrFail();

        $this->patchJson("/api/v1/platform-admin/subscriptions/{$subscription->id}", [
            'status' => 'past_due',
            'billing_interval' => 'monthly',
            'amount' => 1500,
            'currency' => 'GHS',
            'seats' => 16,
            'renewal_at' => now()->addDays(20)->toDateString(),
        ])
            ->assertOk()
            ->assertJsonPath('subscription.status', 'past_due')
            ->assertJsonPath('subscription.billing_interval', 'monthly')
            ->assertJsonPath('subscription.seats', 16);

        $this->assertDatabaseHas('companies', ['id' => $companyId, 'status' => 'past_due']);

        $this->postJson("/api/v1/platform-admin/subscriptions/{$subscription->id}/upgrade", [
            'platform_subscription_plan_id' => $business->id,
            'billing_interval' => 'yearly',
        ])
            ->assertOk()
            ->assertJsonPath('subscription.plan.code', 'business')
            ->assertJsonPath('subscription.status', 'active')
            ->assertJsonPath('subscription.billing_interval', 'yearly')
            ->assertJsonPath('company.status', 'active');

        $this->assertDatabaseHas('company_subscriptions', [
            'id' => $subscription->id,
            'platform_subscription_plan_id' => $business->id,
            'billing_interval' => 'yearly',
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('companies', [
            'id' => $companyId,
            'status' => 'active',
            'employee_limit' => $business->maximum_users,
            'project_limit' => $business->maximum_projects,
            'storage_limit_mb' => $business->maximum_storage_mb,
        ]);

        $biFlag = PlatformFeatureFlag::query()->where('key', 'module.bi')->firstOrFail();
        $this->assertDatabaseHas('company_feature_flags', [
            'company_id' => $companyId,
            'platform_feature_flag_id' => $biFlag->id,
            'is_enabled' => true,
        ]);

        $this->deleteJson("/api/v1/platform-admin/subscriptions/{$subscription->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Subscription deleted.');

        $this->assertSoftDeleted('company_subscriptions', ['id' => $subscription->id]);
        $this->assertDatabaseHas('companies', ['id' => $companyId, 'status' => 'cancelled']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.plan.created']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.plan.updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.plan.deleted']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.subscription.updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.subscription.upgraded']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.subscription.deleted']);
    }

    public function test_platform_admin_feature_settings_support_updates_ai_settings_and_backups_are_real(): void
    {
        Mail::fake();
        Storage::fake('local');

        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $this->getJson('/api/v1/platform-admin')->assertOk();
        $feature = PlatformFeatureFlag::query()->where('key', 'finance.ai_forecasting')->firstOrFail();

        $this->patchJson("/api/v1/platform-admin/features/{$feature->id}", [
            'name' => 'AI Forecasting',
            'module' => 'finance',
            'category' => 'feature',
            'description' => 'Forecast platform revenue and client risk from live tenant data.',
            'default_enabled' => false,
            'rollout_status' => 'beta',
            'rollout_percentage' => 35,
            'pricing_tier' => 'enterprise',
            'requires_subscription' => true,
        ])
            ->assertOk()
            ->assertJsonPath('feature.rollout_status', 'beta')
            ->assertJsonPath('feature.rollout_percentage', 35);

        $this->assertDatabaseHas('platform_feature_flags', [
            'id' => $feature->id,
            'rollout_status' => 'beta',
            'rollout_percentage' => 35,
        ]);

        $companyId = $this->postJson('/api/v1/platform-admin/companies', [
            'name' => 'Console Integrated Builders',
            'country' => 'GH',
            'currency' => 'GHS',
            'primary_contact_name' => 'Console Admin',
            'primary_contact_email' => 'console.admin@integrated.test',
            'admin_password' => 'TenantPass2026!',
            'status' => 'active',
        ])->assertCreated()->json('company.id');

        $ticketId = $this->postJson('/api/v1/platform-admin/support-tickets', [
            'company_id' => $companyId,
            'title' => 'Resolve onboarding issue',
            'priority' => 'urgent',
            'description' => 'Tenant administrator cannot access finance settings.',
        ])
            ->assertCreated()
            ->assertJsonPath('ticket.status', 'open')
            ->json('ticket.id');

        $this->patchJson("/api/v1/platform-admin/support-tickets/{$ticketId}", [
            'status' => 'resolved',
            'priority' => 'high',
            'assigned_to' => $platformUser->id,
            'resolution_notes' => 'Confirmed subscription feature flags and refreshed tenant permissions.',
        ])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'resolved')
            ->assertJsonPath('ticket.priority', 'high');

        $ticket = PlatformSupportTicket::query()->findOrFail($ticketId);
        $this->assertNotNull($ticket->closed_at);
        $this->assertSame('Confirmed subscription feature flags and refreshed tenant permissions.', $ticket->resolution_notes);

        $backup = $this->postJson('/api/v1/platform-admin/backups', [
            'company_id' => $companyId,
            'backup_type' => 'tenant',
        ])
            ->assertCreated()
            ->assertJsonPath('backup.status', 'completed')
            ->json('backup');

        Storage::disk('local')->assertExists($backup['storage_path']);
        $encryptedSnapshot = Storage::disk('local')->get($backup['storage_path']);
        $this->assertStringNotContainsString('Console Integrated Builders', $encryptedSnapshot);
        $this->assertStringContainsString('Console Integrated Builders', Crypt::decryptString($encryptedSnapshot));
        $this->assertDatabaseHas('platform_backups', [
            'id' => $backup['id'],
            'status' => 'completed',
        ]);
        $this->assertNotNull(PlatformBackup::query()->findOrFail($backup['id'])->verified_at);

        $this->patchJson('/api/v1/platform-admin/settings', [
            'settings' => [
                'ai' => [
                    'enabled' => true,
                    'usage_percent' => 63.5,
                    'monthly_token_limit' => 100000,
                    'monthly_budget' => 1500,
                    'cost_month_to_date' => 375,
                ],
            ],
        ])->assertOk();

        $this->assertSame(63.5, (float) data_get(PlatformSetting::query()->where('setting_key', 'ai')->firstOrFail()->setting_value, 'usage_percent'));

        $dashboard = $this->getJson('/api/v1/platform-admin')
            ->assertOk()
            ->assertJsonPath('summary.ai_usage_percent', 63.5)
            ->json();
        $aiCard = collect($dashboard['command_center']['cards'])->firstWhere('key', 'ai_usage');

        $this->assertSame('63.5%', $aiCard['value']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.feature_release.updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.support.updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.backup.completed']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.settings.updated']);
    }

    public function test_platform_admin_redacts_connector_credentials_from_payloads_and_audit_logs(): void
    {
        [$platformUser, $company] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $connector = IntegrationConnector::query()->create([
            'company_id' => $company->id,
            'provider' => 'xero',
            'name' => 'Xero Finance Connector',
            'category' => 'accounting',
            'status' => 'configured',
            'settings' => ['sync_invoices' => true],
            'encrypted_credentials' => ['tenant_id' => 'xero-live-tenant', 'client_id' => 'client-secret-value'],
            'created_by' => $platformUser->id,
        ]);
        $connector->update([
            'status' => 'connected',
            'encrypted_credentials' => ['access_token' => 'live-access-token'],
        ]);

        $auditLog = AuditLog::query()
            ->where('auditable_type', IntegrationConnector::class)
            ->latest('created_at')
            ->firstOrFail();
        $storedAuditPayload = json_encode([$auditLog->before, $auditLog->after], JSON_THROW_ON_ERROR);

        $this->assertStringNotContainsString('encrypted_credentials', $storedAuditPayload);
        $this->assertStringNotContainsString('client-secret-value', $storedAuditPayload);
        $this->assertStringNotContainsString('live-access-token', $storedAuditPayload);
        $this->assertStringContainsString('_redacted_field_count', $storedAuditPayload);

        $response = $this->getJson('/api/v1/platform-admin')
            ->assertOk()
            ->json();
        $platformPayload = json_encode($response, JSON_THROW_ON_ERROR);

        $this->assertStringNotContainsString('encrypted_credentials', $platformPayload);
        $this->assertStringNotContainsString('client-secret-value', $platformPayload);
        $this->assertStringNotContainsString('live-access-token', $platformPayload);
        $this->assertJson($platformPayload);
    }

    public function test_disabled_company_module_blocks_tenant_api_access(): void
    {
        Mail::fake();
        Storage::fake('local');

        [$platformUser] = $this->userWithPermissions(['platform.manage']);
        Sanctum::actingAs($platformUser);

        $this->getJson('/api/v1/platform-admin')->assertOk();
        $companyId = $this->postJson('/api/v1/platform-admin/companies', [
            'name' => 'Keta Civil Works',
            'country' => 'GH',
            'currency' => 'GHS',
            'primary_contact_name' => 'Kojo Admin',
            'primary_contact_email' => 'kojo.admin@keta.test',
            'status' => 'active',
        ])->assertCreated()->json('company.id');

        $tenantAdmin = User::query()->where('company_id', $companyId)->where('email', 'kojo.admin@keta.test')->firstOrFail();

        Sanctum::actingAs($tenantAdmin);
        $this->getJson('/api/v1/finance')->assertOk();
        $this->getJson('/api/v1/platform-admin')->assertForbidden();

        Sanctum::actingAs($platformUser);
        $financeFlag = PlatformFeatureFlag::query()->where('key', 'module.finance')->firstOrFail();
        $this->patchJson("/api/v1/platform-admin/companies/{$companyId}/features/{$financeFlag->id}", [
            'is_enabled' => false,
        ])
            ->assertOk()
            ->assertJsonPath('feature.is_enabled', false);

        Sanctum::actingAs($tenantAdmin);
        $this->getJson('/api/v1/finance')
            ->assertForbidden();
    }

    private function userWithPermissions(array $permissions): array
    {
        $company = Company::query()->create([
            'name' => fake()->company(),
            'default_currency' => 'GHS',
            'country' => 'GH',
            'status' => 'active',
        ]);

        $branch = Branch::query()->create([
            'company_id' => $company->id,
            'name' => 'Head Office',
            'code' => 'HQ',
            'country' => 'GH',
        ]);

        $role = Role::query()->create([
            'company_id' => $company->id,
            'name' => 'Test Role',
            'slug' => 'test-role-'.fake()->unique()->numberBetween(1000, 9999),
            'permissions' => $permissions,
            'is_system' => true,
        ]);

        $user = User::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'role_id' => $role->id,
            'name' => 'Platform Test User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'NavkwaBuild2026!',
            'status' => 'active',
        ]);

        return [$user, $company, $branch, $role];
    }
}
