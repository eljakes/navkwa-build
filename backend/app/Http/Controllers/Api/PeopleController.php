<?php

namespace App\Http\Controllers\Api;

use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\EmployeeProfile;
use App\Models\EquipmentAsset;
use App\Models\LeaveRequest;
use App\Models\PayrollRun;
use App\Models\Payslip;
use App\Models\Project;
use App\Models\Supplier;
use App\Models\User;
use App\Models\WorkforceAllocation;
use App\Models\WorkforceApplication;
use App\Models\WorkforceAsset;
use App\Models\WorkforceBenefit;
use App\Models\WorkforceCandidate;
use App\Models\WorkforceCertification;
use App\Models\WorkforceContractor;
use App\Models\WorkforceDocument;
use App\Models\WorkforceExitRecord;
use App\Models\WorkforceInterview;
use App\Models\WorkforceJobVacancy;
use App\Models\WorkforceOnboardingChecklist;
use App\Models\WorkforceOvertimeRequest;
use App\Models\WorkforcePerformanceReview;
use App\Models\WorkforcePpeIssue;
use App\Models\WorkforceSetting;
use App\Models\WorkforceShift;
use App\Models\WorkforceShiftAssignment;
use App\Models\WorkforceTimesheet;
use App\Models\WorkforceTrainingCourse;
use App\Models\WorkforceTrainingRecord;
use App\Services\FinancePostingService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PeopleController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $financePosting = app(FinancePostingService::class);
        $financePosting->syncPayrollRunsForCompany($companyId, $this->user($request)->id);

        $employees = EmployeeProfile::query()
            ->forCompany($companyId)
            ->with(['user:id,name,email,job_title', 'branch:id,name,code', 'manager:id,name,email', 'currentProject:id,code,name', 'allocations.project:id,code,name'])
            ->orderBy('employee_number')
            ->get();

        $payrollRuns = PayrollRun::query()
            ->forCompany($companyId)
            ->with(['payslips.employeeProfile.user:id,name,email'])
            ->latest('period_end')
            ->limit(80)
            ->get()
            ->each(fn (PayrollRun $run): PayrollRun => $financePosting->attachPayrollFinanceStatus($run));

        $attendance = AttendanceRecord::query()
            ->forCompany($companyId)
            ->with(['user:id,name,email'])
            ->latest('clock_in_at')
            ->limit(120)
            ->get();

        $vacancies = WorkforceJobVacancy::query()->forCompany($companyId)->with(['branch:id,name', 'project:id,code,name', 'applications'])->latest()->limit(100)->get();
        $candidates = WorkforceCandidate::query()->forCompany($companyId)->with('applications.vacancy:id,vacancy_number,title')->latest()->limit(120)->get();
        $applications = WorkforceApplication::query()->forCompany($companyId)->with(['vacancy:id,vacancy_number,title,department,branch_id,project_id,employment_type', 'candidate:id,candidate_number,full_name,email,phone,trade', 'interviews', 'hiredEmployee.user:id,name,email'])->latest()->limit(120)->get();
        $interviews = WorkforceInterview::query()->forCompany($companyId)->with(['application.candidate:id,full_name', 'application.vacancy:id,title'])->latest('scheduled_at')->limit(120)->get();
        $timesheets = WorkforceTimesheet::query()->forCompany($companyId)->with(['employeeProfile.user:id,name,email', 'project:id,code,name', 'shift:id,name'])->latest('work_date')->limit(160)->get();
        $allocations = WorkforceAllocation::query()->forCompany($companyId)->with(['employeeProfile.user:id,name,email', 'project:id,code,name', 'supervisor:id,name'])->latest('start_date')->limit(140)->get();
        $certifications = WorkforceCertification::query()->forCompany($companyId)->with('employeeProfile.user:id,name,email')->latest('expires_on')->limit(120)->get();
        $trainingRecords = WorkforceTrainingRecord::query()->forCompany($companyId)->with(['employeeProfile.user:id,name,email', 'course:id,course_code,title,category'])->latest()->limit(120)->get();
        $ppeIssues = WorkforcePpeIssue::query()->forCompany($companyId)->with(['employeeProfile.user:id,name,email', 'project:id,code,name'])->latest('issued_on')->limit(120)->get();
        $contractors = WorkforceContractor::query()->forCompany($companyId)->with('supplier:id,name')->latest()->limit(100)->get();
        $exitRecords = WorkforceExitRecord::query()->forCompany($companyId)->with('employeeProfile.user:id,name,email')->latest('exit_date')->limit(100)->get();
        $workforceAutomationTriggers = ['employee_birthday', 'contract_expiring', 'certification_expiring', 'employee_absent', 'leave_approved', 'payroll_completed'];
        $workforceTriggerStatuses = collect($workforceAutomationTriggers)->map(function (string $trigger) use ($companyId): array {
            $activeWorkflows = DB::table('automation_rules')
                ->where('company_id', $companyId)
                ->whereIn('module', ['hr', 'people', 'staff'])
                ->where('status', 'active')
                ->where('trigger_event', $trigger)
                ->count();

            return [
                'trigger' => $trigger,
                'active_workflows' => $activeWorkflows,
                'status' => $activeWorkflows > 0 ? 'connected' : 'not_configured',
            ];
        })->values();

        return response()->json([
            'summary' => $this->summary($companyId, $employees, $attendance, $timesheets, $certifications, $contractors, $vacancies),
            'employees' => $employees,
            'leave_requests' => LeaveRequest::query()->forCompany($companyId)->with(['employeeProfile.user:id,name,email'])->latest()->limit(100)->get(),
            'payroll_runs' => $payrollRuns,
            'recruitment' => [
                'vacancies' => $vacancies,
                'candidates' => $candidates,
                'applications' => $applications,
                'interviews' => $interviews,
            ],
            'onboarding' => WorkforceOnboardingChecklist::query()->forCompany($companyId)->with('employeeProfile.user:id,name,email')->latest()->limit(120)->get(),
            'attendance' => [
                'records' => $attendance,
                'summary' => $this->attendanceSummary($employees, $attendance),
            ],
            'shifts' => WorkforceShift::query()->forCompany($companyId)->with(['branch:id,name', 'project:id,code,name'])->orderBy('shift_code')->get(),
            'shift_assignments' => WorkforceShiftAssignment::query()->forCompany($companyId)->with(['shift:id,name,shift_type,start_time,end_time', 'employeeProfile.user:id,name,email', 'project:id,code,name'])->latest()->limit(120)->get(),
            'timesheets' => $timesheets,
            'workforce_allocations' => $allocations,
            'overtime_requests' => WorkforceOvertimeRequest::query()->forCompany($companyId)->with(['employeeProfile.user:id,name,email', 'project:id,code,name'])->latest()->limit(120)->get(),
            'benefits' => WorkforceBenefit::query()->forCompany($companyId)->with('employeeProfile.user:id,name,email')->latest()->limit(120)->get(),
            'performance_reviews' => WorkforcePerformanceReview::query()->forCompany($companyId)->with(['employeeProfile.user:id,name,email', 'reviewer:id,name'])->latest()->limit(120)->get(),
            'training_courses' => WorkforceTrainingCourse::query()->forCompany($companyId)->orderBy('course_code')->get(),
            'training_records' => $trainingRecords,
            'certifications' => $certifications,
            'health_safety' => [
                'ppe_issues' => $ppeIssues,
                'expiring_ppe' => $ppeIssues->filter(fn (WorkforcePpeIssue $issue): bool => $issue->replacement_due_on && $issue->replacement_due_on->lte(now()->addDays(30)))->values(),
                'certification_risk' => $certifications->filter(fn (WorkforceCertification $cert): bool => $cert->expires_on && $cert->expires_on->lte(now()->addDays(60)))->values(),
            ],
            'ppe_issues' => $ppeIssues,
            'contractors' => $contractors,
            'employee_assets' => WorkforceAsset::query()->forCompany($companyId)->with(['employeeProfile.user:id,name,email', 'equipmentAsset:id,equipment_number,name'])->latest('assigned_on')->limit(120)->get(),
            'documents' => WorkforceDocument::query()->forCompany($companyId)->with(['employeeProfile.user:id,name,email', 'candidate:id,full_name'])->latest()->limit(120)->get(),
            'self_service' => $this->selfService($request),
            'manager_portal' => $this->managerPortal($companyId),
            'exit_records' => $exitRecords,
            'reports' => $this->reports($employees, $timesheets, $allocations, $trainingRecords, $certifications, $exitRecords),
            'analytics' => $this->analytics($employees, $timesheets, $allocations, $applications, $certifications, $trainingRecords, $exitRecords),
            'automation' => [
                'available_triggers' => $workforceTriggerStatuses,
                'connected_workflows' => DB::table('automation_rules')->where('company_id', $companyId)->whereIn('module', ['hr', 'people', 'staff'])->where('status', 'active')->count(),
            ],
            'settings' => WorkforceSetting::query()->forCompany($companyId)->pluck('setting_value', 'setting_key'),
            'asset_candidates' => EquipmentAsset::query()->forCompany($companyId)->select('id', 'equipment_number', 'name', 'status')->orderBy('name')->limit(100)->get(),
        ]);
    }

    public function storeEmployeeProfile(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'user_id' => ['required', 'integer', Rule::unique('employee_profiles')->where('company_id', $companyId)],
            'manager_id' => ['nullable', 'integer'],
            'current_project_id' => ['nullable', 'integer'],
            'employment_type' => ['nullable', Rule::in(['full_time', 'part_time', 'contract', 'casual'])],
            'department' => ['nullable', 'string', 'max:120'],
            'position' => ['nullable', 'string', 'max:120'],
            'gender' => ['nullable', 'string', 'max:40'],
            'date_of_birth' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:80'],
            'marital_status' => ['nullable', 'string', 'max:40'],
            'national_id' => ['nullable', 'string', 'max:120'],
            'tax_number' => ['nullable', 'string', 'max:120'],
            'ssnit_number' => ['nullable', 'string', 'max:120'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'allowances' => ['nullable', 'numeric', 'min:0'],
            'bonuses' => ['nullable', 'numeric', 'min:0'],
            'deductions' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'hire_date' => ['nullable', 'date'],
            'emergency_contact' => ['nullable', 'string', 'max:255'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'bank_account' => ['nullable', 'string', 'max:120'],
            'skills' => ['nullable', 'string', 'max:1000'],
            'licenses' => ['nullable', 'string', 'max:1000'],
            'medical_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = User::query()->where('company_id', $companyId)->whereKey($data['user_id'])->firstOrFail();
        $branchId = $data['branch_id'] ?? $user->branch_id ?? $this->user($request)->branch_id;
        Branch::query()->forCompany($companyId)->whereKey($branchId)->firstOrFail();

        if (! empty($data['manager_id'])) {
            User::query()->where('company_id', $companyId)->whereKey($data['manager_id'])->firstOrFail();
        }

        if (! empty($data['current_project_id'])) {
            Project::query()->forCompany($companyId)->whereKey($data['current_project_id'])->firstOrFail();
        }

        $employee = EmployeeProfile::query()->create([
            'company_id' => $companyId,
            'branch_id' => $branchId,
            'employee_number' => $this->nextNumber('EMP', EmployeeProfile::class, 'employee_number', $companyId),
            'employment_type' => $data['employment_type'] ?? 'full_time',
            'department' => $data['department'] ?? 'operations',
            'currency' => strtoupper($data['currency'] ?? $this->user($request)->company->default_currency),
            'status' => 'active',
            'skills' => $this->csv($data['skills'] ?? null),
            'licenses' => $this->csv($data['licenses'] ?? null),
            ...collect($data)->except(['branch_id', 'employment_type', 'department', 'currency', 'skills', 'licenses'])->all(),
        ]);

        return response()->json(['employee' => $employee->load(['user', 'branch', 'manager', 'currentProject'])], 201);
    }

    public function storeJobVacancy(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:120'],
            'employment_type' => ['nullable', Rule::in(['full_time', 'part_time', 'contract', 'casual'])],
            'openings' => ['nullable', 'integer', 'min:1'],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
            'description' => ['nullable', 'string', 'max:4000'],
            'required_skills' => ['nullable', 'string', 'max:1000'],
            'opened_on' => ['nullable', 'date'],
            'closes_on' => ['nullable', 'date'],
        ]);

        $this->validateBranchProject($companyId, $data);

        $vacancy = WorkforceJobVacancy::query()->create([
            'company_id' => $companyId,
            'vacancy_number' => $this->nextNumber('VAC', WorkforceJobVacancy::class, 'vacancy_number', $companyId),
            'department' => $data['department'] ?? 'operations',
            'employment_type' => $data['employment_type'] ?? 'full_time',
            'openings' => $data['openings'] ?? 1,
            'priority' => $data['priority'] ?? 'medium',
            'status' => 'open',
            'required_skills' => $this->csv($data['required_skills'] ?? null),
            'opened_on' => $data['opened_on'] ?? now()->toDateString(),
            'created_by' => $this->user($request)->id,
            ...collect($data)->except(['department', 'employment_type', 'openings', 'priority', 'required_skills', 'opened_on'])->all(),
        ]);

        return response()->json(['vacancy' => $vacancy->load(['branch', 'project'])], 201);
    }

    public function storeCandidate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:80'],
            'trade' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:120'],
            'source' => ['nullable', 'string', 'max:80'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'notes' => ['nullable', 'string', 'max:3000'],
        ]);

        $companyId = $this->companyId($request);
        $candidate = WorkforceCandidate::query()->create([
            'company_id' => $companyId,
            'candidate_number' => $this->nextNumber('CAN', WorkforceCandidate::class, 'candidate_number', $companyId),
            'source' => $data['source'] ?? 'direct',
            'rating' => $data['rating'] ?? 3,
            ...collect($data)->except(['source', 'rating'])->all(),
        ]);

        return response()->json(['candidate' => $candidate], 201);
    }

    public function storeApplication(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'job_vacancy_id' => ['required', 'integer'],
            'candidate_id' => ['required', 'integer'],
            'applied_on' => ['nullable', 'date'],
            'expected_salary' => ['nullable', 'numeric', 'min:0'],
            'screening_score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'background_check_status' => ['nullable', Rule::in(['pending', 'clear', 'flagged'])],
            'offer_status' => ['nullable', Rule::in(['not_sent', 'sent', 'accepted', 'declined'])],
            'notes' => ['nullable', 'string', 'max:3000'],
        ]);

        $vacancy = WorkforceJobVacancy::query()->forCompany($companyId)->whereKey($data['job_vacancy_id'])->firstOrFail();
        $candidate = WorkforceCandidate::query()->forCompany($companyId)->whereKey($data['candidate_id'])->firstOrFail();

        $application = WorkforceApplication::query()->create([
            'company_id' => $companyId,
            'job_vacancy_id' => $vacancy->id,
            'candidate_id' => $candidate->id,
            'application_number' => $this->nextNumber('APP', WorkforceApplication::class, 'application_number', $companyId),
            'status' => 'applied',
            'applied_on' => $data['applied_on'] ?? now()->toDateString(),
            'expected_salary' => $data['expected_salary'] ?? 0,
            'screening_score' => $data['screening_score'] ?? 0,
            'background_check_status' => $data['background_check_status'] ?? 'pending',
            'offer_status' => $data['offer_status'] ?? 'not_sent',
            'notes' => $data['notes'] ?? null,
        ]);

        $candidate->update(['status' => 'applied']);

        return response()->json(['application' => $application->load(['vacancy', 'candidate'])], 201);
    }

    public function hireApplication(Request $request, WorkforceApplication $application): JsonResponse
    {
        $this->assertTenant($request, $application);
        abort_if($application->status === 'hired', 422, 'Application has already been hired.');

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'manager_id' => ['nullable', 'integer'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'hire_date' => ['nullable', 'date'],
        ]);

        $application->load(['candidate', 'vacancy']);
        $candidate = $application->candidate;
        $vacancy = $application->vacancy;
        $branchId = $data['branch_id'] ?? $vacancy->branch_id ?? $this->user($request)->branch_id;

        Branch::query()->forCompany($application->company_id)->whereKey($branchId)->firstOrFail();

        $email = $candidate->email ?: 'candidate-'.$candidate->id.'-'.$application->company_id.'@navkwabuild.local';
        $user = User::query()->firstOrCreate(
            ['company_id' => $application->company_id, 'email' => $email],
            [
                'branch_id' => $branchId,
                'role_id' => $this->user($request)->role_id,
                'name' => $candidate->full_name,
                'phone' => $candidate->phone,
                'job_title' => $vacancy->title,
                'status' => 'active',
                'password' => Str::password(24, letters: true, numbers: true, symbols: true, spaces: false),
                'must_change_password' => true,
                'permissions' => ['payroll.manage'],
            ]
        );

        $employee = DB::transaction(function () use ($request, $application, $candidate, $vacancy, $user, $branchId, $data) {
            $employee = EmployeeProfile::query()->create([
                'company_id' => $application->company_id,
                'branch_id' => $branchId,
                'user_id' => $user->id,
                'manager_id' => $data['manager_id'] ?? null,
                'current_project_id' => $data['project_id'] ?? $vacancy->project_id,
                'employee_number' => $this->nextNumber('EMP', EmployeeProfile::class, 'employee_number', $application->company_id),
                'employment_type' => $vacancy->employment_type,
                'department' => $vacancy->department,
                'position' => $vacancy->title,
                'base_salary' => $data['base_salary'] ?? $application->expected_salary,
                'hourly_rate' => $data['hourly_rate'] ?? 0,
                'currency' => $this->user($request)->company->default_currency,
                'hire_date' => $data['hire_date'] ?? now()->toDateString(),
                'status' => 'active',
            ]);

            $application->update([
                'status' => 'hired',
                'offer_status' => 'accepted',
                'hired_employee_profile_id' => $employee->id,
            ]);
            $candidate->update(['status' => 'hired']);

            $hiredCount = WorkforceApplication::query()->where('job_vacancy_id', $vacancy->id)->where('status', 'hired')->count();
            if ($hiredCount >= $vacancy->openings) {
                $vacancy->update(['status' => 'filled']);
            }

            WorkforceOnboardingChecklist::query()->create([
                'company_id' => $application->company_id,
                'employee_profile_id' => $employee->id,
                'checklist_number' => $this->nextNumber('ONB', WorkforceOnboardingChecklist::class, 'checklist_number', $application->company_id),
                'status' => 'open',
                'due_date' => now()->addDays(14)->toDateString(),
                'items' => $this->defaultOnboardingItems(),
            ]);

            return $employee;
        });

        return response()->json(['employee' => $employee->fresh(['user', 'branch', 'manager', 'currentProject']), 'application' => $application->fresh(['vacancy', 'candidate', 'hiredEmployee'])], 201);
    }

    public function storeInterview(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'application_id' => ['required', 'integer'],
            'scheduled_at' => ['nullable', 'date'],
            'stage' => ['nullable', 'string', 'max:80'],
            'interviewers' => ['nullable', 'string', 'max:1000'],
            'result' => ['nullable', Rule::in(['scheduled', 'passed', 'failed', 'rescheduled'])],
            'score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string', 'max:3000'],
        ]);

        $application = WorkforceApplication::query()->forCompany($companyId)->whereKey($data['application_id'])->firstOrFail();
        $interview = WorkforceInterview::query()->create([
            'company_id' => $companyId,
            'application_id' => $application->id,
            'interview_number' => $this->nextNumber('INT', WorkforceInterview::class, 'interview_number', $companyId),
            'stage' => $data['stage'] ?? 'technical',
            'interviewers' => $this->csv($data['interviewers'] ?? null),
            'result' => $data['result'] ?? 'scheduled',
            'score' => $data['score'] ?? 0,
            ...collect($data)->except(['application_id', 'stage', 'interviewers', 'result', 'score'])->all(),
        ]);

        $application->update(['status' => ($data['result'] ?? 'scheduled') === 'passed' ? 'interview_passed' : 'interview']);

        return response()->json(['interview' => $interview->load('application.candidate')], 201);
    }

    public function storeOnboardingChecklist(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'employee_profile_id' => ['required', 'integer'],
            'due_date' => ['nullable', 'date'],
            'completed_items' => ['nullable', 'string', 'max:1000'],
        ]);

        $employee = $this->employee($companyId, $data['employee_profile_id']);
        $completed = $this->csv($data['completed_items'] ?? null);
        $items = collect($this->defaultOnboardingItems())
            ->map(fn (array $item): array => [...$item, 'completed' => in_array($item['label'], $completed, true)])
            ->values()
            ->all();
        $complete = collect($items)->every(fn (array $item): bool => $item['completed']);

        $checklist = WorkforceOnboardingChecklist::query()->create([
            'company_id' => $companyId,
            'employee_profile_id' => $employee->id,
            'checklist_number' => $this->nextNumber('ONB', WorkforceOnboardingChecklist::class, 'checklist_number', $companyId),
            'status' => $complete ? 'completed' : 'open',
            'due_date' => $data['due_date'] ?? now()->addDays(14)->toDateString(),
            'items' => $items,
            'completed_at' => $complete ? now() : null,
        ]);

        return response()->json(['onboarding' => $checklist->load('employeeProfile.user')], 201);
    }

    public function storeShift(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'shift_type' => ['nullable', Rule::in(['day', 'night', 'weekend', 'rotating'])],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'break_minutes' => ['nullable', 'integer', 'min:0'],
        ]);

        $this->validateBranchProject($companyId, $data);

        $shift = WorkforceShift::query()->create([
            'company_id' => $companyId,
            'shift_code' => $this->nextCompanyCode('SFT', WorkforceShift::class, 'shift_code', $companyId),
            'shift_type' => $data['shift_type'] ?? 'day',
            'break_minutes' => $data['break_minutes'] ?? 60,
            'status' => 'active',
            ...collect($data)->except(['shift_type', 'break_minutes'])->all(),
        ]);

        return response()->json(['shift' => $shift->load(['branch', 'project'])], 201);
    }

    public function storeShiftAssignment(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'shift_id' => ['required', 'integer'],
            'employee_profile_id' => ['required', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
        ]);

        $shift = WorkforceShift::query()->forCompany($companyId)->whereKey($data['shift_id'])->firstOrFail();
        $employee = $this->employee($companyId, $data['employee_profile_id']);
        if (! empty($data['project_id'])) {
            Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
        }

        $assignment = WorkforceShiftAssignment::query()->create([
            'company_id' => $companyId,
            'shift_id' => $shift->id,
            'employee_profile_id' => $employee->id,
            'status' => 'active',
            ...collect($data)->except(['shift_id', 'employee_profile_id'])->all(),
        ]);

        return response()->json(['shift_assignment' => $assignment->load(['shift', 'employeeProfile.user', 'project'])], 201);
    }

    public function storeTimesheet(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'employee_profile_id' => ['required', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'shift_id' => ['nullable', 'integer'],
            'work_date' => ['required', 'date'],
            'hours_worked' => ['required', 'numeric', 'min:0'],
            'overtime_hours' => ['nullable', 'numeric', 'min:0'],
            'cost_rate' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $employee = $this->employee($companyId, $data['employee_profile_id']);
        if (! empty($data['project_id'])) {
            Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
        }
        if (! empty($data['shift_id'])) {
            WorkforceShift::query()->forCompany($companyId)->whereKey($data['shift_id'])->firstOrFail();
        }

        $hours = (float) $data['hours_worked'];
        $overtime = (float) ($data['overtime_hours'] ?? max(0, $hours - 8));
        $rate = (float) ($data['cost_rate'] ?? $employee->hourly_rate ?? 0);
        $cost = round(($hours * $rate) + ($overtime * $rate * 0.5), 2);

        $timesheet = WorkforceTimesheet::query()->create([
            'company_id' => $companyId,
            'employee_profile_id' => $employee->id,
            'timesheet_number' => $this->nextNumber('TMS', WorkforceTimesheet::class, 'timesheet_number', $companyId),
            'overtime_hours' => $overtime,
            'cost_rate' => $rate,
            'cost_amount' => $cost,
            'status' => 'submitted',
            ...collect($data)->except(['employee_profile_id', 'overtime_hours', 'cost_rate'])->all(),
        ]);

        return response()->json(['timesheet' => $timesheet->load(['employeeProfile.user', 'project', 'shift'])], 201);
    }

    public function reviewTimesheet(Request $request, WorkforceTimesheet $timesheet): JsonResponse
    {
        $this->assertTenant($request, $timesheet);
        $data = $request->validate(['status' => ['required', Rule::in(['approved', 'rejected'])]]);

        $timesheet->update([
            'status' => $data['status'],
            'approved_by' => $this->user($request)->id,
            'approved_at' => now(),
        ]);

        return response()->json(['timesheet' => $timesheet->fresh(['employeeProfile.user', 'project', 'shift'])]);
    }

    public function storeAllocation(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'employee_profile_id' => ['required', 'integer'],
            'project_id' => ['required', 'integer'],
            'supervisor_id' => ['nullable', 'integer'],
            'role' => ['nullable', 'string', 'max:120'],
            'allocation_percent' => ['nullable', 'integer', 'min:1', 'max:100'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        $employee = $this->employee($companyId, $data['employee_profile_id']);
        $project = Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
        if (! empty($data['supervisor_id'])) {
            User::query()->where('company_id', $companyId)->whereKey($data['supervisor_id'])->firstOrFail();
        }

        $allocation = WorkforceAllocation::query()->create([
            'company_id' => $companyId,
            'employee_profile_id' => $employee->id,
            'project_id' => $project->id,
            'allocation_number' => $this->nextNumber('ALC', WorkforceAllocation::class, 'allocation_number', $companyId),
            'role' => $data['role'] ?? $employee->position ?? 'worker',
            'allocation_percent' => $data['allocation_percent'] ?? 100,
            'status' => 'active',
            ...collect($data)->except(['employee_profile_id', 'project_id', 'role', 'allocation_percent'])->all(),
        ]);

        $employee->update(['current_project_id' => $project->id]);

        return response()->json(['allocation' => $allocation->load(['employeeProfile.user', 'project', 'supervisor'])], 201);
    }

    public function storeOvertimeRequest(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'employee_profile_id' => ['required', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'work_date' => ['required', 'date'],
            'hours' => ['required', 'numeric', 'min:0.25'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $employee = $this->employee($companyId, $data['employee_profile_id']);
        if (! empty($data['project_id'])) {
            Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
        }

        $requestModel = WorkforceOvertimeRequest::query()->create([
            'company_id' => $companyId,
            'employee_profile_id' => $employee->id,
            'request_number' => $this->nextNumber('OT', WorkforceOvertimeRequest::class, 'request_number', $companyId),
            'status' => 'pending',
            ...collect($data)->except(['employee_profile_id'])->all(),
        ]);

        return response()->json(['overtime_request' => $requestModel->load(['employeeProfile.user', 'project'])], 201);
    }

    public function reviewOvertimeRequest(Request $request, WorkforceOvertimeRequest $overtime): JsonResponse
    {
        $this->assertTenant($request, $overtime);
        $data = $request->validate(['status' => ['required', Rule::in(['approved', 'rejected'])]]);

        $overtime->update([
            'status' => $data['status'],
            'approved_by' => $this->user($request)->id,
            'approved_at' => now(),
        ]);

        return response()->json(['overtime_request' => $overtime->fresh(['employeeProfile.user', 'project'])]);
    }

    public function storeLeaveRequest(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'employee_profile_id' => ['required', 'integer'],
            'leave_type' => ['nullable', Rule::in(['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'compassionate', 'study', 'half_day', 'emergency'])],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'days' => ['nullable', 'numeric', 'min:0.5'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $employee = $this->employee($companyId, $data['employee_profile_id']);
        $days = $data['days'] ?? Carbon::parse($data['starts_on'])->diffInDays(Carbon::parse($data['ends_on'])) + 1;

        $leave = LeaveRequest::query()->create([
            'company_id' => $companyId,
            'employee_profile_id' => $employee->id,
            'user_id' => $employee->user_id,
            'leave_type' => $data['leave_type'] ?? 'annual',
            'status' => 'pending',
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
            'days' => $days,
            'reason' => $data['reason'] ?? null,
        ]);

        $this->publishAutomationEvent($request, 'leave_request_pending', [
            'record_type' => 'leave_request',
            'record_id' => $leave->id,
        ]);

        return response()->json(['leave_request' => $leave->load('employeeProfile.user')], 201);
    }

    public function reviewLeaveRequest(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->assertTenant($request, $leaveRequest);

        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected', 'cancelled'])],
            'review_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $allowed = [
            'pending' => ['approved', 'rejected', 'cancelled'],
            'approved' => ['cancelled'],
            'rejected' => [],
            'cancelled' => [],
        ];

        abort_if(! in_array($data['status'], $allowed[$leaveRequest->status] ?? [], true), 422, 'Invalid leave request transition.');

        $leaveRequest->update([
            'status' => $data['status'],
            'reviewed_by' => $this->user($request)->id,
            'reviewed_at' => now(),
            'review_notes' => $data['review_notes'] ?? null,
        ]);

        return response()->json(['leave_request' => $leaveRequest->fresh('employeeProfile.user')]);
    }

    public function storePayrollRun(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'currency' => ['nullable', 'string', 'size:3'],
            'payslips' => ['nullable', 'array'],
            'payslips.*.employee_profile_id' => ['required_with:payslips', 'integer'],
            'payslips.*.gross_pay' => ['nullable', 'numeric', 'min:0'],
            'payslips.*.overtime_pay' => ['nullable', 'numeric', 'min:0'],
            'payslips.*.allowances' => ['nullable', 'numeric', 'min:0'],
            'payslips.*.deductions' => ['nullable', 'numeric', 'min:0'],
            'payslips.*.tax_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        if (! empty($data['branch_id'])) {
            Branch::query()->forCompany($companyId)->whereKey($data['branch_id'])->firstOrFail();
        }

        $periodStart = Carbon::parse($data['period_start'])->toDateString();
        $periodEnd = Carbon::parse($data['period_end'])->toDateString();
        $payslipLines = $data['payslips'] ?? [];

        if ($payslipLines === []) {
            $employees = EmployeeProfile::query()
                ->forCompany($companyId)
                ->when($data['branch_id'] ?? null, fn ($query, $branchId) => $query->where('branch_id', $branchId))
                ->where('status', 'active')
                ->get();

            abort_if($employees->isEmpty(), 422, 'No active employees available for this payroll run.');

            $payslipLines = $employees->map(function (EmployeeProfile $employee) use ($periodStart, $periodEnd): array {
                $overtimeHours = (float) WorkforceTimesheet::query()
                    ->where('employee_profile_id', $employee->id)
                    ->where('status', 'approved')
                    ->whereDate('work_date', '>=', $periodStart)
                    ->whereDate('work_date', '<=', $periodEnd)
                    ->sum('overtime_hours');
                $approvedOvertime = (float) WorkforceOvertimeRequest::query()
                    ->where('employee_profile_id', $employee->id)
                    ->where('status', 'approved')
                    ->whereDate('work_date', '>=', $periodStart)
                    ->whereDate('work_date', '<=', $periodEnd)
                    ->sum('hours');
                $overtimePay = round(($overtimeHours + $approvedOvertime) * (float) $employee->hourly_rate * 1.5, 2);

                return [
                    'employee_profile_id' => $employee->id,
                    'gross_pay' => (float) $employee->base_salary,
                    'overtime_pay' => $overtimePay,
                    'allowances' => (float) $employee->allowances + (float) $employee->bonuses,
                    'deductions' => (float) $employee->deductions,
                    'tax_amount' => 0,
                ];
            })->all();
        }

        $run = DB::transaction(function () use ($request, $companyId, $data, $payslipLines) {
            $run = PayrollRun::query()->create([
                'company_id' => $companyId,
                'branch_id' => $data['branch_id'] ?? null,
                'run_number' => $this->nextNumber('PAYRUN', PayrollRun::class, 'run_number', $companyId),
                'period_start' => $data['period_start'],
                'period_end' => $data['period_end'],
                'status' => 'draft',
                'currency' => strtoupper($data['currency'] ?? $this->user($request)->company->default_currency),
                'created_by' => $this->user($request)->id,
            ]);

            foreach ($payslipLines as $line) {
                $employee = $this->employee($companyId, $line['employee_profile_id']);
                $gross = (float) ($line['gross_pay'] ?? $employee->base_salary);
                $overtime = (float) ($line['overtime_pay'] ?? 0);
                $allowances = (float) ($line['allowances'] ?? 0);
                $deductions = (float) ($line['deductions'] ?? 0);
                $tax = (float) ($line['tax_amount'] ?? 0);
                $grossTotal = $gross + $overtime + $allowances;
                $deductionTotal = $deductions + $tax;

                Payslip::query()->create([
                    'company_id' => $companyId,
                    'payroll_run_id' => $run->id,
                    'employee_profile_id' => $employee->id,
                    'user_id' => $employee->user_id,
                    'gross_pay' => $gross,
                    'overtime_pay' => $overtime,
                    'allowances' => $allowances,
                    'deductions' => $deductions,
                    'tax_amount' => $tax,
                    'net_pay' => max(0, $grossTotal - $deductionTotal),
                    'status' => 'draft',
                    'metadata' => ['period' => [$data['period_start'], $data['period_end']]],
                ]);
            }

            $this->syncPayrollTotals($run);

            return $run;
        });

        $payrollRun = app(FinancePostingService::class)->attachPayrollFinanceStatus($run->fresh('payslips.employeeProfile.user'));

        return response()->json(['payroll_run' => $payrollRun], 201);
    }

    public function approvePayrollRun(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->assertTenant($request, $payrollRun);

        $data = $request->validate([
            'status' => ['nullable', Rule::in(['approved', 'paid'])],
        ]);

        $target = $data['status'] ?? 'approved';
        $allowed = [
            'draft' => ['approved'],
            'approved' => ['paid'],
            'paid' => [],
        ];

        abort_if(! in_array($target, $allowed[$payrollRun->status] ?? [], true), 422, 'Invalid payroll transition.');

        $updates = ['status' => $target];

        if ($target === 'approved') {
            $updates['approved_by'] = $this->user($request)->id;
            $updates['approved_at'] = now();
        }

        if ($target === 'paid') {
            $updates['paid_at'] = now();
        }

        DB::transaction(function () use ($payrollRun, $target, $updates) {
            $payrollRun->update($updates);
            $payrollRun->payslips()->update([
                'status' => $target,
                'paid_at' => $target === 'paid' ? now() : null,
            ]);
        });

        if ($target === 'approved') {
            app(FinancePostingService::class)->postPayrollApproval($payrollRun->fresh('payslips'), $this->user($request)->id);
        }

        if ($target === 'paid') {
            app(FinancePostingService::class)->postPayrollPayment($payrollRun->fresh('payslips'), $this->user($request)->id);
        }

        $payrollRun = app(FinancePostingService::class)->attachPayrollFinanceStatus($payrollRun->fresh('payslips.employeeProfile.user'));

        return response()->json(['payroll_run' => $payrollRun]);
    }

    public function storeBenefit(Request $request): JsonResponse
    {
        $data = $this->employeeRecordPayload($request, [
            'benefit_type' => ['required', 'string', 'max:120'],
            'provider' => ['nullable', 'string', 'max:120'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date'],
        ]);

        $benefit = WorkforceBenefit::query()->create([
            'company_id' => $data['company_id'],
            'employee_profile_id' => $data['employee']->id,
            'currency' => strtoupper($data['validated']['currency'] ?? $this->user($request)->company->default_currency),
            'status' => 'active',
            ...collect($data['validated'])->except(['employee_profile_id', 'currency'])->all(),
        ]);

        return response()->json(['benefit' => $benefit->load('employeeProfile.user')], 201);
    }

    public function storePerformanceReview(Request $request): JsonResponse
    {
        $data = $this->employeeRecordPayload($request, [
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date'],
            'safety_score' => ['nullable', 'integer', 'min:0', 'max:5'],
            'quality_score' => ['nullable', 'integer', 'min:0', 'max:5'],
            'productivity_score' => ['nullable', 'integer', 'min:0', 'max:5'],
            'teamwork_score' => ['nullable', 'integer', 'min:0', 'max:5'],
            'goals' => ['nullable', 'string', 'max:3000'],
            'notes' => ['nullable', 'string', 'max:3000'],
        ]);

        $scores = collect(['safety_score', 'quality_score', 'productivity_score', 'teamwork_score'])->map(fn (string $field): int => (int) ($data['validated'][$field] ?? 0));
        $review = WorkforcePerformanceReview::query()->create([
            'company_id' => $data['company_id'],
            'employee_profile_id' => $data['employee']->id,
            'reviewer_id' => $this->user($request)->id,
            'review_number' => $this->nextNumber('REV', WorkforcePerformanceReview::class, 'review_number', $data['company_id']),
            'overall_score' => round((float) $scores->avg(), 2),
            'status' => 'completed',
            ...collect($data['validated'])->except(['employee_profile_id'])->all(),
        ]);

        return response()->json(['performance_review' => $review->load(['employeeProfile.user', 'reviewer'])], 201);
    }

    public function storeTrainingCourse(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:120'],
            'provider' => ['nullable', 'string', 'max:120'],
            'duration_hours' => ['nullable', 'numeric', 'min:0'],
        ]);

        $course = WorkforceTrainingCourse::query()->create([
            'company_id' => $companyId,
            'course_code' => $this->nextCompanyCode($this->codePrefix($data['category'] ?? $data['title'], 'TRN'), WorkforceTrainingCourse::class, 'course_code', $companyId),
            'category' => $data['category'] ?? 'safety',
            'duration_hours' => $data['duration_hours'] ?? 0,
            'status' => 'active',
            ...collect($data)->except(['category', 'duration_hours'])->all(),
        ]);

        return response()->json(['training_course' => $course], 201);
    }

    public function storeTrainingRecord(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'employee_profile_id' => ['required', 'integer'],
            'training_course_id' => ['required', 'integer'],
            'status' => ['nullable', Rule::in(['scheduled', 'completed', 'failed', 'cancelled'])],
            'scheduled_on' => ['nullable', 'date'],
            'completed_on' => ['nullable', 'date'],
            'score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'certificate_number' => ['nullable', 'string', 'max:120'],
        ]);

        $employee = $this->employee($companyId, $data['employee_profile_id']);
        $course = WorkforceTrainingCourse::query()->forCompany($companyId)->whereKey($data['training_course_id'])->firstOrFail();
        $record = WorkforceTrainingRecord::query()->create([
            'company_id' => $companyId,
            'employee_profile_id' => $employee->id,
            'training_course_id' => $course->id,
            'status' => $data['status'] ?? 'scheduled',
            'score' => $data['score'] ?? 0,
            ...collect($data)->except(['employee_profile_id', 'training_course_id', 'status', 'score'])->all(),
        ]);

        return response()->json(['training_record' => $record->load(['employeeProfile.user', 'course'])], 201);
    }

    public function storeCertification(Request $request): JsonResponse
    {
        $data = $this->employeeRecordPayload($request, [
            'name' => ['required', 'string', 'max:255'],
            'issuing_authority' => ['nullable', 'string', 'max:120'],
            'issued_on' => ['nullable', 'date'],
            'expires_on' => ['nullable', 'date'],
            'document_path' => ['nullable', 'string', 'max:255'],
        ]);

        $cert = WorkforceCertification::query()->create([
            'company_id' => $data['company_id'],
            'employee_profile_id' => $data['employee']->id,
            'certification_number' => $this->nextNumber('CERT', WorkforceCertification::class, 'certification_number', $data['company_id']),
            'status' => ! empty($data['validated']['expires_on']) && Carbon::parse($data['validated']['expires_on'])->lt(now()) ? 'expired' : 'valid',
            ...collect($data['validated'])->except(['employee_profile_id'])->all(),
        ]);

        return response()->json(['certification' => $cert->load('employeeProfile.user')], 201);
    }

    public function storePpeIssue(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'employee_profile_id' => ['required', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'item_name' => ['required', 'string', 'max:255'],
            'size' => ['nullable', 'string', 'max:40'],
            'quantity' => ['nullable', 'numeric', 'min:0.01'],
            'issued_on' => ['nullable', 'date'],
            'replacement_due_on' => ['nullable', 'date'],
            'condition' => ['nullable', 'string', 'max:80'],
        ]);

        $employee = $this->employee($companyId, $data['employee_profile_id']);
        if (! empty($data['project_id'])) {
            Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
        }

        $ppe = WorkforcePpeIssue::query()->create([
            'company_id' => $companyId,
            'employee_profile_id' => $employee->id,
            'ppe_number' => $this->nextNumber('PPE', WorkforcePpeIssue::class, 'ppe_number', $companyId),
            'quantity' => $data['quantity'] ?? 1,
            'issued_on' => $data['issued_on'] ?? now()->toDateString(),
            'condition' => $data['condition'] ?? 'new',
            'status' => 'issued',
            ...collect($data)->except(['employee_profile_id', 'quantity', 'issued_on', 'condition'])->all(),
        ]);

        return response()->json(['ppe_issue' => $ppe->load(['employeeProfile.user', 'project'])], 201);
    }

    public function storeContractor(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'supplier_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:80'],
            'trade' => ['nullable', 'string', 'max:120'],
            'worker_count' => ['nullable', 'integer', 'min:0'],
            'contract_expires_on' => ['nullable', 'date'],
            'insurance_expires_on' => ['nullable', 'date'],
        ]);

        if (! empty($data['supplier_id'])) {
            Supplier::query()->forCompany($companyId)->whereKey($data['supplier_id'])->firstOrFail();
        }

        $contractor = WorkforceContractor::query()->create([
            'company_id' => $companyId,
            'contractor_number' => $this->nextNumber('CTR', WorkforceContractor::class, 'contractor_number', $companyId),
            'worker_count' => $data['worker_count'] ?? 0,
            'compliance_status' => $this->contractorComplianceStatus($data),
            'status' => 'active',
            ...collect($data)->except(['worker_count'])->all(),
        ]);

        return response()->json(['contractor' => $contractor->load('supplier')], 201);
    }

    public function storeWorkforceAsset(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'employee_profile_id' => ['required', 'integer'],
            'equipment_asset_id' => ['nullable', 'integer'],
            'item_name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:80'],
            'serial_number' => ['nullable', 'string', 'max:120'],
            'assigned_on' => ['nullable', 'date'],
            'return_due_on' => ['nullable', 'date'],
        ]);

        $employee = $this->employee($companyId, $data['employee_profile_id']);
        if (! empty($data['equipment_asset_id'])) {
            EquipmentAsset::query()->forCompany($companyId)->whereKey($data['equipment_asset_id'])->firstOrFail();
        }

        $asset = WorkforceAsset::query()->create([
            'company_id' => $companyId,
            'employee_profile_id' => $employee->id,
            'asset_number' => $this->nextNumber('WAS', WorkforceAsset::class, 'asset_number', $companyId),
            'category' => $data['category'] ?? 'tool',
            'assigned_on' => $data['assigned_on'] ?? now()->toDateString(),
            'status' => 'assigned',
            ...collect($data)->except(['employee_profile_id', 'category', 'assigned_on'])->all(),
        ]);

        return response()->json(['employee_asset' => $asset->load(['employeeProfile.user', 'equipmentAsset'])], 201);
    }

    public function storeWorkforceDocument(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $data = $request->validate([
            'employee_profile_id' => ['nullable', 'integer'],
            'candidate_id' => ['nullable', 'integer'],
            'document_type' => ['required', 'string', 'max:120'],
            'title' => ['required', 'string', 'max:255'],
            'file_path' => ['nullable', 'string', 'max:255'],
            'expiry_date' => ['nullable', 'date'],
        ]);

        if (! empty($data['employee_profile_id'])) {
            $this->employee($companyId, $data['employee_profile_id']);
        }
        if (! empty($data['candidate_id'])) {
            WorkforceCandidate::query()->forCompany($companyId)->whereKey($data['candidate_id'])->firstOrFail();
        }

        $document = WorkforceDocument::query()->create([
            'company_id' => $companyId,
            'document_number' => $this->nextNumber('HRD', WorkforceDocument::class, 'document_number', $companyId),
            'status' => 'active',
            ...$data,
        ]);

        return response()->json(['document' => $document->load(['employeeProfile.user', 'candidate'])], 201);
    }

    public function storeExitRecord(Request $request): JsonResponse
    {
        $data = $this->employeeRecordPayload($request, [
            'exit_type' => ['nullable', Rule::in(['resignation', 'termination', 'retirement'])],
            'notice_date' => ['nullable', 'date'],
            'exit_date' => ['nullable', 'date'],
            'reason' => ['nullable', 'string', 'max:3000'],
        ]);

        $clearance = [
            ['label' => 'Return Laptop', 'completed' => false],
            ['label' => 'Return Vehicle', 'completed' => false],
            ['label' => 'Return PPE', 'completed' => false],
            ['label' => 'Deactivate Login', 'completed' => false],
            ['label' => 'Final Payroll', 'completed' => false],
            ['label' => 'Exit Interview', 'completed' => false],
        ];

        $exit = WorkforceExitRecord::query()->create([
            'company_id' => $data['company_id'],
            'employee_profile_id' => $data['employee']->id,
            'exit_number' => $this->nextNumber('EXT', WorkforceExitRecord::class, 'exit_number', $data['company_id']),
            'exit_type' => $data['validated']['exit_type'] ?? 'resignation',
            'clearance_items' => $clearance,
            'clearance_status' => 'pending',
            'status' => 'open',
            ...collect($data['validated'])->except(['employee_profile_id', 'exit_type'])->all(),
        ]);

        $data['employee']->update(['status' => 'exiting']);

        return response()->json(['exit_record' => $exit->load('employeeProfile.user')], 201);
    }

    private function summary(int $companyId, EloquentCollection $employees, EloquentCollection $attendance, EloquentCollection $timesheets, EloquentCollection $certifications, EloquentCollection $contractors, EloquentCollection $vacancies): array
    {
        $attendanceSummary = $this->attendanceSummary($employees, $attendance);
        $approvedTimesheets = $timesheets->where('status', 'approved');
        $payrollLiability = (float) PayrollRun::query()->forCompany($companyId)->whereIn('status', ['draft', 'approved'])->sum('net_pay');

        return [
            'active_employees' => $employees->where('status', 'active')->count(),
            'total_workforce' => $employees->where('status', 'active')->count() + (int) $contractors->sum('worker_count'),
            'open_vacancies' => $vacancies->where('status', 'open')->count(),
            'pending_leave' => LeaveRequest::query()->forCompany($companyId)->where('status', 'pending')->count(),
            'draft_payroll' => PayrollRun::query()->forCompany($companyId)->where('status', 'draft')->count(),
            'payroll_liability' => $payrollLiability,
            'attendance_rate' => $attendanceSummary['attendance_rate'],
            'present_today' => $attendanceSummary['present_today'],
            'absent_today' => $attendanceSummary['absent_today'],
            'overtime_hours' => (float) $timesheets->sum('overtime_hours'),
            'overtime_cost' => (float) $approvedTimesheets->sum(fn (WorkforceTimesheet $sheet): float => (float) $sheet->overtime_hours * (float) $sheet->cost_rate * 1.5),
            'training_compliance' => $this->trainingCompliance($companyId),
            'expiring_certifications' => $certifications->filter(fn (WorkforceCertification $cert): bool => $cert->expires_on && $cert->expires_on->between(now()->startOfDay(), now()->addDays(60)->endOfDay()))->count(),
        ];
    }

    private function attendanceSummary(EloquentCollection $employees, EloquentCollection $attendance): array
    {
        $todayUserIds = $attendance
            ->filter(fn (AttendanceRecord $record): bool => $record->clock_in_at?->isToday())
            ->pluck('user_id')
            ->unique();
        $active = max(1, $employees->where('status', 'active')->count());
        $present = $todayUserIds->count();

        return [
            'present_today' => $present,
            'absent_today' => max(0, $employees->where('status', 'active')->count() - $present),
            'late_today' => $attendance->filter(fn (AttendanceRecord $record): bool => $record->clock_in_at?->isToday() && $record->status === 'late')->count(),
            'attendance_rate' => round(($present / $active) * 100, 2),
        ];
    }

    private function reports(EloquentCollection $employees, EloquentCollection $timesheets, EloquentCollection $allocations, EloquentCollection $trainingRecords, EloquentCollection $certifications, EloquentCollection $exitRecords): array
    {
        return [
            'headcount_by_department' => $employees->groupBy('department')->map(fn (Collection $items, string $department): array => ['department' => $department, 'employees' => $items->count()])->values(),
            'employees_by_project' => $allocations->where('status', 'active')->groupBy('project_id')->map(fn (Collection $items): array => ['project' => $items->first()?->project?->name ?? 'Unassigned', 'employees' => $items->count()])->values(),
            'timesheet_costs' => $timesheets->groupBy('project_id')->map(fn (Collection $items): array => ['project' => $items->first()?->project?->name ?? 'Unassigned', 'hours' => (float) $items->sum('hours_worked'), 'overtime' => (float) $items->sum('overtime_hours'), 'cost' => (float) $items->sum('cost_amount')])->values(),
            'training_matrix' => $trainingRecords->map(fn (WorkforceTrainingRecord $record): array => ['employee' => $record->employeeProfile?->user?->name, 'course' => $record->course?->title, 'status' => $record->status, 'completed_on' => $record->completed_on]),
            'certification_expiry' => $certifications->map(fn (WorkforceCertification $cert): array => ['employee' => $cert->employeeProfile?->user?->name, 'certification' => $cert->name, 'expires_on' => $cert->expires_on, 'status' => $cert->status]),
            'turnover' => $exitRecords->groupBy(fn (WorkforceExitRecord $exit): string => $exit->exit_date?->format('Y-m') ?? 'unscheduled')->map(fn (Collection $items, string $period): array => ['period' => $period, 'exits' => $items->count()])->values(),
        ];
    }

    private function analytics(EloquentCollection $employees, EloquentCollection $timesheets, EloquentCollection $allocations, EloquentCollection $applications, EloquentCollection $certifications, EloquentCollection $trainingRecords, EloquentCollection $exitRecords): array
    {
        return [
            'average_salary' => round((float) $employees->avg('base_salary'), 2),
            'payroll_cost' => (float) $employees->sum('base_salary'),
            'overtime_cost' => (float) $timesheets->sum(fn (WorkforceTimesheet $sheet): float => (float) $sheet->overtime_hours * (float) $sheet->cost_rate * 1.5),
            'headcount_by_department' => $employees->groupBy('department')->map(fn (Collection $items, string $department): array => ['name' => $department, 'value' => $items->count()])->values(),
            'employees_by_project' => $allocations->where('status', 'active')->groupBy('project_id')->map(fn (Collection $items): array => ['name' => $items->first()?->project?->name ?? 'Unassigned', 'value' => $items->count()])->values(),
            'gender_distribution' => $employees->groupBy(fn (EmployeeProfile $employee): string => $employee->gender ?: 'unspecified')->map(fn (Collection $items, string $gender): array => ['name' => $gender, 'value' => $items->count()])->values(),
            'age_distribution' => $this->ageDistribution($employees),
            'hiring_trends' => $applications->groupBy(fn (WorkforceApplication $app): string => $app->applied_on?->format('Y-m') ?? 'undated')->map(fn (Collection $items, string $period): array => ['period' => $period, 'applications' => $items->count(), 'hires' => $items->where('status', 'hired')->count()])->values(),
            'termination_trends' => $exitRecords->groupBy(fn (WorkforceExitRecord $exit): string => $exit->exit_date?->format('Y-m') ?? 'unscheduled')->map(fn (Collection $items, string $period): array => ['period' => $period, 'exits' => $items->count()])->values(),
            'training_compliance' => $trainingRecords->count() > 0 ? round(($trainingRecords->where('status', 'completed')->count() / $trainingRecords->count()) * 100, 2) : 0,
            'expiring_certifications' => $certifications->filter(fn (WorkforceCertification $cert): bool => $cert->expires_on && $cert->expires_on->lte(now()->addDays(60)))->count(),
        ];
    }

    private function selfService(Request $request): array
    {
        $employee = EmployeeProfile::query()->forCompany($this->companyId($request))->where('user_id', $this->user($request)->id)->first();

        if (! $employee) {
            return ['employee' => null, 'payslips' => [], 'leave_requests' => [], 'attendance' => [], 'training' => [], 'documents' => []];
        }

        return [
            'employee' => $employee->load(['user', 'branch', 'currentProject']),
            'payslips' => Payslip::query()->where('employee_profile_id', $employee->id)->latest()->limit(24)->get(),
            'leave_requests' => LeaveRequest::query()->where('employee_profile_id', $employee->id)->latest()->limit(24)->get(),
            'attendance' => AttendanceRecord::query()->where('user_id', $employee->user_id)->latest('clock_in_at')->limit(30)->get(),
            'training' => WorkforceTrainingRecord::query()->where('employee_profile_id', $employee->id)->with('course')->latest()->limit(30)->get(),
            'documents' => WorkforceDocument::query()->where('employee_profile_id', $employee->id)->latest()->limit(30)->get(),
        ];
    }

    private function managerPortal(int $companyId): array
    {
        return [
            'leave_approvals' => LeaveRequest::query()->forCompany($companyId)->where('status', 'pending')->with('employeeProfile.user:id,name,email')->latest()->limit(60)->get(),
            'overtime_approvals' => WorkforceOvertimeRequest::query()->forCompany($companyId)->where('status', 'pending')->with('employeeProfile.user:id,name,email')->latest()->limit(60)->get(),
            'timesheet_approvals' => WorkforceTimesheet::query()->forCompany($companyId)->where('status', 'submitted')->with(['employeeProfile.user:id,name,email', 'project:id,name'])->latest()->limit(60)->get(),
            'performance_due' => EmployeeProfile::query()->forCompany($companyId)->where('status', 'active')->with('user:id,name,email')->limit(40)->get(),
        ];
    }

    private function ageDistribution(EloquentCollection $employees): Collection
    {
        return $employees
            ->filter(fn (EmployeeProfile $employee): bool => filled($employee->date_of_birth))
            ->groupBy(function (EmployeeProfile $employee): string {
                $age = $employee->date_of_birth->age;

                return match (true) {
                    $age < 25 => 'Under 25',
                    $age < 35 => '25-34',
                    $age < 45 => '35-44',
                    $age < 55 => '45-54',
                    default => '55+',
                };
            })
            ->map(fn (Collection $items, string $range): array => ['name' => $range, 'value' => $items->count()])
            ->values();
    }

    private function trainingCompliance(int $companyId): float
    {
        $total = WorkforceTrainingRecord::query()->forCompany($companyId)->count();

        if ($total === 0) {
            return 0;
        }

        return round((WorkforceTrainingRecord::query()->forCompany($companyId)->where('status', 'completed')->count() / $total) * 100, 2);
    }

    private function employeeRecordPayload(Request $request, array $rules): array
    {
        $companyId = $this->companyId($request);
        $data = $request->validate(['employee_profile_id' => ['required', 'integer'], ...$rules]);

        return [
            'company_id' => $companyId,
            'employee' => $this->employee($companyId, $data['employee_profile_id']),
            'validated' => $data,
        ];
    }

    private function validateBranchProject(int $companyId, array $data): void
    {
        if (! empty($data['branch_id'])) {
            Branch::query()->forCompany($companyId)->whereKey($data['branch_id'])->firstOrFail();
        }

        if (! empty($data['project_id'])) {
            Project::query()->forCompany($companyId)->whereKey($data['project_id'])->firstOrFail();
        }
    }

    private function employee(int $companyId, int|string $employeeId): EmployeeProfile
    {
        return EmployeeProfile::query()->forCompany($companyId)->whereKey($employeeId)->firstOrFail();
    }

    private function csv(?string $value): array
    {
        if (blank($value)) {
            return [];
        }

        return collect(explode(',', $value))->map(fn (string $item): string => trim($item))->filter()->values()->all();
    }

    private function defaultOnboardingItems(): array
    {
        return collect([
            'Employment Contract',
            'National ID',
            'Tax Number',
            'SSNIT Number',
            'Bank Details',
            'Emergency Contact',
            'Laptop Assigned',
            'PPE Issued',
            'Orientation Completed',
        ])->map(fn (string $label): array => ['label' => $label, 'completed' => false])->all();
    }

    private function contractorComplianceStatus(array $data): string
    {
        $contractOk = empty($data['contract_expires_on']) || Carbon::parse($data['contract_expires_on'])->gte(now());
        $insuranceOk = empty($data['insurance_expires_on']) || Carbon::parse($data['insurance_expires_on'])->gte(now());

        return $contractOk && $insuranceOk ? 'compliant' : 'expired';
    }

    private function syncPayrollTotals(PayrollRun $run): void
    {
        $payslips = $run->payslips()->get();

        $run->forceFill([
            'gross_pay' => $payslips->sum(fn (Payslip $payslip) => (float) $payslip->gross_pay + (float) $payslip->overtime_pay + (float) $payslip->allowances),
            'total_deductions' => $payslips->sum(fn (Payslip $payslip) => (float) $payslip->deductions + (float) $payslip->tax_amount),
            'net_pay' => $payslips->sum(fn (Payslip $payslip) => (float) $payslip->net_pay),
        ])->save();
    }

    private function assertTenant(Request $request, object $model): void
    {
        abort_if((int) $model->company_id !== $this->companyId($request), 404);
    }
}
