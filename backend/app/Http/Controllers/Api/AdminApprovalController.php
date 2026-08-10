<?php

namespace App\Http\Controllers\Api;

use App\Models\ClientApproval;
use App\Models\ConsultantSubmittal;
use App\Models\Expense;
use App\Models\FieldDailyReport;
use App\Models\LeaveRequest;
use App\Models\PortalWorkItem;
use App\Models\PurchaseRequisition;
use App\Models\SupplierInvoice;
use App\Models\SupplierQuotation;
use App\Models\User;
use App\Models\WorkPermit;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminApprovalController extends ApiController
{
    /** @var array<int, string> */
    private array $userNames = [];

    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $items = collect()
            ->concat($this->materialRequestApprovals($companyId))
            ->concat($this->quotationApprovals($companyId))
            ->concat($this->supplierInvoiceApprovals($companyId))
            ->concat($this->expenseApprovals($companyId))
            ->concat($this->leaveApprovals($companyId))
            ->concat($this->dailyReportApprovals($companyId))
            ->concat($this->permitApprovals($companyId))
            ->concat($this->clientApprovals($companyId))
            ->concat($this->consultantSubmittalApprovals($companyId))
            ->concat($this->portalWorkItemApprovals($companyId))
            ->sortByDesc(fn (array $item): int => (int) ($item['sort_at'] ?? 0))
            ->values();

        return response()->json([
            'summary' => [
                'total_pending' => $items->count(),
                'total_value' => round($items->sum(fn (array $item): float => (float) ($item['amount'] ?? 0)), 2),
                'oldest_days' => $this->oldestDays($items),
                'by_module' => $items->groupBy('module')->map(fn (Collection $group): int => $group->count())->all(),
            ],
            'items' => $items->map(fn (array $item): array => collect($item)->except('sort_at')->all())->all(),
        ]);
    }

    public function review(Request $request, string $type, int $id): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $approval = match ($type) {
            'material_request' => $this->reviewMaterialRequest($request, $id, $data),
            'supplier_quotation' => $this->reviewSupplierQuotation($request, $id, $data),
            'supplier_invoice' => $this->reviewSupplierInvoice($request, $id, $data),
            'expense' => $this->reviewExpense($request, $id, $data),
            'leave_request' => $this->reviewLeaveRequest($request, $id, $data),
            'daily_report' => $this->reviewDailyReport($request, $id, $data),
            'work_permit' => $this->reviewWorkPermit($request, $id, $data),
            'client_approval' => $this->reviewClientApproval($request, $id, $data),
            'consultant_submittal' => $this->reviewConsultantSubmittal($request, $id, $data),
            'portal_work_item' => $this->reviewPortalWorkItem($request, $id, $data),
            default => abort(404, 'Approval type was not found.'),
        };

        return response()->json(['approval' => $approval]);
    }

    private function materialRequestApprovals(int $companyId): Collection
    {
        return PurchaseRequisition::query()
            ->forCompany($companyId)
            ->where('status', 'submitted')
            ->with(['project:id,code,name', 'requestedBy:id,name'])
            ->latest('submitted_at')
            ->limit(80)
            ->get()
            ->map(fn (PurchaseRequisition $request): array => $this->approvalItem('material_request', $request->id, [
                'module' => 'Procurement',
                'reference' => $request->requisition_number,
                'title' => $request->title,
                'status' => $request->approval_status_label,
                'priority' => $request->priority,
                'amount' => (float) ($request->grand_total ?: $request->total_estimated),
                'requester' => $request->requestedBy?->name,
                'project' => $this->projectName($request->project),
                'context' => $request->current_approval_step['label'] ?? 'Approval workflow',
                'submitted_at' => $request->submitted_at ?? $request->created_at,
                'due_at' => $request->required_by,
                'approve_label' => 'Approve step',
                'deny_label' => 'Reject',
            ]));
    }

    private function quotationApprovals(int $companyId): Collection
    {
        return SupplierQuotation::query()
            ->forCompany($companyId)
            ->where('status', 'submitted')
            ->with(['supplier:id,name', 'rfq:id,rfq_number,title', 'requisition.project:id,code,name'])
            ->latest()
            ->limit(80)
            ->get()
            ->map(fn (SupplierQuotation $quotation): array => $this->approvalItem('supplier_quotation', $quotation->id, [
                'module' => 'Procurement',
                'reference' => $quotation->quotation_number,
                'title' => $quotation->supplier?->name ? "{$quotation->supplier->name} quotation" : 'Supplier quotation',
                'status' => 'Submitted',
                'amount' => (float) $quotation->total_amount,
                'requester' => $this->userName($quotation->submitted_by),
                'project' => $this->projectName($quotation->requisition?->project),
                'context' => $quotation->rfq?->rfq_number,
                'submitted_at' => $quotation->created_at,
                'due_at' => $quotation->valid_until,
                'approve_label' => 'Accept',
                'deny_label' => 'Reject',
            ]));
    }

    private function supplierInvoiceApprovals(int $companyId): Collection
    {
        return SupplierInvoice::query()
            ->forCompany($companyId)
            ->where('status', 'submitted')
            ->with(['supplier:id,name', 'purchaseOrder.project:id,code,name', 'purchaseOrder:id,project_id,po_number'])
            ->latest()
            ->limit(80)
            ->get()
            ->map(fn (SupplierInvoice $invoice): array => $this->approvalItem('supplier_invoice', $invoice->id, [
                'module' => 'Procurement / Finance',
                'reference' => $invoice->invoice_number,
                'title' => $invoice->supplier?->name ? "{$invoice->supplier->name} invoice" : 'Supplier invoice',
                'status' => 'Submitted',
                'amount' => (float) $invoice->total_amount,
                'requester' => $this->userName($invoice->submitted_by),
                'project' => $this->projectName($invoice->purchaseOrder?->project),
                'context' => $invoice->purchaseOrder?->po_number,
                'submitted_at' => $invoice->created_at,
                'due_at' => $invoice->due_date,
                'approve_label' => 'Finance approve',
                'deny_label' => 'Reject',
            ]));
    }

    private function expenseApprovals(int $companyId): Collection
    {
        return Expense::query()
            ->forCompany($companyId)
            ->where('status', 'submitted')
            ->with(['project:id,code,name', 'supplier:id,name'])
            ->latest()
            ->limit(80)
            ->get()
            ->map(fn (Expense $expense): array => $this->approvalItem('expense', $expense->id, [
                'module' => 'Finance',
                'reference' => $expense->expense_number,
                'title' => $expense->description,
                'status' => 'Submitted',
                'amount' => (float) $expense->amount + (float) $expense->tax_amount,
                'requester' => $this->userName($expense->submitted_by),
                'project' => $this->projectName($expense->project),
                'context' => $expense->supplier?->name ?: $expense->category,
                'submitted_at' => $expense->created_at,
                'due_at' => $expense->incurred_on,
                'approve_label' => 'Approve',
                'deny_label' => 'Deny',
            ]));
    }

    private function leaveApprovals(int $companyId): Collection
    {
        return LeaveRequest::query()
            ->forCompany($companyId)
            ->where('status', 'pending')
            ->with('employeeProfile.user:id,name,email')
            ->latest()
            ->limit(80)
            ->get()
            ->map(fn (LeaveRequest $leave): array => $this->approvalItem('leave_request', $leave->id, [
                'module' => 'HR',
                'reference' => "LEAVE-{$leave->id}",
                'title' => $leave->employeeProfile?->user?->name ? "{$leave->employeeProfile->user->name} leave request" : 'Leave request',
                'status' => 'Pending',
                'amount' => 0,
                'requester' => $leave->employeeProfile?->user?->name ?: $this->userName($leave->user_id),
                'project' => null,
                'context' => str($leave->leave_type)->replace('_', ' ')->title()->toString(),
                'submitted_at' => $leave->created_at,
                'due_at' => $leave->starts_on,
                'approve_label' => 'Approve',
                'deny_label' => 'Deny',
            ]));
    }

    private function dailyReportApprovals(int $companyId): Collection
    {
        return FieldDailyReport::query()
            ->forCompany($companyId)
            ->where('status', 'submitted')
            ->with('project:id,code,name')
            ->latest('submitted_at')
            ->limit(80)
            ->get()
            ->map(fn (FieldDailyReport $report): array => $this->approvalItem('daily_report', $report->id, [
                'module' => 'Site Management',
                'reference' => $report->report_number,
                'title' => 'Daily report',
                'status' => 'Submitted',
                'amount' => 0,
                'requester' => $this->userName($report->submitted_by),
                'project' => $this->projectName($report->project),
                'context' => $report->shift ? str($report->shift)->title()->toString().' shift' : null,
                'submitted_at' => $report->submitted_at ?? $report->created_at,
                'due_at' => $report->report_date,
                'approve_label' => 'Approve',
                'deny_label' => 'Deny',
            ]));
    }

    private function permitApprovals(int $companyId): Collection
    {
        return WorkPermit::query()
            ->forCompany($companyId)
            ->where('status', 'submitted')
            ->with('project:id,code,name')
            ->latest()
            ->limit(80)
            ->get()
            ->map(fn (WorkPermit $permit): array => $this->approvalItem('work_permit', $permit->id, [
                'module' => 'QA/HSE',
                'reference' => $permit->permit_number,
                'title' => str($permit->permit_type)->replace('_', ' ')->title()->toString().' permit',
                'status' => 'Submitted',
                'amount' => 0,
                'requester' => $this->userName($permit->requested_by),
                'project' => $this->projectName($permit->project),
                'context' => $permit->location,
                'submitted_at' => $permit->created_at,
                'due_at' => $permit->valid_from,
                'approve_label' => 'Approve',
                'deny_label' => 'Deny',
            ]));
    }

    private function clientApprovals(int $companyId): Collection
    {
        return ClientApproval::query()
            ->forCompany($companyId)
            ->where('status', 'submitted')
            ->with(['portalUser:id,name,email', 'project:id,code,name'])
            ->latest('submitted_at')
            ->limit(80)
            ->get()
            ->map(fn (ClientApproval $approval): array => $this->approvalItem('client_approval', $approval->id, [
                'module' => 'Portals',
                'reference' => $approval->approval_number,
                'title' => $approval->title,
                'status' => 'Submitted',
                'amount' => 0,
                'requester' => $approval->portalUser?->name ?: $this->userName($approval->created_by),
                'project' => $this->projectName($approval->project),
                'context' => 'Client approval',
                'submitted_at' => $approval->submitted_at ?? $approval->created_at,
                'due_at' => $approval->due_date,
                'approve_label' => 'Approve',
                'deny_label' => 'Deny',
            ]));
    }

    private function consultantSubmittalApprovals(int $companyId): Collection
    {
        return ConsultantSubmittal::query()
            ->forCompany($companyId)
            ->whereIn('status', ['submitted', 'in_review'])
            ->with(['portalUser:id,name,email', 'project:id,code,name'])
            ->latest('submitted_at')
            ->limit(80)
            ->get()
            ->map(fn (ConsultantSubmittal $submittal): array => $this->approvalItem('consultant_submittal', $submittal->id, [
                'module' => 'Portals',
                'reference' => $submittal->submittal_number,
                'title' => $submittal->title,
                'status' => str($submittal->status)->replace('_', ' ')->title()->toString(),
                'amount' => 0,
                'requester' => $submittal->portalUser?->name ?: $this->userName($submittal->created_by),
                'project' => $this->projectName($submittal->project),
                'context' => str($submittal->discipline)->title()->toString(),
                'submitted_at' => $submittal->submitted_at ?? $submittal->created_at,
                'due_at' => $submittal->due_date,
                'approve_label' => 'Approve',
                'deny_label' => 'Deny',
            ]));
    }

    private function portalWorkItemApprovals(int $companyId): Collection
    {
        return PortalWorkItem::query()
            ->forCompany($companyId)
            ->whereIn('status', ['submitted', 'in_review', 'changes_required'])
            ->with(['portalUser:id,name,email,user_type', 'project:id,code,name', 'supplier:id,name'])
            ->latest('submitted_at')
            ->limit(80)
            ->get()
            ->map(fn (PortalWorkItem $item): array => $this->approvalItem('portal_work_item', $item->id, [
                'module' => 'Portals',
                'reference' => $item->item_number,
                'title' => $item->title,
                'status' => str($item->status)->replace('_', ' ')->title()->toString(),
                'priority' => $item->priority,
                'amount' => 0,
                'requester' => $item->portalUser?->name ?: $item->supplier?->name ?: $this->userName($item->created_by),
                'project' => $this->projectName($item->project),
                'context' => str($item->portal_type.' '.$item->item_type)->replace('_', ' ')->title()->toString(),
                'submitted_at' => $item->submitted_at ?? $item->created_at,
                'due_at' => $item->due_date,
                'approve_label' => 'Approve',
                'deny_label' => 'Deny',
            ]));
    }

    private function reviewMaterialRequest(Request $request, int $id, array $data): array
    {
        $requisition = PurchaseRequisition::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if($requisition->status !== 'submitted', 422, 'Only submitted material requests can be reviewed.');

        DB::transaction(function () use ($request, $requisition, $data): void {
            $workflow = $requisition->approval_workflow ?: [];
            $currentIndex = collect($workflow)->search(fn (array $step): bool => ($step['status'] ?? null) === 'pending');

            abort_if($currentIndex === false, 422, 'This material request is not awaiting approval.');

            $workflow[$currentIndex]['status'] = $data['decision'] === 'approved' ? 'approved' : 'rejected';
            $workflow[$currentIndex]['acted_by'] = $this->user($request)->name;
            $workflow[$currentIndex]['acted_by_id'] = $this->user($request)->id;
            $workflow[$currentIndex]['acted_at'] = now()->toISOString();

            if ($data['decision'] === 'rejected') {
                $requisition->update([
                    'status' => 'rejected',
                    'approval_workflow' => $workflow,
                    'approval_stage' => $workflow[$currentIndex]['key'],
                    'reviewed_by' => $this->user($request)->id,
                    'reviewed_at' => now(),
                ]);

                return;
            }

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

        return $this->decisionPayload('material_request', $requisition->fresh());
    }

    private function reviewSupplierQuotation(Request $request, int $id, array $data): array
    {
        $quotation = SupplierQuotation::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if($quotation->status !== 'submitted', 422, 'Only submitted quotations can be reviewed.');

        DB::transaction(function () use ($quotation, $data): void {
            if ($data['decision'] === 'rejected') {
                $quotation->update(['status' => 'rejected']);

                return;
            }

            SupplierQuotation::query()
                ->where('procurement_rfq_id', $quotation->procurement_rfq_id)
                ->where('id', '!=', $quotation->id)
                ->update(['status' => 'rejected']);

            $quotation->update(['status' => 'accepted', 'accepted_at' => now()]);
            $quotation->rfq?->update(['status' => 'awarded']);
        });

        return $this->decisionPayload('supplier_quotation', $quotation->fresh());
    }

    private function reviewSupplierInvoice(Request $request, int $id, array $data): array
    {
        $invoice = SupplierInvoice::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if(! in_array($invoice->status, ['submitted', 'finance_approved'], true), 422, 'Only submitted supplier invoices can be reviewed.');

        $invoice->update([
            'status' => $data['decision'] === 'approved' ? 'finance_approved' : 'rejected',
            'approved_by' => $this->user($request)->id,
            'approved_at' => now(),
            'notes' => $data['notes'] ?? $invoice->notes,
        ]);

        return $this->decisionPayload('supplier_invoice', $invoice->fresh());
    }

    private function reviewExpense(Request $request, int $id, array $data): array
    {
        $expense = Expense::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if($expense->status !== 'submitted', 422, 'Only submitted expenses can be reviewed.');

        $expense->update([
            'status' => $data['decision'] === 'approved' ? 'approved' : 'rejected',
            'approved_by' => $data['decision'] === 'approved' ? $this->user($request)->id : $expense->approved_by,
            'approved_at' => $data['decision'] === 'approved' ? now() : $expense->approved_at,
        ]);

        return $this->decisionPayload('expense', $expense->fresh());
    }

    private function reviewLeaveRequest(Request $request, int $id, array $data): array
    {
        $leave = LeaveRequest::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if($leave->status !== 'pending', 422, 'Only pending leave requests can be reviewed.');

        $leave->update([
            'status' => $data['decision'] === 'approved' ? 'approved' : 'rejected',
            'reviewed_by' => $this->user($request)->id,
            'reviewed_at' => now(),
            'review_notes' => $data['notes'] ?? null,
        ]);

        return $this->decisionPayload('leave_request', $leave->fresh());
    }

    private function reviewDailyReport(Request $request, int $id, array $data): array
    {
        $report = FieldDailyReport::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if($report->status !== 'submitted', 422, 'Only submitted daily reports can be reviewed.');

        $report->update([
            'status' => $data['decision'] === 'approved' ? 'approved' : 'rejected',
            'approved_by' => $data['decision'] === 'approved' ? $this->user($request)->id : null,
            'approved_at' => $data['decision'] === 'approved' ? now() : null,
        ]);

        return $this->decisionPayload('daily_report', $report->fresh());
    }

    private function reviewWorkPermit(Request $request, int $id, array $data): array
    {
        $permit = WorkPermit::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if($permit->status !== 'submitted', 422, 'Only submitted permits can be reviewed.');

        $permit->update([
            'status' => $data['decision'] === 'approved' ? 'approved' : 'rejected',
            'approved_by' => $data['decision'] === 'approved' ? $this->user($request)->id : $permit->approved_by,
        ]);

        return $this->decisionPayload('work_permit', $permit->fresh());
    }

    private function reviewClientApproval(Request $request, int $id, array $data): array
    {
        $approval = ClientApproval::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if(! in_array($approval->status, ['submitted', 'changes_required'], true), 422, 'Client approval is not awaiting review.');

        $approval->update([
            'status' => $data['decision'] === 'approved' ? 'approved' : 'rejected',
            'decision_notes' => $data['notes'] ?? null,
            'reviewed_at' => now(),
        ]);

        return $this->decisionPayload('client_approval', $approval->fresh());
    }

    private function reviewConsultantSubmittal(Request $request, int $id, array $data): array
    {
        $submittal = ConsultantSubmittal::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if(! in_array($submittal->status, ['submitted', 'in_review', 'revise_and_resubmit'], true), 422, 'Consultant submittal is not awaiting review.');

        $submittal->update([
            'status' => $data['decision'] === 'approved' ? 'approved' : 'rejected',
            'comments' => $data['notes'] ?? $submittal->comments,
            'reviewed_by' => $this->user($request)->id,
            'reviewed_at' => now(),
        ]);

        return $this->decisionPayload('consultant_submittal', $submittal->fresh());
    }

    private function reviewPortalWorkItem(Request $request, int $id, array $data): array
    {
        $item = PortalWorkItem::query()->forCompany($this->companyId($request))->whereKey($id)->firstOrFail();
        abort_if(! in_array($item->status, ['submitted', 'in_review', 'changes_required'], true), 422, 'Portal work item is not awaiting review.');

        $item->update([
            'status' => $data['decision'] === 'approved' ? $this->portalCompletionStatus($item->item_type) : 'rejected',
            'response' => $data['notes'] ?? $item->response,
            'reviewed_by' => $this->user($request)->id,
            'reviewed_at' => now(),
        ]);

        return $this->decisionPayload('portal_work_item', $item->fresh());
    }

    private function portalCompletionStatus(string $itemType): string
    {
        return match ($itemType) {
            'invoice_submission', 'payment_status_query' => 'paid',
            'inspection_signoff' => 'signed_off',
            'approval_request', 'digital_approval', 'drawing_review', 'submittal' => 'approved',
            default => 'completed',
        };
    }

    private function approvalItem(string $type, int $recordId, array $data): array
    {
        $submittedAt = $data['submitted_at'] ?? null;

        return [
            'type' => $type,
            'record_id' => $recordId,
            'module' => $data['module'] ?? '',
            'reference' => $data['reference'] ?? '',
            'title' => $data['title'] ?? '',
            'status' => $data['status'] ?? '',
            'priority' => $data['priority'] ?? 'normal',
            'amount' => round((float) ($data['amount'] ?? 0), 2),
            'requester' => $data['requester'] ?? '',
            'project' => $data['project'] ?? '',
            'context' => $data['context'] ?? '',
            'submitted_at' => $this->dateValue($submittedAt),
            'due_at' => $this->dateValue($data['due_at'] ?? null),
            'sort_at' => $this->sortTimestamp($submittedAt),
            'approve_label' => $data['approve_label'] ?? 'Approve',
            'deny_label' => $data['deny_label'] ?? 'Deny',
        ];
    }

    private function decisionPayload(string $type, object $record): array
    {
        return [
            'type' => $type,
            'record_id' => $record->id,
            'status' => $record->status,
        ];
    }

    private function userName(int|string|null $id): ?string
    {
        if (! $id) {
            return null;
        }

        $key = (int) $id;

        if (! array_key_exists($key, $this->userNames)) {
            $this->userNames[$key] = User::query()->whereKey($key)->value('name') ?? "User #{$key}";
        }

        return $this->userNames[$key];
    }

    private function projectName(?object $project): ?string
    {
        if (! $project) {
            return null;
        }

        return trim(($project->code ? "{$project->code} - " : '').$project->name);
    }

    private function dateValue(mixed $value): ?string
    {
        if ($value instanceof CarbonInterface) {
            return $value->toISOString();
        }

        return $value ? (string) $value : null;
    }

    private function sortTimestamp(mixed $value): int
    {
        if ($value instanceof CarbonInterface) {
            return $value->timestamp;
        }

        return $value ? Carbon::parse($value)->timestamp : 0;
    }

    private function oldestDays(Collection $items): int
    {
        $oldest = (int) $items->min('sort_at');

        return $oldest > 0 ? (int) Carbon::createFromTimestamp($oldest)->diffInDays(now()) : 0;
    }
}
