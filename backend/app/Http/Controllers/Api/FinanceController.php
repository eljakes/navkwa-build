<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\BudgetLine;
use App\Models\Client;
use App\Models\Document;
use App\Models\EquipmentAsset;
use App\Models\Expense;
use App\Models\FinanceAccount;
use App\Models\FinanceBankAccount;
use App\Models\FinanceBankReconciliation;
use App\Models\FinanceCostCenter;
use App\Models\FinanceCreditNote;
use App\Models\FinanceFixedAsset;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceProgressBilling;
use App\Models\FinanceRetention;
use App\Models\FinanceTaxRule;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\Payment;
use App\Models\PayrollRun;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use App\Services\FinancePostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FinanceController extends ApiController
{
    private const FINANCE_WORKBOOK_EXTENSIONS = 'xls,xlsx,xlsm,csv';

    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $this->ensureFinanceFoundation($request);
        app(FinancePostingService::class)->syncPayrollRunsForCompany($companyId, $this->user($request)->id);

        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();

        $receivables = Invoice::query()
            ->forCompany($companyId)
            ->whereNotIn('status', ['draft', 'void'])
            ->selectRaw('coalesce(sum(total_amount), 0) as invoiced')
            ->selectRaw('coalesce(sum(amount_paid), 0) as paid')
            ->selectRaw('coalesce(sum(balance_due), 0) as outstanding')
            ->selectRaw('coalesce(sum(credit_note_amount), 0) as credited')
            ->first();

        $openClientInvoices = Invoice::query()
            ->forCompany($companyId)
            ->with(['client:id,name', 'project:id,code,name'])
            ->whereNotIn('status', ['draft', 'void'])
            ->where('balance_due', '>', 0)
            ->get();

        $openSupplierInvoices = SupplierInvoice::query()
            ->forCompany($companyId)
            ->with(['supplier:id,name', 'purchaseOrder:id,po_number,total_amount,payment_status', 'goodsReceipt:id,grn_number'])
            ->whereNotIn('status', ['paid', 'rejected'])
            ->where('balance_due', '>', 0)
            ->get();

        $cashBalance = (float) FinanceBankAccount::query()
            ->forCompany($companyId)
            ->where('status', 'active')
            ->sum('current_balance');

        $revenueThisMonth = (float) Invoice::query()
            ->forCompany($companyId)
            ->whereNotIn('status', ['draft', 'void'])
            ->whereBetween('issue_date', [$monthStart, $monthEnd])
            ->sum('subtotal');

        $expensesThisMonth = (float) Expense::query()
            ->forCompany($companyId)
            ->whereIn('status', ['approved', 'paid'])
            ->whereBetween(DB::raw('coalesce(incurred_on, date(created_at))'), [$monthStart, $monthEnd])
            ->sum(DB::raw('amount + tax_amount'));

        $budgetTotals = BudgetLine::query()
            ->forCompany($companyId)
            ->selectRaw('coalesce(sum(budget_amount), 0) as budget')
            ->selectRaw('coalesce(sum(committed_amount), 0) as committed')
            ->selectRaw('coalesce(sum(actual_amount), 0) as actual')
            ->selectRaw('coalesce(sum(forecast_amount), 0) as forecast')
            ->first();

        $payrollLiability = (float) PayrollRun::query()
            ->forCompany($companyId)
            ->whereIn('status', ['draft', 'approved'])
            ->sum('net_pay');

        $taxPayable = $this->taxPayable($companyId);
        $retentionHeld = (float) FinanceRetention::query()
            ->forCompany($companyId)
            ->whereIn('status', ['held', 'partial'])
            ->sum('balance_amount');

        $summary = [
            'cash_balance' => $cashBalance,
            'accounts_receivable' => (float) ($receivables->outstanding ?? 0),
            'accounts_payable' => (float) $openSupplierInvoices->sum('balance_due'),
            'revenue_this_month' => $revenueThisMonth,
            'expenses_this_month' => $expensesThisMonth,
            'profit' => $revenueThisMonth - $expensesThisMonth,
            'cash_flow' => $this->cashFlowNet($companyId, $monthStart, $monthEnd),
            'budget_utilization' => (float) ($budgetTotals->budget ?? 0) > 0 ? round((((float) ($budgetTotals->actual ?? 0) + (float) ($budgetTotals->committed ?? 0)) / (float) $budgetTotals->budget) * 100, 2) : 0,
            'retention_held' => $retentionHeld,
            'taxes_payable' => $taxPayable,
            'payroll' => $payrollLiability,
            'project_profitability' => $this->projectProfitability($companyId)->avg('margin_percent') ?? 0,
            'outstanding_purchase_orders' => (float) PurchaseOrder::query()->forCompany($companyId)->whereNotIn('status', ['draft', 'cancelled', 'closed'])->sum('total_amount'),
            'outstanding_invoices' => (float) ($receivables->outstanding ?? 0),
            'upcoming_payments' => (float) SupplierInvoice::query()->forCompany($companyId)->whereNotIn('status', ['paid', 'rejected'])->whereDate('due_date', '<=', now()->addDays(14)->toDateString())->sum('balance_due'),
            'invoiced' => (float) ($receivables->invoiced ?? 0),
            'paid' => (float) ($receivables->paid ?? 0),
            'outstanding' => (float) ($receivables->outstanding ?? 0),
            'overdue' => (float) Invoice::query()->forCompany($companyId)->whereNotIn('payment_status', ['paid'])->whereDate('due_date', '<', now()->toDateString())->sum('balance_due'),
            'approved_expenses' => (float) Expense::query()->forCompany($companyId)->whereIn('status', ['approved', 'paid'])->sum(DB::raw('amount + tax_amount')),
        ];
        $financeAutomationTriggers = ['expense_submitted', 'supplier_invoice_submitted', 'invoice_generated', 'payment_received'];
        $financeTriggerStatuses = collect($financeAutomationTriggers)->map(function (string $trigger) use ($companyId): array {
            $activeWorkflows = DB::table('automation_rules')
                ->where('company_id', $companyId)
                ->where('status', 'active')
                ->where('module', 'finance')
                ->where('trigger_event', $trigger)
                ->count();

            return [
                'trigger' => $trigger,
                'active_workflows' => $activeWorkflows,
                'status' => $activeWorkflows > 0 ? 'connected' : 'not_configured',
            ];
        })->values();
        $company = $this->user($request)->company;
        $financeSettings = [
            ...[
                'default_currency' => $company->default_currency,
                'multi_currency_enabled' => true,
                'audit_trail_enabled' => true,
                'ledger_posting' => 'automatic',
            ],
            ...($company->settings['finance'] ?? []),
        ];

        return response()->json([
            'summary' => $summary,
            'invoices' => Invoice::query()->forCompany($companyId)->with(['client', 'project:id,code,name', 'lines', 'payments.bankAccount', 'creditNotes', 'retentions'])->latest()->limit(120)->get(),
            'payments' => Payment::query()->forCompany($companyId)->with(['invoice:id,invoice_number,title', 'client:id,name', 'bankAccount:id,account_name,bank_name'])->latest('received_at')->limit(120)->get(),
            'expenses' => Expense::query()->forCompany($companyId)->with(['project:id,code,name', 'supplier:id,name'])->latest()->limit(120)->get(),
            'journal_entries' => JournalEntry::query()->forCompany($companyId)->with('lines')->latest('entry_date')->limit(100)->get(),
            'accounts_receivable' => $this->accountsReceivable($companyId, $openClientInvoices),
            'accounts_payable' => $this->accountsPayable($companyId, $openSupplierInvoices),
            'customers' => Client::query()->forCompany($companyId)->orderBy('name')->limit(120)->get(),
            'suppliers' => Supplier::query()->forCompany($companyId)->orderBy('name')->limit(120)->get(),
            'credit_notes' => FinanceCreditNote::query()->forCompany($companyId)->with(['invoice:id,invoice_number,title', 'client:id,name'])->latest('issue_date')->limit(100)->get(),
            'budgets' => $this->budgetManagement($companyId),
            'cash_flow' => $this->cashFlow($companyId),
            'bank_accounts' => FinanceBankAccount::query()->forCompany($companyId)->with('branch:id,name')->orderByDesc('is_default')->orderBy('account_name')->get(),
            'bank_reconciliations' => FinanceBankReconciliation::query()->forCompany($companyId)->with('bankAccount:id,account_name,bank_name')->latest('statement_date')->limit(80)->get(),
            'workbooks' => Document::query()
                ->forCompany($companyId)
                ->with(['branch:id,name,code', 'project:id,code,name'])
                ->where('document_type', 'finance_workbook')
                ->latest()
                ->limit(80)
                ->get(),
            'chart_of_accounts' => $this->chartOfAccounts($companyId),
            'general_ledger' => $this->generalLedger($companyId),
            'cost_centers' => FinanceCostCenter::query()->forCompany($companyId)->with('project:id,code,name')->orderBy('code')->get(),
            'fixed_assets' => $this->fixedAssets($companyId),
            'payroll_integration' => $this->payrollIntegration($companyId),
            'taxes' => $this->taxes($companyId),
            'retentions' => FinanceRetention::query()->forCompany($companyId)->with(['project:id,code,name', 'invoice:id,invoice_number,title', 'supplierInvoice:id,invoice_number'])->latest()->limit(120)->get(),
            'progress_billings' => FinanceProgressBilling::query()->forCompany($companyId)->with(['project:id,code,name,contract_value', 'invoice:id,invoice_number,title,status,balance_due'])->latest()->limit(120)->get(),
            'purchase_invoice_matching' => $this->purchaseInvoiceMatching($companyId),
            'financial_reports' => $this->financialReports($companyId, $summary, $openClientInvoices, $openSupplierInvoices),
            'approvals' => $this->financeApprovals($companyId),
            'audit_trail' => $this->auditTrail($companyId),
            'automation' => [
                'approval_triggers' => $financeTriggerStatuses,
                'connected_workflows' => DB::table('automation_rules')->where('company_id', $companyId)->where('status', 'active')->where('module', 'finance')->count(),
            ],
            'finance_settings' => $financeSettings,
        ]);
    }

    public function storeInvoice(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'client_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'currency' => ['nullable', 'string', 'size:3'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'retention_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'progress_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'billing_stage' => ['nullable', 'string', 'max:120'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.description' => ['required', 'string', 'max:255'],
            'lines.*.cost_code' => ['nullable', 'string', 'max:40'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'lines.*.unit' => ['nullable', 'string', 'max:24'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $project = null;
        $branchId = $data['branch_id'] ?? $this->user($request)->branch_id;
        $clientId = $data['client_id'] ?? null;

        if (! empty($data['project_id'])) {
            $project = Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
            $branchId = $project->branch_id;
            $clientId = $clientId ?: $project->client_id;
        }

        Branch::query()->forCompany($companyId)->whereKey($branchId)->firstOrFail();

        if ($clientId) {
            Client::query()->forCompany($companyId)->whereKey($clientId)->firstOrFail();
        }

        $invoice = DB::transaction(function () use ($request, $companyId, $data, $branchId, $clientId, $project) {
            $invoice = Invoice::query()->create([
                'company_id' => $companyId,
                'branch_id' => $branchId,
                'project_id' => $project?->id,
                'client_id' => $clientId,
                'invoice_number' => $this->nextNumber('INV', Invoice::class, 'invoice_number', $companyId),
                'title' => $data['title'],
                'status' => 'draft',
                'issue_date' => $data['issue_date'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'currency' => strtoupper($data['currency'] ?? $this->user($request)->company->default_currency),
                'retention_percent' => $data['retention_percent'] ?? 0,
                'progress_percent' => $data['progress_percent'] ?? 0,
                'billing_stage' => $data['billing_stage'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $this->user($request)->id,
                'updated_by' => $this->user($request)->id,
            ]);

            foreach ($data['lines'] as $line) {
                InvoiceLine::query()->create([
                    'company_id' => $companyId,
                    'invoice_id' => $invoice->id,
                    ...$this->invoiceLinePayload($line, $companyId),
                ]);
            }

            $this->syncInvoiceTotals($invoice);

            return $invoice;
        });

        return response()->json(['invoice' => $invoice->fresh(['client', 'project', 'lines', 'payments', 'retentions'])], 201);
    }

    public function addInvoiceLine(Request $request, Invoice $invoice): JsonResponse
    {
        $this->assertTenant($request, $invoice);
        abort_if(! in_array($invoice->status, ['draft', 'issued'], true), 422, 'Invoice lines can only be added to draft or issued invoices.');

        $data = $request->validate([
            'description' => ['required', 'string', 'max:255'],
            'cost_code' => ['nullable', 'string', 'max:40'],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'unit' => ['nullable', 'string', 'max:24'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $line = DB::transaction(function () use ($data, $invoice) {
            $line = InvoiceLine::query()->create([
                'company_id' => $invoice->company_id,
                'invoice_id' => $invoice->id,
                ...$this->invoiceLinePayload($data, $invoice->company_id),
            ]);

            $this->syncInvoiceTotals($invoice);

            return $line;
        });

        return response()->json(['line' => $line, 'invoice' => $invoice->fresh(['lines', 'payments', 'retentions'])], 201);
    }

    public function issueInvoice(Request $request, Invoice $invoice): JsonResponse
    {
        $this->assertTenant($request, $invoice);
        abort_if($invoice->lines()->count() === 0, 422, 'Invoice requires at least one line.');
        abort_if(! in_array($invoice->status, ['draft', 'issued'], true), 422, 'Invoice cannot be issued from its current status.');

        $data = $request->validate([
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        DB::transaction(function () use ($request, $invoice, $data) {
            $invoice->update([
                'status' => 'issued',
                'issue_date' => $invoice->issue_date ?: now()->toDateString(),
                'due_date' => $data['due_date'] ?? $invoice->due_date,
                'notes' => $data['notes'] ?? $invoice->notes,
                'issued_by' => $this->user($request)->id,
                'issued_at' => now(),
                'updated_by' => $this->user($request)->id,
            ]);

            $this->syncInvoiceTotals($invoice);
            $this->syncInvoiceRetention($request, $invoice->fresh());
            $this->postInvoiceLedger($request, $invoice->fresh());
        });

        $this->publishAutomationEvent($request, 'invoice_generated', [
            'record_type' => 'invoice',
            'record_id' => $invoice->id,
        ]);

        return response()->json(['invoice' => $invoice->fresh(['client', 'project', 'lines', 'payments', 'retentions'])]);
    }

    public function recordPayment(Request $request, Invoice $invoice): JsonResponse
    {
        $this->assertTenant($request, $invoice);
        abort_if(in_array($invoice->status, ['draft', 'void'], true), 422, 'Payments can only be recorded against issued invoices.');

        $data = $request->validate([
            'finance_bank_account_id' => ['nullable', 'integer'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['nullable', Rule::in(['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque'])],
            'reference' => ['nullable', 'string', 'max:120'],
            'received_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->syncInvoiceTotals($invoice);
        abort_if((float) $data['amount'] > (float) $invoice->fresh()->balance_due + 0.01, 422, 'Payment exceeds the invoice balance.');

        $bankAccount = $this->bankAccountForPayment($request, $data['finance_bank_account_id'] ?? null);

        $payment = DB::transaction(function () use ($request, $invoice, $data, $bankAccount) {
            $payment = Payment::query()->create([
                'company_id' => $invoice->company_id,
                'invoice_id' => $invoice->id,
                'client_id' => $invoice->client_id,
                'finance_bank_account_id' => $bankAccount->id,
                'payment_number' => $this->nextNumber('PAY', Payment::class, 'payment_number', $invoice->company_id),
                'amount' => $data['amount'],
                'currency' => $invoice->currency,
                'method' => $data['method'] ?? 'bank_transfer',
                'reference' => $data['reference'] ?? null,
                'received_at' => $data['received_at'] ?? now(),
                'received_by' => $this->user($request)->id,
                'notes' => $data['notes'] ?? null,
            ]);

            $bankAccount->increment('current_balance', (float) $payment->amount);
            $this->syncInvoiceTotals($invoice);
            $this->postPaymentLedger($request, $payment->fresh(['invoice', 'bankAccount']));

            return $payment;
        });

        $this->publishAutomationEvent($request, 'payment_received', [
            'record_type' => 'payment',
            'record_id' => $payment->id,
        ]);

        return response()->json(['payment' => $payment->fresh('bankAccount'), 'invoice' => $invoice->fresh(['payments.bankAccount', 'lines', 'retentions'])], 201);
    }

    public function storeExpense(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'supplier_id' => ['nullable', 'integer'],
            'category' => ['nullable', 'string', 'max:80'],
            'description' => ['required', 'string', 'max:255'],
            'cost_code' => ['nullable', 'string', 'max:40'],
            'amount' => ['required', 'numeric', 'min:0'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'incurred_on' => ['nullable', 'date'],
        ]);

        $branchId = $data['branch_id'] ?? $this->user($request)->branch_id;

        if (! empty($data['project_id'])) {
            $project = Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
            $branchId = $project->branch_id;
        }

        Branch::query()->forCompany($companyId)->whereKey($branchId)->firstOrFail();

        if (! empty($data['supplier_id'])) {
            Supplier::query()->forCompany($companyId)->whereKey($data['supplier_id'])->firstOrFail();
        }

        $expense = Expense::query()->create([
            'company_id' => $companyId,
            'branch_id' => $branchId,
            'expense_number' => $this->nextNumber('EXP', Expense::class, 'expense_number', $companyId),
            'category' => $data['category'] ?? 'site_cost',
            'cost_code' => $this->suppliedCode($data['cost_code'] ?? null)
                ?? $this->nextCompanyCode($this->codePrefix($data['category'] ?? $data['description'], 'CST'), Expense::class, 'cost_code', $companyId),
            'currency' => strtoupper($data['currency'] ?? $this->user($request)->company->default_currency),
            'status' => 'submitted',
            'submitted_by' => $this->user($request)->id,
            ...collect($data)->except(['branch_id', 'category', 'cost_code', 'currency'])->all(),
        ]);

        $this->publishAutomationEvent($request, 'expense_submitted', [
            'record_type' => 'expense',
            'record_id' => $expense->id,
        ]);

        return response()->json(['expense' => $expense->load(['project', 'supplier'])], 201);
    }

    public function reviewExpense(Request $request, Expense $expense): JsonResponse
    {
        $this->assertTenant($request, $expense);

        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected', 'paid'])],
            'finance_bank_account_id' => ['nullable', 'integer'],
        ]);

        $allowed = [
            'submitted' => ['approved', 'rejected'],
            'approved' => ['paid'],
            'paid' => [],
            'rejected' => [],
        ];

        abort_if(! in_array($data['status'], $allowed[$expense->status] ?? [], true), 422, 'Invalid expense transition.');

        $expense = DB::transaction(function () use ($request, $expense, $data) {
            $updates = [
                'status' => $data['status'],
                'approved_by' => $data['status'] === 'approved' ? $this->user($request)->id : $expense->approved_by,
                'approved_at' => $data['status'] === 'approved' ? now() : $expense->approved_at,
            ];

            if ($data['status'] === 'paid') {
                $updates['paid_at'] = now();
            }

            $expense->update($updates);

            if ($data['status'] === 'approved') {
                $this->postExpenseApprovalLedger($request, $expense->fresh());
            }

            if ($data['status'] === 'paid') {
                $bankAccount = $this->bankAccountForPayment($request, $data['finance_bank_account_id'] ?? null);
                $bankAccount->decrement('current_balance', (float) $expense->amount + (float) $expense->tax_amount);
                $this->postExpensePaymentLedger($request, $expense->fresh(), $bankAccount);
            }

            return $expense->fresh(['project', 'supplier']);
        });

        return response()->json(['expense' => $expense]);
    }

    public function storeJournalEntry(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'entry_date' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:4000'],
            'status' => ['nullable', Rule::in(['draft', 'posted'])],
            'lines' => ['required', 'array', 'min:2'],
            'lines.*.project_id' => ['nullable', 'integer'],
            'lines.*.account_code' => ['required', 'string', 'max:40'],
            'lines.*.account_name' => ['required', 'string', 'max:255'],
            'lines.*.description' => ['nullable', 'string', 'max:255'],
            'lines.*.debit' => ['nullable', 'numeric', 'min:0'],
            'lines.*.credit' => ['nullable', 'numeric', 'min:0'],
        ]);

        if (! empty($data['branch_id'])) {
            Branch::query()->forCompany($companyId)->whereKey($data['branch_id'])->firstOrFail();
        }

        $totalDebit = collect($data['lines'])->sum(fn (array $line) => (float) ($line['debit'] ?? 0));
        $totalCredit = collect($data['lines'])->sum(fn (array $line) => (float) ($line['credit'] ?? 0));

        abort_if(abs($totalDebit - $totalCredit) > 0.01, 422, 'Journal entry must balance debits and credits.');
        abort_if($totalDebit <= 0, 422, 'Journal entry requires debit and credit amounts.');

        $entry = DB::transaction(function () use ($request, $companyId, $data, $totalDebit, $totalCredit) {
            $entry = JournalEntry::query()->create([
                'company_id' => $companyId,
                'branch_id' => $data['branch_id'] ?? $this->user($request)->branch_id,
                'entry_number' => $this->nextNumber('JE', JournalEntry::class, 'entry_number', $companyId),
                'entry_date' => $data['entry_date'],
                'reference' => $data['reference'] ?? null,
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? 'draft',
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
                'posted_by' => ($data['status'] ?? 'draft') === 'posted' ? $this->user($request)->id : null,
                'posted_at' => ($data['status'] ?? 'draft') === 'posted' ? now() : null,
                'created_by' => $this->user($request)->id,
            ]);

            foreach ($data['lines'] as $line) {
                if (! empty($line['project_id'])) {
                    Project::query()->forCompany($companyId)->whereKey($line['project_id'])->firstOrFail();
                }

                JournalLine::query()->create([
                    'company_id' => $companyId,
                    'journal_entry_id' => $entry->id,
                    'project_id' => $line['project_id'] ?? null,
                    'account_code' => $line['account_code'],
                    'account_name' => $line['account_name'],
                    'description' => $line['description'] ?? null,
                    'debit' => $line['debit'] ?? 0,
                    'credit' => $line['credit'] ?? 0,
                ]);
            }

            if ($entry->status === 'posted') {
                $this->postJournalLedger($request, $entry->fresh('lines'));
            }

            return $entry;
        });

        return response()->json(['journal_entry' => $entry->fresh('lines')], 201);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'parent_id' => ['nullable', 'integer'],
            'account_code' => ['nullable', 'string', 'max:40'],
            'account_name' => ['required', 'string', 'max:255'],
            'account_type' => ['required', Rule::in(['asset', 'liability', 'equity', 'revenue', 'expense'])],
            'normal_balance' => ['nullable', Rule::in(['debit', 'credit'])],
            'is_control_account' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        if (! empty($data['parent_id'])) {
            FinanceAccount::query()->forCompany($companyId)->whereKey($data['parent_id'])->firstOrFail();
        }

        $account = FinanceAccount::query()->create([
            'company_id' => $companyId,
            'account_code' => $this->suppliedCode($data['account_code'] ?? null)
                ?? $this->nextCompanyCode($this->accountCodePrefix($data['account_type']), FinanceAccount::class, 'account_code', $companyId, 4),
            'normal_balance' => $data['normal_balance'] ?? (in_array($data['account_type'], ['asset', 'expense'], true) ? 'debit' : 'credit'),
            'is_control_account' => $data['is_control_account'] ?? false,
            'is_active' => $data['is_active'] ?? true,
            ...collect($data)->except(['account_code', 'normal_balance', 'is_control_account', 'is_active'])->all(),
        ]);

        return response()->json(['account' => $account], 201);
    }

    public function storeBankAccount(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'account_name' => ['required', 'string', 'max:255'],
            'bank_name' => ['required', 'string', 'max:255'],
            'account_number' => ['nullable', 'string', 'max:80'],
            'currency' => ['nullable', 'string', 'size:3'],
            'opening_balance' => ['nullable', 'numeric'],
            'current_balance' => ['nullable', 'numeric'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'is_default' => ['nullable', 'boolean'],
        ]);

        if (! empty($data['branch_id'])) {
            Branch::query()->forCompany($companyId)->whereKey($data['branch_id'])->firstOrFail();
        }

        $bankAccount = DB::transaction(function () use ($companyId, $data) {
            if (($data['is_default'] ?? false) === true) {
                FinanceBankAccount::query()->forCompany($companyId)->update(['is_default' => false]);
            }

            return FinanceBankAccount::query()->create([
                'company_id' => $companyId,
                'currency' => strtoupper($data['currency'] ?? 'GHS'),
                'opening_balance' => $data['opening_balance'] ?? 0,
                'current_balance' => $data['current_balance'] ?? ($data['opening_balance'] ?? 0),
                'status' => $data['status'] ?? 'active',
                'is_default' => $data['is_default'] ?? false,
                ...collect($data)->except(['currency', 'opening_balance', 'current_balance', 'status', 'is_default'])->all(),
            ]);
        });

        return response()->json(['bank_account' => $bankAccount->fresh('branch')], 201);
    }

    public function storeBankReconciliation(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'finance_bank_account_id' => ['required', 'integer'],
            'statement_date' => ['required', 'date'],
            'statement_balance' => ['required', 'numeric'],
            'status' => ['nullable', Rule::in(['draft', 'reconciled', 'exception'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $bankAccount = FinanceBankAccount::query()->forCompany($companyId)->whereKey($data['finance_bank_account_id'])->firstOrFail();
        $difference = (float) $data['statement_balance'] - (float) $bankAccount->current_balance;
        $status = $data['status'] ?? (abs($difference) <= 0.01 ? 'reconciled' : 'exception');

        $reconciliation = FinanceBankReconciliation::query()->create([
            'company_id' => $companyId,
            'finance_bank_account_id' => $bankAccount->id,
            'statement_date' => $data['statement_date'],
            'statement_balance' => $data['statement_balance'],
            'system_balance' => $bankAccount->current_balance,
            'difference' => $difference,
            'status' => $status,
            'reconciled_by' => $status === 'reconciled' ? $this->user($request)->id : null,
            'reconciled_at' => $status === 'reconciled' ? now() : null,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json(['bank_reconciliation' => $reconciliation->load('bankAccount')], 201);
    }

    public function storeWorkbook(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'workbook_type' => ['nullable', Rule::in(['bank_statement', 'invoice_import', 'expense_import', 'budget_import', 'journal_import', 'payroll_import', 'general_finance'])],
            'folder' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:4000'],
            'file' => ['required', 'file', 'max:51200', 'extensions:'.self::FINANCE_WORKBOOK_EXTENSIONS],
        ]);

        $branchId = $data['branch_id'] ?? $this->user($request)->branch_id;
        $projectId = $data['project_id'] ?? null;

        if ($projectId) {
            $project = Project::query()->forCompany($companyId)->whereKey($projectId)->firstOrFail();
            $branchId = $project->branch_id;
        } elseif ($branchId) {
            Branch::query()->forCompany($companyId)->whereKey($branchId)->firstOrFail();
        }

        $workbookType = $data['workbook_type'] ?? 'general_finance';
        $file = $request->file('file');
        $path = $file->store("navkwabuild/companies/{$companyId}/branches/".($branchId ?: 'company').'/finance/'.($projectId ?: 'shared'), 'local');

        $workbook = Document::query()->create([
            'company_id' => $companyId,
            'branch_id' => $branchId,
            'project_id' => $projectId,
            'uploaded_by' => $this->user($request)->id,
            'document_number' => $this->nextNumber('DOC', Document::class, 'document_number', $companyId),
            'title' => $data['title'],
            'document_type' => 'finance_workbook',
            'repository_scope' => $projectId ? 'project' : ($branchId ? 'branch' : 'company'),
            'folder' => $data['folder'] ?? 'Finance / '.ucwords(str_replace('_', ' ', $workbookType)),
            'version' => 1,
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
            'tags' => ['finance', $workbookType, strtolower($file->getClientOriginalExtension())],
            'description' => $data['description'] ?? null,
        ]);

        $this->publishAutomationEvent($request, 'document_uploaded', [
            'record_type' => 'finance_workbook',
            'record_id' => $workbook->id,
        ]);

        return response()->json(['workbook' => $workbook->load(['branch', 'project'])], 201);
    }

    public function storeCreditNote(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'invoice_id' => ['required', 'integer'],
            'issue_date' => ['nullable', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(['draft', 'approved'])],
        ]);

        $invoice = Invoice::query()->forCompany($companyId)->whereKey($data['invoice_id'])->firstOrFail();
        abort_if($invoice->status === 'draft', 422, 'Credit notes can only be raised against issued invoices.');

        $creditNote = DB::transaction(function () use ($request, $companyId, $data, $invoice) {
            $creditNote = FinanceCreditNote::query()->create([
                'company_id' => $companyId,
                'invoice_id' => $invoice->id,
                'client_id' => $invoice->client_id,
                'credit_note_number' => $this->nextNumber('CRN', FinanceCreditNote::class, 'credit_note_number', $companyId),
                'issue_date' => $data['issue_date'] ?? now()->toDateString(),
                'amount' => $data['amount'],
                'tax_amount' => $data['tax_amount'] ?? 0,
                'reason' => $data['reason'] ?? null,
                'status' => $data['status'] ?? 'approved',
                'approved_by' => ($data['status'] ?? 'approved') === 'approved' ? $this->user($request)->id : null,
                'approved_at' => ($data['status'] ?? 'approved') === 'approved' ? now() : null,
                'created_by' => $this->user($request)->id,
            ]);

            $this->syncInvoiceTotals($invoice);

            if ($creditNote->status === 'approved') {
                $this->postCreditNoteLedger($request, $creditNote->fresh('invoice'));
            }

            return $creditNote;
        });

        return response()->json(['credit_note' => $creditNote->fresh(['invoice', 'client'])], 201);
    }

    public function storeRetention(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'project_id' => ['nullable', 'integer'],
            'invoice_id' => ['nullable', 'integer'],
            'supplier_invoice_id' => ['nullable', 'integer'],
            'party_type' => ['required', Rule::in(['client', 'supplier'])],
            'base_amount' => ['nullable', 'numeric', 'min:0'],
            'retention_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'retention_amount' => ['nullable', 'numeric', 'min:0'],
            'due_date' => ['nullable', 'date'],
        ]);

        $invoice = ! empty($data['invoice_id'])
            ? Invoice::query()->forCompany($companyId)->whereKey($data['invoice_id'])->firstOrFail()
            : null;
        $supplierInvoice = ! empty($data['supplier_invoice_id'])
            ? SupplierInvoice::query()->forCompany($companyId)->whereKey($data['supplier_invoice_id'])->firstOrFail()
            : null;

        if (! empty($data['project_id'])) {
            Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
        }

        $baseAmount = (float) ($data['base_amount'] ?? $invoice?->total_amount ?? $supplierInvoice?->total_amount ?? 0);
        $retentionPercent = (float) ($data['retention_percent'] ?? 0);
        $retentionAmount = (float) ($data['retention_amount'] ?? round($baseAmount * ($retentionPercent / 100), 2));

        $retention = FinanceRetention::query()->create([
            'company_id' => $companyId,
            'project_id' => $data['project_id'] ?? $invoice?->project_id ?? $supplierInvoice?->project_id,
            'invoice_id' => $invoice?->id,
            'supplier_invoice_id' => $supplierInvoice?->id,
            'retention_number' => $this->nextNumber('RET', FinanceRetention::class, 'retention_number', $companyId),
            'party_type' => $data['party_type'],
            'base_amount' => $baseAmount,
            'retention_percent' => $retentionPercent,
            'retention_amount' => $retentionAmount,
            'balance_amount' => $retentionAmount,
            'status' => $retentionAmount > 0 ? 'held' : 'released',
            'due_date' => $data['due_date'] ?? null,
            'created_by' => $this->user($request)->id,
        ]);

        return response()->json(['retention' => $retention->load(['project', 'invoice', 'supplierInvoice'])], 201);
    }

    public function releaseRetention(Request $request, FinanceRetention $retention): JsonResponse
    {
        $this->assertTenant($request, $retention);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
        ]);

        abort_if($retention->balance_amount <= 0, 422, 'Retention has already been fully released.');

        $amount = min((float) $data['amount'], (float) $retention->balance_amount);
        $released = (float) $retention->released_amount + $amount;
        $balance = max(0, (float) $retention->retention_amount - $released);

        $retention->update([
            'released_amount' => $released,
            'balance_amount' => $balance,
            'status' => $balance <= 0.01 ? 'released' : 'partial',
            'released_at' => $balance <= 0.01 ? now() : $retention->released_at,
        ]);

        return response()->json(['retention' => $retention->fresh(['project', 'invoice', 'supplierInvoice'])]);
    }

    public function storeProgressBilling(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'project_id' => ['required', 'integer'],
            'milestone_name' => ['required', 'string', 'max:255'],
            'progress_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'billable_amount' => ['required', 'numeric', 'min:0'],
            'retention_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['nullable', Rule::in(['draft', 'certified', 'invoiced'])],
            'due_date' => ['nullable', 'date'],
            'create_invoice' => ['nullable', 'boolean'],
        ]);

        $project = Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
        abort_if(! $project->client_id && ($data['create_invoice'] ?? false), 422, 'A project client is required before creating a progress billing invoice.');

        $billing = DB::transaction(function () use ($request, $companyId, $data, $project) {
            $billing = FinanceProgressBilling::query()->create([
                'company_id' => $companyId,
                'project_id' => $project->id,
                'milestone_number' => $this->nextNumber('PB', FinanceProgressBilling::class, 'milestone_number', $companyId),
                'milestone_name' => $data['milestone_name'],
                'progress_percent' => $data['progress_percent'],
                'billable_amount' => $data['billable_amount'],
                'retention_percent' => $data['retention_percent'] ?? 0,
                'status' => $data['status'] ?? 'draft',
                'due_date' => $data['due_date'] ?? null,
                'certified_at' => in_array(($data['status'] ?? 'draft'), ['certified', 'invoiced'], true) ? now() : null,
                'created_by' => $this->user($request)->id,
            ]);

            if ($data['create_invoice'] ?? false) {
                $invoice = Invoice::query()->create([
                    'company_id' => $companyId,
                    'branch_id' => $project->branch_id,
                    'project_id' => $project->id,
                    'client_id' => $project->client_id,
                    'invoice_number' => $this->nextNumber('INV', Invoice::class, 'invoice_number', $companyId),
                    'title' => 'Progress billing - '.$billing->milestone_name,
                    'status' => 'draft',
                    'issue_date' => now()->toDateString(),
                    'due_date' => $billing->due_date,
                    'currency' => $project->currency,
                    'retention_percent' => $billing->retention_percent,
                    'progress_percent' => $billing->progress_percent,
                    'billing_stage' => $billing->milestone_name,
                    'created_by' => $this->user($request)->id,
                    'updated_by' => $this->user($request)->id,
                ]);

                InvoiceLine::query()->create([
                    'company_id' => $companyId,
                    'invoice_id' => $invoice->id,
                    'description' => $billing->milestone_name,
                    'cost_code' => $this->nextCompanyCode('PBL', InvoiceLine::class, 'cost_code', $companyId),
                    'quantity' => 1,
                    'unit' => 'milestone',
                    'unit_price' => $billing->billable_amount,
                    'tax_rate' => 0,
                    'line_subtotal' => $billing->billable_amount,
                    'tax_amount' => 0,
                    'line_total' => $billing->billable_amount,
                ]);

                $this->syncInvoiceTotals($invoice);
                $billing->update([
                    'invoice_id' => $invoice->id,
                    'status' => 'invoiced',
                    'invoiced_at' => now(),
                ]);
            }

            return $billing;
        });

        return response()->json(['progress_billing' => $billing->fresh(['project', 'invoice'])], 201);
    }

    public function storeTaxRule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tax_name' => ['required', 'string', 'max:255'],
            'tax_type' => ['required', 'string', 'max:80'],
            'rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'applies_to' => ['nullable', Rule::in(['sales', 'purchases', 'payroll', 'retention', 'all'])],
            'is_active' => ['nullable', 'boolean'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
        ]);

        $taxRule = FinanceTaxRule::query()->create([
            'company_id' => $this->companyId($request),
            'applies_to' => $data['applies_to'] ?? 'sales',
            'is_active' => $data['is_active'] ?? true,
            ...collect($data)->except(['applies_to', 'is_active'])->all(),
        ]);

        return response()->json(['tax_rule' => $taxRule], 201);
    }

    public function storeCostCenter(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'project_id' => ['nullable', 'integer'],
            'code' => ['nullable', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', Rule::in(['project', 'workshop', 'head_office', 'equipment_yard', 'department'])],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        if (! empty($data['project_id'])) {
            Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
        }

        $costCenter = FinanceCostCenter::query()->create([
            'company_id' => $companyId,
            'code' => $this->suppliedCode($data['code'] ?? null)
                ?? $this->nextCompanyCode($this->codePrefix($data['name'], 'CC'), FinanceCostCenter::class, 'code', $companyId),
            'type' => $data['type'] ?? 'project',
            'status' => $data['status'] ?? 'active',
            ...collect($data)->except(['code', 'type', 'status'])->all(),
        ]);

        return response()->json(['cost_center' => $costCenter->load('project')], 201);
    }

    public function storeFixedAsset(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'equipment_asset_id' => ['nullable', 'integer'],
            'branch_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:80'],
            'purchase_date' => ['nullable', 'date'],
            'purchase_cost' => ['required', 'numeric', 'min:0'],
            'depreciation_method' => ['nullable', Rule::in(['straight_line', 'reducing_balance', 'none'])],
            'useful_life_months' => ['nullable', 'integer', 'min:1', 'max:600'],
            'status' => ['nullable', Rule::in(['active', 'disposed', 'impaired'])],
        ]);

        if (! empty($data['equipment_asset_id'])) {
            EquipmentAsset::query()->forCompany($companyId)->whereKey($data['equipment_asset_id'])->firstOrFail();
        }

        if (! empty($data['branch_id'])) {
            Branch::query()->forCompany($companyId)->whereKey($data['branch_id'])->firstOrFail();
        }

        $depreciation = $this->calculateDepreciation(
            (float) $data['purchase_cost'],
            (int) ($data['useful_life_months'] ?? 60),
            $data['purchase_date'] ?? null,
            $data['depreciation_method'] ?? 'straight_line'
        );

        $asset = FinanceFixedAsset::query()->create([
            'company_id' => $companyId,
            'asset_number' => $this->nextNumber('FAS', FinanceFixedAsset::class, 'asset_number', $companyId),
            'category' => $data['category'] ?? 'equipment',
            'depreciation_method' => $data['depreciation_method'] ?? 'straight_line',
            'useful_life_months' => $data['useful_life_months'] ?? 60,
            'accumulated_depreciation' => $depreciation,
            'current_value' => max(0, (float) $data['purchase_cost'] - $depreciation),
            'status' => $data['status'] ?? 'active',
            ...collect($data)->except(['category', 'depreciation_method', 'useful_life_months', 'status'])->all(),
        ]);

        return response()->json(['fixed_asset' => $asset->load(['equipmentAsset', 'branch'])], 201);
    }

    private function accountsReceivable(int $companyId, Collection $openInvoices): array
    {
        $customerRows = Client::query()
            ->forCompany($companyId)
            ->orderBy('name')
            ->get()
            ->map(function (Client $client) use ($openInvoices): array {
                $invoices = $openInvoices->where('client_id', $client->id);

                return [
                    'client_id' => $client->id,
                    'client' => $client->name,
                    'outstanding' => (float) $invoices->sum('balance_due'),
                    'aging' => $this->agingBuckets($invoices, 'due_date', 'balance_due'),
                    'invoice_count' => $invoices->count(),
                ];
            })
            ->filter(fn (array $row): bool => $row['outstanding'] > 0)
            ->values();

        return [
            'aging' => $this->agingBuckets($openInvoices, 'due_date', 'balance_due'),
            'customers' => $customerRows,
            'statements' => $openInvoices->sortBy('due_date')->values(),
            'collections' => $openInvoices->filter(fn (Invoice $invoice): bool => $invoice->due_date && $invoice->due_date->lt(now()))->values(),
        ];
    }

    private function accountsPayable(int $companyId, Collection $openInvoices): array
    {
        $supplierRows = Supplier::query()
            ->forCompany($companyId)
            ->orderBy('name')
            ->get()
            ->map(function (Supplier $supplier) use ($openInvoices): array {
                $invoices = $openInvoices->where('supplier_id', $supplier->id);

                return [
                    'supplier_id' => $supplier->id,
                    'supplier' => $supplier->name,
                    'outstanding' => (float) $invoices->sum('balance_due'),
                    'aging' => $this->agingBuckets($invoices, 'due_date', 'balance_due'),
                    'invoice_count' => $invoices->count(),
                ];
            })
            ->filter(fn (array $row): bool => $row['outstanding'] > 0)
            ->values();

        return [
            'aging' => $this->agingBuckets($openInvoices, 'due_date', 'balance_due'),
            'suppliers' => $supplierRows,
            'due_this_week' => $openInvoices->filter(fn (SupplierInvoice $invoice): bool => $invoice->due_date && $invoice->due_date->between(now()->startOfDay(), now()->addDays(7)->endOfDay()))->values(),
            'blocked_invoices' => $openInvoices->where('status', 'submitted')->values(),
        ];
    }

    private function chartOfAccounts(int $companyId): array
    {
        $balances = FinanceLedgerEntry::query()
            ->forCompany($companyId)
            ->select('finance_account_id')
            ->selectRaw('coalesce(sum(debit), 0) as debit')
            ->selectRaw('coalesce(sum(credit), 0) as credit')
            ->groupBy('finance_account_id')
            ->get()
            ->keyBy('finance_account_id');

        $accounts = FinanceAccount::query()
            ->forCompany($companyId)
            ->with('parent:id,account_code,account_name')
            ->orderBy('account_code')
            ->get()
            ->map(function (FinanceAccount $account) use ($balances): array {
                $balance = $balances->get($account->id);
                $debit = (float) ($balance->debit ?? 0);
                $credit = (float) ($balance->credit ?? 0);

                return [
                    'id' => $account->id,
                    'account_code' => $account->account_code,
                    'account_name' => $account->account_name,
                    'account_type' => $account->account_type,
                    'normal_balance' => $account->normal_balance,
                    'parent' => $account->parent,
                    'is_control_account' => $account->is_control_account,
                    'is_active' => $account->is_active,
                    'debit' => $debit,
                    'credit' => $credit,
                    'balance' => $account->normal_balance === 'credit' ? $credit - $debit : $debit - $credit,
                ];
            });

        return [
            'accounts' => $accounts,
            'by_type' => $accounts->groupBy('account_type')->map(fn (Collection $items): array => [
                'count' => $items->count(),
                'balance' => (float) $items->sum('balance'),
            ]),
        ];
    }

    private function generalLedger(int $companyId): array
    {
        $entries = FinanceLedgerEntry::query()
            ->forCompany($companyId)
            ->with(['account:id,account_code,account_name,account_type,normal_balance', 'project:id,code,name', 'costCenter:id,code,name'])
            ->latest('entry_date')
            ->latest('id')
            ->limit(250)
            ->get();

        return [
            'entries' => $entries,
            'account_balances' => $this->chartOfAccounts($companyId)['accounts'],
        ];
    }

    private function budgetManagement(int $companyId): array
    {
        $lines = BudgetLine::query()
            ->forCompany($companyId)
            ->with('project:id,code,name')
            ->orderBy('cost_code')
            ->get();

        $summary = [
            'budget' => (float) $lines->sum('budget_amount'),
            'actual' => (float) $lines->sum('actual_amount'),
            'committed' => (float) $lines->sum('committed_amount'),
            'forecast' => (float) $lines->sum('forecast_amount'),
        ];
        $summary['remaining'] = max(0, $summary['budget'] - $summary['actual'] - $summary['committed']);
        $summary['variance'] = $summary['budget'] - max($summary['forecast'], $summary['actual'] + $summary['committed']);

        return [
            'summary' => $summary,
            'lines' => $lines,
            'by_project' => $lines->groupBy('project_id')->map(function (Collection $items): array {
                $project = $items->first()?->project;
                $budget = (float) $items->sum('budget_amount');
                $actual = (float) $items->sum('actual_amount');
                $committed = (float) $items->sum('committed_amount');

                return [
                    'project' => $project?->name ?? 'Unassigned',
                    'budget' => $budget,
                    'actual' => $actual,
                    'committed' => $committed,
                    'remaining' => max(0, $budget - $actual - $committed),
                ];
            })->values(),
        ];
    }

    private function cashFlow(int $companyId): array
    {
        $months = collect(range(0, 5))->map(function (int $offset): array {
            $date = now()->startOfMonth()->addMonths($offset);

            return [
                'key' => $date->format('Y-m'),
                'period' => $date->format('M Y'),
                'inflows' => 0.0,
                'outflows' => 0.0,
                'net' => 0.0,
            ];
        })->keyBy('key');

        Invoice::query()
            ->forCompany($companyId)
            ->whereNotIn('payment_status', ['paid'])
            ->where('balance_due', '>', 0)
            ->whereNotNull('due_date')
            ->get()
            ->each(function (Invoice $invoice) use ($months): void {
                $key = $invoice->due_date->format('Y-m');
                if ($months->has($key)) {
                    $month = $months->get($key);
                    $month['inflows'] += (float) $invoice->balance_due;
                    $months->put($key, $month);
                }
            });

        SupplierInvoice::query()
            ->forCompany($companyId)
            ->whereNotIn('status', ['paid', 'rejected'])
            ->where('balance_due', '>', 0)
            ->whereNotNull('due_date')
            ->get()
            ->each(function (SupplierInvoice $invoice) use ($months): void {
                $key = $invoice->due_date->format('Y-m');
                if ($months->has($key)) {
                    $month = $months->get($key);
                    $month['outflows'] += (float) $invoice->balance_due;
                    $months->put($key, $month);
                }
            });

        PayrollRun::query()
            ->forCompany($companyId)
            ->whereIn('status', ['draft', 'approved'])
            ->get()
            ->each(function (PayrollRun $run) use ($months): void {
                $key = $run->period_end->format('Y-m');
                if ($months->has($key)) {
                    $month = $months->get($key);
                    $month['outflows'] += (float) $run->net_pay;
                    $months->put($key, $month);
                }
            });

        return [
            'position' => [
                'opening_cash' => (float) FinanceBankAccount::query()->forCompany($companyId)->sum('opening_balance'),
                'current_cash' => (float) FinanceBankAccount::query()->forCompany($companyId)->sum('current_balance'),
                'expected_receipts' => (float) Invoice::query()->forCompany($companyId)->whereNotIn('payment_status', ['paid'])->sum('balance_due'),
                'supplier_obligations' => (float) SupplierInvoice::query()->forCompany($companyId)->whereNotIn('status', ['paid', 'rejected'])->sum('balance_due'),
            ],
            'forecast' => $months->map(function (array $month): array {
                $month['net'] = $month['inflows'] - $month['outflows'];

                return $month;
            })->values(),
        ];
    }

    private function fixedAssets(int $companyId): array
    {
        $assets = FinanceFixedAsset::query()
            ->forCompany($companyId)
            ->with(['equipmentAsset:id,equipment_number,name,status', 'branch:id,name'])
            ->orderBy('asset_number')
            ->get();

        return [
            'assets' => $assets,
            'equipment_candidates' => EquipmentAsset::query()->forCompany($companyId)->where('purchase_cost', '>', 0)->with('branch:id,name')->orderBy('name')->limit(80)->get(),
            'summary' => [
                'purchase_cost' => (float) $assets->sum('purchase_cost'),
                'current_value' => (float) $assets->sum('current_value'),
                'accumulated_depreciation' => (float) $assets->sum('accumulated_depreciation'),
            ],
        ];
    }

    private function payrollIntegration(int $companyId): array
    {
        $financePosting = app(FinancePostingService::class);
        $runs = PayrollRun::query()
            ->forCompany($companyId)
            ->with('payslips.employeeProfile.user:id,name,email')
            ->latest('period_end')
            ->limit(60)
            ->get()
            ->each(fn (PayrollRun $run): PayrollRun => $financePosting->attachPayrollFinanceStatus($run));

        return [
            'runs' => $runs,
            'summary' => [
                'draft' => (float) $runs->where('status', 'draft')->sum('net_pay'),
                'approved' => (float) $runs->where('status', 'approved')->sum('net_pay'),
                'paid' => (float) $runs->where('status', 'paid')->sum('net_pay'),
                'tax_withheld' => (float) $runs->flatMap->payslips->sum('tax_amount'),
            ],
        ];
    }

    private function taxes(int $companyId): array
    {
        return [
            'rules' => FinanceTaxRule::query()->forCompany($companyId)->orderBy('tax_type')->orderBy('tax_name')->get(),
            'sales_tax_collected' => (float) Invoice::query()->forCompany($companyId)->whereNotIn('status', ['draft', 'void'])->sum('tax_amount'),
            'purchase_tax_recorded' => (float) SupplierInvoice::query()->forCompany($companyId)->whereNotIn('status', ['rejected'])->sum('tax_amount'),
            'payroll_tax_withheld' => (float) DB::table('payslips')->where('company_id', $companyId)->sum('tax_amount'),
            'taxes_payable' => $this->taxPayable($companyId),
        ];
    }

    private function purchaseInvoiceMatching(int $companyId): Collection
    {
        return SupplierInvoice::query()
            ->forCompany($companyId)
            ->with(['supplier:id,name', 'purchaseOrder:id,po_number,total_amount,payment_status', 'goodsReceipt:id,grn_number,status'])
            ->latest('invoice_date')
            ->limit(120)
            ->get()
            ->map(function (SupplierInvoice $invoice): array {
                $poTotal = (float) ($invoice->purchaseOrder?->total_amount ?? 0);
                $invoiceTotal = (float) $invoice->total_amount;
                $variance = $invoiceTotal - $poTotal;

                return [
                    'invoice_id' => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'supplier' => $invoice->supplier?->name,
                    'purchase_order' => $invoice->purchaseOrder?->po_number,
                    'goods_receipt' => $invoice->goodsReceipt?->grn_number,
                    'po_total' => $poTotal,
                    'invoice_total' => $invoiceTotal,
                    'variance' => $variance,
                    'grn_status' => $invoice->goodsReceipt?->status,
                    'match_status' => abs($variance) <= 0.01 && $invoice->goodsReceipt ? 'matched' : 'exception',
                    'status' => $invoice->status,
                ];
            });
    }

    private function financialReports(int $companyId, array $summary, Collection $openClientInvoices, Collection $openSupplierInvoices): array
    {
        $trialBalance = $this->chartOfAccounts($companyId)['accounts'];
        $fixedAssetValue = (float) FinanceFixedAsset::query()->forCompany($companyId)->sum('current_value');

        return [
            'income_statement' => [
                ['line' => 'Recognized revenue', 'amount' => $summary['revenue_this_month']],
                ['line' => 'Expenses', 'amount' => $summary['expenses_this_month']],
                ['line' => 'Gross profit', 'amount' => $summary['profit']],
            ],
            'balance_sheet' => [
                ['line' => 'Cash and bank', 'amount' => $summary['cash_balance']],
                ['line' => 'Accounts receivable', 'amount' => $summary['accounts_receivable']],
                ['line' => 'Fixed assets', 'amount' => $fixedAssetValue],
                ['line' => 'Accounts payable', 'amount' => $summary['accounts_payable']],
                ['line' => 'Payroll liabilities', 'amount' => $summary['payroll']],
                ['line' => 'Taxes payable', 'amount' => $summary['taxes_payable']],
                ['line' => 'Net position', 'amount' => $summary['cash_balance'] + $summary['accounts_receivable'] + $fixedAssetValue - $summary['accounts_payable'] - $summary['payroll'] - $summary['taxes_payable']],
            ],
            'cash_flow_statement' => $this->cashFlow($companyId)['forecast'],
            'trial_balance' => $trialBalance,
            'general_ledger' => FinanceLedgerEntry::query()->forCompany($companyId)->with('account:id,account_code,account_name')->latest('entry_date')->limit(300)->get(),
            'accounts_receivable_aging' => $this->agingBuckets($openClientInvoices, 'due_date', 'balance_due'),
            'accounts_payable_aging' => $this->agingBuckets($openSupplierInvoices, 'due_date', 'balance_due'),
            'expense_analysis' => Expense::query()->forCompany($companyId)->select('category')->selectRaw('coalesce(sum(amount + tax_amount), 0) as total')->groupBy('category')->orderByDesc('total')->get(),
            'budget_variance' => $this->budgetManagement($companyId)['by_project'],
            'project_profitability' => $this->projectProfitability($companyId),
            'retention_report' => FinanceRetention::query()->forCompany($companyId)->select('party_type', 'status')->selectRaw('coalesce(sum(balance_amount), 0) as balance')->groupBy('party_type', 'status')->get(),
            'tax_report' => $this->taxes($companyId),
        ];
    }

    private function financeApprovals(int $companyId): array
    {
        return [
            'expenses' => Expense::query()->forCompany($companyId)->with(['project:id,code,name', 'supplier:id,name'])->where('status', 'submitted')->latest()->limit(80)->get(),
            'supplier_invoices' => SupplierInvoice::query()->forCompany($companyId)->with(['supplier:id,name', 'purchaseOrder:id,po_number'])->where('status', 'submitted')->latest()->limit(80)->get(),
            'draft_invoices' => Invoice::query()->forCompany($companyId)->with(['client:id,name', 'project:id,code,name'])->where('status', 'draft')->latest()->limit(80)->get(),
        ];
    }

    private function auditTrail(int $companyId): Collection
    {
        return AuditLog::query()
            ->where('company_id', $companyId)
            ->whereIn('auditable_type', [
                Invoice::class,
                InvoiceLine::class,
                Payment::class,
                Expense::class,
                JournalEntry::class,
                JournalLine::class,
                SupplierInvoice::class,
                SupplierPayment::class,
                FinanceAccount::class,
                FinanceBankAccount::class,
                FinanceBankReconciliation::class,
                FinanceLedgerEntry::class,
                FinanceCreditNote::class,
                FinanceRetention::class,
                FinanceProgressBilling::class,
                FinanceCostCenter::class,
                FinanceFixedAsset::class,
                FinanceTaxRule::class,
            ])
            ->latest('created_at')
            ->limit(120)
            ->get();
    }

    private function projectProfitability(int $companyId): Collection
    {
        return Project::query()
            ->forCompany($companyId)
            ->with('client:id,name')
            ->orderBy('name')
            ->limit(120)
            ->get()
            ->map(function (Project $project): array {
                $revenue = (float) Invoice::query()->where('project_id', $project->id)->whereNotIn('status', ['draft', 'void'])->sum('subtotal');
                $actual = (float) BudgetLine::query()->where('project_id', $project->id)->sum('actual_amount');
                $expenses = (float) Expense::query()->where('project_id', $project->id)->whereIn('status', ['approved', 'paid'])->sum(DB::raw('amount + tax_amount'));
                $cost = $actual + $expenses;
                $profit = $revenue - $cost;

                return [
                    'project_id' => $project->id,
                    'project' => $project->name,
                    'client' => $project->client?->name,
                    'contract_value' => (float) $project->contract_value,
                    'recognized_revenue' => $revenue,
                    'cost' => $cost,
                    'profit' => $profit,
                    'margin_percent' => $revenue > 0 ? round(($profit / $revenue) * 100, 2) : 0,
                ];
            });
    }

    private function cashFlowNet(int $companyId, string $monthStart, string $monthEnd): float
    {
        $inflows = (float) Payment::query()
            ->forCompany($companyId)
            ->whereBetween(DB::raw('date(received_at)'), [$monthStart, $monthEnd])
            ->sum('amount');

        $supplierPayments = (float) SupplierPayment::query()
            ->forCompany($companyId)
            ->whereBetween('payment_date', [$monthStart, $monthEnd])
            ->sum('amount');

        $paidExpenses = (float) Expense::query()
            ->forCompany($companyId)
            ->where('status', 'paid')
            ->whereBetween(DB::raw('date(paid_at)'), [$monthStart, $monthEnd])
            ->sum(DB::raw('amount + tax_amount'));

        $payroll = (float) PayrollRun::query()
            ->forCompany($companyId)
            ->where('status', 'paid')
            ->whereBetween(DB::raw('date(paid_at)'), [$monthStart, $monthEnd])
            ->sum('net_pay');

        return $inflows - $supplierPayments - $paidExpenses - $payroll;
    }

    private function taxPayable(int $companyId): float
    {
        $salesTax = (float) Invoice::query()->forCompany($companyId)->whereNotIn('status', ['draft', 'void'])->sum('tax_amount');
        $purchaseTax = (float) SupplierInvoice::query()->forCompany($companyId)->whereNotIn('status', ['rejected'])->sum('tax_amount');
        $payrollTax = (float) DB::table('payslips')->where('company_id', $companyId)->whereIn('status', ['draft', 'approved'])->sum('tax_amount');

        return max(0, $salesTax + $payrollTax - $purchaseTax);
    }

    private function agingBuckets(Collection $records, string $dateField, string $amountField): array
    {
        $buckets = [
            'current' => 0.0,
            '30_days' => 0.0,
            '60_days' => 0.0,
            '90_days' => 0.0,
            '120_plus_days' => 0.0,
        ];

        foreach ($records as $record) {
            $amount = (float) ($record->{$amountField} ?? 0);
            $date = $record->{$dateField};

            if (! $date) {
                $buckets['current'] += $amount;
                continue;
            }

            $days = max(0, $date->diffInDays(now(), false));

            match (true) {
                $days <= 0 => $buckets['current'] += $amount,
                $days <= 30 => $buckets['30_days'] += $amount,
                $days <= 60 => $buckets['60_days'] += $amount,
                $days <= 90 => $buckets['90_days'] += $amount,
                default => $buckets['120_plus_days'] += $amount,
            };
        }

        return $buckets;
    }

    private function invoiceLinePayload(array $line, int $companyId): array
    {
        $quantity = (float) $line['quantity'];
        $unitPrice = (float) $line['unit_price'];
        $taxRate = (float) ($line['tax_rate'] ?? 0);
        $subtotal = round($quantity * $unitPrice, 2);
        $taxAmount = round($subtotal * ($taxRate / 100), 2);

        return [
            'description' => $line['description'],
            'cost_code' => $this->suppliedCode($line['cost_code'] ?? null)
                ?? $this->nextCompanyCode($this->codePrefix($line['description'], 'CST'), InvoiceLine::class, 'cost_code', $companyId),
            'quantity' => $quantity,
            'unit' => $line['unit'] ?? 'each',
            'unit_price' => $unitPrice,
            'tax_rate' => $taxRate,
            'line_subtotal' => $subtotal,
            'tax_amount' => $taxAmount,
            'line_total' => $subtotal + $taxAmount,
        ];
    }

    private function syncInvoiceTotals(Invoice $invoice): void
    {
        $subtotal = (float) $invoice->lines()->sum('line_subtotal');
        $taxAmount = (float) $invoice->lines()->sum('tax_amount');
        $grossTotal = $subtotal + $taxAmount;
        $retentionAmount = round($grossTotal * ((float) $invoice->retention_percent / 100), 2);
        $creditNoteAmount = (float) $invoice->creditNotes()->where('status', 'approved')->sum(DB::raw('amount + tax_amount'));
        $paid = (float) $invoice->payments()->sum('amount');
        $balance = max(0, $grossTotal - $retentionAmount - $creditNoteAmount - $paid);

        $paymentStatus = match (true) {
            $paid <= 0 && $balance > 0 => 'unpaid',
            $balance <= 0.01 => 'paid',
            default => 'partial',
        };

        $invoice->forceFill([
            'subtotal' => $subtotal,
            'tax_amount' => $taxAmount,
            'retention_amount' => $retentionAmount,
            'total_amount' => $grossTotal,
            'amount_paid' => $paid,
            'credit_note_amount' => $creditNoteAmount,
            'balance_due' => $balance,
            'payment_status' => $paymentStatus,
            'paid_at' => $paymentStatus === 'paid' ? ($invoice->paid_at ?: now()) : null,
        ])->save();
    }

    private function ensureFinanceFoundation(Request $request): void
    {
        $companyId = $this->companyId($request);

        $accounts = [
            ['1000', 'Cash and Bank', 'asset', 'debit', true],
            ['1200', 'Accounts Receivable', 'asset', 'debit', true],
            ['1250', 'Retention Receivable', 'asset', 'debit', true],
            ['1300', 'Inventory', 'asset', 'debit', true],
            ['1500', 'Fixed Assets', 'asset', 'debit', true],
            ['2000', 'Accounts Payable', 'liability', 'credit', true],
            ['2100', 'Tax Payable', 'liability', 'credit', true],
            ['2200', 'Retention Payable', 'liability', 'credit', true],
            ['2300', 'Payroll Payable', 'liability', 'credit', true],
            ['3000', 'Owner Equity', 'equity', 'credit', true],
            ['4100', 'Construction Revenue', 'revenue', 'credit', false],
            ['4200', 'Consultancy Revenue', 'revenue', 'credit', false],
            ['5000', 'Direct Project Costs', 'expense', 'debit', false],
            ['5100', 'Salaries and Wages', 'expense', 'debit', false],
            ['5200', 'Fuel', 'expense', 'debit', false],
            ['5300', 'Repairs and Maintenance', 'expense', 'debit', false],
            ['5400', 'Office Expenses', 'expense', 'debit', false],
            ['5500', 'Depreciation', 'expense', 'debit', false],
        ];

        foreach ($accounts as [$code, $name, $type, $normal, $control]) {
            $this->financeAccount($companyId, $code, $name, $type, $normal, $control);
        }

        if (! FinanceBankAccount::query()->forCompany($companyId)->exists()) {
            FinanceBankAccount::query()->create([
                'company_id' => $companyId,
                'branch_id' => $this->user($request)->branch_id,
                'account_name' => 'Main Operating Account',
                'bank_name' => 'Primary Bank',
                'currency' => $this->user($request)->company->default_currency,
                'opening_balance' => 0,
                'current_balance' => 0,
                'status' => 'active',
                'is_default' => true,
            ]);
        }

        Project::query()
            ->forCompany($companyId)
            ->whereDoesntHave('financeCostCenter')
            ->limit(50)
            ->get()
            ->each(function (Project $project) use ($companyId): void {
                FinanceCostCenter::query()->firstOrCreate(
                    ['company_id' => $companyId, 'project_id' => $project->id],
                    [
                        'code' => $this->suppliedCode($project->code) ?? $this->nextCompanyCode('PRJ', FinanceCostCenter::class, 'code', $companyId),
                        'name' => $project->name,
                        'type' => 'project',
                        'status' => 'active',
                    ]
                );
            });
    }

    private function syncInvoiceRetention(Request $request, Invoice $invoice): void
    {
        if ((float) $invoice->retention_amount <= 0) {
            return;
        }

        FinanceRetention::query()->firstOrCreate(
            ['company_id' => $invoice->company_id, 'invoice_id' => $invoice->id],
            [
                'project_id' => $invoice->project_id,
                'retention_number' => $this->nextNumber('RET', FinanceRetention::class, 'retention_number', $invoice->company_id),
                'party_type' => 'client',
                'base_amount' => $invoice->total_amount,
                'retention_percent' => $invoice->retention_percent,
                'retention_amount' => $invoice->retention_amount,
                'balance_amount' => $invoice->retention_amount,
                'status' => 'held',
                'due_date' => $invoice->due_date?->copy()->addYear()->toDateString(),
                'created_by' => $this->user($request)->id,
            ]
        );
    }

    private function bankAccountForPayment(Request $request, ?int $bankAccountId): FinanceBankAccount
    {
        $query = FinanceBankAccount::query()->forCompany($this->companyId($request));

        if ($bankAccountId) {
            return $query->whereKey($bankAccountId)->firstOrFail();
        }

        return (clone $query)->where('is_default', true)->first()
            ?? (clone $query)->where('status', 'active')->first()
            ?? FinanceBankAccount::query()->create([
                'company_id' => $this->companyId($request),
                'branch_id' => $this->user($request)->branch_id,
                'account_name' => 'Main Operating Account',
                'bank_name' => 'Primary Bank',
                'currency' => $this->user($request)->company->default_currency,
                'is_default' => true,
            ]);
    }

    private function postInvoiceLedger(Request $request, Invoice $invoice): void
    {
        if ($this->ledgerExists(Invoice::class, $invoice->id)) {
            return;
        }

        $netReceivable = max(0, (float) $invoice->total_amount - (float) $invoice->retention_amount);
        $this->postLedgerLine($request, '1200', Invoice::class, $invoice->id, $invoice->issue_date?->toDateString() ?? now()->toDateString(), $invoice->invoice_number, $invoice->title, $netReceivable, 0, $invoice->project_id, $invoice->currency);

        if ((float) $invoice->retention_amount > 0) {
            $this->postLedgerLine($request, '1250', Invoice::class, $invoice->id, $invoice->issue_date?->toDateString() ?? now()->toDateString(), $invoice->invoice_number, 'Retention held on '.$invoice->title, (float) $invoice->retention_amount, 0, $invoice->project_id, $invoice->currency);
        }

        if ((float) $invoice->subtotal > 0) {
            $this->postLedgerLine($request, '4100', Invoice::class, $invoice->id, $invoice->issue_date?->toDateString() ?? now()->toDateString(), $invoice->invoice_number, $invoice->title, 0, (float) $invoice->subtotal, $invoice->project_id, $invoice->currency);
        }

        if ((float) $invoice->tax_amount > 0) {
            $this->postLedgerLine($request, '2100', Invoice::class, $invoice->id, $invoice->issue_date?->toDateString() ?? now()->toDateString(), $invoice->invoice_number, 'Output tax on '.$invoice->title, 0, (float) $invoice->tax_amount, $invoice->project_id, $invoice->currency);
        }
    }

    private function postPaymentLedger(Request $request, Payment $payment): void
    {
        if ($this->ledgerExists(Payment::class, $payment->id)) {
            return;
        }

        $invoice = $payment->invoice;
        $this->postLedgerLine($request, '1000', Payment::class, $payment->id, $payment->received_at->toDateString(), $payment->payment_number, 'Payment received '.$payment->reference, (float) $payment->amount, 0, $invoice?->project_id, $payment->currency);
        $this->postLedgerLine($request, '1200', Payment::class, $payment->id, $payment->received_at->toDateString(), $payment->payment_number, 'Receivable cleared '.$payment->reference, 0, (float) $payment->amount, $invoice?->project_id, $payment->currency);
    }

    private function postCreditNoteLedger(Request $request, FinanceCreditNote $creditNote): void
    {
        if ($this->ledgerExists(FinanceCreditNote::class, $creditNote->id)) {
            return;
        }

        $invoice = $creditNote->invoice;
        $this->postLedgerLine($request, '4100', FinanceCreditNote::class, $creditNote->id, $creditNote->issue_date->toDateString(), $creditNote->credit_note_number, 'Credit note revenue reversal', (float) $creditNote->amount, 0, $invoice?->project_id, $invoice?->currency ?? 'GHS');

        if ((float) $creditNote->tax_amount > 0) {
            $this->postLedgerLine($request, '2100', FinanceCreditNote::class, $creditNote->id, $creditNote->issue_date->toDateString(), $creditNote->credit_note_number, 'Credit note tax reversal', (float) $creditNote->tax_amount, 0, $invoice?->project_id, $invoice?->currency ?? 'GHS');
        }

        $this->postLedgerLine($request, '1200', FinanceCreditNote::class, $creditNote->id, $creditNote->issue_date->toDateString(), $creditNote->credit_note_number, 'Credit note applied to receivable', 0, (float) $creditNote->amount + (float) $creditNote->tax_amount, $invoice?->project_id, $invoice?->currency ?? 'GHS');
    }

    private function postExpenseApprovalLedger(Request $request, Expense $expense): void
    {
        if ($this->ledgerExists(Expense::class, $expense->id)) {
            return;
        }

        $total = (float) $expense->amount + (float) $expense->tax_amount;
        $entryDate = $expense->incurred_on?->toDateString() ?? now()->toDateString();
        $this->postLedgerLine($request, '5000', Expense::class, $expense->id, $entryDate, $expense->expense_number, $expense->description, $total, 0, $expense->project_id, $expense->currency);
        $this->postLedgerLine($request, '2000', Expense::class, $expense->id, $entryDate, $expense->expense_number, $expense->description, 0, $total, $expense->project_id, $expense->currency);
    }

    private function postExpensePaymentLedger(Request $request, Expense $expense, FinanceBankAccount $bankAccount): void
    {
        $sourceType = Expense::class.'#payment';
        if ($this->ledgerExists($sourceType, $expense->id)) {
            return;
        }

        $total = (float) $expense->amount + (float) $expense->tax_amount;
        $this->postLedgerLine($request, '2000', $sourceType, $expense->id, now()->toDateString(), $expense->expense_number, 'Expense paid from '.$bankAccount->account_name, $total, 0, $expense->project_id, $expense->currency);
        $this->postLedgerLine($request, '1000', $sourceType, $expense->id, now()->toDateString(), $expense->expense_number, 'Expense paid from '.$bankAccount->account_name, 0, $total, $expense->project_id, $expense->currency);
    }

    private function postJournalLedger(Request $request, JournalEntry $entry): void
    {
        if ($this->ledgerExists(JournalEntry::class, $entry->id)) {
            return;
        }

        foreach ($entry->lines as $line) {
            $account = FinanceAccount::query()
                ->forCompany($entry->company_id)
                ->firstOrCreate(
                    ['account_code' => $this->suppliedCode($line->account_code)],
                    [
                        'account_name' => $line->account_name,
                        'account_type' => $this->inferAccountType($line->account_code),
                        'normal_balance' => $this->inferAccountNormalBalance($line->account_code),
                    ]
                );

            $this->postLedgerLine($request, $account->account_code, JournalEntry::class, $entry->id, $entry->entry_date->toDateString(), $entry->entry_number, $line->description ?? $entry->description, (float) $line->debit, (float) $line->credit, $line->project_id, $this->user($request)->company->default_currency);
        }
    }

    private function postLedgerLine(Request $request, string $accountCode, string $sourceType, int $sourceId, string $entryDate, ?string $reference, ?string $description, float $debit, float $credit, ?int $projectId, string $currency): void
    {
        if ($debit <= 0 && $credit <= 0) {
            return;
        }

        $companyId = $this->companyId($request);
        $account = FinanceAccount::query()->forCompany($companyId)->where('account_code', $accountCode)->first()
            ?? $this->financeAccount($companyId, $accountCode, $description ?: $accountCode, $this->inferAccountType($accountCode), $this->inferAccountNormalBalance($accountCode), false);
        $costCenter = $projectId ? FinanceCostCenter::query()->forCompany($companyId)->where('project_id', $projectId)->first() : null;
        $lastBalance = (float) FinanceLedgerEntry::query()->forCompany($companyId)->where('finance_account_id', $account->id)->latest('id')->value('running_balance');
        $delta = $account->normal_balance === 'credit' ? $credit - $debit : $debit - $credit;

        FinanceLedgerEntry::query()->create([
            'company_id' => $companyId,
            'finance_account_id' => $account->id,
            'project_id' => $projectId,
            'cost_center_id' => $costCenter?->id,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'entry_date' => $entryDate,
            'reference' => $reference,
            'description' => $description,
            'debit' => $debit,
            'credit' => $credit,
            'running_balance' => $lastBalance + $delta,
            'currency' => strtoupper($currency),
            'created_by' => $this->user($request)->id,
        ]);
    }

    private function ledgerExists(string $sourceType, int $sourceId): bool
    {
        return FinanceLedgerEntry::query()
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->exists();
    }

    private function financeAccount(int $companyId, string $code, string $name, string $type, string $normalBalance, bool $control): FinanceAccount
    {
        return FinanceAccount::query()->firstOrCreate(
            ['company_id' => $companyId, 'account_code' => $code],
            [
                'account_name' => $name,
                'account_type' => $type,
                'normal_balance' => $normalBalance,
                'is_control_account' => $control,
                'is_active' => true,
            ]
        );
    }

    private function inferAccountType(string $accountCode): string
    {
        return match (substr($accountCode, 0, 1)) {
            '1' => 'asset',
            '2' => 'liability',
            '3' => 'equity',
            '4' => 'revenue',
            default => 'expense',
        };
    }

    private function inferAccountNormalBalance(string $accountCode): string
    {
        return in_array($this->inferAccountType($accountCode), ['asset', 'expense'], true) ? 'debit' : 'credit';
    }

    private function accountCodePrefix(string $accountType): string
    {
        return [
            'asset' => '1',
            'liability' => '2',
            'equity' => '3',
            'revenue' => '4',
            'expense' => '5',
        ][$accountType] ?? '9';
    }

    private function calculateDepreciation(float $purchaseCost, int $usefulLifeMonths, ?string $purchaseDate, string $method): float
    {
        if ($method === 'none' || ! $purchaseDate || $purchaseCost <= 0) {
            return 0;
        }

        $monthsElapsed = max(0, now()->diffInMonths(\Illuminate\Support\Carbon::parse($purchaseDate)));

        if ($method === 'reducing_balance') {
            $annualRate = 2 / max(1, $usefulLifeMonths / 12);
            $depreciated = $purchaseCost * (1 - pow(1 - $annualRate / 12, $monthsElapsed));

            return round(min($purchaseCost, $depreciated), 2);
        }

        return round(min($purchaseCost, ($purchaseCost / max(1, $usefulLifeMonths)) * $monthsElapsed), 2);
    }

    private function assertTenant(Request $request, object $model): void
    {
        abort_if((int) $model->company_id !== $this->companyId($request), 404);
    }
}
