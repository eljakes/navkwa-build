<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Client;
use App\Models\Company;
use App\Models\Document;
use App\Models\Drawing;
use App\Models\FinanceCreditNote;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceRetention;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PayrollRun;
use App\Models\Project;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NavkwaBuildPhaseThreeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_finance_invoices_payments_expenses_and_journals_work(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $client = Client::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'name' => 'Finance Client',
        ]);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'client_id' => $client->id,
            'code' => 'PRJ-FIN-001',
            'name' => 'Finance Test Project',
        ]);

        $invoiceId = $this->postJson('/api/v1/finance/invoices', [
            'project_id' => $project->id,
            'client_id' => $client->id,
            'title' => 'Interim claim',
            'due_date' => now()->addDays(30)->toDateString(),
            'lines' => [
                [
                    'description' => 'Certified works',
                    'cost_code' => 'C01',
                    'quantity' => 10,
                    'unit' => 'm3',
                    'unit_price' => 100,
                    'tax_rate' => 5,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('invoice.total_amount', '1050.00')
            ->json('invoice.id');

        $this->postJson("/api/v1/finance/invoices/{$invoiceId}/issue")
            ->assertOk()
            ->assertJsonPath('invoice.status', 'issued');

        $this->postJson("/api/v1/finance/invoices/{$invoiceId}/payments", [
            'amount' => 500,
            'method' => 'bank_transfer',
            'reference' => 'TEST-PAY-001',
        ])
            ->assertCreated()
            ->assertJsonPath('invoice.payment_status', 'partial')
            ->assertJsonPath('invoice.balance_due', '550.00');

        $this->postJson("/api/v1/finance/invoices/{$invoiceId}/payments", [
            'amount' => 550,
            'method' => 'bank_transfer',
            'reference' => 'TEST-PAY-002',
        ])
            ->assertCreated()
            ->assertJsonPath('invoice.payment_status', 'paid')
            ->assertJsonPath('invoice.balance_due', '0.00');

        $expenseId = $this->postJson('/api/v1/finance/expenses', [
            'project_id' => $project->id,
            'description' => 'Site petty cash',
            'amount' => 250,
            'tax_amount' => 0,
        ])
            ->assertCreated()
            ->assertJsonPath('expense.status', 'submitted')
            ->json('expense.id');

        $this->postJson("/api/v1/finance/expenses/{$expenseId}/review", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('expense.status', 'approved');

        $this->postJson('/api/v1/finance/journal-entries', [
            'entry_date' => now()->toDateString(),
            'reference' => 'JE-TEST',
            'status' => 'posted',
            'lines' => [
                ['account_code' => '1200', 'account_name' => 'Accounts receivable', 'debit' => 1050, 'credit' => 0],
                ['account_code' => '4100', 'account_name' => 'Construction revenue', 'debit' => 0, 'credit' => 1050],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('journal_entry.status', 'posted')
            ->assertJsonCount(2, 'journal_entry.lines');

        $this->assertDatabaseHas('finance_ledger_entries', [
            'source_type' => Invoice::class,
            'source_id' => $invoiceId,
        ]);
        $this->assertDatabaseHas('finance_ledger_entries', [
            'source_type' => Payment::class,
        ]);

        $bankAccountId = $this->postJson('/api/v1/finance/bank-accounts', [
            'account_name' => 'Project Collections',
            'bank_name' => 'GCB Bank',
            'currency' => 'GHS',
            'opening_balance' => 1000,
            'is_default' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('bank_account.current_balance', '1000.00')
            ->json('bank_account.id');

        $this->postJson('/api/v1/finance/bank-reconciliations', [
            'finance_bank_account_id' => $bankAccountId,
            'statement_date' => now()->toDateString(),
            'statement_balance' => 1000,
        ])
            ->assertCreated()
            ->assertJsonPath('bank_reconciliation.status', 'reconciled');

        $this->postJson('/api/v1/finance/accounts', [
            'account_name' => 'Retention control',
            'account_type' => 'asset',
        ])
            ->assertCreated()
            ->assertJsonPath('account.account_type', 'asset');

        $this->postJson('/api/v1/finance/credit-notes', [
            'invoice_id' => $invoiceId,
            'amount' => 25,
            'tax_amount' => 0,
            'reason' => 'Client certified adjustment',
        ])
            ->assertCreated()
            ->assertJsonPath('credit_note.status', 'approved');

        $retentionId = $this->postJson('/api/v1/finance/retentions', [
            'project_id' => $project->id,
            'invoice_id' => $invoiceId,
            'party_type' => 'client',
            'base_amount' => 1000,
            'retention_percent' => 10,
        ])
            ->assertCreated()
            ->assertJsonPath('retention.balance_amount', '100.00')
            ->json('retention.id');

        $this->postJson("/api/v1/finance/retentions/{$retentionId}/release", [
            'amount' => 40,
        ])
            ->assertOk()
            ->assertJsonPath('retention.status', 'partial')
            ->assertJsonPath('retention.balance_amount', '60.00');

        $this->postJson('/api/v1/finance/progress-billings', [
            'project_id' => $project->id,
            'milestone_name' => 'Foundation certified',
            'progress_percent' => 20,
            'billable_amount' => 5000,
            'retention_percent' => 10,
            'create_invoice' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('progress_billing.status', 'invoiced');

        $this->postJson('/api/v1/finance/tax-rules', [
            'tax_name' => 'VAT',
            'tax_type' => 'vat',
            'rate' => 15,
            'applies_to' => 'sales',
        ])
            ->assertCreated()
            ->assertJsonPath('tax_rule.tax_type', 'vat');

        $this->postJson('/api/v1/finance/cost-centers', [
            'project_id' => $project->id,
            'name' => 'Finance Project Cost Center',
            'type' => 'project',
        ])
            ->assertCreated()
            ->assertJsonPath('cost_center.type', 'project');

        $this->postJson('/api/v1/finance/fixed-assets', [
            'branch_id' => $branch->id,
            'name' => 'Site generator',
            'category' => 'equipment',
            'purchase_cost' => 12000,
            'useful_life_months' => 60,
        ])
            ->assertCreated()
            ->assertJsonPath('fixed_asset.asset_number', fn (string $number): bool => str_starts_with($number, 'FAS-'));

        $this->getJson('/api/v1/finance')
            ->assertOk()
            ->assertJsonStructure([
                'summary' => ['cash_balance', 'accounts_receivable', 'accounts_payable', 'profit', 'budget_utilization', 'taxes_payable'],
                'accounts_receivable' => ['aging', 'customers', 'statements'],
                'accounts_payable' => ['aging', 'suppliers'],
                'chart_of_accounts' => ['accounts', 'by_type'],
                'general_ledger' => ['entries', 'account_balances'],
                'financial_reports' => ['income_statement', 'balance_sheet', 'cash_flow_statement', 'trial_balance', 'project_profitability'],
                'bank_accounts',
                'retentions',
                'progress_billings',
            ]);

        $this->assertDatabaseHas('finance_credit_notes', [
            'invoice_id' => $invoiceId,
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('finance_retentions', [
            'id' => $retentionId,
            'status' => 'partial',
        ]);
        $this->assertGreaterThan(0, FinanceLedgerEntry::query()->count());
        $this->assertSame(1, FinanceCreditNote::query()->count());
        $this->assertGreaterThanOrEqual(1, FinanceRetention::query()->count());
    }

    public function test_finance_workbook_uploads_store_excel_files_as_documents(): void
    {
        Storage::fake('local');

        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'code' => 'PRJ-FIN-XLS',
            'name' => 'Finance Workbook Project',
        ]);

        $workbookPath = $this->post('/api/v1/finance/workbooks', [
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'title' => 'August bank statement import',
            'workbook_type' => 'bank_statement',
            'description' => 'Statement prepared for reconciliation.',
            'file' => UploadedFile::fake()->create('august-bank-statement.xlsx', 256, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('workbook.document_type', 'finance_workbook')
            ->assertJsonPath('workbook.folder', 'Finance / Bank Statement')
            ->json('workbook.file_path');

        Storage::disk('local')->assertExists($workbookPath);

        $this->assertDatabaseHas('documents', [
            'company_id' => $user->company_id,
            'project_id' => $project->id,
            'document_type' => 'finance_workbook',
            'original_filename' => 'august-bank-statement.xlsx',
        ]);

        $this->getJson('/api/v1/finance')
            ->assertOk()
            ->assertJsonPath('workbooks.0.document_type', 'finance_workbook');
    }

    public function test_admin_approval_inbox_lists_and_reviews_pending_expenses(): void
    {
        [$admin, $branch] = $this->tenantUser();
        Sanctum::actingAs($admin);

        $expenseId = $this->postJson('/api/v1/finance/expenses', [
            'branch_id' => $branch->id,
            'description' => 'Generator fuel reimbursement',
            'amount' => 750,
            'tax_amount' => 0,
        ])
            ->assertCreated()
            ->assertJsonPath('expense.status', 'submitted')
            ->json('expense.id');

        $this->getJson('/api/v1/admin/approvals')
            ->assertOk()
            ->assertJsonPath('summary.total_pending', 1)
            ->assertJsonPath('items.0.type', 'expense')
            ->assertJsonPath('items.0.reference', fn (string $reference): bool => str_starts_with($reference, 'EXP-'));

        $financeRole = Role::query()->create([
            'company_id' => $admin->company_id,
            'name' => 'Finance Officer',
            'slug' => 'finance-officer',
            'permissions' => ['finance.manage'],
            'is_system' => false,
        ]);

        $financeUser = User::query()->create([
            'company_id' => $admin->company_id,
            'branch_id' => $branch->id,
            'role_id' => $financeRole->id,
            'name' => 'Finance User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'NavkwaBuild2026!',
        ]);

        Sanctum::actingAs($financeUser);
        $this->getJson('/api/v1/admin/approvals')->assertForbidden();

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/approvals/expense/{$expenseId}/review", [
            'decision' => 'approved',
            'notes' => 'Approved by admin.',
        ])
            ->assertOk()
            ->assertJsonPath('approval.type', 'expense')
            ->assertJsonPath('approval.status', 'approved');

        $this->assertDatabaseHas('expenses', [
            'id' => $expenseId,
            'status' => 'approved',
            'approved_by' => $admin->id,
        ]);

        $this->getJson('/api/v1/admin/approvals')
            ->assertOk()
            ->assertJsonPath('summary.total_pending', 0);
    }

    public function test_people_payroll_and_leave_workflows_work(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $worker = User::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'role_id' => $user->role_id,
            'name' => 'Payroll Worker',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'NavkwaBuild2026!',
        ]);

        $employeeId = $this->postJson('/api/v1/people/employees', [
            'user_id' => $worker->id,
            'branch_id' => $branch->id,
            'position' => 'Site Supervisor',
            'base_salary' => 6000,
        ])
            ->assertCreated()
            ->assertJsonPath('employee.status', 'active')
            ->json('employee.id');

        $leaveId = $this->postJson('/api/v1/people/leave-requests', [
            'employee_profile_id' => $employeeId,
            'starts_on' => now()->addWeek()->toDateString(),
            'ends_on' => now()->addWeek()->addDays(2)->toDateString(),
            'reason' => 'Family event',
        ])
            ->assertCreated()
            ->assertJsonPath('leave_request.status', 'pending')
            ->json('leave_request.id');

        $this->postJson("/api/v1/people/leave-requests/{$leaveId}/review", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('leave_request.status', 'approved');

        $runId = $this->postJson('/api/v1/people/payroll-runs', [
            'branch_id' => $branch->id,
            'period_start' => now()->startOfMonth()->toDateString(),
            'period_end' => now()->endOfMonth()->toDateString(),
            'payslips' => [
                [
                    'employee_profile_id' => $employeeId,
                    'gross_pay' => 6000,
                    'allowances' => 500,
                    'deductions' => 100,
                    'tax_amount' => 400,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('payroll_run.net_pay', '6000.00')
            ->assertJsonPath('payroll_run.finance_status', 'forecast_in_finance')
            ->json('payroll_run.id');

        $this->postJson("/api/v1/people/payroll-runs/{$runId}/approve")
            ->assertOk()
            ->assertJsonPath('payroll_run.status', 'approved')
            ->assertJsonPath('payroll_run.finance_status', 'approved_posted')
            ->assertJsonPath('payroll_run.finance_posting.approval_posted', true);

        $this->postJson("/api/v1/people/payroll-runs/{$runId}/approve", ['status' => 'paid'])
            ->assertOk()
            ->assertJsonPath('payroll_run.status', 'paid')
            ->assertJsonPath('payroll_run.payslips.0.status', 'paid')
            ->assertJsonPath('payroll_run.finance_status', 'paid_posted')
            ->assertJsonPath('payroll_run.finance_posting.payment_posted', true);

        $this->assertDatabaseHas('finance_ledger_entries', [
            'source_type' => PayrollRun::class,
            'source_id' => $runId,
        ]);
        $this->assertDatabaseHas('finance_ledger_entries', [
            'source_type' => PayrollRun::class.'#payment',
            'source_id' => $runId,
        ]);

        $this->getJson('/api/v1/people')
            ->assertOk()
            ->assertJsonPath('payroll_runs.0.finance_status', 'paid_posted')
            ->assertJsonPath('payroll_runs.0.finance_linked', true);

        $this->getJson('/api/v1/finance')
            ->assertOk()
            ->assertJsonPath('payroll_integration.runs.0.finance_status', 'paid_posted')
            ->assertJsonPath('payroll_integration.runs.0.finance_posting.payment_posted', true);
    }

    public function test_hr_workforce_lifecycle_records_are_real_and_payroll_uses_approved_overtime(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'code' => 'PRJ-HR-001',
            'name' => 'Workforce Test Project',
        ]);

        $supplier = Supplier::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'name' => 'Reliable Labour Services',
        ]);

        $vacancyId = $this->postJson('/api/v1/people/job-vacancies', [
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'title' => 'Site Engineer',
            'department' => 'construction',
            'employment_type' => 'full_time',
            'openings' => 1,
            'priority' => 'critical',
            'required_skills' => 'setting out, QA, site supervision',
        ])
            ->assertCreated()
            ->assertJsonPath('vacancy.vacancy_number', fn (string $number): bool => str_starts_with($number, 'VAC-'))
            ->json('vacancy.id');

        $candidateId = $this->postJson('/api/v1/people/candidates', [
            'full_name' => 'Aba Site',
            'email' => fake()->unique()->safeEmail(),
            'phone' => '0240000001',
            'trade' => 'Site engineering',
            'rating' => 5,
        ])
            ->assertCreated()
            ->assertJsonPath('candidate.candidate_number', fn (string $number): bool => str_starts_with($number, 'CAN-'))
            ->json('candidate.id');

        $applicationId = $this->postJson('/api/v1/people/applications', [
            'job_vacancy_id' => $vacancyId,
            'candidate_id' => $candidateId,
            'expected_salary' => 7000,
            'screening_score' => 92,
            'background_check_status' => 'clear',
            'offer_status' => 'sent',
        ])
            ->assertCreated()
            ->assertJsonPath('application.application_number', fn (string $number): bool => str_starts_with($number, 'APP-'))
            ->json('application.id');

        $this->postJson('/api/v1/people/interviews', [
            'application_id' => $applicationId,
            'scheduled_at' => now()->addDay()->toIso8601String(),
            'stage' => 'technical',
            'interviewers' => 'Project Manager, HR Manager',
            'result' => 'passed',
            'score' => 88,
        ])
            ->assertCreated()
            ->assertJsonPath('interview.result', 'passed');

        $employeeId = $this->postJson("/api/v1/people/applications/{$applicationId}/hire", [
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'manager_id' => $user->id,
            'base_salary' => 7000,
            'hourly_rate' => 50,
            'hire_date' => now()->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('employee.status', 'active')
            ->assertJsonPath('employee.hourly_rate', '50.00')
            ->assertJsonPath('application.status', 'hired')
            ->json('employee.id');

        $this->postJson('/api/v1/people/onboarding-checklists', [
            'employee_profile_id' => $employeeId,
            'completed_items' => 'Employment Contract, National ID, Tax Number, SSNIT Number, Bank Details, Emergency Contact, Laptop Assigned, PPE Issued, Orientation Completed',
        ])
            ->assertCreated()
            ->assertJsonPath('onboarding.status', 'completed');

        $shiftId = $this->postJson('/api/v1/people/shifts', [
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'name' => 'Day site shift',
            'shift_type' => 'day',
            'start_time' => '07:00',
            'end_time' => '17:00',
            'break_minutes' => 60,
        ])
            ->assertCreated()
            ->assertJsonPath('shift.shift_code', fn (string $number): bool => str_starts_with($number, 'SFT-'))
            ->json('shift.id');

        $this->postJson('/api/v1/people/shift-assignments', [
            'shift_id' => $shiftId,
            'employee_profile_id' => $employeeId,
            'project_id' => $project->id,
            'starts_on' => now()->startOfMonth()->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('shift_assignment.status', 'active');

        $this->postJson('/api/v1/people/workforce-allocations', [
            'employee_profile_id' => $employeeId,
            'project_id' => $project->id,
            'supervisor_id' => $user->id,
            'role' => 'Site Engineer',
            'allocation_percent' => 100,
            'start_date' => now()->startOfMonth()->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('allocation.status', 'active');

        $timesheetId = $this->postJson('/api/v1/people/timesheets', [
            'employee_profile_id' => $employeeId,
            'project_id' => $project->id,
            'shift_id' => $shiftId,
            'work_date' => now()->toDateString(),
            'hours_worked' => 10,
            'overtime_hours' => 2,
            'cost_rate' => 50,
        ])
            ->assertCreated()
            ->assertJsonPath('timesheet.cost_amount', '550.00')
            ->json('timesheet.id');

        $this->postJson("/api/v1/people/timesheets/{$timesheetId}/review", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('timesheet.status', 'approved');

        $overtimeId = $this->postJson('/api/v1/people/overtime-requests', [
            'employee_profile_id' => $employeeId,
            'project_id' => $project->id,
            'work_date' => now()->toDateString(),
            'hours' => 3,
            'reason' => 'Concrete pour extension',
        ])
            ->assertCreated()
            ->assertJsonPath('overtime_request.status', 'pending')
            ->json('overtime_request.id');

        $this->postJson("/api/v1/people/overtime-requests/{$overtimeId}/review", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('overtime_request.status', 'approved');

        $this->postJson('/api/v1/people/payroll-runs', [
            'branch_id' => $branch->id,
            'period_start' => now()->startOfMonth()->toDateString(),
            'period_end' => now()->endOfMonth()->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('payroll_run.gross_pay', '7375.00')
            ->assertJsonPath('payroll_run.payslips.0.overtime_pay', '375.00');

        $courseId = $this->postJson('/api/v1/people/training-courses', [
            'title' => 'Working at Height',
            'category' => 'safety',
            'provider' => 'HSE Institute',
            'duration_hours' => 4,
        ])
            ->assertCreated()
            ->assertJsonPath('training_course.course_code', fn (string $number): bool => str_starts_with($number, 'SAF-'))
            ->json('training_course.id');

        $this->postJson('/api/v1/people/training-records', [
            'employee_profile_id' => $employeeId,
            'training_course_id' => $courseId,
            'status' => 'completed',
            'completed_on' => now()->toDateString(),
            'score' => 90,
        ])
            ->assertCreated()
            ->assertJsonPath('training_record.status', 'completed');

        $this->postJson('/api/v1/people/certifications', [
            'employee_profile_id' => $employeeId,
            'name' => 'Engineer Practicing Certificate',
            'issuing_authority' => 'Engineering Council',
            'issued_on' => now()->subYear()->toDateString(),
            'expires_on' => now()->addDays(30)->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('certification.status', 'valid');

        $this->postJson('/api/v1/people/ppe-issues', [
            'employee_profile_id' => $employeeId,
            'project_id' => $project->id,
            'item_name' => 'Safety harness',
            'quantity' => 1,
            'replacement_due_on' => now()->addDays(20)->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('ppe_issue.status', 'issued');

        $this->postJson('/api/v1/people/contractors', [
            'supplier_id' => $supplier->id,
            'name' => 'Reliable Labour Crew',
            'trade' => 'General labour',
            'worker_count' => 12,
            'contract_expires_on' => now()->addMonths(6)->toDateString(),
            'insurance_expires_on' => now()->addMonths(6)->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('contractor.compliance_status', 'compliant');

        $this->postJson('/api/v1/people/assets', [
            'employee_profile_id' => $employeeId,
            'item_name' => 'Survey tablet',
            'category' => 'device',
            'serial_number' => 'TAB-100',
        ])
            ->assertCreated()
            ->assertJsonPath('employee_asset.status', 'assigned');

        $this->postJson('/api/v1/people/documents', [
            'employee_profile_id' => $employeeId,
            'document_type' => 'contract',
            'title' => 'Signed employment contract',
            'file_path' => 'documents/hr/contracts/site-engineer.pdf',
        ])
            ->assertCreated()
            ->assertJsonPath('document.status', 'active');

        $this->postJson('/api/v1/people/performance-reviews', [
            'employee_profile_id' => $employeeId,
            'safety_score' => 5,
            'quality_score' => 4,
            'productivity_score' => 4,
            'teamwork_score' => 5,
        ])
            ->assertCreated()
            ->assertJsonPath('performance_review.overall_score', '4.50');

        $this->postJson('/api/v1/people/benefits', [
            'employee_profile_id' => $employeeId,
            'benefit_type' => 'health_insurance',
            'provider' => 'Enterprise Health',
            'amount' => 250,
        ])
            ->assertCreated()
            ->assertJsonPath('benefit.status', 'active');

        $this->postJson('/api/v1/people/exit-records', [
            'employee_profile_id' => $employeeId,
            'exit_type' => 'resignation',
            'notice_date' => now()->toDateString(),
            'exit_date' => now()->addMonth()->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('exit_record.status', 'open');

        $this->getJson('/api/v1/people')
            ->assertOk()
            ->assertJsonPath('summary.expiring_certifications', 1)
            ->assertJsonPath('summary.training_compliance', 100)
            ->assertJsonStructure([
                'recruitment' => ['vacancies', 'candidates', 'applications', 'interviews'],
                'onboarding',
                'attendance' => ['records', 'summary'],
                'shifts',
                'shift_assignments',
                'timesheets',
                'workforce_allocations',
                'overtime_requests',
                'benefits',
                'performance_reviews',
                'training_courses',
                'training_records',
                'certifications',
                'health_safety' => ['ppe_issues', 'expiring_ppe', 'certification_risk'],
                'contractors',
                'employee_assets',
                'documents',
                'self_service',
                'manager_portal',
                'exit_records',
                'reports',
                'analytics',
                'automation',
            ]);

        $this->assertDatabaseHas('workforce_applications', ['id' => $applicationId, 'status' => 'hired']);
        $this->assertDatabaseHas('employee_profiles', ['id' => $employeeId, 'status' => 'exiting']);
    }

    public function test_hr_can_manage_users_and_roles_without_company_admin_access(): void
    {
        [$admin, $branch] = $this->tenantUser();

        $hrRole = Role::query()->create([
            'company_id' => $admin->company_id,
            'name' => 'HR Manager',
            'slug' => 'hr-manager',
            'permissions' => ['payroll.manage'],
            'is_system' => false,
        ]);

        $hrUser = User::query()->create([
            'company_id' => $admin->company_id,
            'branch_id' => $branch->id,
            'role_id' => $hrRole->id,
            'name' => 'HR User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'NavkwaBuild2026!',
        ]);

        Sanctum::actingAs($hrUser);

        $this->patchJson('/api/v1/organization/company', [
            'name' => 'Attempted HR Company Edit',
        ])->assertForbidden();

        $roleId = $this->postJson('/api/v1/organization/roles', [
            'name' => 'Site Attendance Officer',
            'permissions' => ['payroll.manage', 'attendance.manage'],
        ])
            ->assertCreated()
            ->assertJsonPath('role.slug', 'site-attendance-officer')
            ->assertJsonPath('role.permissions.1', 'attendance.manage')
            ->json('role.id');

        $newUserId = $this->postJson('/api/v1/organization/users', [
            'name' => 'Attendance Clerk',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'TempPass2026!!',
            'branch_id' => $branch->id,
            'role_name' => 'Site Attendance Officer',
            'permissions' => ['payroll.manage', 'attendance.manage'],
            'status' => 'active',
        ])
            ->assertCreated()
            ->assertJsonPath('user.role.slug', 'site-attendance-officer')
            ->json('user.id');

        $customUserId = $this->postJson('/api/v1/organization/users', [
            'name' => 'Night Shift Supervisor',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'TempPass2026!!',
            'branch_id' => $branch->id,
            'role_name' => 'Night Shift Supervisor',
            'permissions' => ['payroll.manage', 'attendance.manage'],
            'status' => 'active',
        ])
            ->assertCreated()
            ->assertJsonPath('user.role.name', 'Night Shift Supervisor')
            ->assertJsonPath('user.role.slug', 'night-shift-supervisor')
            ->json('user.id');

        $customRoleId = Role::query()
            ->where('company_id', $admin->company_id)
            ->where('slug', 'night-shift-supervisor')
            ->value('id');

        $this->patchJson("/api/v1/organization/users/{$newUserId}", [
            'status' => 'suspended',
            'permissions' => ['payroll.manage'],
        ])
            ->assertOk()
            ->assertJsonPath('user.status', 'suspended')
            ->assertJsonPath('user.permissions.0', 'payroll.manage');

        $this->deleteJson("/api/v1/organization/users/{$newUserId}")
            ->assertOk()
            ->assertJsonPath('message', 'User deleted.');

        $this->deleteJson("/api/v1/organization/users/{$customUserId}")
            ->assertOk()
            ->assertJsonPath('message', 'User deleted.');

        $this->deleteJson("/api/v1/organization/roles/{$roleId}")
            ->assertOk()
            ->assertJsonPath('message', 'Role deleted.');

        $this->deleteJson("/api/v1/organization/roles/{$customRoleId}")
            ->assertOk()
            ->assertJsonPath('message', 'Role deleted.');

        $this->assertDatabaseMissing('roles', ['id' => $roleId]);
        $this->assertDatabaseMissing('roles', ['id' => $customRoleId]);
        $this->assertDatabaseMissing('users', ['id' => $newUserId]);
        $this->assertDatabaseMissing('users', ['id' => $customUserId]);
    }

    public function test_equipment_assignment_maintenance_and_fuel_work(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'code' => 'PRJ-EQ-001',
            'name' => 'Equipment Test Project',
        ]);

        $assetId = $this->postJson('/api/v1/equipment/assets', [
            'branch_id' => $branch->id,
            'name' => 'Excavator CAT 320',
            'category' => 'earthworks',
            'meter_reading' => 100,
            'hourly_rate' => 350,
        ])
            ->assertCreated()
            ->assertJsonPath('asset.status', 'available')
            ->json('asset.id');

        $assignmentId = $this->postJson("/api/v1/equipment/assets/{$assetId}/assign", [
            'project_id' => $project->id,
            'meter_start' => 100,
        ])
            ->assertCreated()
            ->assertJsonPath('asset.status', 'assigned')
            ->json('assignment.id');

        $this->postJson("/api/v1/equipment/assets/{$assetId}/fuel-logs", [
            'project_id' => $project->id,
            'quantity' => 50,
            'unit_cost' => 12,
            'meter_reading' => 108,
        ])
            ->assertCreated()
            ->assertJsonPath('fuel_log.total_cost', '600.00');

        $this->postJson("/api/v1/equipment/assignments/{$assignmentId}/release", [
            'meter_end' => 110,
        ])
            ->assertOk()
            ->assertJsonPath('assignment.status', 'completed')
            ->assertJsonPath('assignment.asset.status', 'available');

        $this->postJson("/api/v1/equipment/assets/{$assetId}/maintenance", [
            'status' => 'completed',
            'service_date' => now()->toDateString(),
            'meter_reading' => 112,
            'cost_amount' => 900,
            'description' => 'Oil and filter change',
        ])
            ->assertCreated()
            ->assertJsonPath('asset.status', 'available')
            ->assertJsonPath('maintenance.status', 'completed');
    }

    public function test_quality_and_safety_workflows_work(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'code' => 'PRJ-QA-001',
            'name' => 'Quality Test Project',
        ]);

        $inspectionId = $this->postJson("/api/v1/projects/{$project->id}/inspections", [
            'type' => 'quality',
            'area' => 'Level 1 columns',
            'items' => [
                ['checklist_item' => 'Rebar spacing', 'requirement' => 'Drawing S-102', 'result' => 'pass'],
                ['checklist_item' => 'Concrete cover', 'requirement' => 'Project specification', 'result' => 'fail', 'severity' => 'high'],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('inspection.type', 'quality')
            ->assertJsonCount(2, 'inspection.items')
            ->json('inspection.id');

        $this->postJson("/api/v1/compliance/inspections/{$inspectionId}/complete")
            ->assertOk()
            ->assertJsonPath('inspection.status', 'failed')
            ->assertJsonPath('inspection.score', 50);

        $ncrId = $this->postJson("/api/v1/projects/{$project->id}/ncrs", [
            'inspection_id' => $inspectionId,
            'title' => 'Insufficient cover',
            'department' => 'qa',
            'category' => 'reinforcement',
            'location' => 'Level 1 grid B3',
            'contractor' => 'Main Works Contractor',
            'reference_documents' => ['Drawing S-102', 'Concrete specification'],
            'evidence' => ['cover-meter-photo.jpg'],
            'root_cause' => 'Poor workmanship',
            'corrective_action' => 'Chip out and reinstate cover to specification.',
            'preventive_action' => 'Brief steel fixing team before next pour.',
            'severity' => 'high',
        ])
            ->assertCreated()
            ->assertJsonPath('ncr.status', 'open')
            ->assertJsonPath('ncr.category', 'reinforcement')
            ->assertJsonPath('ncr.location', 'Level 1 grid B3')
            ->assertJsonPath('ncr.reference_documents.0', 'Drawing S-102')
            ->json('ncr.id');

        $this->postJson("/api/v1/compliance/ncrs/{$ncrId}/close", [
            'corrective_action' => 'Chipped and reinstated cover to specification.',
            'preventive_action' => 'Added hold point before concrete pour.',
            'verification_notes' => 'QA verified cover depth against specification.',
        ])
            ->assertOk()
            ->assertJsonPath('ncr.status', 'closed')
            ->assertJsonPath('ncr.preventive_action', 'Added hold point before concrete pour.');

        $incidentId = $this->postJson('/api/v1/safety/incidents', [
            'project_id' => $project->id,
            'description' => 'Near miss during lifting activity.',
            'severity' => 'high',
        ])
            ->assertCreated()
            ->assertJsonPath('incident.status', 'reported')
            ->json('incident.id');

        $this->postJson("/api/v1/safety/incidents/{$incidentId}/close", [
            'root_cause' => 'Lift zone not barricaded.',
            'corrective_action' => 'Updated lift plan and exclusion controls.',
        ])
            ->assertOk()
            ->assertJsonPath('incident.status', 'closed');

        $this->postJson('/api/v1/safety/toolbox-talks', [
            'project_id' => $project->id,
            'topic' => 'Lifting exclusion zones',
            'attendee_count' => 18,
        ])->assertCreated();

        $observationId = $this->postJson('/api/v1/safety/observations', [
            'project_id' => $project->id,
            'description' => 'Open trench without signage.',
        ])
            ->assertCreated()
            ->json('observation.id');

        $this->postJson("/api/v1/safety/observations/{$observationId}/close", [
            'corrective_action' => 'Installed signage and barricades.',
        ])
            ->assertOk()
            ->assertJsonPath('observation.status', 'closed');

        $permitId = $this->postJson('/api/v1/safety/permits', [
            'project_id' => $project->id,
            'permit_type' => 'hot_work',
            'location' => 'Plant room',
        ])
            ->assertCreated()
            ->assertJsonPath('permit.status', 'submitted')
            ->json('permit.id');

        $this->postJson("/api/v1/safety/permits/{$permitId}/transition", ['status' => 'approved'])->assertOk();
        $this->postJson("/api/v1/safety/permits/{$permitId}/transition", ['status' => 'active'])->assertOk();
        $this->postJson("/api/v1/safety/permits/{$permitId}/transition", ['status' => 'closed'])
            ->assertOk()
            ->assertJsonPath('permit.status', 'closed');
    }

    public function test_client_and_consultant_portal_workflows_work(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $client = Client::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'name' => 'Portal Client',
        ]);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'client_id' => $client->id,
            'code' => 'PRJ-PORT-001',
            'name' => 'Portal Test Project',
        ]);

        $drawing = Drawing::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'drawing_number' => 'A-900',
            'title' => 'Portal drawing',
            'discipline' => 'architectural',
            'status' => 'issued_for_review',
        ]);

        $document = Document::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'document_number' => 'DOC-PORT-001',
            'title' => 'Portal document',
            'document_type' => 'contract',
            'repository_scope' => 'project',
        ]);

        $portalUserId = $this->postJson('/api/v1/portals/users', [
            'client_id' => $client->id,
            'user_type' => 'client',
            'name' => 'Client Reviewer',
            'email' => 'reviewer@example.com',
        ])
            ->assertCreated()
            ->assertJsonPath('portal_user.status', 'invited')
            ->json('portal_user.id');

        $this->postJson("/api/v1/portals/users/{$portalUserId}/access", [
            'project_id' => $project->id,
            'access_level' => 'approve',
            'disciplines' => ['architectural'],
        ])
            ->assertCreated()
            ->assertJsonPath('access.access_level', 'approve');

        $approvalId = $this->postJson("/api/v1/projects/{$project->id}/client-approvals", [
            'portal_user_id' => $portalUserId,
            'drawing_id' => $drawing->id,
            'document_id' => $document->id,
            'title' => 'Approve portal drawing',
        ])
            ->assertCreated()
            ->assertJsonPath('client_approval.status', 'submitted')
            ->json('client_approval.id');

        $this->postJson("/api/v1/portals/client-approvals/{$approvalId}/review", [
            'status' => 'approved',
            'decision_notes' => 'Accepted.',
        ])
            ->assertOk()
            ->assertJsonPath('client_approval.status', 'approved');

        $submittalId = $this->postJson("/api/v1/projects/{$project->id}/consultant-submittals", [
            'portal_user_id' => $portalUserId,
            'drawing_id' => $drawing->id,
            'title' => 'Consultant detail package',
            'discipline' => 'architectural',
        ])
            ->assertCreated()
            ->assertJsonPath('consultant_submittal.status', 'submitted')
            ->json('consultant_submittal.id');

        $this->postJson("/api/v1/portals/consultant-submittals/{$submittalId}/review", [
            'status' => 'approved',
            'comments' => 'Reviewed for construction coordination.',
        ])
            ->assertOk()
            ->assertJsonPath('consultant_submittal.status', 'approved');

        $supplier = Supplier::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'name' => 'Portal Supplier',
            'email' => 'supplier@example.com',
        ]);

        $supplierPortalId = $this->postJson('/api/v1/portals/users', [
            'user_type' => 'supplier',
            'name' => 'Supplier Accounts',
            'email' => 'supplier-portal@example.com',
            'organization' => 'Portal Supplier',
        ])
            ->assertCreated()
            ->assertJsonPath('portal_user.user_type', 'supplier')
            ->json('portal_user.id');

        $this->postJson("/api/v1/portals/users/{$supplierPortalId}/access", [
            'project_id' => $project->id,
            'access_level' => 'submit',
            'access_scope' => 'contract',
            'features' => ['purchase_orders', 'invoice_submission', 'payment_status'],
        ])
            ->assertCreated()
            ->assertJsonPath('access.access_level', 'submit')
            ->assertJsonPath('access.access_scope', 'contract');

        $workItemId = $this->postJson("/api/v1/projects/{$project->id}/portal-work-items", [
            'portal_user_id' => $supplierPortalId,
            'supplier_id' => $supplier->id,
            'portal_type' => 'supplier',
            'item_type' => 'invoice_submission',
            'title' => 'Submit supplier invoice',
            'description' => 'Supplier submitted invoice for delivered materials.',
            'priority' => 'high',
            'due_date' => now()->addDays(7)->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('work_item.portal_type', 'supplier')
            ->assertJsonPath('work_item.item_type', 'invoice_submission')
            ->assertJsonPath('work_item.status', 'submitted')
            ->json('work_item.id');

        $this->getJson('/api/v1/admin/approvals')
            ->assertOk()
            ->assertJsonFragment([
                'type' => 'portal_work_item',
                'record_id' => $workItemId,
            ]);

        $this->postJson("/api/v1/portals/work-items/{$workItemId}/review", [
            'status' => 'in_review',
            'response' => 'Finance review started.',
        ])
            ->assertOk()
            ->assertJsonPath('work_item.status', 'in_review');

        $this->patchJson("/api/v1/portals/work-items/{$workItemId}", [
            'title' => 'Submit supplier invoice updated',
            'priority' => 'critical',
        ])
            ->assertOk()
            ->assertJsonPath('work_item.title', 'Submit supplier invoice updated')
            ->assertJsonPath('work_item.priority', 'critical');

        $this->getJson('/api/v1/portals')
            ->assertOk()
            ->assertJsonPath('summary.active_users', 0)
            ->assertJsonPath('portal_types.2.key', 'supplier')
            ->assertJsonCount(1, 'work_items');

        $this->postJson("/api/v1/portals/work-items/{$workItemId}/review", [
            'status' => 'paid',
            'response' => 'Payment released.',
        ])
            ->assertOk()
            ->assertJsonPath('work_item.status', 'paid');

        $this->deleteJson("/api/v1/portals/work-items/{$workItemId}")
            ->assertOk()
            ->assertJsonPath('message', 'Portal work item archived.');
        $this->assertSoftDeleted('portal_work_items', ['id' => $workItemId]);
    }

    private function tenantUser(): array
    {
        $company = Company::query()->create([
            'name' => 'Phase Three Build Co',
            'default_currency' => 'GHS',
            'country' => 'GH',
        ]);

        $branch = Branch::query()->create([
            'company_id' => $company->id,
            'name' => 'Head Office',
            'code' => 'HQ',
        ]);

        $role = Role::query()->create([
            'company_id' => $company->id,
            'name' => 'Owner',
            'slug' => 'owner',
            'permissions' => ['*'],
            'is_system' => true,
        ]);

        $user = User::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'role_id' => $role->id,
            'name' => 'Owner User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'NavkwaBuild2026!',
        ]);

        return [$user, $branch, $company];
    }
}
