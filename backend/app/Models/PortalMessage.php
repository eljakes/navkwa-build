<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PortalMessage extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'portal_user_id', 'project_id', 'user_id', 'subject', 'message', 'attachments', 'read_at'];

    protected function casts(): array
    {
        return ['attachments' => 'array', 'read_at' => 'datetime'];
    }

    public function portalUser(): BelongsTo
    {
        return $this->belongsTo(PortalUser::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
