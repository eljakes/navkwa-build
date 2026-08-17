<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\PortalUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditableObserver
{
    public function created(Model $model): void
    {
        $this->record($model, 'created', null, $model->getAttributes());
    }

    public function updated(Model $model): void
    {
        $changes = $model->getChanges();
        unset($changes['updated_at']);

        if ($changes === []) {
            return;
        }

        $before = [];
        foreach ($changes as $attribute => $value) {
            $before[$attribute] = $model->getOriginal($attribute);
        }

        $this->record($model, 'updated', $before, $changes);
    }

    public function deleted(Model $model): void
    {
        $this->record($model, 'deleted', $model->getOriginal(), null);
    }

    private function record(Model $model, string $action, ?array $before, ?array $after): void
    {
        $actor = Auth::user();
        AuditLog::query()->create([
            'company_id' => $model->getAttribute('company_id') ?? $actor?->company_id,
            'user_id' => $actor instanceof PortalUser ? null : Auth::id(),
            'portal_user_id' => $actor instanceof PortalUser ? $actor->id : null,
            'auditable_type' => $model::class,
            'auditable_id' => $model->getKey(),
            'action' => $action,
            'before' => AuditLog::sanitizePayload($before),
            'after' => AuditLog::sanitizePayload($after),
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
        ]);
    }
}
