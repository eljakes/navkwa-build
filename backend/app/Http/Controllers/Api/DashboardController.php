<?php

namespace App\Http\Controllers\Api;

use App\Models\AttendanceRecord;
use App\Models\AuditLog;
use App\Models\BudgetLine;
use App\Models\ClientApproval;
use App\Models\ConsultantSubmittal;
use App\Models\Document;
use App\Models\Drawing;
use App\Models\EmployeeProfile;
use App\Models\EquipmentAsset;
use App\Models\Estimate;
use App\Models\Expense;
use App\Models\FieldDailyReport;
use App\Models\FieldIssue;
use App\Models\Inspection;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\LeaveRequest;
use App\Models\NonConformanceReport;
use App\Models\Opportunity;
use App\Models\Payment;
use App\Models\PayrollRun;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\SafetyIncident;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use App\Models\Tender;
use App\Models\WorkPermit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $portfolio = Project::query()
            ->forCompany($companyId)
            ->selectRaw('count(*) as total_projects')
            ->selectRaw("sum(case when status = 'active' then 1 else 0 end) as active_projects")
            ->selectRaw("sum(case when health_status = 'critical' then 1 else 0 end) as critical_projects")
            ->selectRaw('coalesce(sum(contract_value), 0) as contract_value')
            ->selectRaw('coalesce(sum(budget_total), 0) as budget_total')
            ->selectRaw('coalesce(sum(committed_total), 0) as committed_total')
            ->selectRaw('coalesce(sum(actual_cost), 0) as actual_cost')
            ->selectRaw('coalesce(avg(progress_percent), 0) as average_progress')
            ->first();

        $lateTasks = ProjectTask::query()
            ->forCompany($companyId)
            ->whereNotIn('status', ['done', 'cancelled'])
            ->whereDate('due_date', '<', now()->toDateString())
            ->count();

        $pendingApprovals = PurchaseRequisition::query()
            ->forCompany($companyId)
            ->where('status', 'submitted')
            ->count();

        $issuedPoValue = PurchaseOrder::query()
            ->forCompany($companyId)
            ->whereIn('status', ['issued', 'approved', 'delivered', 'closed'])
            ->sum('total_amount');

        $totalRevenue = Invoice::query()
            ->forCompany($companyId)
            ->where('status', '!=', 'draft')
            ->sum('total_amount');
        $totalCost = (float) ($portfolio->actual_cost ?? 0);

        return response()->json([
            'kpis' => [
                'total_projects' => (int) ($portfolio->total_projects ?? 0),
                'active_projects' => (int) ($portfolio->active_projects ?? 0),
                'critical_projects' => (int) ($portfolio->critical_projects ?? 0),
                'total_revenue' => (float) $totalRevenue,
                'total_cost' => $totalCost,
                'gross_profit' => (float) $totalRevenue - $totalCost,
                'contract_value' => (float) ($portfolio->contract_value ?? 0),
                'budget_total' => (float) ($portfolio->budget_total ?? 0),
                'committed_total' => (float) ($portfolio->committed_total ?? 0),
                'actual_cost' => $totalCost,
                'issued_po_value' => (float) $issuedPoValue,
                'variance' => (float) (($portfolio->budget_total ?? 0) - ($portfolio->actual_cost ?? 0)),
                'cost_variance' => (float) (($portfolio->budget_total ?? 0) - ($portfolio->actual_cost ?? 0)),
                'average_progress' => round((float) ($portfolio->average_progress ?? 0), 1),
                'average_days_to_finish' => $this->averageDaysToFinish($companyId),
                'late_tasks' => $lateTasks,
                'pending_approvals' => $pendingApprovals,
                'open_leads' => Lead::query()->forCompany($companyId)->whereNotIn('stage', ['won', 'lost'])->count(),
                'active_tenders' => Tender::query()->forCompany($companyId)->whereIn('status', ['draft', 'submitted', 'pending'])->count(),
                'open_field_issues' => FieldIssue::query()->forCompany($companyId)->whereNotIn('status', ['resolved', 'closed'])->count(),
                'reorder_alerts' => InventoryItem::query()->forCompany($companyId)->whereColumn('quantity_on_hand', '<=', 'reorder_level')->count(),
                'clocked_in' => AttendanceRecord::query()->forCompany($companyId)->where('status', 'open')->count(),
                'accounts_receivable' => (float) Invoice::query()->forCompany($companyId)->whereNotIn('payment_status', ['paid'])->sum('balance_due'),
                'payroll_liability' => (float) PayrollRun::query()->forCompany($companyId)->whereIn('status', ['draft', 'approved'])->sum('net_pay'),
                'equipment_available' => EquipmentAsset::query()->forCompany($companyId)->where('status', 'available')->count(),
                'open_ncrs' => NonConformanceReport::query()->forCompany($companyId)->whereNotIn('status', ['closed'])->count(),
                'open_incidents' => SafetyIncident::query()->forCompany($companyId)->whereNotIn('status', ['closed'])->count(),
                'portal_reviews' => ClientApproval::query()->forCompany($companyId)->where('status', 'submitted')->count()
                    + ConsultantSubmittal::query()->forCompany($companyId)->whereIn('status', ['submitted', 'in_review'])->count(),
            ],
            'portfolio_cards' => $this->portfolioCards($companyId),
            'budget_overview' => $this->budgetOverview($portfolio),
            'cash_flow_trend' => $this->cashFlowTrend($companyId),
            'procurement_overview' => $this->procurementOverview($companyId),
            'pending_approval_items' => $this->pendingApprovalItems($companyId),
            'inventory_alerts' => $this->inventoryAlerts($companyId),
            'workforce_attendance' => $this->workforceAttendance($companyId),
            'invoice_summary' => $this->invoiceSummary($companyId),
            'cost_breakdown' => $this->costBreakdown($companyId),
            'project_performance' => $this->projectPerformance($companyId),
            'project_health' => $this->projectHealth($companyId),
            'cost_by_category' => $this->costByCategory($companyId),
            'procurement_status' => $this->procurementStatus($companyId),
            'sales_pipeline' => $this->salesPipeline($companyId),
            'field_status' => $this->fieldStatus($companyId),
            'upcoming' => $this->upcoming($companyId),
            'recent_activity' => $this->recentActivity($companyId),
        ]);
    }

    public function reports(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        return response()->json([
            'portfolio' => Project::query()
                ->forCompany($companyId)
                ->with(['branch:id,name,code', 'client:id,name'])
                ->orderBy('status')
                ->orderBy('target_end_date')
                ->get(),
            'cost_control' => BudgetLine::query()
                ->forCompany($companyId)
                ->with('project:id,code,name,currency')
                ->orderBy('project_id')
                ->orderBy('cost_code')
                ->get()
                ->map(fn (BudgetLine $line) => [
                    'id' => $line->id,
                    'project' => $line->project,
                    'cost_code' => $line->cost_code,
                    'description' => $line->description,
                    'category' => $line->category,
                    'budget_amount' => (float) $line->budget_amount,
                    'committed_amount' => (float) $line->committed_amount,
                    'actual_amount' => (float) $line->actual_amount,
                    'forecast_amount' => (float) $line->forecast_amount,
                    'variance' => (float) $line->budget_amount - (float) $line->actual_amount,
                ]),
            'documents' => [
                'total' => Document::query()->forCompany($companyId)->count(),
                'by_type' => Document::query()
                    ->forCompany($companyId)
                    ->select('document_type', DB::raw('count(*) as total'))
                    ->groupBy('document_type')
                    ->orderByDesc('total')
                    ->get(),
                'drawings_by_status' => Drawing::query()
                    ->forCompany($companyId)
                    ->select('status', DB::raw('count(*) as total'))
                    ->groupBy('status')
                    ->get(),
            ],
            'procurement' => [
                'requisitions' => PurchaseRequisition::query()
                    ->forCompany($companyId)
                    ->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(total_estimated), 0) as value'))
                    ->groupBy('status')
                    ->get(),
                'purchase_orders' => PurchaseOrder::query()
                    ->forCompany($companyId)
                    ->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(total_amount), 0) as value'))
                    ->groupBy('status')
                    ->get(),
            ],
            'sales' => [
                'leads' => Lead::query()->forCompany($companyId)->select('stage', DB::raw('count(*) as total'), DB::raw('coalesce(sum(estimated_value), 0) as value'))->groupBy('stage')->get(),
                'opportunities' => Opportunity::query()->forCompany($companyId)->select('stage', DB::raw('count(*) as total'), DB::raw('coalesce(sum(estimated_value), 0) as value'))->groupBy('stage')->get(),
                'tenders' => Tender::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(value), 0) as value'))->groupBy('status')->get(),
                'estimates' => Estimate::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(total_amount), 0) as value'))->groupBy('status')->get(),
            ],
            'field' => [
                'daily_reports' => FieldDailyReport::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'))->groupBy('status')->get(),
                'issues' => FieldIssue::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'))->groupBy('status')->get(),
                'attendance_open' => AttendanceRecord::query()->forCompany($companyId)->where('status', 'open')->count(),
            ],
            'inventory' => [
                'items' => InventoryItem::query()->forCompany($companyId)->count(),
                'reorder_alerts' => InventoryItem::query()->forCompany($companyId)->whereColumn('quantity_on_hand', '<=', 'reorder_level')->get(),
            ],
            'finance' => [
                'invoices' => Invoice::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(total_amount), 0) as value'), DB::raw('coalesce(sum(balance_due), 0) as balance'))->groupBy('status')->get(),
                'expenses' => Expense::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(amount + tax_amount), 0) as value'))->groupBy('status')->get(),
                'receivables' => Invoice::query()->forCompany($companyId)->whereNotIn('payment_status', ['paid'])->with(['client:id,name', 'project:id,code,name'])->orderBy('due_date')->get(),
            ],
            'payroll' => [
                'employees' => EmployeeProfile::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'))->groupBy('status')->get(),
                'runs' => PayrollRun::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(net_pay), 0) as value'))->groupBy('status')->get(),
            ],
            'equipment' => EquipmentAsset::query()
                ->forCompany($companyId)
                ->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(hourly_rate), 0) as hourly_rate'))
                ->groupBy('status')
                ->get(),
            'quality' => [
                'inspections' => Inspection::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'))->groupBy('status')->get(),
                'ncrs' => NonConformanceReport::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'))->groupBy('status')->get(),
            ],
            'safety' => [
                'incidents' => SafetyIncident::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'))->groupBy('status')->get(),
                'permits' => WorkPermit::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'))->groupBy('status')->get(),
            ],
            'portals' => [
                'client_approvals' => ClientApproval::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'))->groupBy('status')->get(),
                'consultant_submittals' => ConsultantSubmittal::query()->forCompany($companyId)->select('status', DB::raw('count(*) as total'))->groupBy('status')->get(),
            ],
        ]);
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $logs = AuditLog::query()
            ->where('company_id', $this->companyId($request))
            ->latest('created_at')
            ->paginate((int) $request->query('per_page', 30));

        return response()->json($logs);
    }

    private function projectHealth(int $companyId)
    {
        return Project::query()
            ->forCompany($companyId)
            ->select('health_status', DB::raw('count(*) as total'))
            ->groupBy('health_status')
            ->get();
    }

    private function portfolioCards(int $companyId)
    {
        return Project::query()
            ->forCompany($companyId)
            ->with(['client:id,name'])
            ->whereIn('status', ['planning', 'active', 'on_hold'])
            ->orderByDesc('updated_at')
            ->limit(4)
            ->get()
            ->map(fn (Project $project): array => [
                'id' => $project->id,
                'code' => $project->code,
                'name' => $project->name,
                'client' => $project->client?->name,
                'status' => $project->status,
                'health_status' => $project->health_status,
                'country' => $project->country,
                'currency' => $project->currency,
                'contract_value' => (float) $project->contract_value,
                'budget_total' => (float) $project->budget_total,
                'actual_cost' => (float) $project->actual_cost,
                'progress_percent' => (int) $project->progress_percent,
                'target_end_date' => $project->target_end_date,
            ]);
    }

    private function budgetOverview(object $portfolio): array
    {
        $budget = (float) ($portfolio->budget_total ?? 0);
        $committed = (float) ($portfolio->committed_total ?? 0);
        $actual = (float) ($portfolio->actual_cost ?? 0);
        $balance = max(0, $budget - $actual);

        return [
            'budget' => $budget,
            'committed' => $committed,
            'actual' => $actual,
            'balance' => $balance,
            'utilized_percent' => $budget > 0 ? round(($actual / $budget) * 100, 1) : 0,
        ];
    }

    private function cashFlowTrend(int $companyId): array
    {
        $start = now()->startOfMonth()->subMonths(11);
        $end = now()->endOfMonth();

        $clientPayments = Payment::query()
            ->forCompany($companyId)
            ->whereBetween('received_at', [$start, $end])
            ->get(['amount', 'received_at']);
        $expenses = Expense::query()
            ->forCompany($companyId)
            ->whereBetween('paid_at', [$start, $end])
            ->get(['amount', 'tax_amount', 'paid_at']);
        $supplierPayments = SupplierPayment::query()
            ->forCompany($companyId)
            ->whereBetween('payment_date', [$start->toDateString(), $end->toDateString()])
            ->get(['amount', 'payment_date']);

        return collect(range(11, 0))
            ->map(function (int $offset) use ($clientPayments, $expenses, $supplierPayments): array {
                $month = now()->startOfMonth()->subMonths($offset);
                $monthKey = $month->format('Y-m');
                $inflow = $clientPayments
                    ->filter(fn (Payment $payment): bool => $payment->received_at?->format('Y-m') === $monthKey)
                    ->sum(fn (Payment $payment): float => (float) $payment->amount);
                $expenseOutflow = $expenses
                    ->filter(fn (Expense $expense): bool => $expense->paid_at?->format('Y-m') === $monthKey)
                    ->sum(fn (Expense $expense): float => (float) $expense->amount + (float) $expense->tax_amount);
                $supplierOutflow = $supplierPayments
                    ->filter(fn (SupplierPayment $payment): bool => $payment->payment_date?->format('Y-m') === $monthKey)
                    ->sum(fn (SupplierPayment $payment): float => (float) $payment->amount);

                return [
                    'month' => $monthKey,
                    'label' => $month->format('M'),
                    'inflow' => (float) $inflow,
                    'outflow' => (float) $expenseOutflow + (float) $supplierOutflow,
                ];
            })
            ->values()
            ->all();
    }

    private function procurementOverview(int $companyId): array
    {
        $statusRows = PurchaseOrder::query()
            ->forCompany($companyId)
            ->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(total_amount), 0) as value'))
            ->groupBy('status')
            ->orderBy('status')
            ->get();

        return [
            'total_po_value' => (float) $statusRows->sum('value'),
            'statuses' => $statusRows,
        ];
    }

    private function pendingApprovalItems(int $companyId): array
    {
        $requisitions = PurchaseRequisition::query()
            ->forCompany($companyId)
            ->with('project:id,name')
            ->where('status', 'submitted')
            ->latest('submitted_at')
            ->limit(8)
            ->get()
            ->map(fn (PurchaseRequisition $item): array => $this->approvalListItem(
                'Purchase Requisition',
                $item->title,
                $item->project?->name,
                (float) ($item->grand_total ?: $item->total_estimated),
                $item->priority,
                $item->submitted_at ?? $item->created_at,
                $item->required_by,
            ));

        $supplierInvoices = SupplierInvoice::query()
            ->forCompany($companyId)
            ->with('project:id,name')
            ->where('status', 'submitted')
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn (SupplierInvoice $item): array => $this->approvalListItem(
                'Supplier Invoice',
                $item->invoice_number,
                $item->project?->name,
                (float) $item->total_amount,
                'medium',
                $item->created_at,
                $item->due_date,
            ));

        $clientApprovals = ClientApproval::query()
            ->forCompany($companyId)
            ->with('project:id,name')
            ->where('status', 'submitted')
            ->latest('submitted_at')
            ->limit(8)
            ->get()
            ->map(fn (ClientApproval $item): array => $this->approvalListItem(
                'Client Approval',
                $item->title,
                $item->project?->name,
                0,
                'medium',
                $item->submitted_at ?? $item->created_at,
                $item->due_date,
            ));

        $consultantSubmittals = ConsultantSubmittal::query()
            ->forCompany($companyId)
            ->with('project:id,name')
            ->whereIn('status', ['submitted', 'in_review'])
            ->latest('submitted_at')
            ->limit(8)
            ->get()
            ->map(fn (ConsultantSubmittal $item): array => $this->approvalListItem(
                'Consultant Submittal',
                $item->title,
                $item->project?->name,
                0,
                'medium',
                $item->submitted_at ?? $item->created_at,
                $item->due_date,
            ));

        return $requisitions
            ->concat($supplierInvoices)
            ->concat($clientApprovals)
            ->concat($consultantSubmittals)
            ->sortByDesc('submitted_at')
            ->take(8)
            ->values()
            ->all();
    }

    private function approvalListItem(string $type, ?string $title, ?string $project, float $amount, string $priority, mixed $submittedAt, mixed $dueDate): array
    {
        return [
            'type' => $type,
            'title' => $title ?: $type,
            'project' => $project,
            'amount' => $amount,
            'priority' => $priority,
            'severity' => $this->approvalSeverity($priority, $amount, $dueDate),
            'submitted_at' => $submittedAt,
            'due_date' => $dueDate,
        ];
    }

    private function approvalSeverity(string $priority, float $amount, mixed $dueDate): string
    {
        if (in_array($priority, ['high', 'critical', 'urgent'], true) || $amount >= 100000) {
            return 'high';
        }

        if ($dueDate && now()->startOfDay()->diffInDays($dueDate, false) <= 3) {
            return 'medium';
        }

        return 'low';
    }

    private function inventoryAlerts(int $companyId)
    {
        return InventoryItem::query()
            ->forCompany($companyId)
            ->whereColumn('quantity_on_hand', '<=', 'reorder_level')
            ->orderBy('quantity_on_hand')
            ->limit(8)
            ->get()
            ->map(fn (InventoryItem $item): array => [
                'sku' => $item->sku,
                'name' => $item->name,
                'category' => $item->category,
                'unit' => $item->unit,
                'quantity_on_hand' => (float) $item->quantity_on_hand,
                'reorder_level' => (float) $item->reorder_level,
                'shortage' => max(0, (float) $item->reorder_level - (float) $item->quantity_on_hand),
            ]);
    }

    private function workforceAttendance(int $companyId): array
    {
        $today = now()->toDateString();
        $totalWorkers = EmployeeProfile::query()
            ->forCompany($companyId)
            ->where('status', 'active')
            ->count();
        $presentToday = AttendanceRecord::query()
            ->forCompany($companyId)
            ->whereDate('clock_in_at', $today)
            ->distinct('user_id')
            ->count('user_id');
        $onLeave = LeaveRequest::query()
            ->forCompany($companyId)
            ->where('status', 'approved')
            ->whereDate('starts_on', '<=', $today)
            ->whereDate('ends_on', '>=', $today)
            ->count();
        $absent = max(0, $totalWorkers - $presentToday - $onLeave);

        return [
            'total_workers' => $totalWorkers,
            'present_today' => $presentToday,
            'absent_today' => $absent,
            'on_leave' => $onLeave,
            'attendance_rate' => $totalWorkers > 0 ? round(($presentToday / $totalWorkers) * 100, 1) : 0,
            'last_updated_at' => AttendanceRecord::query()->forCompany($companyId)->latest('updated_at')->value('updated_at'),
        ];
    }

    private function invoiceSummary(int $companyId): array
    {
        $paid = Invoice::query()
            ->forCompany($companyId)
            ->where('payment_status', 'paid');
        $outstanding = Invoice::query()
            ->forCompany($companyId)
            ->where('payment_status', '!=', 'paid')
            ->where('status', '!=', 'draft');
        $overdue = Invoice::query()
            ->forCompany($companyId)
            ->where('payment_status', '!=', 'paid')
            ->whereDate('due_date', '<', now()->toDateString());
        $draft = Invoice::query()
            ->forCompany($companyId)
            ->where('status', 'draft');

        return [
            'paid' => ['count' => (clone $paid)->count(), 'amount' => (float) (clone $paid)->sum('total_amount')],
            'outstanding' => ['count' => (clone $outstanding)->count(), 'amount' => (float) (clone $outstanding)->sum('balance_due')],
            'overdue' => ['count' => (clone $overdue)->count(), 'amount' => (float) (clone $overdue)->sum('balance_due')],
            'draft' => ['count' => (clone $draft)->count(), 'amount' => (float) (clone $draft)->sum('total_amount')],
            'total_invoiced' => (float) Invoice::query()->forCompany($companyId)->sum('total_amount'),
        ];
    }

    private function costBreakdown(int $companyId)
    {
        $rows = BudgetLine::query()
            ->forCompany($companyId)
            ->select('category')
            ->selectRaw('coalesce(sum(actual_amount), 0) as actual')
            ->selectRaw('coalesce(sum(committed_amount), 0) as committed')
            ->selectRaw('coalesce(sum(budget_amount), 0) as budget')
            ->groupBy('category')
            ->orderByDesc('actual')
            ->get();
        $total = max(0.01, (float) $rows->sum(fn (BudgetLine $line): float => (float) $line->actual));

        return $rows->map(fn (BudgetLine $line): array => [
            'category' => $line->category,
            'actual' => (float) $line->actual,
            'committed' => (float) $line->committed,
            'budget' => (float) $line->budget,
            'percent' => round(((float) $line->actual / $total) * 100, 1),
        ]);
    }

    private function projectPerformance(int $companyId)
    {
        return Project::query()
            ->forCompany($companyId)
            ->orderByRaw("case when status = 'active' then 0 when status = 'on_hold' then 1 when status = 'planning' then 2 else 3 end")
            ->orderBy('target_end_date')
            ->limit(12)
            ->get()
            ->map(fn (Project $project): array => $this->projectPerformanceRow($project));
    }

    private function projectPerformanceRow(Project $project): array
    {
        $budget = (float) $project->budget_total;
        $actual = (float) $project->actual_cost;
        $progress = (float) $project->progress_percent;
        $earnedValue = $budget * ($progress / 100);
        $plannedProgress = $this->plannedProgressPercent($project);

        return [
            'id' => $project->id,
            'code' => $project->code,
            'project' => $project->name,
            'status' => $project->status,
            'health_status' => $project->health_status,
            'progress_percent' => $progress,
            'budget' => $budget,
            'budget_utilized_percent' => $budget > 0 ? round(($actual / $budget) * 100, 1) : 0,
            'cost_to_date' => $actual,
            'cost_variance' => $budget - $actual,
            'schedule_variance_days' => $this->scheduleVarianceDays($project),
            'spi' => $plannedProgress > 0 ? round($progress / $plannedProgress, 2) : null,
            'cpi' => $actual > 0 ? round($earnedValue / $actual, 2) : null,
        ];
    }

    private function plannedProgressPercent(Project $project): float
    {
        if (! $project->start_date || ! $project->target_end_date) {
            return 0;
        }

        $start = $project->start_date->startOfDay();
        $finish = $project->target_end_date->startOfDay();
        $today = now()->startOfDay();
        $duration = max(1, $start->diffInDays($finish));
        $elapsed = max(0, min($duration, $start->diffInDays($today)));

        return round(($elapsed / $duration) * 100, 1);
    }

    private function scheduleVarianceDays(Project $project): ?int
    {
        if (! $project->target_end_date) {
            return null;
        }

        $reference = $project->actual_end_date ?: now()->startOfDay();

        return (int) $reference->startOfDay()->diffInDays($project->target_end_date->startOfDay(), false);
    }

    private function averageDaysToFinish(int $companyId): int
    {
        $days = Project::query()
            ->forCompany($companyId)
            ->whereIn('status', ['planning', 'active', 'on_hold'])
            ->whereNotNull('target_end_date')
            ->get(['target_end_date'])
            ->map(fn (Project $project): int => (int) now()->startOfDay()->diffInDays($project->target_end_date->startOfDay(), false))
            ->filter(fn (int $days): bool => $days >= 0);

        return $days->isNotEmpty() ? (int) round($days->average()) : 0;
    }

    private function costByCategory(int $companyId)
    {
        return BudgetLine::query()
            ->forCompany($companyId)
            ->select('category')
            ->selectRaw('coalesce(sum(budget_amount), 0) as budget')
            ->selectRaw('coalesce(sum(committed_amount), 0) as committed')
            ->selectRaw('coalesce(sum(actual_amount), 0) as actual')
            ->groupBy('category')
            ->orderBy('category')
            ->get();
    }

    private function procurementStatus(int $companyId)
    {
        return [
            'requisitions' => PurchaseRequisition::query()
                ->forCompany($companyId)
                ->select('status', DB::raw('count(*) as total'))
                ->groupBy('status')
                ->get(),
            'purchase_orders' => PurchaseOrder::query()
                ->forCompany($companyId)
                ->select('status', DB::raw('count(*) as total'))
                ->groupBy('status')
                ->get(),
        ];
    }

    private function salesPipeline(int $companyId): array
    {
        return [
            'leads' => Lead::query()
                ->forCompany($companyId)
                ->select('stage', DB::raw('count(*) as total'), DB::raw('coalesce(sum(estimated_value), 0) as value'))
                ->groupBy('stage')
                ->get(),
            'opportunities' => Opportunity::query()
                ->forCompany($companyId)
                ->select('stage', DB::raw('count(*) as total'), DB::raw('coalesce(sum(estimated_value), 0) as value'))
                ->groupBy('stage')
                ->get(),
            'tenders' => Tender::query()
                ->forCompany($companyId)
                ->select('status', DB::raw('count(*) as total'), DB::raw('coalesce(sum(value), 0) as value'))
                ->groupBy('status')
                ->get(),
        ];
    }

    private function fieldStatus(int $companyId): array
    {
        return [
            'daily_reports' => FieldDailyReport::query()
                ->forCompany($companyId)
                ->select('status', DB::raw('count(*) as total'))
                ->groupBy('status')
                ->get(),
            'issues' => FieldIssue::query()
                ->forCompany($companyId)
                ->select('status', DB::raw('count(*) as total'))
                ->groupBy('status')
                ->get(),
        ];
    }

    private function upcoming(int $companyId): array
    {
        return [
            'tasks' => ProjectTask::query()
                ->forCompany($companyId)
                ->with('project:id,code,name')
                ->whereNotIn('status', ['done', 'cancelled'])
                ->whereNotNull('due_date')
                ->orderBy('due_date')
                ->limit(8)
                ->get(),
            'requisitions' => PurchaseRequisition::query()
                ->forCompany($companyId)
                ->with('project:id,code,name')
                ->whereIn('status', ['draft', 'submitted'])
                ->whereNotNull('required_by')
                ->orderBy('required_by')
                ->limit(8)
                ->get(),
        ];
    }

    private function recentActivity(int $companyId)
    {
        return AuditLog::query()
            ->where('company_id', $companyId)
            ->latest('created_at')
            ->limit(12)
            ->get();
    }
}
