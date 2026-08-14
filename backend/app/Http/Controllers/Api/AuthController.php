<?php

namespace App\Http\Controllers\Api;

use App\Models\Branch;
use App\Models\Company;
use App\Models\PlatformSecurityEvent;
use App\Models\Role;
use App\Models\User;
use App\Services\MfaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends ApiController
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'branch_name' => ['nullable', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'size:2'],
            'currency' => ['nullable', 'string', 'size:3'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', $this->passwordRule()],
        ]);

        $payload = DB::transaction(function () use ($data, $request) {
            $company = Company::query()->create([
                'name' => $data['company_name'],
                'country' => strtoupper($data['country'] ?? 'GH'),
                'default_currency' => strtoupper($data['currency'] ?? 'GHS'),
            ]);

            $branch = Branch::query()->create([
                'company_id' => $company->id,
                'name' => $data['branch_name'] ?? 'Head Office',
                'code' => 'HQ',
                'country' => $company->country,
            ]);

            $ownerRole = Role::query()->create([
                'company_id' => $company->id,
                'name' => 'CEO',
                'slug' => 'owner',
                'permissions' => ['*'],
                'is_system' => true,
            ]);

            foreach ($this->defaultRoles() as $role) {
                Role::query()->create([
                    'company_id' => $company->id,
                    ...$role,
                ]);
            }

            $user = User::query()->create([
                'company_id' => $company->id,
                'branch_id' => $branch->id,
                'role_id' => $ownerRole->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'job_title' => 'Managing Director',
                'password' => $data['password'],
                'last_login_at' => now(),
                'last_login_ip' => $request->ip(),
                'password_changed_at' => now(),
            ]);

            return [$company, $branch, $user];
        });

        [, , $user] = $payload;

        return response()->json([
            'token' => $this->issueWebToken($user),
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);
        $email = strtolower(trim($data['email']));

        $user = User::query()
            ->with(['company', 'branch', 'role'])
            ->where('email', $email)
            ->first();

        if ($user && $this->userIsLocked($user)) {
            $this->recordSecurityEvent($request, $user, 'login_blocked_account_locked', 'high', 'open', 'A login attempt was blocked because the account is temporarily locked.');
            abort(423, 'This user account is temporarily locked. Try again after '.$user->locked_until?->toDayDateTimeString().'.');
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            if ($user) {
                $this->recordFailedLogin($request, $user, 'invalid_password');
            }

            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $this->ensureUserCanSignIn($user);

        if ($this->requiresPlatformMfa($user) && ! $this->mfaIsEnabled($user)) {
            throw ValidationException::withMessages([
                'email' => ['Multi-factor authentication is required for Navkwa Build Cloud Console administrators before sign in is allowed.'],
            ]);
        }

        if ($this->mfaIsEnabled($user)) {
            $user->forceFill([
                'failed_login_attempts' => 0,
                'locked_until' => null,
            ])->save();

            $challenge = $this->createMfaChallenge($user, $request);
            $this->recordSecurityEvent($request, $user, 'mfa_challenge_issued', 'medium', 'resolved', 'A multi-factor authentication challenge was issued.');

            return response()->json([
                'mfa_required' => true,
                'challenge_token' => $challenge['token'],
                'expires_at' => $challenge['expires_at']->toISOString(),
                'user' => [
                    'email' => $user->email,
                    'mfa_enabled' => true,
                ],
            ]);
        }

        $this->recordSuccessfulLogin($request, $user);

        return response()->json([
            'token' => $this->issueWebToken($user),
            'user' => $this->userPayload($user->fresh(['company', 'branch', 'role'])),
        ]);
    }

    public function mfaChallenge(Request $request, MfaService $mfaService): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string', 'size:64'],
            'mfa_code' => ['nullable', 'string', 'max:20'],
            'recovery_code' => ['nullable', 'string', 'max:40'],
        ]);

        if (blank($data['mfa_code'] ?? null) && blank($data['recovery_code'] ?? null)) {
            throw ValidationException::withMessages([
                'mfa_code' => ['Enter an authenticator code or recovery code.'],
            ]);
        }

        $cacheKey = $this->mfaChallengeCacheKey($data['challenge_token']);
        $challenge = Cache::get($cacheKey);
        if (! is_array($challenge) || empty($challenge['user_id'])) {
            throw ValidationException::withMessages([
                'mfa_code' => ['This multi-factor challenge has expired. Sign in again.'],
            ]);
        }

        $user = User::query()->with(['company', 'branch', 'role'])->findOrFail($challenge['user_id']);
        if ($this->userIsLocked($user)) {
            abort(423, 'This user account is temporarily locked. Try again after '.$user->locked_until?->toDayDateTimeString().'.');
        }
        $this->ensureUserCanSignIn($user);

        if (! hash_equals((string) ($challenge['ip_address'] ?? ''), (string) $request->ip())
            || ! hash_equals((string) ($challenge['user_agent'] ?? ''), (string) $request->userAgent())) {
            Cache::forget($cacheKey);
            $this->recordFailedLogin($request, $user, 'mfa_context_changed');

            throw ValidationException::withMessages([
                'mfa_code' => ['This multi-factor challenge could not be verified. Sign in again.'],
            ]);
        }

        $valid = filled($data['mfa_code'] ?? null)
            ? $mfaService->verifyCode($user->mfa_secret, $data['mfa_code'])
            : $mfaService->consumeRecoveryCode($user, $data['recovery_code'] ?? null);

        if (! $valid) {
            $this->recordFailedLogin($request, $user, 'invalid_mfa');

            throw ValidationException::withMessages([
                'mfa_code' => ['The multi-factor authentication code is incorrect.'],
            ]);
        }

        Cache::forget($cacheKey);
        $this->recordSuccessfulLogin($request, $user, true);

        return response()->json([
            'token' => $this->issueWebToken($user),
            'user' => $this->userPayload($user->fresh(['company', 'branch', 'role'])),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userPayload($this->user($request)->load(['company.branches', 'branch', 'role'])),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', $this->passwordRule()],
        ]);

        $this->assertCurrentPassword($user, $data['current_password']);
        if (Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Choose a new password that is different from your current password.'],
            ]);
        }

        $user->forceFill([
            'password' => $data['password'],
            'password_changed_at' => now(),
            'must_change_password' => false,
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ])->save();

        $this->revokeOtherTokens($request, $user);
        $this->recordSecurityEvent($request, $user, 'password_changed', 'medium', 'resolved', 'A user changed their password.');

        return response()->json([
            'user' => $this->userPayload($user->fresh(['company.branches', 'branch', 'role'])),
        ]);
    }

    public function mfaStatus(Request $request): JsonResponse
    {
        return response()->json([
            'security' => [
                'mfa' => $this->mfaPayload($this->user($request)),
            ],
        ]);
    }

    public function setupMfa(Request $request, MfaService $mfaService): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'current_password' => ['required', 'string'],
        ]);

        $this->assertCurrentPassword($user, $data['current_password']);
        abort_if($this->mfaIsEnabled($user), 422, 'Multi-factor authentication is already enabled.');

        $secret = $mfaService->generateSecret();
        $recoveryCodes = $mfaService->generateRecoveryCodes();

        $user->forceFill([
            'mfa_secret' => $secret,
            'mfa_enabled_at' => null,
            'mfa_recovery_codes' => $mfaService->hashRecoveryCodes($recoveryCodes),
            'mfa_last_used_at' => null,
        ])->save();

        $this->recordSecurityEvent($request, $user, 'mfa_setup_started', 'medium', 'resolved', 'Multi-factor authentication setup was started.');

        return response()->json([
            'security' => [
                'mfa' => $this->mfaPayload($user->fresh()),
            ],
            'setup' => [
                'secret' => $secret,
                'otpauth_uri' => $mfaService->otpauthUri($user, $secret),
                'recovery_codes' => $recoveryCodes,
            ],
        ]);
    }

    public function enableMfa(Request $request, MfaService $mfaService): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'mfa_code' => ['required', 'string', 'max:20'],
        ]);

        $this->assertCurrentPassword($user, $data['current_password']);
        if (! $mfaService->verifyCode($user->mfa_secret, $data['mfa_code'])) {
            throw ValidationException::withMessages([
                'mfa_code' => ['The authenticator code is incorrect.'],
            ]);
        }

        $user->forceFill([
            'mfa_enabled_at' => now(),
            'mfa_last_used_at' => now(),
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ])->save();
        $this->revokeOtherTokens($request, $user);
        $this->recordSecurityEvent($request, $user, 'mfa_enabled', 'medium', 'resolved', 'Multi-factor authentication was enabled.');

        return response()->json([
            'security' => [
                'mfa' => $this->mfaPayload($user->fresh()),
            ],
        ]);
    }

    public function disableMfa(Request $request, MfaService $mfaService): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'mfa_code' => ['nullable', 'string', 'max:20'],
            'recovery_code' => ['nullable', 'string', 'max:40'],
        ]);

        $this->assertCurrentPassword($user, $data['current_password']);
        $valid = filled($data['mfa_code'] ?? null)
            ? $mfaService->verifyCode($user->mfa_secret, $data['mfa_code'])
            : $mfaService->consumeRecoveryCode($user, $data['recovery_code'] ?? null);

        if (! $valid) {
            throw ValidationException::withMessages([
                'mfa_code' => ['Enter a valid authenticator code or recovery code.'],
            ]);
        }

        $user->forceFill([
            'mfa_secret' => null,
            'mfa_enabled_at' => null,
            'mfa_recovery_codes' => null,
            'mfa_last_used_at' => null,
        ])->save();
        $this->revokeOtherTokens($request, $user);
        $this->recordSecurityEvent($request, $user, 'mfa_disabled', 'high', 'open', 'Multi-factor authentication was disabled.');

        return response()->json([
            'security' => [
                'mfa' => $this->mfaPayload($user->fresh()),
            ],
        ]);
    }

    public function regenerateMfaRecoveryCodes(Request $request, MfaService $mfaService): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'mfa_code' => ['required', 'string', 'max:20'],
        ]);

        $this->assertCurrentPassword($user, $data['current_password']);
        if (! $this->mfaIsEnabled($user) || ! $mfaService->verifyCode($user->mfa_secret, $data['mfa_code'])) {
            throw ValidationException::withMessages([
                'mfa_code' => ['The authenticator code is incorrect.'],
            ]);
        }

        $recoveryCodes = $mfaService->generateRecoveryCodes();
        $user->forceFill([
            'mfa_recovery_codes' => $mfaService->hashRecoveryCodes($recoveryCodes),
            'mfa_last_used_at' => now(),
        ])->save();
        $this->recordSecurityEvent($request, $user, 'mfa_recovery_codes_regenerated', 'medium', 'resolved', 'Multi-factor recovery codes were regenerated.');

        return response()->json([
            'security' => [
                'mfa' => $this->mfaPayload($user->fresh()),
            ],
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing(['company.branches', 'branch', 'role']);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'job_title' => $user->job_title,
            'status' => $user->status,
            'company' => $user->company,
            'branch' => $user->branch,
            'role' => $user->role,
            'permissions' => $user->accessPermissions(),
            'effective_permissions' => $user->accessPermissions(),
            'mfa_enabled' => $this->mfaIsEnabled($user),
            'mfa_enabled_at' => $user->mfa_enabled_at?->toISOString(),
            'locked_until' => $user->locked_until?->toISOString(),
            'password_changed_at' => $user->password_changed_at?->toISOString(),
            'must_change_password' => (bool) $user->must_change_password,
            'platform_mfa_required' => $this->requiresPlatformMfa($user),
        ];
    }

    private function passwordRule(): Password
    {
        return Password::min(14)->letters()->mixedCase()->numbers()->symbols();
    }

    private function tokenExpiresAt(): ?Carbon
    {
        $minutes = (int) config('security.tokens.web_token_lifetime_minutes', 240);

        return $minutes > 0 ? now()->addMinutes($minutes) : null;
    }

    private function issueWebToken(User $user): string
    {
        if ((bool) config('security.auth.revoke_other_web_tokens_on_login', true)) {
            $this->revokeWebTokens($user);
        }

        return $user->createToken('navkwabuild-web', ['*'], $this->tokenExpiresAt())->plainTextToken;
    }

    private function mfaIsEnabled(User $user): bool
    {
        return filled($user->mfa_secret) && filled($user->mfa_enabled_at);
    }

    private function requiresPlatformMfa(User $user): bool
    {
        return (bool) config('security.auth.require_mfa_for_platform_admins', false)
            && $user->hasPermission('platform.manage');
    }

    private function createMfaChallenge(User $user, Request $request): array
    {
        $token = Str::random(64);
        $expiresAt = now()->addMinutes((int) config('security.auth.mfa_challenge_minutes', 5));
        Cache::put($this->mfaChallengeCacheKey($token), [
            'user_id' => $user->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ], $expiresAt);

        return [
            'token' => $token,
            'expires_at' => $expiresAt,
        ];
    }

    private function mfaChallengeCacheKey(string $token): string
    {
        return 'auth:mfa-challenge:'.hash('sha256', $token);
    }

    private function userIsLocked(User $user): bool
    {
        return $user->locked_until !== null && $user->locked_until->isFuture();
    }

    private function recordFailedLogin(Request $request, User $user, string $reason): void
    {
        $attempts = (int) $user->failed_login_attempts + 1;
        $lockThreshold = max(1, (int) config('security.auth.max_failed_login_attempts', 5));
        $lockedUntil = $attempts >= $lockThreshold
            ? now()->addMinutes((int) config('security.auth.lockout_minutes', 15))
            : null;

        $user->forceFill([
            'failed_login_attempts' => $attempts,
            'locked_until' => $lockedUntil,
        ])->save();

        $this->recordSecurityEvent(
            $request,
            $user,
            $lockedUntil ? 'account_locked_after_failed_login' : 'login_failed',
            $lockedUntil ? 'critical' : 'medium',
            $lockedUntil ? 'open' : 'resolved',
            $lockedUntil ? 'Account locked after repeated failed login attempts.' : 'A sign-in attempt failed.',
            ['reason' => $reason, 'attempts' => $attempts],
        );
    }

    private function recordSuccessfulLogin(Request $request, User $user, bool $usedMfa = false): void
    {
        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
            'failed_login_attempts' => 0,
            'locked_until' => null,
            'mfa_last_used_at' => $usedMfa ? now() : $user->mfa_last_used_at,
        ])->save();

        $this->recordSecurityEvent(
            $request,
            $user,
            $usedMfa ? 'login_succeeded_with_mfa' : 'login_succeeded',
            'low',
            'resolved',
            'A user signed in successfully.',
        );
    }

    private function assertCurrentPassword(User $user, string $password): void
    {
        if (! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Your current password is incorrect.'],
            ]);
        }
    }

    private function ensureUserCanSignIn(User $user): void
    {
        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => ['This user account is not active.'],
            ]);
        }

        if (! $user->company || in_array($user->company->status, ['inactive', 'suspended', 'cancelled', 'archived'], true)) {
            throw ValidationException::withMessages([
                'email' => ['This company account is not active.'],
            ]);
        }
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

    private function revokeWebTokens(User $user): void
    {
        $user->tokens()->where('name', 'navkwabuild-web')->delete();
    }

    private function mfaPayload(User $user): array
    {
        return [
            'enabled' => $this->mfaIsEnabled($user),
            'enabled_at' => $user->mfa_enabled_at?->toISOString(),
            'last_used_at' => $user->mfa_last_used_at?->toISOString(),
            'recovery_codes_remaining' => count($user->mfa_recovery_codes ?? []),
        ];
    }

    private function recordSecurityEvent(Request $request, User $user, string $eventType, string $severity, string $status, string $description, array $metadata = []): void
    {
        if (! Schema::hasTable('platform_security_events')) {
            return;
        }

        PlatformSecurityEvent::query()->create([
            'company_id' => $user->company_id,
            'user_id' => $user->id,
            'event_type' => $eventType,
            'severity' => $severity,
            'status' => $status,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'description' => $description,
            'metadata' => $metadata,
        ]);
    }

    private function defaultRoles(): array
    {
        return [
            [
                'name' => 'Project Director',
                'slug' => 'project-director',
                'permissions' => ['projects.manage', 'procurement.approve', 'documents.manage', 'field.manage', 'attendance.manage', 'equipment.manage', 'quality.manage', 'safety.manage', 'portals.manage', 'bi.manage', 'automation.manage', 'reports.view'],
                'is_system' => true,
            ],
            [
                'name' => 'Procurement Manager',
                'slug' => 'procurement-manager',
                'permissions' => ['procurement.manage', 'inventory.manage', 'suppliers.manage', 'equipment.manage', 'documents.manage', 'reports.view'],
                'is_system' => true,
            ],
            [
                'name' => 'Site Engineer',
                'slug' => 'site-engineer',
                'permissions' => ['projects.manage', 'documents.manage', 'field.manage', 'attendance.manage', 'inventory.manage', 'equipment.manage', 'quality.manage', 'safety.manage', 'reports.view'],
                'is_system' => true,
            ],
            [
                'name' => 'Finance',
                'slug' => 'finance',
                'permissions' => ['finance.manage', 'payroll.manage', 'bi.manage', 'reports.view', 'procurement.approve'],
                'is_system' => true,
            ],
            [
                'name' => 'HR',
                'slug' => 'hr',
                'permissions' => ['payroll.manage', 'reports.view'],
                'is_system' => true,
            ],
            [
                'name' => 'Architect',
                'slug' => 'architect',
                'permissions' => ['documents.manage', 'reports.view'],
                'is_system' => true,
            ],
            [
                'name' => 'Sales & Estimating',
                'slug' => 'sales-estimating',
                'permissions' => ['crm.manage', 'tenders.manage', 'estimating.manage', 'reports.view'],
                'is_system' => true,
            ],
            [
                'name' => 'Quality Assurance and Health, Safety, and Environment Manager',
                'slug' => 'qhse-manager',
                'permissions' => ['quality.manage', 'safety.manage', 'field.manage', 'documents.manage', 'bi.manage', 'automation.manage', 'reports.view'],
                'is_system' => true,
            ],
        ];
    }
}
