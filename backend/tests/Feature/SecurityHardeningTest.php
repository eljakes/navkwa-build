<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Services\MfaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_responses_include_security_headers(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertUnauthorized()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Content-Security-Policy');
    }

    public function test_repeated_failed_password_attempts_temporarily_lock_the_account(): void
    {
        config([
            'security.auth.max_failed_login_attempts' => 2,
            'security.auth.lockout_minutes' => 20,
        ]);

        [$user] = $this->userWithPermissions(['reports.view']);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'WrongPass2026',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'WrongPass2027',
        ])->assertStatus(422);

        $this->assertNotNull($user->fresh()->locked_until);
        $this->assertDatabaseHas('platform_security_events', [
            'user_id' => $user->id,
            'event_type' => 'account_locked_after_failed_login',
            'severity' => 'critical',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'SecurePass2026!',
        ])->assertStatus(423);
    }

    public function test_mfa_setup_enforces_a_second_factor_at_login(): void
    {
        [$user] = $this->userWithPermissions(['reports.view']);
        $mfaService = app(MfaService::class);

        Sanctum::actingAs($user);

        $setup = $this->postJson('/api/v1/security/mfa/setup', [
            'current_password' => 'SecurePass2026!',
        ])
            ->assertOk()
            ->assertJsonPath('security.mfa.enabled', false)
            ->assertJsonCount(10, 'setup.recovery_codes');

        $secret = $setup->json('setup.secret');

        $this->postJson('/api/v1/security/mfa/enable', [
            'current_password' => 'SecurePass2026!',
            'mfa_code' => $mfaService->currentCode($secret),
        ])
            ->assertOk()
            ->assertJsonPath('security.mfa.enabled', true)
            ->assertJsonPath('security.mfa.recovery_codes_remaining', 10);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'SecurePass2026!',
        ])
            ->assertOk()
            ->assertJsonPath('mfa_required', true);

        $this->assertNull($login->json('token'));

        $this->postJson('/api/v1/auth/mfa-challenge', [
            'challenge_token' => $login->json('challenge_token'),
            'mfa_code' => $mfaService->currentCode($secret),
        ])
            ->assertOk()
            ->assertJsonStructure(['token', 'user'])
            ->assertJsonPath('user.mfa_enabled', true);

        $this->assertDatabaseHas('platform_security_events', [
            'user_id' => $user->id,
            'event_type' => 'login_succeeded_with_mfa',
        ]);
        $this->assertNotNull(DB::table('personal_access_tokens')->latest('id')->value('expires_at'));
    }

    public function test_password_change_requires_current_password_and_revokes_other_web_sessions(): void
    {
        [$user] = $this->userWithPermissions(['reports.view']);
        $user->forceFill(['must_change_password' => true])->save();

        $currentToken = $user->createToken('navkwabuild-web', ['*'])->plainTextToken;
        $otherToken = $user->createToken('navkwabuild-web', ['*'])->plainTextToken;
        [$currentTokenId] = explode('|', $currentToken, 2);
        [$otherTokenId] = explode('|', $otherToken, 2);

        $this->withToken($currentToken)->postJson('/api/v1/security/password', [
            'current_password' => 'WrongPass2026',
            'password' => 'StrongerPass2026!',
            'password_confirmation' => 'StrongerPass2026!',
        ])->assertStatus(422);

        $this->withToken($currentToken)->postJson('/api/v1/security/password', [
            'current_password' => 'SecurePass2026!',
            'password' => 'StrongerPass2026!',
            'password_confirmation' => 'StrongerPass2026!',
        ])
            ->assertOk()
            ->assertJsonPath('user.must_change_password', false);

        $fresh = $user->fresh();
        $this->assertTrue(Hash::check('StrongerPass2026!', $fresh->password));
        $this->assertFalse((bool) $fresh->must_change_password);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => (int) $currentTokenId]);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => (int) $otherTokenId]);
        $this->assertDatabaseHas('platform_security_events', [
            'user_id' => $user->id,
            'event_type' => 'password_changed',
        ]);
    }

    public function test_cloud_console_admins_can_be_required_to_use_mfa(): void
    {
        config(['security.auth.require_mfa_for_platform_admins' => true]);

        [$user] = $this->userWithPermissions(['platform.manage']);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'SecurePass2026!',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_development_seed_data_is_blocked_in_production(): void
    {
        config(['app.env' => 'production']);

        $this->artisan('db:seed')
            ->assertSuccessful();

        $this->assertDatabaseMissing('companies', ['name' => 'Navkwa Build Workspace']);
        $this->assertDatabaseMissing('users', ['email' => 'owner@navkwabuild.test']);
    }

    public function test_strict_production_check_rejects_non_production_environment(): void
    {
        config(['app.env' => 'local']);

        $this->artisan('navkwabuild:production-check --strict')
            ->expectsOutputToContain('APP_ENV must be production for deployment.')
            ->assertFailed();
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
            'name' => 'Security Test User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'SecurePass2026!',
            'status' => 'active',
            'password_changed_at' => now(),
        ]);

        return [$user, $company, $branch, $role];
    }
}
