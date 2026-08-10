<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use BelongsToCompany, HasFactory, SoftDeletes;

    protected $fillable = [
        'company_id',
        'branch_id',
        'client_id',
        'code',
        'name',
        'description',
        'status',
        'health_status',
        'risk_level',
        'site_address',
        'country',
        'currency',
        'contract_value',
        'budget_total',
        'committed_total',
        'actual_cost',
        'forecast_to_complete',
        'progress_percent',
        'start_date',
        'target_end_date',
        'actual_end_date',
        'metadata',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'contract_value' => 'decimal:2',
            'budget_total' => 'decimal:2',
            'committed_total' => 'decimal:2',
            'actual_cost' => 'decimal:2',
            'forecast_to_complete' => 'decimal:2',
            'start_date' => 'date',
            'target_end_date' => 'date',
            'actual_end_date' => 'date',
            'metadata' => 'array',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(ProjectTask::class);
    }

    public function budgetLines(): HasMany
    {
        return $this->hasMany(BudgetLine::class);
    }

    public function financeCostCenter(): HasOne
    {
        return $this->hasOne(FinanceCostCenter::class);
    }

    public function purchaseRequisitions(): HasMany
    {
        return $this->hasMany(PurchaseRequisition::class);
    }

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function procurementRfqs(): HasMany
    {
        return $this->hasMany(ProcurementRfq::class);
    }

    public function goodsReceipts(): HasMany
    {
        return $this->hasMany(GoodsReceipt::class);
    }

    public function supplierInvoices(): HasMany
    {
        return $this->hasMany(SupplierInvoice::class);
    }

    public function supplierContracts(): HasMany
    {
        return $this->hasMany(SupplierContract::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function drawings(): HasMany
    {
        return $this->hasMany(Drawing::class);
    }

    public function fieldDailyReports(): HasMany
    {
        return $this->hasMany(FieldDailyReport::class);
    }

    public function fieldIssues(): HasMany
    {
        return $this->hasMany(FieldIssue::class);
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(Inspection::class);
    }

    public function nonConformanceReports(): HasMany
    {
        return $this->hasMany(NonConformanceReport::class);
    }

    public function safetyIncidents(): HasMany
    {
        return $this->hasMany(SafetyIncident::class);
    }

    public function safetyObservations(): HasMany
    {
        return $this->hasMany(SafetyObservation::class);
    }

    public function toolboxTalks(): HasMany
    {
        return $this->hasMany(ToolboxTalk::class);
    }

    public function workPermits(): HasMany
    {
        return $this->hasMany(WorkPermit::class);
    }

    public function clientApprovals(): HasMany
    {
        return $this->hasMany(ClientApproval::class);
    }

    public function consultantSubmittals(): HasMany
    {
        return $this->hasMany(ConsultantSubmittal::class);
    }

    public function portalWorkItems(): HasMany
    {
        return $this->hasMany(PortalWorkItem::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function equipmentAssignments(): HasMany
    {
        return $this->hasMany(EquipmentAssignment::class);
    }

    public function equipmentAssets(): HasMany
    {
        return $this->hasMany(EquipmentAsset::class, 'current_project_id');
    }

    public function fuelLogs(): HasMany
    {
        return $this->hasMany(FuelLog::class);
    }

    public function workforceAllocations(): HasMany
    {
        return $this->hasMany(WorkforceAllocation::class);
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }

    public function workforceTimesheets(): HasMany
    {
        return $this->hasMany(WorkforceTimesheet::class);
    }
}
