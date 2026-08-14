<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Hidden(['password', 'remember_token', 'mfa_secret', 'mfa_recovery_codes'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'company_id',
        'branch_id',
        'role_id',
        'permissions',
        'name',
        'email',
        'phone',
        'job_title',
        'status',
        'password',
        'last_login_at',
        'last_login_ip',
        'failed_login_attempts',
        'locked_until',
        'password_changed_at',
        'must_change_password',
        'mfa_secret',
        'mfa_enabled_at',
        'mfa_recovery_codes',
        'mfa_last_used_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'locked_until' => 'datetime',
            'password_changed_at' => 'datetime',
            'must_change_password' => 'boolean',
            'mfa_secret' => 'encrypted',
            'mfa_enabled_at' => 'datetime',
            'mfa_recovery_codes' => 'encrypted:array',
            'mfa_last_used_at' => 'datetime',
            'permissions' => 'array',
            'password' => 'hashed',
        ];
    }

    protected $appends = [
        'effective_permissions',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function hasPermission(string $permission): bool
    {
        $permissions = $this->accessPermissions();

        if (str_starts_with($permission, 'platform.')) {
            return in_array('platform.*', $permissions, true) || in_array($permission, $permissions, true);
        }

        return in_array('*', $permissions, true) || in_array($permission, $permissions, true);
    }

    public function accessPermissions(): array
    {
        if (! $this->relationLoaded('role')) {
            $this->load('role');
        }

        $permissions = $this->permissions;

        if ($permissions === null) {
            $permissions = $this->role?->permissions ?? [];
        }

        return array_values(array_unique($permissions));
    }

    public function getEffectivePermissionsAttribute(): array
    {
        return $this->accessPermissions();
    }
}
