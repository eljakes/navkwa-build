<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\BudgetLine;
use App\Models\Client;
use App\Models\Company;
use App\Models\Project;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NavkwaBuildPhaseOneApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_creates_a_tenant_and_api_token(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'company_name' => 'Atlas Builders Ltd',
            'branch_name' => 'Head Office',
            'country' => 'GH',
            'currency' => 'GHS',
            'name' => 'Adjoa Admin',
            'email' => 'adjoa@example.com',
            'password' => 'NavkwaBuild2026!',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.company.name', 'Atlas Builders Ltd')
            ->assertJsonPath('user.role.slug', 'owner')
            ->assertJsonStructure(['token']);

        $this->assertDatabaseHas('companies', ['name' => 'Atlas Builders Ltd']);
        $this->assertDatabaseHas('users', ['email' => 'adjoa@example.com']);
        $this->assertDatabaseHas('roles', ['slug' => 'hr', 'name' => 'HR']);
        $this->assertDatabaseHas('roles', ['slug' => 'architect', 'name' => 'Architect']);
    }

    public function test_projects_tasks_budgets_and_dashboard_rollups_work(): void
    {
        [$user, $branch] = $this->tenantUser();

        Sanctum::actingAs($user);
        Storage::fake('public');

        $projectResponse = $this->post('/api/v1/projects', [
            'branch_id' => $branch->id,
            'client_name' => 'Cedar Developments',
            'name' => 'Cedar Office Park',
            'status' => 'active',
            'contract_value' => 2500000,
            'start_date' => now()->toDateString(),
            'target_end_date' => now()->addMonths(10)->toDateString(),
            'future_image' => UploadedFile::fake()->image('cedar-final-view.jpg', 1200, 720),
        ], ['Accept' => 'application/json']);

        $projectResponse->assertCreated();

        $projectId = $projectResponse->json('project.id');
        $project = Project::query()->findOrFail($projectId);

        $this->assertNotNull($projectResponse->json('project.future_image_url'));
        Storage::disk('public')->assertExists($project->future_image_path);

        $this->postJson("/api/v1/projects/{$projectId}/budget-lines", [
            'cost_code' => 'C01',
            'description' => 'Concrete works',
            'category' => 'materials',
            'budget_amount' => 500000,
        ])->assertCreated();

        $this->postJson("/api/v1/projects/{$projectId}/tasks", [
            'title' => 'Mobilize site team',
            'status' => 'done',
            'priority' => 'high',
            'progress_percent' => 100,
            'due_date' => now()->addDay()->toDateString(),
        ])->assertCreated();

        $this->getJson("/api/v1/projects/{$projectId}")
            ->assertOk()
            ->assertJsonPath('project.budget_total', '500000.00')
            ->assertJsonPath('project.progress_percent', 100);

        $this->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('kpis.total_projects', 1)
            ->assertJsonPath('kpis.active_projects', 1)
            ->assertJsonPath('kpis.budget_total', 500000)
            ->assertJsonPath('portfolio_cards.0.future_image_url', $project->future_image_url);
    }

    public function test_projects_generate_unique_codes_when_optional_fields_are_blank(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $first = $this->postJson('/api/v1/projects', [
            'branch_id' => $branch->id,
        ])->assertCreated();
        $second = $this->postJson('/api/v1/projects', [
            'branch_id' => $branch->id,
            'code' => '',
            'name' => '',
        ])->assertCreated();

        $firstCode = $first->json('project.code');
        $secondCode = $second->json('project.code');

        $this->assertMatchesRegularExpression('/^PRJ-\d{4}-\d{5}$/', $firstCode);
        $this->assertMatchesRegularExpression('/^PRJ-\d{4}-\d{5}$/', $secondCode);
        $this->assertNotSame($firstCode, $secondCode);
        $second->assertJsonPath('project.name', "New Project {$secondCode}");
    }

    public function test_admin_can_create_update_and_delete_users(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $role = Role::query()->create([
            'company_id' => $user->company_id,
            'name' => 'Site Engineer',
            'slug' => 'site-engineer',
            'permissions' => ['projects.manage'],
            'is_system' => true,
        ]);

        $managedUserId = $this->postJson('/api/v1/organization/users', [
            'name' => 'Managed User',
            'email' => 'managed.user@example.com',
            'password' => 'NavkwaBuild2026!',
            'branch_id' => $branch->id,
            'role_id' => $role->id,
            'permissions' => ['payroll.manage'],
        ])
            ->assertCreated()
            ->assertJsonPath('user.role.name', 'Site Engineer')
            ->assertJsonPath('user.permissions.0', 'payroll.manage')
            ->json('user.id');

        Sanctum::actingAs(User::query()->findOrFail($managedUserId));

        $this->getJson('/api/v1/people')->assertOk();
        $this->getJson('/api/v1/finance')->assertForbidden();

        Sanctum::actingAs($user);

        $this->patchJson("/api/v1/organization/users/{$managedUserId}", [
            'name' => 'Edited User',
            'email' => 'edited.user@example.com',
            'password' => 'NavkwaBuild2027!',
            'branch_id' => $branch->id,
            'role_id' => $user->role_id,
            'permissions' => ['projects.manage', 'reports.view'],
            'status' => 'inactive',
        ])
            ->assertOk()
            ->assertJsonPath('user.name', 'Edited User')
            ->assertJsonPath('user.permissions.0', 'projects.manage')
            ->assertJsonPath('user.status', 'inactive');

        $managedUser = User::query()->findOrFail($managedUserId);
        $this->assertTrue(Hash::check('NavkwaBuild2027!', $managedUser->password));
        $this->assertSame(['projects.manage', 'reports.view'], $managedUser->permissions);

        $this->deleteJson("/api/v1/organization/users/{$managedUserId}")
            ->assertOk()
            ->assertJsonPath('message', 'User deleted.');

        $this->assertDatabaseMissing('users', ['id' => $managedUserId]);
    }

    public function test_shared_module_indexes_accept_related_access_categories(): void
    {
        [, $branch, $company] = $this->tenantUser();

        $tenderRole = Role::query()->create([
            'company_id' => $company->id,
            'name' => 'Tender Manager',
            'slug' => 'tender-manager',
            'permissions' => ['tenders.manage'],
            'is_system' => true,
        ]);

        $safetyRole = Role::query()->create([
            'company_id' => $company->id,
            'name' => 'HSE Officer',
            'slug' => 'hse-officer',
            'permissions' => ['safety.manage'],
            'is_system' => true,
        ]);

        $tenderUser = User::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'role_id' => $tenderRole->id,
            'name' => 'Tender User',
            'email' => 'tender@example.com',
            'password' => 'NavkwaBuild2026!',
        ]);

        $safetyUser = User::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'role_id' => $safetyRole->id,
            'name' => 'Safety User',
            'email' => 'safety@example.com',
            'password' => 'NavkwaBuild2026!',
        ]);

        Sanctum::actingAs($tenderUser);
        $this->getJson('/api/v1/sales')->assertOk();

        Sanctum::actingAs($safetyUser);
        $this->getJson('/api/v1/compliance')->assertOk();
        $this->getJson('/api/v1/finance')->assertForbidden();
    }

    public function test_only_admin_can_edit_and_archive_projects_clients_suppliers_and_company(): void
    {
        [$admin, $branch, $company] = $this->tenantUser();

        $client = Client::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Restricted Client',
        ]);

        $supplier = Supplier::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Restricted Supplier',
        ]);

        $project = Project::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'client_id' => $client->id,
            'code' => 'PRJ-ADMIN-001',
            'name' => 'Admin Controlled Project',
        ]);

        $managerRole = Role::query()->create([
            'company_id' => $company->id,
            'name' => 'Operations Manager',
            'slug' => 'operations-manager',
            'permissions' => ['projects.manage', 'procurement.manage'],
            'is_system' => true,
        ]);

        $manager = User::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'role_id' => $managerRole->id,
            'name' => 'Operations User',
            'email' => 'operations@example.com',
            'password' => 'NavkwaBuild2026!',
        ]);

        Sanctum::actingAs($manager);

        $this->patchJson("/api/v1/projects/{$project->id}", ['name' => 'Blocked Project Edit'])->assertForbidden();
        $this->deleteJson("/api/v1/projects/{$project->id}")->assertForbidden();
        $this->patchJson('/api/v1/organization/company', ['name' => 'Blocked Company Edit'])->assertForbidden();
        $this->deleteJson('/api/v1/organization/company')->assertForbidden();
        $this->patchJson("/api/v1/organization/clients/{$client->id}", ['name' => 'Blocked Client Edit'])->assertForbidden();
        $this->deleteJson("/api/v1/organization/clients/{$client->id}")->assertForbidden();
        $this->patchJson("/api/v1/organization/suppliers/{$supplier->id}", ['name' => 'Blocked Supplier Edit'])->assertForbidden();
        $this->deleteJson("/api/v1/organization/suppliers/{$supplier->id}")->assertForbidden();

        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/projects/{$project->id}", ['name' => 'Admin Edited Project'])
            ->assertOk()
            ->assertJsonPath('project.name', 'Admin Edited Project');

        $this->patchJson("/api/v1/organization/clients/{$client->id}", ['name' => 'Admin Edited Client'])
            ->assertOk()
            ->assertJsonPath('client.name', 'Admin Edited Client');

        $this->patchJson("/api/v1/organization/suppliers/{$supplier->id}", ['name' => 'Admin Edited Supplier'])
            ->assertOk()
            ->assertJsonPath('supplier.name', 'Admin Edited Supplier');

        $this->patchJson('/api/v1/organization/company', [
            'settings' => ['appearance' => ['theme' => 'dark']],
        ])
            ->assertOk()
            ->assertJsonPath('company.settings.appearance.theme', 'dark');

        $this->assertSame('dark', Company::query()->findOrFail($company->id)->settings['appearance']['theme']);

        $this->deleteJson("/api/v1/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Project archived.');

        $this->deleteJson("/api/v1/organization/clients/{$client->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Client archived.');

        $this->deleteJson("/api/v1/organization/suppliers/{$supplier->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Supplier archived.');

        $this->deleteJson('/api/v1/organization/company')
            ->assertOk()
            ->assertJsonPath('message', 'Company archived.');

        $this->assertSoftDeleted('projects', ['id' => $project->id]);
        $this->assertSoftDeleted('clients', ['id' => $client->id]);
        $this->assertSoftDeleted('suppliers', ['id' => $supplier->id]);
        $this->assertSoftDeleted('companies', ['id' => $company->id]);
    }

    public function test_procurement_flow_updates_project_commitments_and_actuals(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $client = Client::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'name' => 'Harbour Estates',
        ]);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'client_id' => $client->id,
            'code' => 'PRJ-TST-001',
            'name' => 'Harbour Residences',
            'status' => 'active',
        ]);

        BudgetLine::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'cost_code' => 'S01',
            'description' => 'Rebar',
            'category' => 'materials',
            'budget_amount' => 120000,
            'forecast_amount' => 120000,
        ]);

        $supplier = Supplier::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'name' => 'Reliable Steel Ltd',
        ]);

        $requisitionId = $this->postJson("/api/v1/projects/{$project->id}/requisitions", [
            'title' => 'Batch A reinforcement steel',
            'requested_by_name' => 'Ama Procurement Officer',
            'department' => 'Procurement',
            'priority' => 'high',
            'lines' => [
                [
                    'supplier_id' => $supplier->id,
                    'description' => 'Y16 reinforcement bars',
                    'cost_code' => 'S01',
                    'quantity' => 30,
                    'unit' => 'tonnes',
                    'estimated_unit_cost' => 1500,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('requisition.total_estimated', '45000.00')
            ->json('requisition.id');

        $this->postJson("/api/v1/procurement/requisitions/{$requisitionId}/submit")->assertOk();

        $this->approveRequisitionThroughWorkflow($requisitionId);

        $purchaseOrderId = $this->postJson("/api/v1/procurement/requisitions/{$requisitionId}/convert-to-po", [
            'supplier_id' => $supplier->id,
        ])
            ->assertCreated()
            ->assertJsonPath('purchase_order.total_amount', '45000.00')
            ->json('purchase_order.id');

        $this->postJson("/api/v1/procurement/purchase-orders/{$purchaseOrderId}/transition", ['status' => 'issued'])->assertOk();
        $this->postJson("/api/v1/procurement/purchase-orders/{$purchaseOrderId}/transition", ['status' => 'approved'])->assertOk();

        $this->assertSame('45000.00', $project->fresh()->committed_total);
        $this->assertSame('0.00', $project->fresh()->actual_cost);

        $this->postJson("/api/v1/procurement/purchase-orders/{$purchaseOrderId}/transition", ['status' => 'delivered'])->assertOk();

        $this->assertSame('45000.00', $project->fresh()->actual_cost);
    }

    public function test_procurement_lifecycle_is_traceable_from_request_to_payment(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'code' => 'PRJ-PROC-001',
            'name' => 'Lifecycle Procurement Project',
            'status' => 'active',
        ]);

        $cementSupplier = Supplier::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'name' => 'Cement Supply Ltd',
        ]);

        $steelSupplier = Supplier::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'name' => 'Steel Supply Ltd',
        ]);

        $requisition = $this->postJson("/api/v1/projects/{$project->id}/requisitions", [
            'title' => 'Foundation concrete materials',
            'requested_by_name' => 'Kwesi Site Officer',
            'department' => 'Construction',
            'delivery_location' => 'Site A Warehouse',
            'purpose' => 'Foundation concrete works.',
            'priority' => 'critical',
            'required_by' => now()->addDays(3)->toDateString(),
            'lines' => [
                [
                    'item_name' => 'Cement',
                    'description' => 'Portland 50kg',
                    'cost_code' => 'CON-001',
                    'quantity' => 100,
                    'unit' => 'bags',
                    'estimated_unit_cost' => 80,
                    'tax_rate' => 5,
                ],
                [
                    'item_name' => 'Sand',
                    'description' => 'River sand',
                    'cost_code' => 'MAT-011',
                    'quantity' => 25,
                    'unit' => 'm3',
                    'estimated_unit_cost' => 350,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('requisition.requisition_number', fn (string $number) => str_starts_with($number, 'MR-'))
            ->assertJsonPath('requisition.requested_by_name', 'Kwesi Site Officer')
            ->assertJsonPath('requisition.grand_total', '17150.00')
            ->json('requisition');

        $this->postJson("/api/v1/procurement/requisitions/{$requisition['id']}/submit")->assertOk();
        $this->approveRequisitionThroughWorkflow($requisition['id']);

        $rfqId = $this->postJson("/api/v1/procurement/requisitions/{$requisition['id']}/rfqs", [
            'supplier_ids' => [$cementSupplier->id, $steelSupplier->id],
            'closing_date' => now()->addWeek()->toDateString(),
            'terms' => 'Quote inclusive of delivery to site.',
        ])
            ->assertCreated()
            ->assertJsonPath('rfq.rfq_number', fn (string $number) => str_starts_with($number, 'RFQ-'))
            ->assertJsonPath('rfq.status', 'sent')
            ->assertJsonCount(2, 'rfq.suppliers')
            ->json('rfq.id');

        $quotationId = $this->postJson("/api/v1/procurement/rfqs/{$rfqId}/quotations", [
            'supplier_id' => $cementSupplier->id,
            'supplier_reference' => 'SUP-QT-001',
            'lead_time_days' => 2,
            'payment_terms' => '30 days',
            'lines' => [
                [
                    'item_name' => 'Cement',
                    'description' => 'Portland 50kg',
                    'cost_code' => 'CON-001',
                    'quantity' => 100,
                    'unit' => 'bags',
                    'unit_price' => 78,
                    'tax_rate' => 5,
                ],
                [
                    'item_name' => 'Sand',
                    'description' => 'River sand',
                    'cost_code' => 'MAT-011',
                    'quantity' => 25,
                    'unit' => 'm3',
                    'unit_price' => 330,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('quotation.quotation_number', fn (string $number) => str_starts_with($number, 'QT-'))
            ->assertJsonPath('quotation.total_amount', '16440.00')
            ->json('quotation.id');

        $this->postJson("/api/v1/procurement/quotations/{$quotationId}/accept")
            ->assertOk()
            ->assertJsonPath('quotation.status', 'accepted');

        $purchaseOrderId = $this->postJson("/api/v1/procurement/quotations/{$quotationId}/purchase-order")
            ->assertCreated()
            ->assertJsonPath('purchase_order.po_number', fn (string $number) => str_starts_with($number, 'PO-'))
            ->assertJsonPath('purchase_order.total_amount', '16440.00')
            ->json('purchase_order.id');

        $this->postJson("/api/v1/procurement/purchase-orders/{$purchaseOrderId}/transition", ['status' => 'issued'])->assertOk();
        $this->postJson("/api/v1/procurement/purchase-orders/{$purchaseOrderId}/transition", ['status' => 'approved'])->assertOk();

        $goodsReceiptId = $this->postJson("/api/v1/procurement/purchase-orders/{$purchaseOrderId}/goods-receipts", [
            'delivery_note_number' => 'DN-001',
            'received_date' => now()->toDateString(),
            'notes' => 'Delivered to Site A Warehouse.',
        ])
            ->assertCreated()
            ->assertJsonPath('goods_receipt.grn_number', fn (string $number) => str_starts_with($number, 'GRN-'))
            ->assertJsonPath('goods_receipt.status', 'received')
            ->assertJsonCount(2, 'goods_receipt.lines')
            ->json('goods_receipt.id');

        $this->postJson("/api/v1/procurement/goods-receipts/{$goodsReceiptId}/quality-inspections", [
            'status' => 'passed',
            'result_summary' => 'Materials accepted for foundation works.',
        ])
            ->assertCreated()
            ->assertJsonPath('quality_inspection.inspection_number', fn (string $number) => str_starts_with($number, 'PQI-'))
            ->assertJsonPath('quality_inspection.status', 'passed');

        $invoiceId = $this->postJson("/api/v1/procurement/purchase-orders/{$purchaseOrderId}/supplier-invoices", [
            'goods_receipt_id' => $goodsReceiptId,
            'supplier_reference' => 'INV-CEM-001',
            'subtotal_amount' => 16050,
            'tax_amount' => 390,
        ])
            ->assertCreated()
            ->assertJsonPath('supplier_invoice.invoice_number', fn (string $number) => str_starts_with($number, 'SIN-'))
            ->assertJsonPath('supplier_invoice.total_amount', '16440.00')
            ->assertJsonPath('supplier_invoice.status', 'submitted')
            ->json('supplier_invoice.id');

        $this->postJson("/api/v1/procurement/supplier-invoices/{$invoiceId}/approve", [
            'decision' => 'approved',
        ])
            ->assertOk()
            ->assertJsonPath('supplier_invoice.status', 'finance_approved');

        $this->postJson("/api/v1/procurement/supplier-invoices/{$invoiceId}/payments", [
            'amount' => 16440,
            'method' => 'bank_transfer',
            'reference' => 'PAY-CEM-001',
        ])
            ->assertCreated()
            ->assertJsonPath('payment.payment_number', fn (string $number) => str_starts_with($number, 'SPY-'))
            ->assertJsonPath('payment.invoice.status', 'paid')
            ->assertJsonPath('payment.invoice.balance_due', '0.00');

        $this->postJson("/api/v1/suppliers/{$cementSupplier->id}/contracts", [
            'project_id' => $project->id,
            'title' => 'Cement supply framework',
            'contract_value' => 16440,
        ])
            ->assertCreated()
            ->assertJsonPath('contract.contract_number', fn (string $number) => str_starts_with($number, 'SC-'));

        $this->getJson('/api/v1/procurement')
            ->assertOk()
            ->assertJsonFragment([
                'material_request' => $requisition['requisition_number'],
                'invoice_status' => 'paid',
                'payment_status' => 'paid',
            ]);
    }

    public function test_document_uploads_and_drawing_revision_workflows_store_files(): void
    {
        Storage::fake('local');

        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'code' => 'PRJ-DOC-001',
            'name' => 'Documentation Test Project',
        ]);

        $documentPath = $this->post('/api/v1/documents', [
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'title' => 'Signed contract',
            'document_type' => 'contract',
            'file' => UploadedFile::fake()->create('contract.pdf', 128, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('document.version', 1)
            ->json('document.file_path');

        Storage::disk('local')->assertExists($documentPath);

        foreach ([
            ['type' => 'microsoft_excel', 'name' => 'quantity-takeoff.xlsx', 'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            ['type' => 'csv_import', 'name' => 'materials-import.csv', 'mime' => 'text/csv'],
            ['type' => 'autocad', 'name' => 'site-layout.dwg', 'mime' => 'application/octet-stream'],
        ] as $upload) {
            $path = $this->post('/api/v1/documents', [
                'branch_id' => $branch->id,
                'project_id' => $project->id,
                'title' => $upload['name'],
                'document_type' => $upload['type'],
                'file' => UploadedFile::fake()->create($upload['name'], 128, $upload['mime']),
            ], ['Accept' => 'application/json'])
                ->assertCreated()
                ->assertJsonPath('document.document_type', $upload['type'])
                ->json('document.file_path');

            Storage::disk('local')->assertExists($path);
        }

        $drawingId = $this->post('/api/v1/drawings', [
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'drawing_number' => 'A-101',
            'title' => 'Ground floor plan',
            'discipline' => 'architectural',
            'status' => 'issued_for_review',
            'revision_code' => 'P01',
            'file' => UploadedFile::fake()->create('A-101-P01.pdf', 256, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('drawing.current_revision', 'P01')
            ->json('drawing.id');

        $this->post("/api/v1/drawings/{$drawingId}/revisions", [
            'revision_code' => 'P02',
            'notes' => 'Updated room tags.',
            'file' => UploadedFile::fake()->create('A-101-P02.dxf', 256, 'application/dxf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('drawing.current_revision', 'P02');

        $this->postJson("/api/v1/drawings/{$drawingId}/transition", [
            'status' => 'approved_for_construction',
        ])
            ->assertOk()
            ->assertJsonPath('drawing.status', 'approved_for_construction');
    }

    private function tenantUser(): array
    {
        $company = Company::query()->create([
            'name' => 'Test Build Co',
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
            'name' => 'CEO',
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

    private function approveRequisitionThroughWorkflow(int $requisitionId): void
    {
        foreach (range(1, 5) as $step) {
            $response = $this->postJson("/api/v1/procurement/requisitions/{$requisitionId}/review", [
                'decision' => 'approved',
            ])->assertOk();

            if ($step < 5) {
                $response
                    ->assertJsonPath('requisition.status', 'submitted')
                    ->assertJsonPath('requisition.approval_progress.approved', $step);
            } else {
                $response
                    ->assertJsonPath('requisition.status', 'approved')
                    ->assertJsonPath('requisition.approval_progress.label', '5/5');
            }
        }
    }
}
