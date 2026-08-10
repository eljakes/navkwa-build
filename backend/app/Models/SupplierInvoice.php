<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SupplierInvoice extends Model
{
    use BelongsToCompany, HasFactory, SoftDeletes;

    protected $fillable = [
        'company_id', 'branch_id', 'project_id', 'supplier_id', 'purchase_order_id',
        'goods_receipt_id', 'invoice_number', 'supplier_reference', 'status',
        'invoice_date', 'due_date', 'currency', 'subtotal_amount', 'tax_amount',
        'retention_percent', 'retention_amount', 'discount_amount', 'total_amount',
        'amount_paid', 'balance_due', 'submitted_by', 'approved_by', 'approved_at',
        'paid_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
            'due_date' => 'date',
            'approved_at' => 'datetime',
            'paid_at' => 'datetime',
            'subtotal_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'retention_percent' => 'decimal:2',
            'retention_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'balance_due' => 'decimal:2',
        ];
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SupplierPayment::class);
    }

    public function retentions(): HasMany
    {
        return $this->hasMany(FinanceRetention::class);
    }
}
