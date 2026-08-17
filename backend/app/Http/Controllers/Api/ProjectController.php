<?php

namespace App\Http\Controllers\Api;

use App\Models\Branch;
use App\Models\Client;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProjectController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $projects = Project::query()
            ->forCompany($companyId)
            ->with(['branch', 'client'])
            ->withCount([
                'tasks',
                'budgetLines',
                'purchaseRequisitions',
                'purchaseOrders',
                'procurementRfqs',
                'goodsReceipts',
                'supplierInvoices',
                'documents',
                'drawings',
                'fieldDailyReports',
                'fieldIssues',
                'nonConformanceReports',
                'clientApprovals',
                'consultantSubmittals',
                'portalWorkItems',
            ])
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('branch_id'), fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($request->query('client_id'), fn ($query, $clientId) => $query->where('client_id', $clientId))
            ->when($request->query('health_status'), fn ($query, $health) => $query->where('health_status', $health))
            ->latest()
            ->paginate((int) $request->query('per_page', 25));

        $archived = Project::onlyTrashed()
            ->forCompany($companyId)
            ->with(['branch', 'client'])
            ->latest('deleted_at')
            ->get();

        return response()->json([
            ...$projects->toArray(),
            'archived' => $archived,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'client_id' => ['nullable', 'integer'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:40', Rule::unique('projects')->where('company_id', $companyId)],
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:4000'],
            'status' => ['nullable', Rule::in($this->projectStatuses())],
            'health_status' => ['nullable', Rule::in(['on_track', 'at_risk', 'critical'])],
            'risk_level' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
            'site_address' => ['nullable', 'string', 'max:2000'],
            'country' => ['nullable', 'string', 'size:2'],
            'currency' => ['nullable', 'string', 'size:3'],
            'contract_value' => ['nullable', 'numeric', 'min:0'],
            'progress_percent' => ['nullable', 'integer', 'between:0,100'],
            'start_date' => ['nullable', 'date'],
            'target_end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'future_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:102400'],
            ...$this->projectMetadataRules(),
        ]);

        $branch = Branch::query()
            ->forCompany($companyId)
            ->when($data['branch_id'] ?? null, fn ($query, $branchId) => $query->whereKey($branchId))
            ->first();

        if (! $branch) {
            $branch = Branch::query()->forCompany($companyId)->first()
                ?? Branch::query()->create([
                    'company_id' => $companyId,
                    'name' => 'Head Office',
                    'code' => $this->nextCompanyCode('HQ', Branch::class, 'code', $companyId),
                    'country' => strtoupper($data['country'] ?? $this->user($request)->company->country ?? 'GH'),
                ]);
        }
        $clientId = $data['client_id'] ?? null;

        if ($clientId) {
            Client::query()->forCompany($companyId)->whereKey($clientId)->firstOrFail();
        } elseif (! empty($data['client_name'])) {
            $client = Client::query()->create([
                'company_id' => $companyId,
                'branch_id' => $branch->id,
                'name' => $data['client_name'],
                'currency' => strtoupper($data['currency'] ?? $this->user($request)->company->default_currency),
            ]);
            $clientId = $client->id;
        }

        $projectCode = $this->suppliedCode($data['code'] ?? null) ?? $this->nextNumber('PRJ', Project::class, 'code', $companyId);
        $project = Project::query()->create([
            'company_id' => $companyId,
            'branch_id' => $branch->id,
            'client_id' => $clientId,
            'code' => $projectCode,
            'name' => filled($data['name'] ?? null) ? $data['name'] : "New Project {$projectCode}",
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'planning',
            'health_status' => $data['health_status'] ?? 'on_track',
            'risk_level' => $data['risk_level'] ?? 'medium',
            'site_address' => $data['site_address'] ?? null,
            'country' => strtoupper($data['country'] ?? $branch->country),
            'currency' => strtoupper($data['currency'] ?? $this->user($request)->company->default_currency),
            'contract_value' => $data['contract_value'] ?? 0,
            'progress_percent' => $data['progress_percent'] ?? 0,
            'start_date' => $data['start_date'] ?? null,
            'target_end_date' => $data['target_end_date'] ?? null,
            'metadata' => $this->projectMetadataFrom($data),
            'created_by' => $this->user($request)->id,
            'updated_by' => $this->user($request)->id,
        ]);

        if ($request->hasFile('future_image')) {
            $project->forceFill([
                'future_image_path' => $this->storeFutureImage($request, $project),
            ])->save();
        }

        $this->publishAutomationEvent($request, 'project_created', [
            'record_type' => 'project',
            'record_id' => $project->id,
        ]);

        return response()->json(['project' => $project->load(['branch', 'client'])], 201);
    }

    public function uploadFutureImage(Request $request, Project $project): JsonResponse
    {
        $project = $this->projectForTenant($request, $project->id);
        $request->validate([
            'future_image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:102400'],
        ]);

        if ($project->future_image_path) {
            Storage::disk('public')->delete($project->future_image_path);
        }

        $project->forceFill([
            'future_image_path' => $this->storeFutureImage($request, $project),
            'updated_by' => $this->user($request)->id,
        ])->save();

        return response()->json(['project' => $project->fresh()->load(['branch', 'client'])]);
    }

    public function show(Request $request, Project $project): JsonResponse
    {
        $project = Project::query()
            ->forCompany($this->companyId($request))
            ->whereKey($project->id)
            ->with([
                'branch',
                'client',
                'tasks.assignee',
                'budgetLines',
                'purchaseRequisitions.lines',
                'purchaseOrders.supplier',
                'purchaseOrders.lines',
                'procurementRfqs.suppliers',
                'goodsReceipts.supplier',
                'goodsReceipts.lines',
                'supplierInvoices.supplier',
                'supplierContracts.supplier',
                'documents',
                'drawings.revisions',
                'fieldDailyReports.issues',
                'fieldIssues',
                'inspections.items',
                'nonConformanceReports',
                'safetyIncidents',
                'safetyObservations',
                'toolboxTalks',
                'workPermits',
                'clientApprovals',
                'consultantSubmittals',
                'portalWorkItems',
                'invoices.payments',
                'expenses.supplier',
                'equipmentAssignments.asset',
                'equipmentAssets',
                'fuelLogs.asset',
                'workforceAllocations.employeeProfile.user',
                'attendanceRecords.user',
                'workforceTimesheets.employeeProfile.user',
            ])
            ->firstOrFail();

        return response()->json(['project' => $project]);
    }

    public function update(Request $request, Project $project): JsonResponse
    {
        $project = $this->projectForTenant($request, $project->id);

        $data = $request->validate([
            'client_id' => ['nullable', 'integer'],
            'code' => ['sometimes', 'string', 'max:40', Rule::unique('projects')->where('company_id', $this->companyId($request))->ignore($project->id)],
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:4000'],
            'status' => ['sometimes', Rule::in($this->projectStatuses())],
            'health_status' => ['sometimes', Rule::in(['on_track', 'at_risk', 'critical'])],
            'risk_level' => ['sometimes', Rule::in(['low', 'medium', 'high', 'critical'])],
            'site_address' => ['nullable', 'string', 'max:2000'],
            'country' => ['sometimes', 'string', 'size:2'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'contract_value' => ['sometimes', 'numeric', 'min:0'],
            'progress_percent' => ['sometimes', 'integer', 'between:0,100'],
            'start_date' => ['nullable', 'date'],
            'target_end_date' => ['nullable', 'date'],
            'actual_end_date' => ['nullable', 'date'],
            'future_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:102400'],
            ...$this->projectMetadataRules(true),
        ]);

        if (isset($data['client_id'])) {
            Client::query()->forCompany($this->companyId($request))->whereKey($data['client_id'])->firstOrFail();
        }

        $metadata = array_replace_recursive($project->metadata ?? [], $this->projectMetadataFrom($data));
        $projectFields = collect($data)->except([...$this->projectMetadataFields(), 'future_image'])->all();

        $project->update([
            ...$projectFields,
            'code' => isset($data['code']) ? $this->suppliedCode($data['code']) : $project->code,
            'country' => isset($data['country']) ? strtoupper($data['country']) : $project->country,
            'currency' => isset($data['currency']) ? strtoupper($data['currency']) : $project->currency,
            'metadata' => $metadata,
            'updated_by' => $this->user($request)->id,
        ]);

        if ($request->hasFile('future_image')) {
            if ($project->future_image_path) {
                Storage::disk('public')->delete($project->future_image_path);
            }

            $project->forceFill([
                'future_image_path' => $this->storeFutureImage($request, $project),
            ])->save();
        }

        if (in_array($project->fresh()->health_status, ['at_risk', 'critical'], true) || in_array($data['risk_level'] ?? null, ['high', 'critical'], true)) {
            $this->publishAutomationEvent($request, 'project_delayed', [
                'record_type' => 'project',
                'record_id' => $project->id,
            ]);
        }

        if ((float) $project->fresh()->forecast_to_complete > (float) $project->fresh()->budget_total && (float) $project->fresh()->budget_total > 0) {
            $this->publishAutomationEvent($request, 'budget_exceeded', [
                'record_type' => 'project',
                'record_id' => $project->id,
            ]);
        }

        return response()->json(['project' => $project->fresh(['branch', 'client'])]);
    }

    public function destroy(Request $request, Project $project): JsonResponse
    {
        $project = $this->projectForTenant($request, $project->id);
        $project->delete();

        return response()->json(['message' => 'Project archived.']);
    }

    public function restore(Request $request, int $project): JsonResponse
    {
        $project = Project::onlyTrashed()
            ->forCompany($this->companyId($request))
            ->whereKey($project)
            ->firstOrFail();

        $project->restore();
        $project->forceFill(['updated_by' => $this->user($request)->id])->save();

        return response()->json([
            'message' => 'Project reinstated.',
            'project' => $project->fresh(['branch', 'client']),
        ]);
    }

    public function forceDestroy(Request $request, int $project): JsonResponse
    {
        $project = Project::onlyTrashed()
            ->forCompany($this->companyId($request))
            ->whereKey($project)
            ->firstOrFail();

        $futureImagePath = $project->future_image_path;
        $project->forceDelete();

        if ($futureImagePath) {
            Storage::disk('public')->delete($futureImagePath);
        }

        return response()->json(['message' => 'Project permanently deleted.']);
    }

    public function timeline(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $items = Project::query()
            ->forCompany($companyId)
            ->with('tasks:id,project_id,title,status,start_date,due_date,progress_percent')
            ->whereIn('status', ['planning', 'active', 'on_hold'])
            ->orderBy('target_end_date')
            ->get(['id', 'code', 'name', 'status', 'start_date', 'target_end_date', 'progress_percent']);

        return response()->json(['timeline' => $items]);
    }

    private function projectStatuses(): array
    {
        return [
            'planning',
            'active',
            'on_hold',
            'practical_completion',
            'defects_liability',
            'final_completion',
            'completed',
            'closed',
            'cancelled',
        ];
    }

    private function projectMetadataRules(bool $partial = false): array
    {
        $stringRule = [$partial ? 'sometimes' : 'nullable', 'nullable', 'string', 'max:255'];
        $textRule = [$partial ? 'sometimes' : 'nullable', 'nullable', 'string', 'max:4000'];
        $moneyRule = [$partial ? 'sometimes' : 'nullable', 'nullable', 'numeric', 'min:0'];
        $dateRule = [$partial ? 'sometimes' : 'nullable', 'nullable', 'date'];

        return [
            'project_type' => $stringRule,
            'sector' => $stringRule,
            'contract_type' => $stringRule,
            'priority' => [$partial ? 'sometimes' : 'nullable', 'nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'region' => $stringRule,
            'city' => $stringRule,
            'gps_coordinates' => $stringRule,
            'site_map_url' => ['nullable', 'url', 'max:2048'],
            'planned_start_date' => $dateRule,
            'actual_start_date' => $dateRule,
            'contract_completion_date' => $dateRule,
            'defects_liability_end_date' => $dateRule,
            'approved_variations' => $moneyRule,
            'revised_contract_value' => $moneyRule,
            'retention_percent' => [$partial ? 'sometimes' : 'nullable', 'nullable', 'numeric', 'between:0,100'],
            'advance_payment' => $moneyRule,
            'payment_terms' => $textRule,
            'tax_configuration' => $textRule,
            'funding_source' => $stringRule,
            'project_director' => $stringRule,
            'project_manager' => $stringRule,
            'site_manager' => $stringRule,
            'quantity_surveyor' => $stringRule,
            'project_engineer' => $stringRule,
            'hse_manager' => $stringRule,
            'qa_qc_manager' => $stringRule,
            'planner' => $stringRule,
            'commercial_manager' => $stringRule,
            'cost_code_structure' => $stringRule,
            'wbs_template' => $stringRule,
            'budget_template' => $stringRule,
            'approval_workflow' => $stringRule,
            'working_calendar' => $stringRule,
            'default_warehouse' => $stringRule,
            'default_document_folders' => $textRule,
            'linked_crm_opportunity' => $stringRule,
            'linked_tender' => $stringRule,
            'linked_estimate' => $stringRule,
            'linked_contract' => $stringRule,
        ];
    }

    private function projectMetadataFrom(array $data): array
    {
        return collect($this->projectMetadataFields())
            ->filter(fn (string $field): bool => array_key_exists($field, $data))
            ->mapWithKeys(fn (string $field): array => [$field => $data[$field]])
            ->all();
    }

    private function projectMetadataFields(): array
    {
        return [
            'project_type',
            'sector',
            'contract_type',
            'priority',
            'region',
            'city',
            'gps_coordinates',
            'site_map_url',
            'planned_start_date',
            'actual_start_date',
            'contract_completion_date',
            'defects_liability_end_date',
            'approved_variations',
            'revised_contract_value',
            'retention_percent',
            'advance_payment',
            'payment_terms',
            'tax_configuration',
            'funding_source',
            'project_director',
            'project_manager',
            'site_manager',
            'quantity_surveyor',
            'project_engineer',
            'hse_manager',
            'qa_qc_manager',
            'planner',
            'commercial_manager',
            'cost_code_structure',
            'wbs_template',
            'budget_template',
            'approval_workflow',
            'working_calendar',
            'default_warehouse',
            'default_document_folders',
            'linked_crm_opportunity',
            'linked_tender',
            'linked_estimate',
            'linked_contract',
        ];
    }

    private function storeFutureImage(Request $request, Project $project): string
    {
        return $request
            ->file('future_image')
            ->store("navkwabuild/companies/{$project->company_id}/projects/{$project->id}/future-image", 'public');
    }
}
