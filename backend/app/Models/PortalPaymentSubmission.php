<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PortalPaymentSubmission extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id', 'portal_user_id', 'project_id', 'invoice_id', 'amount', 'currency',
        'payment_method', 'transaction_reference', 'status', 'proof_path', 'notes', 'submitted_at',
    ];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'submitted_at' => 'datetime'];
    }

    public function portalUser(): BelongsTo
    {
        return $this->belongsTo(PortalUser::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
