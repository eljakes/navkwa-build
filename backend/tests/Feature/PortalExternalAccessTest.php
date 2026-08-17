<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\ClientApproval;
use App\Models\Company;
use App\Models\PortalAccess;
use App\Models\PortalUser;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PortalExternalAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_staff_can_invite_and_control_external_accounts(): void
    {
        [$employee, $company] = $this->tenant('portal-authority');
        Sanctum::actingAs($employee);

        $created = $this->postJson('/api/v1/portals/users', [
            'user_type' => 'client', 'name' => 'External Client', 'email' => 'client@external.test',
        ])->assertCreated()
            ->assertJsonPath('portal_user.status', 'invited');

        $this->assertStringContainsString('/portal?invite=', $created->json('invitation_url'));
        $portalUserId = $created->json('portal_user.id');

        $this->patchJson("/api/v1/portals/users/{$portalUserId}/status", ['status' => 'suspended'])
            ->assertOk()->assertJsonPath('portal_user.status', 'suspended');
        $this->postJson("/api/v1/portals/users/{$portalUserId}/invite")
            ->assertOk()->assertJsonPath('message', 'Portal invitation resent.');

        $this->assertDatabaseHas('portal_users', ['company_id' => $company->id, 'email' => 'client@external.test']);
    }

    public function test_external_client_has_isolated_feature_scoped_workspace_and_actions(): void
    {
        Storage::fake('local');
        [, $company, $branch] = $this->tenant('hortula');
        [, $otherCompany, $otherBranch] = $this->tenant('other-builder');
        $project = $this->project($company, $branch, 'HOSP-001', 'Hospital');
        $otherProject = $this->project($otherCompany, $otherBranch, 'OTHER-001', 'Secret Project');
        $token = 'known-secure-invitation-token';
        $portalUser = PortalUser::query()->create([
            'company_id' => $company->id, 'user_type' => 'client', 'name' => 'Ministry Reviewer',
            'email' => 'reviewer@health.test', 'status' => 'invited',
            'invitation_token_hash' => hash('sha256', $token), 'invitation_expires_at' => now()->addHour(),
        ]);
        PortalAccess::query()->create([
            'company_id' => $company->id, 'portal_user_id' => $portalUser->id, 'project_id' => $project->id,
            'access_level' => 'approve', 'access_scope' => 'project', 'features' => ['approvals', 'rfis', 'invoices'],
        ]);
        $approval = ClientApproval::query()->create([
            'company_id' => $company->id, 'portal_user_id' => $portalUser->id, 'project_id' => $project->id,
            'approval_number' => 'CAP-001', 'title' => 'Approve Drawing A-105', 'status' => 'submitted',
        ]);

        $accepted = $this->postJson('/api/v1/portal/auth/accept', [
            'company' => $company->tenant_key, 'email' => $portalUser->email, 'token' => $token,
            'password' => 'StrongPortalPass1!', 'password_confirmation' => 'StrongPortalPass1!',
        ])->assertOk()->assertJsonPath('portal_user.status', 'active');
        $bearer = $accepted->json('token');

        $workspace = $this->withToken($bearer)->getJson('/api/v1/portal/workspace')
            ->assertOk()
            ->assertJsonPath('accesses.0.project.id', $project->id)
            ->assertJsonMissing(['id' => $otherProject->id, 'name' => 'Secret Project'])
            ->assertJsonPath('client_approvals.0.id', $approval->id);

        $this->withToken($bearer)->postJson("/api/v1/portal/client-approvals/{$approval->id}/review", [
            'status' => 'approved', 'decision_notes' => 'Approved through the external portal.',
        ])->assertOk()->assertJsonPath('client_approval.status', 'approved');

        $this->withToken($bearer)->post('/api/v1/portal/work-items', [
            'project_id' => $project->id, 'item_type' => 'rfi', 'title' => 'Confirm operating theatre layout',
            'description' => 'Please confirm the latest room layout.', 'file' => UploadedFile::fake()->create('markup.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('work_item.portal_user_id', $portalUser->id);

        $this->withToken($bearer)->postJson('/api/v1/portal/work-items', [
            'project_id' => $otherProject->id, 'item_type' => 'rfi', 'title' => 'Cross tenant request',
        ])->assertNotFound();
        $this->withToken($bearer)->postJson('/api/v1/portal/work-items', [
            'project_id' => $project->id, 'item_type' => 'meeting_minutes', 'title' => 'Not enabled',
        ])->assertForbidden();

        $this->withToken($bearer)->postJson('/api/v1/portal/messages', [
            'project_id' => $project->id, 'message' => 'Please confirm receipt of the approval.',
        ])->assertCreated();
        $this->withToken($bearer)->postJson('/api/v1/portal/payments', [
            'project_id' => $project->id, 'amount' => 5000, 'currency' => 'GHS',
            'payment_method' => 'bank_transfer', 'transaction_reference' => 'BANK-001',
        ])->assertCreated()->assertJsonPath('payment.status', 'submitted');

        $this->assertDatabaseHas('audit_logs', ['portal_user_id' => $portalUser->id]);
        $this->assertCount(1, $workspace->json('accesses'));
    }

    public function test_every_external_portal_type_can_submit_only_its_authorized_workflow(): void
    {
        [, $company, $branch] = $this->tenant('all-portals');
        $project = $this->project($company, $branch, 'ALL-001', 'Shared Construction Project');
        $cases = [
            'consultant' => ['submittal', 'submittals'],
            'supplier' => ['invoice_submission', 'invoice_submission'],
            'subcontractor' => ['daily_report', 'daily_reports'],
            'inspector' => ['inspection_signoff', 'sign_offs'],
            'investor_owner' => ['project_health_update', 'project_health_update'],
        ];

        foreach ($cases as $type => [$itemType, $feature]) {
            $portalUser = PortalUser::query()->create([
                'company_id' => $company->id, 'user_type' => $type, 'name' => ucfirst(str_replace('_', ' ', $type)),
                'email' => "{$type}@external.test", 'status' => 'active', 'password' => 'StrongPortalPass1!',
            ]);
            PortalAccess::query()->create([
                'company_id' => $company->id, 'portal_user_id' => $portalUser->id, 'project_id' => $project->id,
                'access_level' => 'submit', 'features' => [$feature],
            ]);
            Sanctum::actingAs($portalUser, ['portal']);

            $this->postJson('/api/v1/portal/work-items', [
                'project_id' => $project->id, 'item_type' => $itemType, 'title' => "{$type} submission",
            ])->assertCreated()->assertJsonPath('work_item.portal_type', $type);

            $this->postJson('/api/v1/portal/work-items', [
                'project_id' => $project->id, 'item_type' => 'variation_request', 'title' => 'Wrong portal action',
            ])->assertUnprocessable();
        }

        $expiredUser = PortalUser::query()->create([
            'company_id' => $company->id, 'user_type' => 'supplier', 'name' => 'Expired Supplier',
            'email' => 'expired@external.test', 'status' => 'active', 'password' => 'StrongPortalPass1!',
        ]);
        PortalAccess::query()->create([
            'company_id' => $company->id, 'portal_user_id' => $expiredUser->id, 'project_id' => $project->id,
            'access_level' => 'submit', 'features' => ['invoice_submission'], 'expires_at' => now()->subMinute(),
        ]);
        Sanctum::actingAs($expiredUser, ['portal']);
        $this->postJson('/api/v1/portal/work-items', [
            'project_id' => $project->id, 'item_type' => 'invoice_submission', 'title' => 'Expired submission',
        ])->assertNotFound();
    }

    private function tenant(string $key): array
    {
        $company = Company::query()->create(['name' => ucfirst($key), 'tenant_key' => $key, 'default_currency' => 'GHS', 'country' => 'GH']);
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'Head Office', 'code' => 'HQ']);
        $role = Role::query()->create(['company_id' => $company->id, 'name' => 'Portal Manager', 'slug' => 'portal-manager', 'permissions' => ['portals.manage'], 'is_system' => true]);
        $user = User::query()->create(['company_id' => $company->id, 'branch_id' => $branch->id, 'role_id' => $role->id, 'name' => 'Portal Manager', 'email' => "manager@{$key}.test", 'password' => 'EmployeePass1!']);

        return [$user, $company, $branch];
    }

    private function project(Company $company, Branch $branch, string $code, string $name): Project
    {
        return Project::query()->create(['company_id' => $company->id, 'branch_id' => $branch->id, 'code' => $code, 'name' => $name]);
    }
}
