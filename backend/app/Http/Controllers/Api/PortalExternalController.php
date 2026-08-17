<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientApproval;
use App\Models\Company;
use App\Models\ConsultantSubmittal;
use App\Models\FieldDailyReport;
use App\Models\Inspection;
use App\Models\Invoice;
use App\Models\PortalAccess;
use App\Models\PortalMessage;
use App\Models\PortalPaymentSubmission;
use App\Models\PortalUser;
use App\Models\PortalWorkItem;
use App\Models\PurchaseOrder;
use App\Models\SupplierInvoice;
use App\Services\MfaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PortalExternalController extends Controller
{
    public function acceptInvitation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company' => ['required', 'string'],
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(12)->letters()->mixedCase()->numbers()->symbols()],
        ]);

        $portalUser = $this->portalUserForCompany($data['company'], $data['email']);
        abort_unless(
            $portalUser->status === 'invited'
            && $portalUser->invitation_expires_at?->isFuture()
            && hash_equals((string) $portalUser->invitation_token_hash, hash('sha256', $data['token'])),
            422,
            'This invitation is invalid or has expired.',
        );

        $portalUser->forceFill([
            'password' => $data['password'],
            'status' => 'active',
            'invitation_token_hash' => null,
            'invitation_expires_at' => null,
            'invitation_accepted_at' => now(),
            'failed_login_attempts' => 0,
        ])->save();

        return $this->authenticatedPayload($portalUser, $request);
    }

    public function login(Request $request, MfaService $mfa): JsonResponse
    {
        $data = $request->validate([
            'company' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'mfa_code' => ['nullable', 'string'],
        ]);

        $portalUser = $this->portalUserForCompany($data['company'], $data['email']);
        abort_if($portalUser->locked_until?->isFuture(), 423, 'This account is temporarily locked.');

        if (! $portalUser->password || ! Hash::check($data['password'], $portalUser->password)) {
            $attempts = $portalUser->failed_login_attempts + 1;
            $portalUser->forceFill([
                'failed_login_attempts' => $attempts,
                'locked_until' => $attempts >= 5 ? now()->addMinutes(15) : null,
            ])->save();
            throw ValidationException::withMessages(['email' => ['The portal credentials are incorrect.']]);
        }

        abort_unless($portalUser->status === 'active', 403, 'This portal account is not active.');
        if ($portalUser->mfa_enabled_at) {
            abort_unless($data['mfa_code'] ?? null, 422, 'An MFA code is required.');
            abort_unless($mfa->verifyCode((string) $portalUser->mfa_secret, (string) $data['mfa_code']), 422, 'The MFA code is invalid.');
            $portalUser->forceFill(['mfa_last_used_at' => now()])->save();
        }

        return $this->authenticatedPayload($portalUser, $request);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['company' => ['required', 'string'], 'email' => ['required', 'email']]);
        $portalUser = $this->portalUserForCompany($data['company'], $data['email'], false);

        if ($portalUser && $portalUser->status === 'active') {
            $token = Str::random(64);
            $portalUser->forceFill([
                'invitation_token_hash' => hash('sha256', $token),
                'invitation_expires_at' => now()->addHour(),
            ])->save();
            $url = rtrim((string) config('app.frontend_url'), '/').'/portal?reset='.urlencode($token)
                .'&email='.urlencode($portalUser->email).'&company='.urlencode($data['company']);
            try {
                Mail::raw("Reset your Navkwa Build portal password within one hour:\n{$url}", fn ($mail) => $mail->to($portalUser->email, $portalUser->name)->subject('Reset your portal password'));
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return response()->json(['message' => 'If the portal account exists, a reset link has been sent.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company' => ['required', 'string'], 'email' => ['required', 'email'], 'token' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(12)->letters()->mixedCase()->numbers()->symbols()],
        ]);
        $portalUser = $this->portalUserForCompany($data['company'], $data['email']);
        abort_unless($portalUser->invitation_expires_at?->isFuture() && hash_equals((string) $portalUser->invitation_token_hash, hash('sha256', $data['token'])), 422, 'This reset link is invalid or expired.');
        $portalUser->forceFill(['password' => $data['password'], 'invitation_token_hash' => null, 'invitation_expires_at' => null, 'failed_login_attempts' => 0, 'locked_until' => null])->save();
        $portalUser->tokens()->delete();

        return response()->json(['message' => 'Password reset. You can now sign in.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['portal_user' => $this->user($request)->load('company:id,name,tenant_key')]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    public function workspace(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $accesses = $this->activeAccesses($user)->with('project:id,code,name,status,health_status,progress_percent,target_end_date,contract_value')->get();
        $projectIds = $accesses->pluck('project_id');
        $features = $accesses->flatMap(fn (PortalAccess $access) => $access->features ?? [])->unique()->values();

        return response()->json([
            'portal_user' => $user->load('company:id,name,tenant_key'),
            'accesses' => $accesses,
            'features' => $features,
            'work_items' => PortalWorkItem::query()->where('portal_user_id', $user->id)->whereIn('project_id', $projectIds)->latest()->get(),
            'messages' => PortalMessage::query()->where('portal_user_id', $user->id)->whereIn('project_id', $projectIds)->latest()->limit(100)->get(),
            'client_approvals' => $user->user_type === 'client' ? ClientApproval::query()->where('portal_user_id', $user->id)->whereIn('project_id', $projectIds)->with(['project:id,name', 'drawing:id,drawing_number,title', 'document:id,document_number,title'])->latest()->get() : [],
            'consultant_submittals' => $user->user_type === 'consultant' ? ConsultantSubmittal::query()->where('portal_user_id', $user->id)->whereIn('project_id', $projectIds)->with(['project:id,name', 'drawing:id,drawing_number,title'])->latest()->get() : [],
            'purchase_orders' => $user->user_type === 'supplier' && $user->supplier_id ? PurchaseOrder::query()->whereIn('project_id', $projectIds)->where('supplier_id', $user->supplier_id)->latest()->get() : [],
            'supplier_invoices' => $user->user_type === 'supplier' && $user->supplier_id ? SupplierInvoice::query()->whereIn('project_id', $projectIds)->where('supplier_id', $user->supplier_id)->latest()->get() : [],
            'client_invoices' => $user->user_type === 'client' && $user->client_id ? Invoice::query()->whereIn('project_id', $projectIds)->where('client_id', $user->client_id)->latest()->get() : [],
            'inspections' => $user->user_type === 'inspector' ? Inspection::query()->whereIn('project_id', $projectIds)->latest()->get() : [],
            'daily_reports' => $user->user_type === 'subcontractor' ? FieldDailyReport::query()->whereIn('project_id', $projectIds)->latest()->get() : [],
            'payments' => PortalPaymentSubmission::query()->where('portal_user_id', $user->id)->latest()->get(),
        ]);
    }

    public function storeWorkItem(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'project_id' => ['required', 'integer'],
            'item_type' => ['required', Rule::in($this->allowedItemTypes($user->user_type))],
            'title' => ['required', 'string', 'max:255'], 'description' => ['nullable', 'string', 'max:4000'],
            'due_date' => ['nullable', 'date'], 'file' => ['nullable', 'file', 'max:102400'],
        ]);
        $access = $this->access($user, $data['project_id'], ['submit', 'manage']);
        $this->requireFeature($access, $this->featureForItem($data['item_type']));
        $attachments = [];
        if ($request->hasFile('file')) {
            $attachments[] = $this->storePortalFile($request->file('file'), $user, (int) $data['project_id']);
        }

        $item = PortalWorkItem::query()->create([
            'company_id' => $user->company_id, 'portal_user_id' => $user->id, 'project_id' => $data['project_id'],
            'portal_type' => $user->user_type, 'item_type' => $data['item_type'],
            'item_number' => strtoupper(substr($data['item_type'], 0, 3)).'-'.now()->format('ymdHis').'-'.$user->id,
            'title' => $data['title'], 'description' => $data['description'] ?? null, 'status' => 'submitted',
            'priority' => 'medium', 'due_date' => $data['due_date'] ?? null, 'submitted_at' => now(),
            'attachments' => $attachments,
        ]);

        return response()->json(['work_item' => $item, 'message' => 'Submitted to the project team.'], 201);
    }

    public function respondWorkItem(Request $request, PortalWorkItem $workItem): JsonResponse
    {
        $user = $this->user($request);
        abort_unless((int) $workItem->portal_user_id === $user->id, 404);
        $access = $this->access($user, $workItem->project_id, ['comment', 'approve', 'submit', 'manage']);
        $data = $request->validate(['response' => ['required', 'string', 'max:4000'], 'status' => ['nullable', Rule::in(['acknowledged', 'submitted', 'completed', 'changes_required'])], 'file' => ['nullable', 'file', 'max:102400']]);
        $attachments = $workItem->attachments ?? [];
        if ($request->hasFile('file')) {
            $attachments[] = $this->storePortalFile($request->file('file'), $user, $workItem->project_id);
        }
        $workItem->update(['response' => $data['response'], 'status' => $data['status'] ?? 'acknowledged', 'attachments' => $attachments, 'reviewed_at' => now()]);

        return response()->json(['work_item' => $workItem->fresh(), 'access_level' => $access->access_level]);
    }

    public function reviewApproval(Request $request, ClientApproval $approval): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user->user_type === 'client' && (int) $approval->portal_user_id === $user->id, 404);
        $access = $this->access($user, $approval->project_id, ['approve', 'manage']);
        $this->requireFeature($access, 'approvals');
        $data = $request->validate(['status' => ['required', Rule::in(['approved', 'rejected', 'changes_required'])], 'decision_notes' => ['nullable', 'string', 'max:4000']]);
        $approval->update(['status' => $data['status'], 'decision_notes' => $data['decision_notes'] ?? null, 'reviewed_at' => now()]);

        return response()->json(['client_approval' => $approval->fresh()]);
    }

    public function storeMessage(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate(['project_id' => ['required', 'integer'], 'subject' => ['nullable', 'string', 'max:255'], 'message' => ['required', 'string', 'max:4000'], 'file' => ['nullable', 'file', 'max:102400']]);
        $this->access($user, $data['project_id'], ['comment', 'approve', 'submit', 'manage']);
        $attachments = $request->hasFile('file') ? [$this->storePortalFile($request->file('file'), $user, (int) $data['project_id'])] : [];
        $message = PortalMessage::query()->create(['company_id' => $user->company_id, 'portal_user_id' => $user->id, 'project_id' => $data['project_id'], 'subject' => $data['subject'] ?? null, 'message' => $data['message'], 'attachments' => $attachments]);

        return response()->json(['portal_message' => $message], 201);
    }

    public function markMessagesRead(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate(['project_id' => ['required', 'integer']]);
        $this->access($user, $data['project_id'], ['view', 'comment', 'submit', 'approve', 'manage']);
        PortalMessage::query()->where('portal_user_id', $user->id)->where('project_id', $data['project_id'])
            ->whereNotNull('user_id')->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['message' => 'Conversation marked as read.']);
    }

    public function downloadMessageAttachment(Request $request, PortalMessage $portalMessage, int $index): StreamedResponse
    {
        $user = $this->user($request);
        abort_unless((int) $portalMessage->portal_user_id === $user->id, 404);
        $this->access($user, $portalMessage->project_id, ['view', 'comment', 'submit', 'approve', 'manage']);
        $attachment = ($portalMessage->attachments ?? [])[$index] ?? null;
        abort_unless($attachment && Storage::disk('local')->exists($attachment['path']), 404);

        return Storage::disk('local')->download($attachment['path'], $attachment['name']);
    }

    public function submitPayment(Request $request): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user->user_type === 'client', 403);
        $data = $request->validate(['project_id' => ['required', 'integer'], 'invoice_id' => ['nullable', 'integer'], 'amount' => ['required', 'numeric', 'min:0.01'], 'currency' => ['required', 'string', 'size:3'], 'payment_method' => ['required', Rule::in(['bank_transfer', 'mobile_money', 'cheque', 'card_reference'])], 'transaction_reference' => ['nullable', 'string', 'max:255'], 'notes' => ['nullable', 'string', 'max:2000'], 'proof' => ['nullable', 'file', 'max:102400']]);
        $access = $this->access($user, $data['project_id'], ['submit', 'manage']);
        $this->requireFeature($access, 'invoices');
        if (! empty($data['invoice_id'])) {
            Invoice::query()->where('company_id', $user->company_id)->where('project_id', $data['project_id'])->whereKey($data['invoice_id'])->firstOrFail();
        }
        $proofPath = $request->hasFile('proof') ? $request->file('proof')->store("portal/{$user->company_id}/{$data['project_id']}/payments", 'local') : null;
        $payment = PortalPaymentSubmission::query()->create([...$data, 'company_id' => $user->company_id, 'portal_user_id' => $user->id, 'proof_path' => $proofPath, 'status' => 'submitted', 'submitted_at' => now()]);

        return response()->json(['payment' => $payment, 'message' => 'Payment evidence submitted for verification.'], 201);
    }

    public function downloadAttachment(Request $request, PortalWorkItem $workItem, int $index): StreamedResponse
    {
        $user = $this->user($request);
        abort_unless((int) $workItem->portal_user_id === $user->id, 404);
        $this->access($user, $workItem->project_id, ['view', 'comment', 'approve', 'submit', 'manage']);
        $attachment = ($workItem->attachments ?? [])[$index] ?? null;
        abort_unless($attachment && Storage::disk('local')->exists($attachment['path']), 404);

        return Storage::disk('local')->download($attachment['path'], $attachment['name']);
    }

    public function setupMfa(Request $request, MfaService $mfa): JsonResponse
    {
        $user = $this->user($request);
        $secret = $mfa->generateSecret();
        $user->forceFill(['mfa_secret' => $secret, 'mfa_enabled_at' => null])->save();

        return response()->json(['secret' => $secret, 'otpauth_url' => $mfa->otpauthUri($user, $secret)]);
    }

    public function enableMfa(Request $request, MfaService $mfa): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string']]);
        $user = $this->user($request);
        abort_unless($user->mfa_secret && $mfa->verifyCode((string) $user->mfa_secret, $data['code']), 422, 'The MFA code is invalid.');
        $user->forceFill(['mfa_enabled_at' => now()])->save();

        return response()->json(['message' => 'MFA enabled.']);
    }

    private function authenticatedPayload(PortalUser $user, Request $request): JsonResponse
    {
        $user->tokens()->delete();
        $user->forceFill(['last_login_at' => now(), 'last_login_ip' => $request->ip(), 'failed_login_attempts' => 0, 'locked_until' => null])->save();
        $token = $user->createToken('navkwabuild-portal', ['portal'], now()->addHours(8))->plainTextToken;

        return response()->json(['token' => $token, 'portal_user' => $user->fresh()->load('company:id,name,tenant_key')]);
    }

    private function user(Request $request): PortalUser
    {
        /** @var PortalUser $user */
        $user = $request->user();

        return $user;
    }

    private function portalUserForCompany(string $tenantKey, string $email, bool $fail = true): ?PortalUser
    {
        $company = Company::query()->where('tenant_key', $tenantKey)->first();
        $user = $company ? PortalUser::query()->where('company_id', $company->id)->where('email', strtolower($email))->first() : null;
        if ($fail && ! $user) {
            throw ValidationException::withMessages(['email' => ['The portal credentials are incorrect.']]);
        }

        return $user;
    }

    private function activeAccesses(PortalUser $user)
    {
        return PortalAccess::query()->where('portal_user_id', $user->id)->where('company_id', $user->company_id)->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    private function access(PortalUser $user, int $projectId, array $levels): PortalAccess
    {
        $access = $this->activeAccesses($user)->where('project_id', $projectId)->firstOrFail();
        $rank = ['view' => 1, 'comment' => 2, 'submit' => 3, 'approve' => 4, 'manage' => 5];
        $minimum = collect($levels)->map(fn (string $level): int => $rank[$level] ?? 99)->min();
        abort_unless(($rank[$access->access_level] ?? 0) >= $minimum, 403, 'Your portal access level does not permit this action.');

        return $access;
    }

    private function requireFeature(PortalAccess $access, string $feature): void
    {
        abort_unless(in_array($feature, $access->features ?? [], true), 403, 'This portal feature is not enabled for your access.');
    }

    private function storePortalFile($file, PortalUser $user, int $projectId): array
    {
        return ['name' => $file->getClientOriginalName(), 'mime' => $file->getMimeType(), 'size' => $file->getSize(), 'path' => $file->store("portal/{$user->company_id}/{$projectId}/{$user->id}", 'local')];
    }

    private function allowedItemTypes(string $type): array
    {
        return match ($type) {
            'client' => ['approval_request', 'variation_request', 'rfi', 'meeting_minutes', 'invoice_query'],
            'consultant' => ['drawing_review', 'technical_comment', 'submittal', 'rfi', 'inspection_request', 'digital_approval'],
            'supplier' => ['purchase_order_acknowledgement', 'delivery_schedule', 'invoice_submission', 'payment_status_query', 'document_upload'],
            'subcontractor' => ['work_package_update', 'daily_report', 'safety_document', 'attendance_update', 'progress_update'],
            'inspector' => ['inspection_schedule', 'inspection_finding', 'compliance_report', 'inspection_signoff'],
            default => ['executive_report', 'budget_report', 'project_health_update'],
        };
    }

    private function featureForItem(string $item): string
    {
        return match ($item) {
            'approval_request', 'digital_approval' => 'approvals',
            'invoice_query' => 'invoices',
            'drawing_review' => 'drawing_reviews',
            'submittal' => 'submittals',
            'rfi' => 'rfis',
            'purchase_order_acknowledgement' => 'purchase_orders',
            'delivery_schedule' => 'delivery_schedules',
            'invoice_submission' => 'invoice_submission',
            'daily_report' => 'daily_reports',
            'inspection_schedule' => 'inspection_schedules',
            'inspection_finding' => 'findings',
            'inspection_signoff' => 'sign_offs',
            default => $item,
        };
    }
}
