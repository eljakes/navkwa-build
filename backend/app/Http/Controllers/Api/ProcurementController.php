<?php

namespace App\Http\Controllers\Api;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptLine;
use App\Models\ProcurementQualityInspection;
use App\Models\ProcurementRfq;
use App\Models\ProcurementRfqSupplier;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseRequisitionLine;
use App\Models\Supplier;
use App\Models\SupplierContract;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use App\Models\SupplierQuotation;
use App\Models\SupplierQuotationLine;
use App\Services\FinancePostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProcurementController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $analytics = $this->procurementAnalytics($companyId);

        return response()->json([
            'summary' => [
                'open_requisitions' => PurchaseRequisition::query()->forCompany($companyId)->whereNotIn('status', ['converted', 'rejected', 'cancelled'])->count(),
                'pending_approvals' => PurchaseRequisition::query()->forCompany($companyId)->where('status', 'submitted')->count(),
                'open_purchase_orders' => PurchaseOrder::query()->forCompany($companyId)->whereNotIn('status', ['closed', 'cancelled'])->count(),
                'awaiting_delivery' => PurchaseOrder::query()->forCompany($companyId)->whereNotIn('status', ['closed', 'cancelled'])->whereNotIn('delivery_status', ['delivered'])->count(),
                'supplier_invoices' => SupplierInvoice::query()->forCompany($companyId)->whereNotIn('status', ['paid', 'rejected'])->count(),
                'month_spend' => (float) SupplierPayment::query()->forCompany($companyId)->whereBetween('payment_date', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])->sum('amount'),
                'average_approval_time_days' => $analytics['average_approval_time_days'],
                'supplier_performance' => $analytics['supplier_performance'],
                'on_time_delivery' => $analytics['on_time_delivery'],
                'pending_payments' => $analytics['pending_payments'],
            ],
            'analytics' => $analytics,
            'recent_activity' => $this->recentActivity($companyId),
            'requisitions' => $this->requisitionQuery($companyId)->latest()->limit(120)->get()->map(fn (PurchaseRequisition $requisition) => $this->decorateRequisition($requisition))->values(),
            'rfqs' => ProcurementRfq::query()->forCompany($companyId)->with(['project:id,code,name', 'requisition:id,requisition_number,title', 'suppliers.supplier:id,name,email', 'quotations.supplier:id,name'])->latest()->limit(120)->get(),
            'quotations' => SupplierQuotation::query()->forCompany($companyId)->with(['rfq:id,rfq_number,title', 'requisition:id,requisition_number,title', 'supplier:id,name', 'lines', 'purchaseOrder:id,supplier_quotation_id,po_number,status'])->latest()->limit(120)->get(),
            'purchase_orders' => $this->purchaseOrderQuery($companyId)->latest()->limit(120)->get(),
            'goods_receipts' => GoodsReceipt::query()->forCompany($companyId)->with(['purchaseOrder:id,po_number,status,total_amount', 'project:id,code,name', 'supplier:id,name', 'lines', 'qualityInspections'])->latest()->limit(120)->get(),
            'quality_inspections' => ProcurementQualityInspection::query()->forCompany($companyId)->with(['goodsReceipt:id,grn_number,status', 'purchaseOrder:id,po_number', 'project:id,code,name'])->latest()->limit(120)->get(),
            'supplier_invoices' => SupplierInvoice::query()->forCompany($companyId)->with(['supplier:id,name', 'purchaseOrder:id,po_number,total_amount,payment_status', 'goodsReceipt:id,grn_number', 'payments'])->latest()->limit(120)->get(),
            'payments' => SupplierPayment::query()->forCompany($companyId)->with(['invoice:id,invoice_number,supplier_id,total_amount,balance_due', 'invoice.supplier:id,name'])->latest()->limit(120)->get(),
            'contracts' => SupplierContract::query()->forCompany($companyId)->with(['supplier:id,name', 'project:id,code,name'])->latest()->limit(120)->get(),
            'supplier_profiles' => $this->supplierProfiles($companyId),
            'traceability' => $this->traceability($companyId),
            'reports' => [
                'rfq_count' => ProcurementRfq::query()->forCompany($companyId)->count(),
                'quotation_count' => SupplierQuotation::query()->forCompany($companyId)->count(),
                'grn_count' => GoodsReceipt::query()->forCompany($companyId)->count(),
                'invoice_balance' => (float) SupplierInvoice::query()->forCompany($companyId)->sum('balance_due'),
            ],
            'settings' => [
                'approval_thresholds' => $this->user($request)->company?->settings['approval_thresholds'] ?? [],
                'base_currency' => $this->user($request)->company?->default_currency ?? 'GHS',
            ],
        ]);
    }

    public function requisitions(Request $request): JsonResponse
    {
        $items = $this->requisitionQuery($this->companyId($request))
            ->when($request->query('project_id'), fn ($query, $projectId) => $query->where('project_id', $projectId))
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate((int) $request->query('per_page', 25));

        $items->getCollection()->transform(fn (PurchaseRequisition $requisition) => $this->decorateRequisition($requisition));

        return response()->json($items);
    }

    public function storeRequisition(Request $request, int $project): JsonResponse
    {
        $projectModel = $this->projectForTenant($request, $project);
        $this->mergeJsonLines($request);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'department' => ['required', 'string', 'max:120'],
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'purpose' => ['nullable', 'string', 'max:4000'],
            'requested_by_name' => ['required', 'string', 'max:255'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'medium', 'high', 'urgent', 'critical'])],
            'required_by' => ['nullable', 'date'],
            'justification' => ['nullable', 'string', 'max:4000'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.supplier_id' => ['nullable', 'integer'],
            'lines.*.item_name' => ['nullable', 'string', 'max:120'],
            'lines.*.description' => ['required', 'string', 'max:255'],
            'lines.*.cost_code' => ['nullable', 'string', 'max:40'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'lines.*.unit' => ['nullable', 'string', 'max:24'],
            'lines.*.estimated_unit_cost' => ['required', 'numeric', 'min:0'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'drawings.*' => ['nullable', 'file', 'max:20480'],
            'boq.*' => ['nullable', 'file', 'max:20480'],
            'specifications.*' => ['nullable', 'file', 'max:20480'],
        ]);

        $requisition = DB::transaction(function () use ($request, $projectModel, $data) {
            $requisition = PurchaseRequisition::query()->create([
                'company_id' => $projectModel->company_id,
                'branch_id' => $projectModel->branch_id,
                'project_id' => $projectModel->id,
                'requisition_number' => $this->nextNumber('MR', PurchaseRequisition::class, 'requisition_number', $projectModel->company_id),
                'title' => $data['title'],
                'department' => $data['department'],
                'delivery_location' => $data['delivery_location'] ?? null,
                'purpose' => $data['purpose'] ?? $data['justification'] ?? null,
                'priority' => $this->normalizePriority($data['priority'] ?? 'medium'),
                'approval_workflow' => $this->approvalWorkflowTemplate('waiting'),
                'required_by' => $data['required_by'] ?? null,
                'justification' => $data['justification'] ?? null,
                'discount_amount' => $data['discount_amount'] ?? 0,
                'attachments' => $this->storeRequisitionAttachments($request, $projectModel->company_id),
                'requested_by_name' => $data['requested_by_name'],
                'requested_by' => $this->user($request)->id,
            ]);

            foreach ($data['lines'] as $line) {
                if (! empty($line['supplier_id'])) {
                    Supplier::query()->forCompany($projectModel->company_id)->whereKey($line['supplier_id'])->firstOrFail();
                }

                $amounts = $this->lineAmounts($line, 'estimated_unit_cost');

                PurchaseRequisitionLine::query()->create([
                    'company_id' => $projectModel->company_id,
                    'purchase_requisition_id' => $requisition->id,
                    'supplier_id' => $line['supplier_id'] ?? null,
                    'item_name' => $line['item_name'] ?? null,
                    'description' => $line['description'],
                    'cost_code' => $this->lineCostCode($line['cost_code'] ?? null, $line['item_name'] ?? $line['description'], PurchaseRequisitionLine::class, $projectModel->company_id),
                    'quantity' => $amounts['quantity'],
                    'unit' => $line['unit'] ?? 'each',
                    'estimated_unit_cost' => $amounts['unit_cost'],
                    'estimated_total' => $amounts['line_total'],
                    'tax_rate' => $amounts['tax_rate'],
                    'tax_amount' => $amounts['tax_amount'],
                    'discount_amount' => $amounts['discount_amount'],
                    'line_total' => $amounts['line_total'],
                ]);
            }

            $this->syncRequisitionTotals($requisition);

            return $requisition;
        });

        return response()->json(['requisition' => $this->decorateRequisition($requisition->load(['project', 'lines', 'requestedBy']))], 201);
    }

    public function updateRequisition(Request $request, PurchaseRequisition $requisition): JsonResponse
    {
        $this->assertRequisitionTenant($request, $requisition);
        abort_if(! in_array($requisition->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected requisitions can be edited.');
        $this->mergeJsonLines($request);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'department' => ['sometimes', 'required', 'string', 'max:120'],
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'purpose' => ['nullable', 'string', 'max:4000'],
            'requested_by_name' => ['sometimes', 'required', 'string', 'max:255'],
            'priority' => ['sometimes', Rule::in(['low', 'normal', 'medium', 'high', 'urgent', 'critical'])],
            'required_by' => ['nullable', 'date'],
            'justification' => ['nullable', 'string', 'max:4000'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'lines' => ['sometimes', 'array', 'min:1'],
            'lines.*.supplier_id' => ['nullable', 'integer'],
            'lines.*.item_name' => ['nullable', 'string', 'max:120'],
            'lines.*.description' => ['required_with:lines', 'string', 'max:255'],
            'lines.*.cost_code' => ['nullable', 'string', 'max:40'],
            'lines.*.quantity' => ['required_with:lines', 'numeric', 'min:0.01'],
            'lines.*.unit' => ['nullable', 'string', 'max:24'],
            'lines.*.estimated_unit_cost' => ['required_with:lines', 'numeric', 'min:0'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($requisition, $data): void {
            if (isset($data['priority'])) {
                $data['priority'] = $this->normalizePriority($data['priority']);
            }

            $requisition->update(collect($data)->except('lines')->all());

            if (array_key_exists('lines', $data)) {
                $requisition->lines()->delete();

                foreach ($data['lines'] as $line) {
                    $amounts = $this->lineAmounts($line, 'estimated_unit_cost');

                    PurchaseRequisitionLine::query()->create([
                        'company_id' => $requisition->company_id,
                        'purchase_requisition_id' => $requisition->id,
                        'supplier_id' => $line['supplier_id'] ?? null,
                        'item_name' => $line['item_name'] ?? null,
                        'description' => $line['description'],
                        'cost_code' => $this->lineCostCode($line['cost_code'] ?? null, $line['item_name'] ?? $line['description'], PurchaseRequisitionLine::class, $requisition->company_id),
                        'quantity' => $amounts['quantity'],
                        'unit' => $line['unit'] ?? 'each',
                        'estimated_unit_cost' => $amounts['unit_cost'],
                        'estimated_total' => $amounts['line_total'],
                        'tax_rate' => $amounts['tax_rate'],
                        'tax_amount' => $amounts['tax_amount'],
                        'discount_amount' => $amounts['discount_amount'],
                        'line_total' => $amounts['line_total'],
                    ]);
                }
            }

            $this->syncRequisitionTotals($requisition);
        });

        return response()->json(['requisition' => $this->decorateRequisition($requisition->fresh(['project', 'lines', 'requestedBy']))]);
    }

    public function destroyRequisition(Request $request, PurchaseRequisition $requisition): JsonResponse
    {
        $this->assertRequisitionTenant($request, $requisition);
        abort_if(! in_array($requisition->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected requisitions can be archived.');

        $requisition->delete();

        return response()->json(['message' => 'Material request archived.']);
    }

    public function submitRequisition(Request $request, PurchaseRequisition $requisition): JsonResponse
    {
        $this->assertRequisitionTenant($request, $requisition);
        abort_if(! in_array($requisition->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected requisitions can be submitted.');
        abort_if($requisition->lines()->count() === 0, 422, 'A requisition needs at least one line before submission.');

        $workflow = $this->approvalWorkflowTemplate('waiting');
        $workflow[0]['status'] = 'pending';

        $requisition->update([
            'status' => 'submitted',
            'approval_stage' => $workflow[0]['key'],
            'approval_workflow' => $workflow,
            'submitted_at' => now(),
        ]);

        $this->publishAutomationEvent($request, 'material_request_submitted', [
            'record_type' => 'material_request',
            'record_id' => $requisition->id,
        ]);

        return response()->json(['requisition' => $this->decorateRequisition($requisition->fresh(['project', 'lines', 'requestedBy']))]);
    }

    public function reviewRequisition(Request $request, PurchaseRequisition $requisition): JsonResponse
    {
        $this->assertRequisitionTenant($request, $requisition);

        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
        ]);

        abort_if($requisition->status !== 'submitted', 422, 'Only submitted requisitions can be reviewed.');

        DB::transaction(function () use ($request, $requisition, $data): void {
            $workflow = $this->approvalWorkflow($requisition);
            $currentIndex = collect($workflow)->search(fn (array $step) => ($step['status'] ?? null) === 'pending');

            abort_if($currentIndex === false, 422, 'This requisition is not awaiting approval.');

            if ($data['decision'] === 'rejected') {
                $workflow[$currentIndex]['status'] = 'rejected';
                $workflow[$currentIndex]['acted_by'] = $this->user($request)->name;
                $workflow[$currentIndex]['acted_by_id'] = $this->user($request)->id;
                $workflow[$currentIndex]['acted_at'] = now()->toISOString();

                $requisition->update([
                    'status' => 'rejected',
                    'approval_workflow' => $workflow,
                    'approval_stage' => $workflow[$currentIndex]['key'],
                    'reviewed_by' => $this->user($request)->id,
                    'reviewed_at' => now(),
                ]);

                return;
            }

            $workflow[$currentIndex]['status'] = 'approved';
            $workflow[$currentIndex]['acted_by'] = $this->user($request)->name;
            $workflow[$currentIndex]['acted_by_id'] = $this->user($request)->id;
            $workflow[$currentIndex]['acted_at'] = now()->toISOString();

            $nextIndex = $currentIndex + 1;
            $updates = [
                'approval_workflow' => $workflow,
                'reviewed_by' => $this->user($request)->id,
                'reviewed_at' => now(),
            ];

            if (array_key_exists($nextIndex, $workflow)) {
                $workflow[$nextIndex]['status'] = 'pending';
                $updates['status'] = 'submitted';
                $updates['approval_stage'] = $workflow[$nextIndex]['key'];
                $updates['approval_workflow'] = $workflow;
            } else {
                $updates['status'] = 'approved';
                $updates['approval_stage'] = 'completed';
            }

            $requisition->update($updates);
        });

        return response()->json(['requisition' => $this->decorateRequisition($requisition->fresh(['project', 'lines', 'requestedBy']))]);
    }

    public function storeRfq(Request $request, PurchaseRequisition $requisition): JsonResponse
    {
        $this->assertRequisitionTenant($request, $requisition);
        abort_if(! in_array($requisition->status, ['approved', 'rfq_sent'], true), 422, 'Only approved requisitions can proceed to RFQ.');

        $data = $request->validate([
            'supplier_ids' => ['required', 'array', 'min:1'],
            'supplier_ids.*' => ['required', 'integer'],
            'closing_date' => ['nullable', 'date'],
            'terms' => ['nullable', 'string', 'max:4000'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $supplierIds = Supplier::query()
            ->forCompany($requisition->company_id)
            ->whereIn('id', $data['supplier_ids'])
            ->pluck('id')
            ->all();

        abort_if(count($supplierIds) !== count(array_unique($data['supplier_ids'])), 422, 'One or more suppliers are invalid.');

        $rfq = DB::transaction(function () use ($request, $requisition, $data, $supplierIds) {
            $rfq = ProcurementRfq::query()->create([
                'company_id' => $requisition->company_id,
                'branch_id' => $requisition->branch_id,
                'project_id' => $requisition->project_id,
                'purchase_requisition_id' => $requisition->id,
                'rfq_number' => $this->nextNumber('RFQ', ProcurementRfq::class, 'rfq_number', $requisition->company_id),
                'title' => $requisition->title,
                'status' => 'sent',
                'issue_date' => now()->toDateString(),
                'closing_date' => $data['closing_date'] ?? null,
                'terms' => $data['terms'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $this->user($request)->id,
                'sent_at' => now(),
            ]);

            foreach ($supplierIds as $supplierId) {
                ProcurementRfqSupplier::query()->create([
                    'company_id' => $requisition->company_id,
                    'procurement_rfq_id' => $rfq->id,
                    'supplier_id' => $supplierId,
                    'status' => 'sent',
                    'sent_at' => now(),
                ]);
            }

            $requisition->update(['status' => 'rfq_sent']);

            return $rfq;
        });

        return response()->json(['rfq' => $rfq->load(['requisition', 'suppliers.supplier', 'quotations'])], 201);
    }

    public function storeSupplierQuotation(Request $request, ProcurementRfq $rfq): JsonResponse
    {
        $this->assertRfqTenant($request, $rfq);
        $this->mergeJsonLines($request);

        $data = $request->validate([
            'supplier_id' => ['required', 'integer'],
            'supplier_reference' => ['nullable', 'string', 'max:120'],
            'quote_date' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date'],
            'lead_time_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'warranty_included' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.item_name' => ['nullable', 'string', 'max:120'],
            'lines.*.description' => ['required', 'string', 'max:255'],
            'lines.*.cost_code' => ['nullable', 'string', 'max:40'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'lines.*.unit' => ['nullable', 'string', 'max:24'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $rfqSupplier = ProcurementRfqSupplier::query()
            ->where('procurement_rfq_id', $rfq->id)
            ->where('supplier_id', $data['supplier_id'])
            ->firstOrFail();

        $quotation = DB::transaction(function () use ($request, $rfq, $rfqSupplier, $data) {
            $quotation = SupplierQuotation::query()->create([
                'company_id' => $rfq->company_id,
                'procurement_rfq_id' => $rfq->id,
                'purchase_requisition_id' => $rfq->purchase_requisition_id,
                'supplier_id' => $data['supplier_id'],
                'quotation_number' => $this->nextNumber('QT', SupplierQuotation::class, 'quotation_number', $rfq->company_id),
                'supplier_reference' => $data['supplier_reference'] ?? null,
                'status' => 'submitted',
                'quote_date' => $data['quote_date'] ?? now()->toDateString(),
                'valid_until' => $data['valid_until'] ?? null,
                'currency' => $rfq->requisition?->project?->currency ?? $this->user($request)->company->default_currency,
                'lead_time_days' => $data['lead_time_days'] ?? 7,
                'payment_terms' => $data['payment_terms'] ?? null,
                'warranty_included' => (bool) ($data['warranty_included'] ?? false),
                'notes' => $data['notes'] ?? null,
                'submitted_by' => $this->user($request)->id,
            ]);

            foreach ($data['lines'] as $line) {
                $amounts = $this->lineAmounts($line, 'unit_price');

                SupplierQuotationLine::query()->create([
                    'company_id' => $rfq->company_id,
                    'supplier_quotation_id' => $quotation->id,
                    'item_name' => $line['item_name'] ?? null,
                    'description' => $line['description'],
                    'cost_code' => $this->lineCostCode($line['cost_code'] ?? null, $line['item_name'] ?? $line['description'], SupplierQuotationLine::class, $rfq->company_id),
                    'quantity' => $amounts['quantity'],
                    'unit' => $line['unit'] ?? 'each',
                    'unit_price' => $amounts['unit_cost'],
                    'tax_rate' => $amounts['tax_rate'],
                    'tax_amount' => $amounts['tax_amount'],
                    'discount_amount' => $amounts['discount_amount'],
                    'line_total' => $amounts['line_total'],
                ]);
            }

            $this->syncQuotationTotals($quotation);
            $rfqSupplier->update(['status' => 'responded', 'responded_at' => now()]);
            $rfq->update(['status' => 'quotations_received']);

            return $quotation;
        });

        $this->updateQuotationScores($rfq->id);

        $this->publishAutomationEvent($request, 'supplier_quotation_submitted', [
            'record_type' => 'supplier_quotation',
            'record_id' => $quotation->id,
        ]);

        return response()->json(['quotation' => $quotation->fresh(['rfq', 'supplier', 'lines'])], 201);
    }

    public function acceptQuotation(Request $request, SupplierQuotation $quotation): JsonResponse
    {
        $this->assertQuotationTenant($request, $quotation);

        DB::transaction(function () use ($quotation): void {
            SupplierQuotation::query()
                ->where('procurement_rfq_id', $quotation->procurement_rfq_id)
                ->where('id', '!=', $quotation->id)
                ->update(['status' => 'rejected']);

            $quotation->update(['status' => 'accepted', 'accepted_at' => now()]);
            $quotation->rfq?->update(['status' => 'awarded']);
        });

        $this->updateQuotationScores((int) $quotation->procurement_rfq_id);

        return response()->json(['quotation' => $quotation->fresh(['rfq', 'supplier', 'lines'])]);
    }

    public function createPurchaseOrderFromQuotation(Request $request, SupplierQuotation $quotation): JsonResponse
    {
        $this->assertQuotationTenant($request, $quotation);
        abort_if($quotation->status !== 'accepted', 422, 'Only accepted quotations can become purchase orders.');
        abort_if($quotation->purchaseOrder()->exists(), 422, 'This quotation already has a purchase order.');

        $requisition = $quotation->requisition;
        $project = $requisition?->project ?? $quotation->rfq?->project;
        abort_if(! $project, 422, 'Quotation is not linked to a project.');

        $purchaseOrder = DB::transaction(function () use ($request, $quotation, $requisition, $project) {
            $purchaseOrder = PurchaseOrder::query()->create([
                'company_id' => $quotation->company_id,
                'branch_id' => $project->branch_id,
                'project_id' => $project->id,
                'supplier_id' => $quotation->supplier_id,
                'purchase_requisition_id' => $requisition?->id,
                'supplier_quotation_id' => $quotation->id,
                'po_number' => $this->nextNumber('PO', PurchaseOrder::class, 'po_number', $quotation->company_id),
                'currency' => $quotation->currency,
                'issue_date' => now()->toDateString(),
                'expected_delivery_date' => now()->addDays((int) $quotation->lead_time_days)->toDateString(),
                'tax_amount' => $quotation->tax_amount,
                'terms' => $quotation->payment_terms,
                'created_by' => $this->user($request)->id,
            ]);

            foreach ($quotation->lines as $line) {
                $this->createPurchaseOrderLine($purchaseOrder, [
                    'description' => $line->description,
                    'cost_code' => $line->cost_code,
                    'quantity' => $line->quantity,
                    'unit' => $line->unit,
                    'unit_cost' => $line->unit_price,
                ]);
            }

            $this->syncPurchaseOrderTotals($purchaseOrder);
            $requisition?->update(['status' => 'converted']);

            return $purchaseOrder;
        });

        $this->syncProjectCosts($project);

        return response()->json(['purchase_order' => $purchaseOrder->load(['supplier', 'project', 'lines', 'quotation'])], 201);
    }

    public function purchaseOrders(Request $request): JsonResponse
    {
        $items = $this->purchaseOrderQuery($this->companyId($request))
            ->when($request->query('project_id'), fn ($query, $projectId) => $query->where('project_id', $projectId))
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate((int) $request->query('per_page', 25));

        return response()->json($items);
    }

    public function storePurchaseOrder(Request $request, int $project): JsonResponse
    {
        $projectModel = $this->projectForTenant($request, $project);
        $this->mergeJsonLines($request);

        $data = $request->validate([
            'supplier_id' => ['required', 'integer'],
            'purchase_requisition_id' => ['nullable', 'integer'],
            'issue_date' => ['nullable', 'date'],
            'expected_delivery_date' => ['nullable', 'date'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'terms' => ['nullable', 'string', 'max:4000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.description' => ['required', 'string', 'max:255'],
            'lines.*.cost_code' => ['nullable', 'string', 'max:40'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'lines.*.unit' => ['nullable', 'string', 'max:24'],
            'lines.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ]);

        $supplier = Supplier::query()->forCompany($projectModel->company_id)->whereKey($data['supplier_id'])->firstOrFail();

        if (! empty($data['purchase_requisition_id'])) {
            PurchaseRequisition::query()
                ->forCompany($projectModel->company_id)
                ->where('project_id', $projectModel->id)
                ->whereIn('status', ['approved', 'rfq_sent'])
                ->whereKey($data['purchase_requisition_id'])
                ->firstOrFail();
        }

        $purchaseOrder = DB::transaction(function () use ($request, $projectModel, $supplier, $data) {
            $purchaseOrder = PurchaseOrder::query()->create([
                'company_id' => $projectModel->company_id,
                'branch_id' => $projectModel->branch_id,
                'project_id' => $projectModel->id,
                'supplier_id' => $supplier->id,
                'purchase_requisition_id' => $data['purchase_requisition_id'] ?? null,
                'po_number' => $this->nextNumber('PO', PurchaseOrder::class, 'po_number', $projectModel->company_id),
                'currency' => $projectModel->currency,
                'issue_date' => $data['issue_date'] ?? now()->toDateString(),
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'tax_amount' => $data['tax_amount'] ?? 0,
                'terms' => $data['terms'] ?? null,
                'created_by' => $this->user($request)->id,
            ]);

            foreach ($data['lines'] as $line) {
                $this->createPurchaseOrderLine($purchaseOrder, $line);
            }

            $this->syncPurchaseOrderTotals($purchaseOrder);

            return $purchaseOrder;
        });

        $this->syncProjectCosts($projectModel);

        return response()->json(['purchase_order' => $purchaseOrder->load(['supplier', 'project', 'lines'])], 201);
    }

    public function convertToPurchaseOrder(Request $request, PurchaseRequisition $requisition): JsonResponse
    {
        $this->assertRequisitionTenant($request, $requisition);
        abort_if(! in_array($requisition->status, ['approved', 'rfq_sent'], true), 422, 'Only approved requisitions can be converted to purchase orders.');

        $data = $request->validate([
            'supplier_id' => ['required', 'integer'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'terms' => ['nullable', 'string', 'max:4000'],
        ]);

        $supplier = Supplier::query()->forCompany($requisition->company_id)->whereKey($data['supplier_id'])->firstOrFail();
        $project = $requisition->project;

        $purchaseOrder = DB::transaction(function () use ($request, $requisition, $project, $supplier, $data) {
            $purchaseOrder = PurchaseOrder::query()->create([
                'company_id' => $project->company_id,
                'branch_id' => $project->branch_id,
                'project_id' => $project->id,
                'supplier_id' => $supplier->id,
                'purchase_requisition_id' => $requisition->id,
                'po_number' => $this->nextNumber('PO', PurchaseOrder::class, 'po_number', $project->company_id),
                'currency' => $project->currency,
                'issue_date' => now()->toDateString(),
                'tax_amount' => $data['tax_amount'] ?? 0,
                'terms' => $data['terms'] ?? null,
                'created_by' => $this->user($request)->id,
            ]);

            foreach ($requisition->lines as $line) {
                $this->createPurchaseOrderLine($purchaseOrder, [
                    'description' => $line->description,
                    'cost_code' => $line->cost_code,
                    'quantity' => $line->quantity,
                    'unit' => $line->unit,
                    'unit_cost' => $line->estimated_unit_cost,
                ]);
            }

            $this->syncPurchaseOrderTotals($purchaseOrder);
            $requisition->update(['status' => 'converted']);

            return $purchaseOrder;
        });

        $this->syncProjectCosts($project);

        return response()->json(['purchase_order' => $purchaseOrder->load(['supplier', 'project', 'lines'])], 201);
    }

    public function transitionPurchaseOrder(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertPurchaseOrderTenant($request, $purchaseOrder);

        $data = $request->validate([
            'status' => ['required', Rule::in(['issued', 'approved', 'delivered', 'closed', 'cancelled'])],
        ]);

        $allowed = [
            'draft' => ['issued', 'cancelled'],
            'issued' => ['approved', 'cancelled'],
            'approved' => ['delivered', 'cancelled'],
            'delivered' => ['closed'],
            'closed' => [],
            'cancelled' => [],
        ];

        abort_if(! in_array($data['status'], $allowed[$purchaseOrder->status] ?? [], true), 422, 'Invalid purchase order status transition.');

        $updates = ['status' => $data['status']];

        if ($data['status'] === 'approved') {
            $updates['approved_by'] = $this->user($request)->id;
            $updates['approved_at'] = now();
        }

        if ($data['status'] === 'delivered') {
            $updates['delivery_status'] = 'delivered';
        }

        $purchaseOrder->update($updates);
        $this->syncProjectCosts($purchaseOrder->project);

        if ($data['status'] === 'approved') {
            $this->publishAutomationEvent($request, 'purchase_order_approved', [
                'record_type' => 'purchase_order',
                'record_id' => $purchaseOrder->id,
            ]);
        }

        return response()->json(['purchase_order' => $purchaseOrder->fresh(['supplier', 'project', 'lines'])]);
    }

    public function storeGoodsReceipt(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertPurchaseOrderTenant($request, $purchaseOrder);
        abort_if(in_array($purchaseOrder->status, ['draft', 'cancelled'], true), 422, 'Only issued or approved purchase orders can receive goods.');
        $this->mergeJsonLines($request);

        $data = $request->validate([
            'received_date' => ['nullable', 'date'],
            'delivery_note_number' => ['nullable', 'string', 'max:120'],
            'delivered_by' => ['nullable', 'string', 'max:120'],
            'warehouse' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'lines' => ['nullable', 'array'],
            'lines.*.purchase_order_line_id' => ['nullable', 'integer'],
            'lines.*.received_quantity' => ['required_with:lines', 'numeric', 'min:0'],
            'lines.*.accepted_quantity' => ['nullable', 'numeric', 'min:0'],
            'lines.*.rejected_quantity' => ['nullable', 'numeric', 'min:0'],
            'lines.*.condition' => ['nullable', Rule::in(['pending', 'accepted', 'rejected', 'damaged', 'partial'])],
            'lines.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $goodsReceipt = DB::transaction(function () use ($request, $purchaseOrder, $data) {
            $goodsReceipt = GoodsReceipt::query()->create([
                'company_id' => $purchaseOrder->company_id,
                'branch_id' => $purchaseOrder->branch_id,
                'project_id' => $purchaseOrder->project_id,
                'purchase_order_id' => $purchaseOrder->id,
                'supplier_id' => $purchaseOrder->supplier_id,
                'grn_number' => $this->nextNumber('GRN', GoodsReceipt::class, 'grn_number', $purchaseOrder->company_id),
                'status' => 'received',
                'received_date' => $data['received_date'] ?? now()->toDateString(),
                'delivery_note_number' => $data['delivery_note_number'] ?? null,
                'delivered_by' => $data['delivered_by'] ?? null,
                'warehouse' => $data['warehouse'] ?? null,
                'received_by' => $this->user($request)->id,
                'notes' => $data['notes'] ?? null,
            ]);

            $linePayload = collect($data['lines'] ?? [])->keyBy('purchase_order_line_id');

            foreach ($purchaseOrder->lines as $poLine) {
                $payload = $linePayload->get($poLine->id, []);
                $received = (float) ($payload['received_quantity'] ?? $poLine->quantity);
                $accepted = (float) ($payload['accepted_quantity'] ?? $received);
                $rejected = (float) ($payload['rejected_quantity'] ?? 0);

                GoodsReceiptLine::query()->create([
                    'company_id' => $purchaseOrder->company_id,
                    'goods_receipt_id' => $goodsReceipt->id,
                    'purchase_order_line_id' => $poLine->id,
                    'description' => $poLine->description,
                    'ordered_quantity' => $poLine->quantity,
                    'received_quantity' => $received,
                    'accepted_quantity' => $accepted,
                    'rejected_quantity' => $rejected,
                    'unit' => $poLine->unit,
                    'condition' => $payload['condition'] ?? ($rejected > 0 ? 'partial' : 'accepted'),
                    'notes' => $payload['notes'] ?? null,
                ]);
            }

            $purchaseOrder->update(['delivery_status' => 'delivered', 'status' => $purchaseOrder->status === 'issued' ? 'delivered' : $purchaseOrder->status]);

            return $goodsReceipt;
        });

        $this->syncProjectCosts($purchaseOrder->project);

        return response()->json(['goods_receipt' => $goodsReceipt->load(['purchaseOrder', 'supplier', 'project', 'lines'])], 201);
    }

    public function storeQualityInspection(Request $request, GoodsReceipt $goodsReceipt): JsonResponse
    {
        $this->assertGoodsReceiptTenant($request, $goodsReceipt);

        $data = $request->validate([
            'status' => ['required', Rule::in(['passed', 'failed'])],
            'result_summary' => ['nullable', 'string', 'max:4000'],
            'corrective_action' => ['nullable', 'string', 'max:4000'],
        ]);

        $inspection = ProcurementQualityInspection::query()->create([
            'company_id' => $goodsReceipt->company_id,
            'goods_receipt_id' => $goodsReceipt->id,
            'purchase_order_id' => $goodsReceipt->purchase_order_id,
            'project_id' => $goodsReceipt->project_id,
            'inspection_number' => $this->nextNumber('PQI', ProcurementQualityInspection::class, 'inspection_number', $goodsReceipt->company_id),
            'status' => $data['status'],
            'inspected_by' => $this->user($request)->id,
            'inspected_at' => now(),
            'result_summary' => $data['result_summary'] ?? null,
            'corrective_action' => $data['corrective_action'] ?? null,
        ]);

        $goodsReceipt->update(['status' => $data['status'] === 'passed' ? 'accepted' : 'rejected']);

        return response()->json(['quality_inspection' => $inspection->load(['goodsReceipt', 'purchaseOrder', 'project'])], 201);
    }

    public function storeSupplierInvoice(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertPurchaseOrderTenant($request, $purchaseOrder);

        $data = $request->validate([
            'goods_receipt_id' => ['nullable', 'integer'],
            'supplier_reference' => ['nullable', 'string', 'max:120'],
            'invoice_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'subtotal_amount' => ['nullable', 'numeric', 'min:0'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $goodsReceipt = null;
        if (! empty($data['goods_receipt_id'])) {
            $goodsReceipt = GoodsReceipt::query()
                ->forCompany($purchaseOrder->company_id)
                ->where('purchase_order_id', $purchaseOrder->id)
                ->whereKey($data['goods_receipt_id'])
                ->firstOrFail();
        }

        $subtotal = (float) ($data['subtotal_amount'] ?? $purchaseOrder->subtotal);
        $tax = (float) ($data['tax_amount'] ?? $purchaseOrder->tax_amount);
        $discount = (float) ($data['discount_amount'] ?? 0);
        $total = max(0, $subtotal + $tax - $discount);

        $invoice = SupplierInvoice::query()->create([
            'company_id' => $purchaseOrder->company_id,
            'branch_id' => $purchaseOrder->branch_id,
            'project_id' => $purchaseOrder->project_id,
            'supplier_id' => $purchaseOrder->supplier_id,
            'purchase_order_id' => $purchaseOrder->id,
            'goods_receipt_id' => $goodsReceipt?->id,
            'invoice_number' => $this->nextNumber('SIN', SupplierInvoice::class, 'invoice_number', $purchaseOrder->company_id),
            'supplier_reference' => $data['supplier_reference'] ?? null,
            'status' => 'submitted',
            'invoice_date' => $data['invoice_date'] ?? now()->toDateString(),
            'due_date' => $data['due_date'] ?? null,
            'currency' => $purchaseOrder->currency,
            'subtotal_amount' => $subtotal,
            'tax_amount' => $tax,
            'discount_amount' => $discount,
            'total_amount' => $total,
            'balance_due' => $total,
            'submitted_by' => $this->user($request)->id,
            'notes' => $data['notes'] ?? null,
        ]);

        $purchaseOrder->update(['payment_status' => 'invoiced']);

        $this->publishAutomationEvent($request, 'supplier_invoice_submitted', [
            'record_type' => 'supplier_invoice',
            'record_id' => $invoice->id,
        ]);

        return response()->json(['supplier_invoice' => $invoice->load(['supplier', 'purchaseOrder', 'goodsReceipt', 'payments'])], 201);
    }

    public function approveSupplierInvoice(Request $request, SupplierInvoice $invoice): JsonResponse
    {
        $this->assertSupplierInvoiceTenant($request, $invoice);

        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        abort_if(! in_array($invoice->status, ['submitted', 'finance_approved'], true), 422, 'Only submitted supplier invoices can be reviewed.');

        $invoice->update([
            'status' => $data['decision'] === 'approved' ? 'finance_approved' : 'rejected',
            'approved_by' => $this->user($request)->id,
            'approved_at' => now(),
            'notes' => $data['notes'] ?? $invoice->notes,
        ]);

        if ($data['decision'] === 'approved') {
            app(FinancePostingService::class)->postSupplierInvoiceApproval($invoice->fresh(), $this->user($request)->id);
        }

        return response()->json(['supplier_invoice' => $invoice->fresh(['supplier', 'purchaseOrder', 'goodsReceipt', 'payments'])]);
    }

    public function recordSupplierPayment(Request $request, SupplierInvoice $invoice): JsonResponse
    {
        $this->assertSupplierInvoiceTenant($request, $invoice);
        abort_if($invoice->status !== 'finance_approved' && $invoice->status !== 'partially_paid', 422, 'Only approved invoices can be paid.');

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'finance_bank_account_id' => ['nullable', 'integer'],
            'payment_date' => ['nullable', 'date'],
            'method' => ['nullable', Rule::in(['bank_transfer', 'cheque', 'cash', 'mobile_money'])],
            'reference' => ['nullable', 'string', 'max:120'],
        ]);

        $amount = min((float) $data['amount'], (float) $invoice->balance_due);

        $payment = DB::transaction(function () use ($request, $invoice, $data, $amount) {
            $payment = SupplierPayment::query()->create([
                'company_id' => $invoice->company_id,
                'supplier_invoice_id' => $invoice->id,
                'finance_bank_account_id' => $data['finance_bank_account_id'] ?? null,
                'payment_number' => $this->nextNumber('SPY', SupplierPayment::class, 'payment_number', $invoice->company_id),
                'amount' => $amount,
                'payment_date' => $data['payment_date'] ?? now()->toDateString(),
                'method' => $data['method'] ?? 'bank_transfer',
                'reference' => $data['reference'] ?? null,
                'created_by' => $this->user($request)->id,
            ]);

            $paid = (float) $invoice->payments()->sum('amount');
            $balance = max(0, (float) $invoice->total_amount - $paid);

            $invoice->update([
                'amount_paid' => $paid,
                'balance_due' => $balance,
                'status' => $balance <= 0 ? 'paid' : 'partially_paid',
                'paid_at' => $balance <= 0 ? now() : $invoice->paid_at,
            ]);

            $invoice->purchaseOrder?->update(['payment_status' => $balance <= 0 ? 'paid' : 'partial']);

            return $payment;
        });

        $payment = app(FinancePostingService::class)->postSupplierPayment($payment, $invoice->fresh(), $this->user($request)->id, $data['finance_bank_account_id'] ?? null);

        return response()->json(['payment' => $payment->load(['invoice', 'bankAccount'])], 201);
    }

    public function storeSupplierContract(Request $request, Supplier $supplier): JsonResponse
    {
        $this->assertSupplierTenant($request, $supplier);

        $data = $request->validate([
            'project_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'contract_value' => ['nullable', 'numeric', 'min:0'],
            'terms' => ['nullable', 'string', 'max:4000'],
        ]);

        $project = null;
        if (! empty($data['project_id'])) {
            $project = $this->projectForTenant($request, $data['project_id']);
        }

        $contract = SupplierContract::query()->create([
            'company_id' => $supplier->company_id,
            'branch_id' => $project?->branch_id ?? $supplier->branch_id,
            'supplier_id' => $supplier->id,
            'project_id' => $project?->id,
            'contract_number' => $this->nextNumber('SC', SupplierContract::class, 'contract_number', $supplier->company_id),
            'title' => $data['title'],
            'status' => 'active',
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'currency' => $project?->currency ?? $this->user($request)->company->default_currency,
            'contract_value' => $data['contract_value'] ?? 0,
            'terms' => $data['terms'] ?? null,
            'created_by' => $this->user($request)->id,
        ]);

        return response()->json(['contract' => $contract->load(['supplier', 'project'])], 201);
    }

    private function requisitionQuery(int $companyId)
    {
        return PurchaseRequisition::query()
            ->forCompany($companyId)
            ->with([
                'project:id,code,name,currency',
                'lines',
                'requestedBy:id,name',
                'rfqs.suppliers.supplier:id,name,email,rating,lead_time_days',
                'rfqs.quotations.supplier:id,name,rating,lead_time_days',
                'rfqs.quotations.purchaseOrder.goodsReceipts.qualityInspections',
                'rfqs.quotations.purchaseOrder.supplierInvoices.payments',
                'purchaseOrder.goodsReceipts.qualityInspections',
                'purchaseOrder.supplierInvoices.payments',
            ]);
    }

    private function purchaseOrderQuery(int $companyId)
    {
        return PurchaseOrder::query()
            ->forCompany($companyId)
            ->with(['project:id,code,name,currency', 'supplier:id,name', 'lines', 'requisition:id,requisition_number,title', 'quotation:id,quotation_number,total_amount', 'goodsReceipts:id,purchase_order_id,grn_number,status', 'supplierInvoices:id,purchase_order_id,invoice_number,status,balance_due']);
    }

    private function createPurchaseOrderLine(PurchaseOrder $purchaseOrder, array $line): PurchaseOrderLine
    {
        $quantity = (float) $line['quantity'];
        $unitCost = (float) $line['unit_cost'];

        return PurchaseOrderLine::query()->create([
            'company_id' => $purchaseOrder->company_id,
            'purchase_order_id' => $purchaseOrder->id,
            'description' => $line['description'],
            'cost_code' => $this->lineCostCode($line['cost_code'] ?? null, $line['description'] ?? null, PurchaseOrderLine::class, $purchaseOrder->company_id),
            'quantity' => $quantity,
            'unit' => $line['unit'] ?? 'each',
            'unit_cost' => $unitCost,
            'line_total' => round($quantity * $unitCost, 2),
        ]);
    }

    private function lineCostCode(?string $provided, ?string $source, string $modelClass, int $companyId): string
    {
        return $this->suppliedCode($provided)
            ?? $this->nextCompanyCode($this->codePrefix($source, 'CST'), $modelClass, 'cost_code', $companyId);
    }

    private function lineAmounts(array $line, string $unitCostKey): array
    {
        $quantity = (float) ($line['quantity'] ?? 1);
        $unitCost = (float) ($line[$unitCostKey] ?? 0);
        $subtotal = round($quantity * $unitCost, 2);
        $taxRate = (float) ($line['tax_rate'] ?? 0);
        $taxAmount = round($subtotal * ($taxRate / 100), 2);
        $discount = (float) ($line['discount_amount'] ?? 0);

        return [
            'quantity' => $quantity,
            'unit_cost' => $unitCost,
            'subtotal' => $subtotal,
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'discount_amount' => $discount,
            'line_total' => max(0, round($subtotal + $taxAmount - $discount, 2)),
        ];
    }

    private function syncRequisitionTotals(PurchaseRequisition $requisition): void
    {
        $lines = $requisition->lines()->get();
        $subtotal = $lines->sum(fn (PurchaseRequisitionLine $line) => (float) $line->quantity * (float) $line->estimated_unit_cost);
        $tax = $lines->sum(fn (PurchaseRequisitionLine $line) => (float) $line->tax_amount);
        $lineDiscount = $lines->sum(fn (PurchaseRequisitionLine $line) => (float) $line->discount_amount);
        $headerDiscount = (float) $requisition->discount_amount;
        $grandTotal = max(0, round($subtotal + $tax - $lineDiscount - $headerDiscount, 2));

        $requisition->forceFill([
            'subtotal_amount' => round($subtotal, 2),
            'tax_amount' => round($tax, 2),
            'discount_amount' => round($lineDiscount + $headerDiscount, 2),
            'grand_total' => $grandTotal,
            'total_estimated' => $grandTotal,
        ])->save();
    }

    private function syncQuotationTotals(SupplierQuotation $quotation): void
    {
        $lines = $quotation->lines()->get();
        $subtotal = $lines->sum(fn (SupplierQuotationLine $line) => (float) $line->quantity * (float) $line->unit_price);
        $tax = $lines->sum(fn (SupplierQuotationLine $line) => (float) $line->tax_amount);
        $discount = $lines->sum(fn (SupplierQuotationLine $line) => (float) $line->discount_amount);

        $quotation->forceFill([
            'subtotal_amount' => round($subtotal, 2),
            'tax_amount' => round($tax, 2),
            'discount_amount' => round($discount, 2),
            'total_amount' => max(0, round($subtotal + $tax - $discount, 2)),
        ])->save();
    }

    private function mergeJsonLines(Request $request): void
    {
        if ($request->filled('lines_payload')) {
            $request->merge(['lines' => json_decode((string) $request->input('lines_payload'), true) ?: []]);
        }
    }

    private function normalizePriority(string $priority): string
    {
        return match ($priority) {
            'normal' => 'medium',
            'urgent' => 'critical',
            default => $priority,
        };
    }

    private function storeRequisitionAttachments(Request $request, int $companyId): array
    {
        $attachments = [];

        foreach (['drawings', 'boq', 'specifications'] as $bucket) {
            foreach ($request->file($bucket, []) as $file) {
                $attachments[$bucket][] = [
                    'name' => $file->getClientOriginalName(),
                    'path' => $file->store("navkwabuild/companies/{$companyId}/procurement/{$bucket}", 'local'),
                    'size' => $file->getSize(),
                ];
            }
        }

        return $attachments;
    }

    private function decorateRequisition(PurchaseRequisition $requisition): PurchaseRequisition
    {
        $requisition->setAttribute('approval_workflow', $this->approvalWorkflow($requisition));
        $requisition->setAttribute('timeline', $this->timelineForRequisition($requisition));

        return $requisition;
    }

    private function approvalWorkflowTemplate(string $defaultStatus = 'waiting'): array
    {
        return collect([
            ['key' => 'site_engineer', 'label' => 'Site Engineer'],
            ['key' => 'project_manager', 'label' => 'Project Manager'],
            ['key' => 'quantity_surveyor', 'label' => 'Quantity Surveyor'],
            ['key' => 'procurement_manager', 'label' => 'Procurement Manager'],
            ['key' => 'finance', 'label' => 'Finance'],
        ])
            ->map(fn (array $step) => [
                ...$step,
                'status' => $defaultStatus,
                'acted_by' => null,
                'acted_by_id' => null,
                'acted_at' => null,
            ])
            ->all();
    }

    private function approvalWorkflow(PurchaseRequisition $requisition): array
    {
        $workflow = $requisition->approval_workflow ?: [];

        if (count($workflow) === 5) {
            return $workflow;
        }

        $workflow = $this->approvalWorkflowTemplate('waiting');

        if (in_array($requisition->status, ['approved', 'rfq_sent', 'converted'], true)) {
            return collect($workflow)
                ->map(fn (array $step) => [
                    ...$step,
                    'status' => 'approved',
                    'acted_by_id' => $requisition->reviewed_by,
                    'acted_at' => $requisition->reviewed_at?->toISOString(),
                ])
                ->all();
        }

        if ($requisition->status === 'submitted') {
            $workflow[0]['status'] = 'pending';
        }

        if ($requisition->status === 'rejected') {
            $workflow[0]['status'] = 'rejected';
            $workflow[0]['acted_by_id'] = $requisition->reviewed_by;
            $workflow[0]['acted_at'] = $requisition->reviewed_at?->toISOString();
        }

        return $workflow;
    }

    private function timelineForRequisition(PurchaseRequisition $requisition): array
    {
        $events = collect();

        $events->push([
            'occurred_at' => $requisition->created_at?->toISOString(),
            'label' => 'Material Request created',
            'actor' => $requisition->requested_by_name ?: $requisition->requestedBy?->name,
        ]);

        if ($requisition->submitted_at) {
            $events->push([
                'occurred_at' => $requisition->submitted_at->toISOString(),
                'label' => 'Material Request submitted',
                'actor' => $requisition->requested_by_name ?: $requisition->requestedBy?->name,
            ]);
        }

        collect($this->approvalWorkflow($requisition))
            ->filter(fn (array $step) => ! empty($step['acted_at']))
            ->each(fn (array $step) => $events->push([
                'occurred_at' => $step['acted_at'],
                'label' => "{$step['label']} {$step['status']}",
                'actor' => $step['acted_by'] ?? null,
            ]));

        $requisition->rfqs->each(function (ProcurementRfq $rfq) use ($events): void {
            if ($rfq->sent_at) {
                $events->push([
                    'occurred_at' => $rfq->sent_at->toISOString(),
                    'label' => "{$rfq->rfq_number} sent to suppliers",
                    'actor' => null,
                ]);
            }

            $rfq->quotations->each(function (SupplierQuotation $quotation) use ($events): void {
                $events->push([
                    'occurred_at' => $quotation->created_at?->toISOString(),
                    'label' => "{$quotation->supplier?->name} submitted {$quotation->quotation_number}",
                    'actor' => $quotation->supplier?->name,
                ]);

                if ($quotation->accepted_at) {
                    $events->push([
                        'occurred_at' => $quotation->accepted_at->toISOString(),
                        'label' => "{$quotation->quotation_number} accepted",
                        'actor' => null,
                    ]);
                }

                $purchaseOrder = $quotation->purchaseOrder;
                if (! $purchaseOrder) {
                    return;
                }

                $events->push([
                    'occurred_at' => $purchaseOrder->created_at?->toISOString(),
                    'label' => "{$purchaseOrder->po_number} generated",
                    'actor' => null,
                ]);

                if ($purchaseOrder->approved_at) {
                    $events->push([
                        'occurred_at' => $purchaseOrder->approved_at->toISOString(),
                        'label' => "{$purchaseOrder->po_number} approved",
                        'actor' => null,
                    ]);
                }

                $this->purchaseOrderTimelineEvents($purchaseOrder, $events);
            });
        });

        $requisition->purchaseOrder->each(fn (PurchaseOrder $purchaseOrder) => $this->purchaseOrderTimelineEvents($purchaseOrder, $events));

        return $events
            ->filter(fn (array $event) => ! empty($event['occurred_at']))
            ->unique(fn (array $event) => $event['occurred_at'].'|'.$event['label'])
            ->sortBy('occurred_at')
            ->values()
            ->all();
    }

    private function purchaseOrderTimelineEvents(PurchaseOrder $purchaseOrder, $events): void
    {
        $purchaseOrder->goodsReceipts->each(function (GoodsReceipt $receipt) use ($events): void {
            $events->push([
                'occurred_at' => $receipt->received_date?->toDateString() ?? $receipt->created_at?->toISOString(),
                'label' => "{$receipt->grn_number} materials received",
                'actor' => $receipt->delivered_by,
            ]);

            $receipt->qualityInspections->each(fn (ProcurementQualityInspection $inspection) => $events->push([
                'occurred_at' => $inspection->inspected_at?->toISOString(),
                'label' => "{$inspection->inspection_number} {$inspection->status}",
                'actor' => null,
            ]));
        });

        $purchaseOrder->supplierInvoices->each(function (SupplierInvoice $invoice) use ($events): void {
            $events->push([
                'occurred_at' => $invoice->created_at?->toISOString(),
                'label' => "{$invoice->invoice_number} submitted",
                'actor' => $invoice->supplier?->name,
            ]);

            if ($invoice->approved_at) {
                $events->push([
                    'occurred_at' => $invoice->approved_at->toISOString(),
                    'label' => "{$invoice->invoice_number} finance approved",
                    'actor' => null,
                ]);
            }

            $invoice->payments->each(fn (SupplierPayment $payment) => $events->push([
                'occurred_at' => $payment->payment_date?->toDateString() ?? $payment->created_at?->toISOString(),
                'label' => "{$payment->payment_number} supplier paid",
                'actor' => null,
            ]));
        });
    }

    private function procurementAnalytics(int $companyId): array
    {
        $monthSpend = (float) SupplierPayment::query()
            ->forCompany($companyId)
            ->whereBetween('payment_date', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])
            ->sum('amount');

        $approvedRequests = PurchaseRequisition::query()
            ->forCompany($companyId)
            ->whereNotNull('submitted_at')
            ->whereNotNull('reviewed_at')
            ->whereIn('status', ['approved', 'rfq_sent', 'converted'])
            ->get();

        $averageApprovalTime = $approvedRequests->count() > 0
            ? round($approvedRequests->avg(fn (PurchaseRequisition $request) => $request->submitted_at->diffInHours($request->reviewed_at) / 24), 1)
            : 0;

        $purchaseOrders = PurchaseOrder::query()
            ->forCompany($companyId)
            ->with('goodsReceipts')
            ->get();

        $deliveriesWithTarget = $purchaseOrders->filter(fn (PurchaseOrder $order) => $order->expected_delivery_date && $order->goodsReceipts->isNotEmpty());
        $onTimeDeliveries = $deliveriesWithTarget->filter(function (PurchaseOrder $order): bool {
            $firstReceipt = $order->goodsReceipts->sortBy('received_date')->first();

            return $firstReceipt && $firstReceipt->received_date && $firstReceipt->received_date->lte($order->expected_delivery_date);
        })->count();
        $onTimeDelivery = $deliveriesWithTarget->count() > 0 ? round(($onTimeDeliveries / $deliveriesWithTarget->count()) * 100) : 0;
        $supplierProfiles = $this->supplierProfiles($companyId);
        $supplierPerformance = count($supplierProfiles) > 0 ? round(collect($supplierProfiles)->avg('performance_score')) : 0;

        return [
            'spend_this_month' => $monthSpend,
            'average_approval_time_days' => $averageApprovalTime,
            'supplier_performance' => $supplierPerformance,
            'on_time_delivery' => $onTimeDelivery,
            'open_pos' => $purchaseOrders->whereNotIn('status', ['closed', 'cancelled'])->count(),
            'pending_payments' => (float) SupplierInvoice::query()->forCompany($companyId)->whereNotIn('status', ['paid', 'rejected'])->sum('balance_due'),
        ];
    }

    private function supplierProfiles(int $companyId): array
    {
        $purchaseOrders = PurchaseOrder::query()
            ->forCompany($companyId)
            ->with('goodsReceipts')
            ->get()
            ->groupBy('supplier_id');

        $invoices = SupplierInvoice::query()
            ->forCompany($companyId)
            ->get()
            ->groupBy('supplier_id');

        return Supplier::query()
            ->forCompany($companyId)
            ->orderBy('name')
            ->get()
            ->map(function (Supplier $supplier) use ($purchaseOrders, $invoices): array {
                $orders = $purchaseOrders->get($supplier->id, collect());
                $supplierInvoices = $invoices->get($supplier->id, collect());
                $deliveredOrders = $orders->filter(fn (PurchaseOrder $order) => $order->goodsReceipts->isNotEmpty());
                $onTimeOrders = $deliveredOrders->filter(function (PurchaseOrder $order): bool {
                    $firstReceipt = $order->goodsReceipts->sortBy('received_date')->first();

                    if (! $order->expected_delivery_date || ! $firstReceipt?->received_date) {
                        return false;
                    }

                    return $firstReceipt->received_date->lte($order->expected_delivery_date);
                });
                $onTimeDelivery = $deliveredOrders->count() > 0 ? round(($onTimeOrders->count() / $deliveredOrders->count()) * 100) : 0;
                $rating = (float) ($supplier->rating ?: 0);
                $performanceScore = $onTimeDelivery > 0 || $rating > 0
                    ? round(collect([$onTimeDelivery, $rating * 20])->filter(fn (float $value) => $value > 0)->avg())
                    : 0;

                return [
                    'id' => $supplier->id,
                    'name' => $supplier->name,
                    'rating' => $rating,
                    'orders' => $orders->count(),
                    'total_spend' => (float) $orders->sum('total_amount'),
                    'on_time_delivery' => $onTimeDelivery,
                    'late_deliveries' => max(0, $deliveredOrders->count() - $onTimeOrders->count()),
                    'open_pos' => $orders->whereNotIn('status', ['closed', 'cancelled'])->count(),
                    'outstanding_invoices' => $supplierInvoices->where('balance_due', '>', 0)->whereNotIn('status', ['paid', 'rejected'])->count(),
                    'performance_score' => $performanceScore,
                ];
            })
            ->values()
            ->all();
    }

    private function updateQuotationScores(?int $rfqId): void
    {
        if (! $rfqId) {
            return;
        }

        $quotations = SupplierQuotation::query()
            ->where('procurement_rfq_id', $rfqId)
            ->with('supplier')
            ->get();

        if ($quotations->isEmpty()) {
            return;
        }

        $minimumPrice = max(1, (float) $quotations->min('total_amount'));
        $minimumLeadTime = max(1, (int) $quotations->min('lead_time_days'));

        $quotations->each(function (SupplierQuotation $quotation) use ($minimumPrice, $minimumLeadTime): void {
            $price = max(1, (float) $quotation->total_amount);
            $leadTime = max(1, (int) $quotation->lead_time_days);
            $rating = (float) ($quotation->supplier?->rating ?: 0);

            $score = min(50, ($minimumPrice / $price) * 50)
                + min(25, ($minimumLeadTime / $leadTime) * 25)
                + min(15, ($rating / 5) * 15)
                + ($quotation->warranty_included ? 10 : 0);

            $quotation->forceFill(['recommendation_score' => (int) round($score)])->save();
        });
    }

    private function recentActivity(int $companyId): array
    {
        $activities = collect();

        PurchaseOrder::query()->forCompany($companyId)->whereNotNull('approved_at')->latest('approved_at')->limit(5)->get()
            ->each(fn (PurchaseOrder $po) => $activities->push(['label' => "{$po->po_number} approved", 'occurred_at' => $po->approved_at]));

        GoodsReceipt::query()->forCompany($companyId)->latest()->limit(5)->get()
            ->each(fn (GoodsReceipt $grn) => $activities->push(['label' => "{$grn->grn_number} received", 'occurred_at' => $grn->created_at]));

        ProcurementRfq::query()->forCompany($companyId)->whereNotNull('sent_at')->latest('sent_at')->limit(5)->get()
            ->each(fn (ProcurementRfq $rfq) => $activities->push(['label' => "{$rfq->rfq_number} sent to {$rfq->suppliers()->count()} supplier(s)", 'occurred_at' => $rfq->sent_at]));

        SupplierInvoice::query()->forCompany($companyId)->whereIn('status', ['submitted', 'finance_approved'])->latest()->limit(5)->get()
            ->each(fn (SupplierInvoice $invoice) => $activities->push(['label' => "{$invoice->invoice_number} awaiting finance approval", 'occurred_at' => $invoice->created_at]));

        return $activities
            ->sortByDesc('occurred_at')
            ->take(8)
            ->values()
            ->all();
    }

    private function traceability(int $companyId): array
    {
        return PurchaseRequisition::query()
            ->forCompany($companyId)
            ->with([
                'requestedBy:id,name',
                'rfqs.quotations.purchaseOrder.goodsReceipts.qualityInspections',
                'rfqs.quotations.purchaseOrder.supplierInvoices.payments',
                'purchaseOrder.goodsReceipts.qualityInspections',
                'purchaseOrder.supplierInvoices.payments',
            ])
            ->latest()
            ->limit(80)
            ->get()
            ->map(function (PurchaseRequisition $requisition): array {
                $rfq = $requisition->rfqs->first();
                $quotation = $rfq?->quotations?->firstWhere('status', 'accepted') ?? $rfq?->quotations?->first();
                $purchaseOrder = $quotation?->purchaseOrder ?? $requisition->purchaseOrder->first();
                $goodsReceipt = $purchaseOrder?->goodsReceipts?->first();
                $inspection = $goodsReceipt?->qualityInspections?->first();
                $invoice = $purchaseOrder?->supplierInvoices?->first();

                return [
                    'material_request' => $requisition->requisition_number,
                    'request_status' => $requisition->approval_status_label,
                    'approval_progress' => $requisition->approval_progress['label'] ?? '',
                    'rfq' => $rfq?->rfq_number,
                    'quotation' => $quotation?->quotation_number,
                    'purchase_order' => $purchaseOrder?->po_number,
                    'goods_receipt' => $goodsReceipt?->grn_number,
                    'quality' => $inspection?->status,
                    'supplier_invoice' => $invoice?->invoice_number,
                    'invoice_status' => $invoice?->status,
                    'payment_status' => $invoice?->balance_due !== null && (float) $invoice->balance_due <= 0 ? 'paid' : ($invoice?->status ?? ''),
                    'timeline' => $this->timelineForRequisition($requisition),
                ];
            })
            ->all();
    }

    private function assertRequisitionTenant(Request $request, PurchaseRequisition $requisition): void
    {
        abort_if($requisition->company_id !== $this->companyId($request), 404);
    }

    private function assertPurchaseOrderTenant(Request $request, PurchaseOrder $purchaseOrder): void
    {
        abort_if($purchaseOrder->company_id !== $this->companyId($request), 404);
    }

    private function assertRfqTenant(Request $request, ProcurementRfq $rfq): void
    {
        abort_if($rfq->company_id !== $this->companyId($request), 404);
    }

    private function assertQuotationTenant(Request $request, SupplierQuotation $quotation): void
    {
        abort_if($quotation->company_id !== $this->companyId($request), 404);
    }

    private function assertGoodsReceiptTenant(Request $request, GoodsReceipt $goodsReceipt): void
    {
        abort_if($goodsReceipt->company_id !== $this->companyId($request), 404);
    }

    private function assertSupplierInvoiceTenant(Request $request, SupplierInvoice $invoice): void
    {
        abort_if($invoice->company_id !== $this->companyId($request), 404);
    }

    private function assertSupplierTenant(Request $request, Supplier $supplier): void
    {
        abort_if($supplier->company_id !== $this->companyId($request), 404);
    }
}
