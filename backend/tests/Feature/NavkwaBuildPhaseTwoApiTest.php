<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Drawing;
use App\Models\DrawingRevision;
use App\Models\Project;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NavkwaBuildPhaseTwoApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_sales_pipeline_tender_estimate_and_win_creates_project_budget(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $leadId = $this->postJson('/api/v1/sales/leads', [
            'branch_id' => $branch->id,
            'company_name' => 'Atlantic Schools Trust',
            'contact_name' => 'Client Lead',
            'email' => 'lead@example.com',
            'estimated_value' => 900000,
        ])
            ->assertCreated()
            ->assertJsonPath('lead.stage', 'new')
            ->json('lead.id');

        $opportunityId = $this->postJson("/api/v1/sales/leads/{$leadId}/qualify", [
            'name' => 'Atlantic Classroom Block',
            'scope' => 'Two-storey classroom block and external works.',
        ])
            ->assertCreated()
            ->assertJsonPath('opportunity.stage', 'qualified')
            ->json('opportunity.id');

        $tenderId = $this->postJson("/api/v1/sales/opportunities/{$opportunityId}/tenders", [
            'deadline_at' => now()->addWeeks(2)->toISOString(),
        ])
            ->assertCreated()
            ->assertJsonPath('tender.status', 'draft')
            ->json('tender.id');

        $estimateId = $this->postJson('/api/v1/sales/estimates', [
            'tender_id' => $tenderId,
            'title' => 'Atlantic base estimate',
            'overhead_percent' => 5,
            'profit_percent' => 10,
            'lines' => [
                [
                    'cost_code' => 'C01',
                    'description' => 'Concrete works',
                    'category' => 'materials',
                    'quantity' => 100,
                    'unit' => 'm3',
                    'unit_cost' => 500,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('estimate.subtotal', '50000.00')
            ->json('estimate.id');

        $this->postJson("/api/v1/sales/estimates/{$estimateId}/approve")->assertOk();
        $this->postJson("/api/v1/sales/tenders/{$tenderId}/submit")->assertOk();

        $projectId = $this->postJson("/api/v1/sales/tenders/{$tenderId}/win", [
            'estimate_id' => $estimateId,
            'project_name' => 'Atlantic Classroom Delivery',
        ])
            ->assertCreated()
            ->assertJsonPath('project.name', 'Atlantic Classroom Delivery')
            ->json('project.id');

        $this->assertDatabaseHas('budget_lines', [
            'project_id' => $projectId,
            'cost_code' => 'C01',
            'budget_amount' => 50000,
        ]);
    }

    public function test_direct_tender_management_records_rfis_documents_and_dashboard_work(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $tenderId = $this->postJson('/api/v1/sales/tenders', [
            'branch_id' => $branch->id,
            'client_name' => 'Volta Education Trust',
            'title' => 'Volta School Expansion Tender',
            'tender_type' => 'open_tender',
            'procurement_method' => 'competitive',
            'project_sector' => 'education',
            'project_category' => 'building',
            'project_location' => 'Ho',
            'deadline_at' => now()->addDays(10)->toISOString(),
            'expected_award_at' => now()->addMonth()->toISOString(),
            'value' => 6107500,
            'tender_fee' => 2500,
            'priority' => 'high',
            'confidentiality_level' => 'commercial_restricted',
            'scope_summary' => 'Classroom block expansion and external works.',
        ])
            ->assertCreated()
            ->assertJsonPath('tender.title', 'Volta School Expansion Tender')
            ->assertJsonPath('tender.tender_type', 'open_tender')
            ->assertJsonPath('tender.completion_percent', 31)
            ->json('tender.id');

        $recordId = $this->postJson("/api/v1/sales/tenders/{$tenderId}/records", [
            'record_type' => 'supplier_quote',
            'title' => 'Structural steel quotation',
            'status' => 'submitted',
            'priority' => 'high',
            'amount' => 450000,
            'notes' => 'Supplier quotation received for bid comparison.',
        ])
            ->assertCreated()
            ->assertJsonPath('record.record_type', 'supplier_quote')
            ->assertJsonPath('record.amount', '450000.00')
            ->json('record.id');

        $this->patchJson("/api/v1/sales/tender-records/{$recordId}", [
            'status' => 'completed',
        ])
            ->assertOk()
            ->assertJsonPath('record.status', 'completed');

        $this->postJson("/api/v1/sales/tenders/{$tenderId}/rfis", [
            'category' => 'scope',
            'question' => 'Please confirm whether furniture supply is included.',
            'submitted_to' => 'Client procurement team',
            'submitted_at' => now()->toISOString(),
            'due_at' => now()->addDays(3)->toISOString(),
            'internal_impact' => 'Commercial proposal may require an alternate item.',
            'cost_impact' => 120000,
            'schedule_impact_days' => 0,
        ])
            ->assertCreated()
            ->assertJsonPath('rfi.category', 'scope')
            ->assertJsonPath('rfi.status', 'submitted')
            ->assertJsonPath('rfi.rfi_number', fn (string $number): bool => str_starts_with($number, 'RFI-'));

        $this->postJson("/api/v1/sales/tenders/{$tenderId}/documents", [
            'title' => 'Invitation to Tender',
            'document_type' => 'invitation_to_tender',
            'version' => '1',
            'status' => 'approved',
            'is_mandatory' => true,
            'is_confidential' => false,
        ])
            ->assertCreated()
            ->assertJsonPath('document.is_mandatory', true)
            ->assertJsonPath('document.status', 'approved');

        $this->getJson('/api/v1/sales')
            ->assertOk()
            ->assertJsonPath('tendering.summary.active_tenders', 1)
            ->assertJsonPath('tendering.summary.active_value', 6107500)
            ->assertJsonPath('tendering.catalog.record_types.supplier_quote', 'Supplier quotation')
            ->assertJsonPath('tenders.0.records.0.record_type', 'activity_log');
    }

    public function test_inventory_stock_movements_and_supplier_reviews_work(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $warehouseId = $this->postJson('/api/v1/inventory/warehouses', [
            'branch_id' => $branch->id,
            'name' => 'Main Store',
        ])
            ->assertCreated()
            ->assertJsonPath('warehouse.code', 'MAI-000001')
            ->json('warehouse.id');

        $itemId = $this->postJson('/api/v1/inventory/items', [
            'name' => 'Cement Bag',
            'category' => 'Cement',
            'unit' => 'bag',
            'reorder_level' => 20,
            'average_cost' => 100,
        ])
            ->assertCreated()
            ->assertJsonPath('item.sku', 'CEM-000001')
            ->json('item.id');

        $this->postJson('/api/v1/inventory/movements', [
            'warehouse_id' => $warehouseId,
            'inventory_item_id' => $itemId,
            'type' => 'receipt',
            'quantity' => 100,
            'unit_cost' => 95,
            'reason' => 'Opening stock',
        ])->assertCreated();

        $this->postJson('/api/v1/inventory/movements', [
            'warehouse_id' => $warehouseId,
            'inventory_item_id' => $itemId,
            'type' => 'issue',
            'quantity' => 30,
            'unit_cost' => 95,
            'reason' => 'Issued to site',
        ])->assertCreated();

        $this->getJson('/api/v1/inventory')
            ->assertOk()
            ->assertJsonPath('items.0.quantity_on_hand', '70.00');

        $this->patchJson("/api/v1/inventory/items/{$itemId}", [
            'sku' => 'CEM-EDIT-001',
            'name' => 'Cement Bag 50kg',
        ])
            ->assertOk()
            ->assertJsonPath('item.sku', 'CEM-EDIT-001')
            ->assertJsonPath('item.name', 'Cement Bag 50kg');

        $supplier = Supplier::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'name' => 'Supply Partner',
        ]);

        $this->postJson("/api/v1/suppliers/{$supplier->id}/prices", [
            'inventory_item_id' => $itemId,
            'description' => 'Cement Bag',
            'unit_price' => 93,
        ])->assertCreated();

        $this->postJson("/api/v1/suppliers/{$supplier->id}/reviews", [
            'rating' => 5,
            'quality_score' => 5,
            'delivery_score' => 4,
            'cost_score' => 5,
        ])->assertCreated();

        $this->assertSame(5, $supplier->fresh()->rating);

        $this->deleteJson("/api/v1/inventory/items/{$itemId}")
            ->assertOk()
            ->assertJsonPath('message', 'Inventory item archived.');
        $this->assertSoftDeleted('inventory_items', ['id' => $itemId]);
    }

    public function test_field_daily_reports_issues_and_attendance_work(): void
    {
        Storage::fake('local');

        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $project = Project::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'code' => 'PRJ-FLD-001',
            'name' => 'Field Test Project',
        ]);

        $reportId = $this->postJson("/api/v1/projects/{$project->id}/daily-reports", [
            'report_date' => now()->toDateString(),
            'weather' => 'Sunny',
            'labour_count' => 24,
            'progress_notes' => 'Excavation complete.',
        ])
            ->assertCreated()
            ->assertJsonPath('daily_report.status', 'draft')
            ->json('daily_report.id');

        $this->postJson("/api/v1/field/daily-reports/{$reportId}/transition", ['status' => 'submitted'])->assertOk();
        $this->postJson("/api/v1/field/daily-reports/{$reportId}/transition", ['status' => 'approved'])->assertOk();

        $issueId = $this->post("/api/v1/projects/{$project->id}/field-issues", [
            'title' => 'Unsafe edge protection',
            'category' => 'safety',
            'severity' => 'high',
            'photo' => UploadedFile::fake()->image('issue.jpg'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('issue.id');

        $this->patchJson("/api/v1/field/issues/{$issueId}", ['status' => 'resolved'])
            ->assertOk()
            ->assertJsonPath('issue.status', 'resolved');

        $this->deleteJson("/api/v1/field/issues/{$issueId}")
            ->assertOk()
            ->assertJsonPath('message', 'Site issue archived.');
        $this->assertSoftDeleted('field_issues', ['id' => $issueId]);

        $attendanceId = $this->post('/api/v1/attendance/clock-in', [
            'project_id' => $project->id,
            'clock_in_latitude' => 5.5,
            'clock_in_longitude' => -0.1,
            'face' => UploadedFile::fake()->image('face-in.jpg'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('attendance.status', 'open')
            ->json('attendance.id');

        $this->post("/api/v1/attendance/{$attendanceId}/clock-out", [
            'clock_out_latitude' => 5.5,
            'clock_out_longitude' => -0.1,
            'face' => UploadedFile::fake()->image('face-out.jpg'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('attendance.status', 'closed');
    }

    public function test_drawing_markups_and_reviews_update_approval_state(): void
    {
        [$user, $branch] = $this->tenantUser();
        Sanctum::actingAs($user);

        $drawing = Drawing::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $branch->id,
            'drawing_number' => 'A-200',
            'title' => 'Elevation',
            'discipline' => 'architectural',
            'status' => 'issued_for_review',
            'current_revision' => 'P01',
        ]);

        DrawingRevision::query()->create([
            'company_id' => $user->company_id,
            'drawing_id' => $drawing->id,
            'revision_code' => 'P01',
            'status' => 'issued_for_review',
            'issued_at' => now(),
        ]);

        $markupId = $this->postJson("/api/v1/drawings/{$drawing->id}/markups", [
            'markup_type' => 'pin',
            'x' => 0.25,
            'y' => 0.4,
            'comment' => 'Revise window head detail.',
        ])
            ->assertCreated()
            ->json('markup.id');

        $this->postJson("/api/v1/drawing-markups/{$markupId}/resolve")
            ->assertOk()
            ->assertJsonPath('markup.status', 'resolved');

        $this->postJson("/api/v1/drawings/{$drawing->id}/reviews", [
            'decision' => 'approved',
            'comments' => 'Approved for construction.',
        ])
            ->assertCreated()
            ->assertJsonPath('drawing.status', 'approved_for_construction');
    }

    private function tenantUser(): array
    {
        $company = Company::query()->create([
            'name' => 'Phase Two Build Co',
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
