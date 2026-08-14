<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseRequisition extends Model
{
    use BelongsToCompany, HasFactory, SoftDeletes;

    protected $fillable = [
        'company_id',
        'branch_id',
        'project_id',
        'requisition_number',
        'title',
        'status',
        'approval_stage',
        'approval_workflow',
        'priority',
        'required_by',
        'total_estimated',
        'department',
        'delivery_location',
        'purpose',
        'subtotal_amount',
        'tax_amount',
        'discount_amount',
        'grand_total',
        'attachments',
        'justification',
        'requested_by_name',
        'requested_by',
        'reviewed_by',
        'reviewed_at',
        'submitted_at',
    ];

    protected $appends = [
        'approval_status_label',
        'approval_progress',
        'current_approval_step',
    ];

    protected function casts(): array
    {
        return [
            'required_by' => 'date',
            'reviewed_at' => 'datetime',
            'submitted_at' => 'datetime',
            'total_estimated' => 'decimal:2',
            'subtotal_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'attachments' => 'array',
            'approval_workflow' => 'array',
        ];
    }

    public function getApprovalStatusLabelAttribute(): string
    {
        if ($this->status === 'submitted' && $this->current_approval_step) {
            return "Pending {$this->current_approval_step['label']} Approval";
        }

        return match ($this->status) {
            'rfq_sent' => 'RFQ Sent',
            'converted' => 'Converted to PO',
            default => str($this->status ?: 'draft')->replace('_', ' ')->title()->toString(),
        };
    }

    public function getApprovalProgressAttribute(): array
    {
        $steps = collect($this->approval_workflow ?: []);
        $total = $steps->count();
        $approved = $steps->where('status', 'approved')->count();

        return [
            'approved' => $approved,
            'total' => $total,
            'label' => $total > 0 ? "{$approved}/{$total}" : '0/0',
            'percent' => $total > 0 ? round(($approved / $total) * 100) : 0,
        ];
    }

    public function getCurrentApprovalStepAttribute(): ?array
    {
        return collect($this->approval_workflow ?: [])->firstWhere('status', 'pending');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseRequisitionLine::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function rfqs(): HasMany
    {
        return $this->hasMany(ProcurementRfq::class);
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(SupplierQuotation::class);
    }

    public function purchaseOrder(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }
}
