<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'user_id',
        'portal_user_id',
        'auditable_type',
        'auditable_id',
        'action',
        'before',
        'after',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'before' => 'array',
            'after' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public static function sanitizePayload(?array $payload): ?array
    {
        if ($payload === null) {
            return null;
        }

        $sensitiveKeys = [
            'password',
            'password_confirmation',
            'current_password',
            'token',
            'access_token',
            'refresh_token',
            'plain_text_token',
            'secret',
            'client_secret',
            'api_secret',
            'api_key',
            'private_key',
            'credentials',
            'encrypted_credentials',
        ];

        $sanitized = [];
        $redactedCount = 0;

        foreach ($payload as $key => $value) {
            $normalizedKey = strtolower((string) $key);
            $isSensitive = in_array($normalizedKey, $sensitiveKeys, true)
                || str_contains($normalizedKey, 'credential')
                || str_contains($normalizedKey, 'password')
                || str_contains($normalizedKey, 'secret')
                || str_ends_with($normalizedKey, '_token');

            if ($isSensitive) {
                $redactedCount++;

                continue;
            }

            $sanitized[$key] = is_array($value) ? self::sanitizePayload($value) : $value;
        }

        if ($redactedCount > 0) {
            $sanitized['_redacted_field_count'] = $redactedCount;
        }

        return $sanitized;
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
