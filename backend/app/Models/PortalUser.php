<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class PortalUser extends Authenticatable
{
    use BelongsToCompany, HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'company_id', 'client_id', 'supplier_id', 'user_type', 'name', 'email', 'phone',
        'organization', 'status', 'password', 'invitation_token_hash', 'invitation_expires_at',
        'invitation_accepted_at', 'last_login_at', 'failed_login_attempts', 'locked_until',
        'last_login_ip', 'mfa_secret', 'mfa_enabled_at', 'mfa_recovery_codes',
        'mfa_last_used_at', 'invited_by',
    ];

    protected $hidden = ['password', 'invitation_token_hash', 'mfa_secret', 'mfa_recovery_codes'];

    protected function casts(): array
    {
        return [
            'last_login_at' => 'datetime',
            'invitation_expires_at' => 'datetime',
            'invitation_accepted_at' => 'datetime',
            'locked_until' => 'datetime',
            'password' => 'hashed',
            'mfa_secret' => 'encrypted',
            'mfa_enabled_at' => 'datetime',
            'mfa_recovery_codes' => 'encrypted:array',
            'mfa_last_used_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function accesses(): HasMany
    {
        return $this->hasMany(PortalAccess::class);
    }

    public function clientApprovals(): HasMany
    {
        return $this->hasMany(ClientApproval::class);
    }

    public function consultantSubmittals(): HasMany
    {
        return $this->hasMany(ConsultantSubmittal::class);
    }

    public function workItems(): HasMany
    {
        return $this->hasMany(PortalWorkItem::class);
    }
}
