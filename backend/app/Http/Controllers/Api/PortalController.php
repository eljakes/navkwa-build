<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use App\Models\ClientApproval;
use App\Models\ConsultantSubmittal;
use App\Models\Document;
use App\Models\Drawing;
use App\Models\FieldDailyReport;
use App\Models\Inspection;
use App\Models\Invoice;
use App\Models\PortalAccess;
use App\Models\PortalMessage;
use App\Models\PortalPaymentSubmission;
use App\Models\PortalUser;
use App\Models\PortalWorkItem;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierInvoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PortalController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        $workItems = PortalWorkItem::query()
            ->forCompany($companyId)
            ->with($this->workItemRelations())
            ->latest()
            ->limit(200)
            ->get();

        return response()->json([
            'portal_users' => PortalUser::query()->forCompany($companyId)->with(['client:id,name', 'supplier:id,name', 'accesses.project:id,code,name', 'workItems:id,portal_user_id,portal_type,item_type,status'])->orderBy('name')->get(),
            'accesses' => PortalAccess::query()->forCompany($companyId)->with(['portalUser:id,name,email,user_type', 'project:id,code,name'])->latest()->get(),
            'client_approvals' => ClientApproval::query()->forCompany($companyId)->with(['portalUser:id,name,email', 'project:id,code,name', 'drawing:id,drawing_number,title', 'document:id,document_number,title'])->latest()->limit(100)->get(),
            'consultant_submittals' => ConsultantSubmittal::query()->forCompany($companyId)->with(['portalUser:id,name,email', 'project:id,code,name', 'drawing:id,drawing_number,title', 'document:id,document_number,title'])->latest()->limit(100)->get(),
            'work_items' => $workItems,
            'portal_types' => $this->portalTypes($companyId, $workItems),
            'project_snapshots' => Project::query()->forCompany($companyId)->withCount(['documents', 'drawings', 'fieldDailyReports', 'purchaseOrders'])->latest()->limit(60)->get(['id', 'code', 'name', 'status', 'health_status', 'risk_level', 'progress_percent', 'contract_value', 'budget_total', 'actual_cost', 'target_end_date']),
            'supplier_purchase_orders' => PurchaseOrder::query()->forCompany($companyId)->with(['supplier:id,name', 'project:id,code,name'])->latest()->limit(80)->get(),
            'supplier_invoices' => SupplierInvoice::query()->forCompany($companyId)->with(['supplier:id,name', 'project:id,code,name', 'purchaseOrder:id,po_number'])->latest()->limit(80)->get(),
            'client_invoices' => Invoice::query()->forCompany($companyId)->with(['client:id,name', 'project:id,code,name'])->latest()->limit(80)->get(),
            'inspections' => Inspection::query()->forCompany($companyId)->with(['project:id,code,name'])->latest()->limit(80)->get(),
            'daily_reports' => FieldDailyReport::query()->forCompany($companyId)->with(['project:id,code,name'])->latest('report_date')->limit(80)->get(),
            'activity' => $this->portalActivity($workItems),
            'messages' => PortalMessage::query()->forCompany($companyId)->with(['portalUser:id,name,email', 'project:id,name'])->latest()->limit(100)->get(),
            'payment_submissions' => PortalPaymentSubmission::query()->forCompany($companyId)->with(['portalUser:id,name,email', 'project:id,name', 'invoice:id,invoice_number'])->latest()->limit(100)->get(),
            'summary' => [
                'active_users' => PortalUser::query()->forCompany($companyId)->where('status', 'active')->count(),
                'pending_client_approvals' => ClientApproval::query()->forCompany($companyId)->where('status', 'submitted')->count(),
                'consultant_reviews' => ConsultantSubmittal::query()->forCompany($companyId)->whereIn('status', ['submitted', 'in_review'])->count(),
                'project_accesses' => PortalAccess::query()->forCompany($companyId)->count(),
                'open_work_items' => $workItems->whereNotIn('status', ['approved', 'rejected', 'closed', 'completed', 'paid', 'signed_off'])->count(),
                'overdue_items' => $workItems->filter(fn (PortalWorkItem $item): bool => $item->due_date && $item->due_date->isPast() && ! in_array($item->status, ['approved', 'closed', 'completed', 'paid', 'signed_off'], true))->count(),
                'supplier_invoices' => SupplierInvoice::query()->forCompany($companyId)->whereNotIn('status', ['paid', 'rejected'])->count(),
                'inspection_signoffs' => $workItems->where('item_type', 'inspection_signoff')->whereIn('status', ['submitted', 'in_review'])->count(),
            ],
        ]);
    }

    public function storePortalUser(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'client_id' => ['nullable', 'integer'],
            'supplier_id' => ['nullable', 'integer'],
            'user_type' => ['required', Rule::in(array_keys($this->portalTypesConfig()))],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('portal_users')->where('company_id', $companyId)],
            'phone' => ['nullable', 'string', 'max:60'],
            'organization' => ['nullable', 'string', 'max:255'],
        ]);

        $client = null;
        if (! empty($data['client_id'])) {
            $client = Client::query()->forCompany($companyId)->whereKey($data['client_id'])->firstOrFail();
        }
        $supplier = null;
        if (! empty($data['supplier_id'])) {
            $supplier = Supplier::query()->forCompany($companyId)->whereKey($data['supplier_id'])->firstOrFail();
        }

        $invitationToken = Str::random(64);
        $portalUser = PortalUser::query()->create([
            'company_id' => $companyId,
            'client_id' => $client?->id,
            'supplier_id' => $supplier?->id,
            'user_type' => $data['user_type'],
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'phone' => $data['phone'] ?? null,
            'organization' => $data['organization'] ?? $client?->name ?? $supplier?->name,
            'status' => 'invited',
            'invitation_token_hash' => hash('sha256', $invitationToken),
            'invitation_expires_at' => now()->addHours(72),
            'invited_by' => $this->user($request)->id,
        ]);

        $invitationUrl = $this->sendPortalInvitation($portalUser, $invitationToken);

        return response()->json([
            'portal_user' => $portalUser->load('client'),
            'invitation_url' => $invitationUrl,
            'message' => 'Portal invitation created.',
        ], 201);
    }

    public function resendInvitation(Request $request, PortalUser $portalUser): JsonResponse
    {
        $this->assertTenant($request, $portalUser);
        $token = Str::random(64);
        $portalUser->forceFill([
            'status' => 'invited',
            'invitation_token_hash' => hash('sha256', $token),
            'invitation_expires_at' => now()->addHours(72),
        ])->save();

        return response()->json([
            'message' => 'Portal invitation resent.',
            'invitation_url' => $this->sendPortalInvitation($portalUser, $token),
        ]);
    }

    public function updatePortalUserStatus(Request $request, PortalUser $portalUser): JsonResponse
    {
        $this->assertTenant($request, $portalUser);
        $data = $request->validate(['status' => ['required', Rule::in(['active', 'suspended', 'revoked'])]]);
        $portalUser->update(['status' => $data['status']]);
        if ($data['status'] !== 'active') {
            $portalUser->tokens()->delete();
        }

        return response()->json(['portal_user' => $portalUser->fresh(), 'message' => 'Portal account status updated.']);
    }

    public function reviewPayment(Request $request, PortalPaymentSubmission $payment): JsonResponse
    {
        $this->assertTenant($request, $payment);
        $data = $request->validate(['status' => ['required', Rule::in(['verified', 'rejected'])], 'notes' => ['nullable', 'string', 'max:2000']]);
        $payment->update(['status' => $data['status'], 'notes' => $data['notes'] ?? $payment->notes]);

        return response()->json(['payment' => $payment->fresh(), 'message' => 'Portal payment submission reviewed.']);
    }

    public function storeMessage(Request $request, PortalUser $portalUser): JsonResponse
    {
        $this->assertTenant($request, $portalUser);
        $data = $request->validate([
            'project_id' => ['required', 'integer'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:4000'],
        ]);
        $access = $portalUser->accesses()->where('project_id', $data['project_id'])->firstOrFail();
        abort_unless((int) $access->company_id === $this->companyId($request), 404);
        $message = PortalMessage::query()->create([
            'company_id' => $this->companyId($request),
            'portal_user_id' => $portalUser->id,
            'project_id' => $data['project_id'],
            'user_id' => $this->user($request)->id,
            'subject' => $data['subject'] ?? null,
            'message' => $data['message'],
        ]);

        return response()->json(['portal_message' => $message, 'message' => 'Reply sent to the portal user.'], 201);
    }

    public function grantAccess(Request $request, PortalUser $portalUser): JsonResponse
    {
        $this->assertTenant($request, $portalUser);

        $data = $request->validate([
            'project_id' => ['required', 'integer'],
            'access_level' => ['nullable', Rule::in(['view', 'comment', 'approve', 'submit', 'manage'])],
            'access_scope' => ['nullable', Rule::in(['project', 'contract', 'work_package', 'cost_code'])],
            'disciplines' => ['nullable', 'array'],
            'features' => ['nullable', 'array'],
            'expires_at' => ['nullable', 'date'],
        ]);

        $project = $this->projectForTenant($request, $data['project_id']);

        $access = PortalAccess::query()->updateOrCreate(
            [
                'portal_user_id' => $portalUser->id,
                'project_id' => $project->id,
            ],
            [
                'company_id' => $portalUser->company_id,
                'access_level' => $data['access_level'] ?? 'view',
                'access_scope' => $data['access_scope'] ?? 'project',
                'disciplines' => $data['disciplines'] ?? [],
                'features' => $data['features'] ?? $this->defaultFeaturesFor($portalUser->user_type),
                'expires_at' => $data['expires_at'] ?? null,
                'granted_by' => $this->user($request)->id,
            ],
        );

        $this->sendPortalEmail(
            $portalUser,
            'Navkwa Build portal access updated',
            "Your {$access->access_level} access to {$project->name} has been granted or updated.\n\nSign in: ".rtrim((string) config('app.frontend_url'), '/').'/portal',
        );

        return response()->json(['access' => $access->load(['portalUser', 'project'])], 201);
    }

    public function storeClientApproval(Request $request, int $project): JsonResponse
    {
        $projectModel = $this->projectForTenant($request, $project);

        $data = $request->validate([
            'portal_user_id' => ['nullable', 'integer'],
            'drawing_id' => ['nullable', 'integer'],
            'document_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'due_date' => ['nullable', 'date'],
        ]);

        if (! empty($data['portal_user_id'])) {
            PortalUser::query()->forCompany($projectModel->company_id)->whereKey($data['portal_user_id'])->firstOrFail();
        }

        if (! empty($data['drawing_id'])) {
            Drawing::query()->forCompany($projectModel->company_id)->whereKey($data['drawing_id'])->firstOrFail();
        }

        if (! empty($data['document_id'])) {
            Document::query()->forCompany($projectModel->company_id)->whereKey($data['document_id'])->firstOrFail();
        }

        $approval = ClientApproval::query()->create([
            'company_id' => $projectModel->company_id,
            'portal_user_id' => $data['portal_user_id'] ?? null,
            'project_id' => $projectModel->id,
            'drawing_id' => $data['drawing_id'] ?? null,
            'document_id' => $data['document_id'] ?? null,
            'approval_number' => $this->nextNumber('CAP', ClientApproval::class, 'approval_number', $projectModel->company_id),
            'title' => $data['title'],
            'status' => 'submitted',
            'due_date' => $data['due_date'] ?? null,
            'submitted_at' => now(),
            'created_by' => $this->user($request)->id,
        ]);

        $approval->load(['portalUser', 'project', 'drawing', 'document']);
        if ($approval->portalUser) {
            $this->sendPortalEmail(
                $approval->portalUser,
                'Client approval requested in Navkwa Build',
                "A new approval request, \"{$approval->title}\", is waiting for your review on {$projectModel->name}.\n\nOpen the portal: ".rtrim((string) config('app.frontend_url'), '/').'/portal',
            );
        }

        return response()->json(['client_approval' => $approval], 201);
    }

    public function reviewClientApproval(Request $request, ClientApproval $approval): JsonResponse
    {
        $this->assertTenant($request, $approval);

        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected', 'changes_required'])],
            'decision_notes' => ['nullable', 'string', 'max:4000'],
        ]);

        abort_if(! in_array($approval->status, ['submitted', 'changes_required'], true), 422, 'Approval is not awaiting review.');

        $approval->update([
            'status' => $data['status'],
            'decision_notes' => $data['decision_notes'] ?? null,
            'reviewed_at' => now(),
        ]);

        return response()->json(['client_approval' => $approval->fresh(['portalUser', 'project', 'drawing', 'document'])]);
    }

    public function storeConsultantSubmittal(Request $request, int $project): JsonResponse
    {
        $projectModel = $this->projectForTenant($request, $project);

        $data = $request->validate([
            'portal_user_id' => ['nullable', 'integer'],
            'drawing_id' => ['nullable', 'integer'],
            'document_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'discipline' => ['nullable', Rule::in(['architectural', 'structural', 'mep', 'civil', 'landscape', 'interiors', 'other'])],
            'due_date' => ['nullable', 'date'],
            'comments' => ['nullable', 'string', 'max:4000'],
        ]);

        if (! empty($data['portal_user_id'])) {
            PortalUser::query()->forCompany($projectModel->company_id)->whereKey($data['portal_user_id'])->firstOrFail();
        }

        if (! empty($data['drawing_id'])) {
            Drawing::query()->forCompany($projectModel->company_id)->whereKey($data['drawing_id'])->firstOrFail();
        }

        if (! empty($data['document_id'])) {
            Document::query()->forCompany($projectModel->company_id)->whereKey($data['document_id'])->firstOrFail();
        }

        $submittal = ConsultantSubmittal::query()->create([
            'company_id' => $projectModel->company_id,
            'portal_user_id' => $data['portal_user_id'] ?? null,
            'project_id' => $projectModel->id,
            'drawing_id' => $data['drawing_id'] ?? null,
            'document_id' => $data['document_id'] ?? null,
            'submittal_number' => $this->nextNumber('SUB', ConsultantSubmittal::class, 'submittal_number', $projectModel->company_id),
            'title' => $data['title'],
            'discipline' => $data['discipline'] ?? 'architectural',
            'status' => 'submitted',
            'due_date' => $data['due_date'] ?? null,
            'submitted_at' => now(),
            'comments' => $data['comments'] ?? null,
            'created_by' => $this->user($request)->id,
        ]);

        return response()->json(['consultant_submittal' => $submittal->load(['portalUser', 'project', 'drawing', 'document'])], 201);
    }

    public function reviewConsultantSubmittal(Request $request, ConsultantSubmittal $submittal): JsonResponse
    {
        $this->assertTenant($request, $submittal);

        $data = $request->validate([
            'status' => ['required', Rule::in(['in_review', 'approved', 'revise_and_resubmit', 'rejected'])],
            'comments' => ['nullable', 'string', 'max:4000'],
        ]);

        abort_if(! in_array($submittal->status, ['submitted', 'in_review', 'revise_and_resubmit'], true), 422, 'Submittal is not awaiting review.');

        $submittal->update([
            'status' => $data['status'],
            'comments' => $data['comments'] ?? $submittal->comments,
            'reviewed_by' => $this->user($request)->id,
            'reviewed_at' => $data['status'] === 'in_review' ? null : now(),
        ]);

        return response()->json(['consultant_submittal' => $submittal->fresh(['portalUser', 'project', 'drawing', 'document'])]);
    }

    public function storeWorkItem(Request $request, int $project): JsonResponse
    {
        $projectModel = $this->projectForTenant($request, $project);

        $data = $request->validate([
            'portal_user_id' => ['nullable', 'integer'],
            'supplier_id' => ['nullable', 'integer'],
            'purchase_order_id' => ['nullable', 'integer'],
            'invoice_id' => ['nullable', 'integer'],
            'supplier_invoice_id' => ['nullable', 'integer'],
            'drawing_id' => ['nullable', 'integer'],
            'document_id' => ['nullable', 'integer'],
            'portal_type' => ['required', Rule::in(array_keys($this->portalTypesConfig()))],
            'item_type' => ['required', Rule::in($this->portalItemTypes())],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:4000'],
            'status' => ['nullable', Rule::in($this->portalStatuses())],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
            'due_date' => ['nullable', 'date'],
            'attachments' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        $portalUser = null;
        if (! empty($data['portal_user_id'])) {
            $portalUser = PortalUser::query()->forCompany($projectModel->company_id)->whereKey($data['portal_user_id'])->firstOrFail();
            abort_if($portalUser->user_type !== $data['portal_type'], 422, 'Portal user type does not match the selected portal.');
        }

        if (! empty($data['supplier_id'])) {
            Supplier::query()->forCompany($projectModel->company_id)->whereKey($data['supplier_id'])->firstOrFail();
        }

        if (! empty($data['purchase_order_id'])) {
            PurchaseOrder::query()->forCompany($projectModel->company_id)->where('project_id', $projectModel->id)->whereKey($data['purchase_order_id'])->firstOrFail();
        }

        if (! empty($data['invoice_id'])) {
            Invoice::query()->forCompany($projectModel->company_id)->where('project_id', $projectModel->id)->whereKey($data['invoice_id'])->firstOrFail();
        }

        if (! empty($data['supplier_invoice_id'])) {
            SupplierInvoice::query()->forCompany($projectModel->company_id)->where('project_id', $projectModel->id)->whereKey($data['supplier_invoice_id'])->firstOrFail();
        }

        if (! empty($data['drawing_id'])) {
            Drawing::query()->forCompany($projectModel->company_id)->where('project_id', $projectModel->id)->whereKey($data['drawing_id'])->firstOrFail();
        }

        if (! empty($data['document_id'])) {
            Document::query()->forCompany($projectModel->company_id)->where('project_id', $projectModel->id)->whereKey($data['document_id'])->firstOrFail();
        }

        $item = PortalWorkItem::query()->create([
            'company_id' => $projectModel->company_id,
            'portal_user_id' => $portalUser?->id,
            'project_id' => $projectModel->id,
            'supplier_id' => $data['supplier_id'] ?? null,
            'purchase_order_id' => $data['purchase_order_id'] ?? null,
            'invoice_id' => $data['invoice_id'] ?? null,
            'supplier_invoice_id' => $data['supplier_invoice_id'] ?? null,
            'drawing_id' => $data['drawing_id'] ?? null,
            'document_id' => $data['document_id'] ?? null,
            'portal_type' => $data['portal_type'],
            'item_type' => $data['item_type'],
            'item_number' => $this->nextNumber($this->portalItemPrefix($data['item_type']), PortalWorkItem::class, 'item_number', $projectModel->company_id),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'submitted',
            'priority' => $data['priority'] ?? 'medium',
            'due_date' => $data['due_date'] ?? null,
            'submitted_at' => now(),
            'attachments' => $data['attachments'] ?? [],
            'metadata' => $data['metadata'] ?? [],
            'created_by' => $this->user($request)->id,
        ]);

        return response()->json(['work_item' => $item->load($this->workItemRelations())], 201);
    }

    public function updateWorkItem(Request $request, PortalWorkItem $workItem): JsonResponse
    {
        $this->assertTenant($request, $workItem);

        $data = $request->validate([
            'portal_user_id' => ['nullable', 'integer'],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:4000'],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'critical'])],
            'due_date' => ['nullable', 'date'],
            'attachments' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (! empty($data['portal_user_id'])) {
            PortalUser::query()->forCompany($workItem->company_id)->where('user_type', $workItem->portal_type)->whereKey($data['portal_user_id'])->firstOrFail();
        }

        $workItem->update($data);

        return response()->json(['work_item' => $workItem->fresh($this->workItemRelations())]);
    }

    public function reviewWorkItem(Request $request, PortalWorkItem $workItem): JsonResponse
    {
        $this->assertTenant($request, $workItem);

        $data = $request->validate([
            'status' => ['required', Rule::in($this->portalStatuses())],
            'response' => ['nullable', 'string', 'max:4000'],
        ]);

        $workItem->update([
            'status' => $data['status'],
            'response' => $data['response'] ?? $workItem->response,
            'reviewed_by' => $this->user($request)->id,
            'reviewed_at' => $data['status'] === 'in_review' ? null : now(),
        ]);

        return response()->json(['work_item' => $workItem->fresh($this->workItemRelations())]);
    }

    public function destroyWorkItem(Request $request, PortalWorkItem $workItem): JsonResponse
    {
        $this->assertTenant($request, $workItem);

        $workItem->delete();

        return response()->json(['message' => 'Portal work item archived.']);
    }

    private function assertTenant(Request $request, object $model): void
    {
        abort_if((int) $model->company_id !== $this->companyId($request), 404);
    }

    private function workItemRelations(): array
    {
        return [
            'portalUser:id,name,email,user_type,organization',
            'project:id,code,name,status,health_status,progress_percent',
            'supplier:id,name',
            'purchaseOrder:id,po_number,status,total_amount,delivery_status',
            'invoice:id,invoice_number,title,status,total_amount,balance_due,payment_status',
            'supplierInvoice:id,invoice_number,status,total_amount,balance_due',
            'drawing:id,drawing_number,title,discipline,status',
            'document:id,document_number,title,document_type,status',
        ];
    }

    private function portalTypesConfig(): array
    {
        return [
            'client' => ['label' => 'Client Portal', 'features' => ['progress_photos', 'milestones', 'approvals', 'invoices', 'variation_requests', 'rfis', 'meeting_minutes', 'project_documents']],
            'consultant' => ['label' => 'Consultant Portal', 'features' => ['drawing_reviews', 'technical_comments', 'submittals', 'rfis', 'inspections', 'digital_approvals']],
            'supplier' => ['label' => 'Supplier Portal', 'features' => ['purchase_orders', 'delivery_schedules', 'invoice_submission', 'payment_status', 'document_uploads']],
            'subcontractor' => ['label' => 'Subcontractor Portal', 'features' => ['work_packages', 'daily_reports', 'safety_documents', 'attendance', 'progress_updates']],
            'inspector' => ['label' => 'Inspector Portal', 'features' => ['inspection_schedules', 'findings', 'compliance_reports', 'sign_offs']],
            'investor_owner' => ['label' => 'Investor/Owner Portal', 'features' => ['executive_dashboards', 'project_health', 'milestones', 'budget_visibility', 'reports']],
        ];
    }

    private function portalTypes(int $companyId, $workItems): array
    {
        return collect($this->portalTypesConfig())
            ->map(fn (array $config, string $type): array => [
                'key' => $type,
                'label' => $config['label'],
                'features' => $config['features'],
                'users' => PortalUser::query()->forCompany($companyId)->where('user_type', $type)->count(),
                'open_items' => $workItems->where('portal_type', $type)->whereNotIn('status', ['approved', 'rejected', 'closed', 'completed', 'paid', 'signed_off'])->count(),
                'completed_items' => $workItems->where('portal_type', $type)->whereIn('status', ['approved', 'closed', 'completed', 'paid', 'signed_off'])->count(),
            ])
            ->values()
            ->all();
    }

    private function portalActivity($workItems): array
    {
        return $workItems
            ->take(12)
            ->map(fn (PortalWorkItem $item): array => [
                'time' => $item->updated_at?->toISOString(),
                'portal' => $item->portal_type,
                'title' => $item->title,
                'status' => $item->status,
                'project' => $item->project?->name,
            ])
            ->values()
            ->all();
    }

    private function defaultFeaturesFor(string $portalType): array
    {
        return $this->portalTypesConfig()[$portalType]['features'] ?? [];
    }

    private function portalItemTypes(): array
    {
        return [
            'progress_photo', 'milestone_update', 'approval_request', 'invoice_query',
            'variation_request', 'rfi', 'meeting_minutes', 'project_document',
            'drawing_review', 'technical_comment', 'submittal', 'inspection_request',
            'digital_approval', 'purchase_order_acknowledgement', 'delivery_schedule',
            'invoice_submission', 'payment_status_query', 'document_upload',
            'work_package_update', 'daily_report', 'safety_document', 'attendance_update',
            'progress_update', 'inspection_schedule', 'inspection_finding',
            'compliance_report', 'inspection_signoff', 'executive_report',
            'budget_report', 'project_health_update',
        ];
    }

    private function portalStatuses(): array
    {
        return ['draft', 'submitted', 'in_review', 'approved', 'changes_required', 'rejected', 'scheduled', 'completed', 'closed', 'acknowledged', 'paid', 'signed_off'];
    }

    private function portalItemPrefix(string $type): string
    {
        return match ($type) {
            'rfi' => 'RFI',
            'variation_request' => 'VAR',
            'invoice_submission', 'invoice_query' => 'INV',
            'purchase_order_acknowledgement' => 'POA',
            'delivery_schedule' => 'DEL',
            'inspection_finding', 'inspection_schedule', 'inspection_signoff' => 'INS',
            'meeting_minutes' => 'MIN',
            'daily_report' => 'DRP',
            'progress_update', 'project_health_update' => 'PRG',
            default => 'PWI',
        };
    }

    private function sendPortalInvitation(PortalUser $portalUser, string $token): string
    {
        $portalUser->loadMissing('company:id,name,tenant_key');
        $url = rtrim((string) config('app.frontend_url'), '/').'/portal?invite='.urlencode($token)
            .'&email='.urlencode($portalUser->email)
            .'&company='.urlencode($portalUser->company->tenant_key);

        $this->sendPortalEmail(
            $portalUser,
            'Your Navkwa Build portal invitation',
            "You have been invited to the {$portalUser->user_type} portal for {$portalUser->company->name}.\n\nAccept your secure invitation within 72 hours:\n{$url}",
        );

        return $url;
    }

    private function sendPortalEmail(PortalUser $portalUser, string $subject, string $message): void
    {
        try {
            Mail::raw($message, fn ($mail) => $mail->to($portalUser->email, $portalUser->name)->subject($subject));
        } catch (\Throwable $exception) {
            report($exception);
        }
    }
}
