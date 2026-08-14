<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\BudgetLine;
use App\Models\Client;
use App\Models\Company;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\NonConformanceReport;
use App\Models\Project;
use App\Models\Role;
use App\Models\SafetyIncident;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NavkwaBuildPhaseFourApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_removed_module_api_surfaces_are_not_exposed(): void
    {
        [$user] = $this->tenantScenario();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/intelligence/analyze')->assertNotFound();
        $this->getJson('/api/v1/integrations')->assertNotFound();
        $this->getJson('/api/v1/localization')->assertNotFound();
    }

    public function test_business_intelligence_dashboards_and_metric_snapshots_work(): void
    {
        [$user] = $this->tenantScenario();
        Sanctum::actingAs($user);

        $dashboardId = $this->postJson('/api/v1/bi/dashboards', [
            'name' => 'Operations Intelligence',
            'audience' => 'operations',
            'refresh_interval' => 'hourly',
            'is_default' => true,
            'widgets' => [
                ['title' => 'Active Projects', 'widget_type' => 'metric', 'metric_key' => 'active_projects'],
                ['title' => 'Receivables', 'widget_type' => 'metric', 'metric_key' => 'accounts_receivable'],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('dashboard.audience', 'operations')
            ->assertJsonCount(2, 'dashboard.widgets')
            ->json('dashboard.id');

        $this->patchJson("/api/v1/bi/dashboards/{$dashboardId}", [
            'name' => 'Operations Intelligence Updated',
            'audience' => 'executive',
            'refresh_interval' => 'daily',
            'is_default' => true,
        ])
            ->assertOk()
            ->assertJsonPath('dashboard.name', 'Operations Intelligence Updated')
            ->assertJsonPath('dashboard.audience', 'executive');

        $this->postJson('/api/v1/bi/snapshots', [
            'period_label' => 'Phase 4 Test',
            'snapshot_date' => now()->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('snapshot.period_label', 'Phase 4 Test')
            ->assertJsonPath('snapshot.metrics.active_projects', 1);

        $this->getJson('/api/v1/bi')
            ->assertOk()
            ->assertJsonPath('metrics.active_projects', 1)
            ->assertJsonPath('meta.module_name', 'Navkwa Build Intelligence')
            ->assertJsonPath('dashboards.0.id', $dashboardId)
            ->assertJsonCount(1, 'datasets.cost_by_category')
            ->assertJsonStructure([
                'executive' => ['headline_scorecards', 'health_matrix', 'executive_actions'],
                'portfolio' => ['comparison', 'rankings'],
                'project_controls' => ['earned_value', 'cost_code_performance', 'delayed_activities'],
                'procurement' => ['kpis', 'funnel', 'supplier_scorecards'],
                'alerts' => ['items'],
            ]);

        $this->deleteJson("/api/v1/bi/dashboards/{$dashboardId}")
            ->assertOk()
            ->assertJsonPath('message', 'Dashboard archived.');
        $this->assertSoftDeleted('bi_dashboards', ['id' => $dashboardId]);
    }

    public function test_automation_rules_create_operational_insights(): void
    {
        [$user] = $this->tenantScenario();
        Sanctum::actingAs($user);

        $ruleId = $this->postJson('/api/v1/automation/rules', [
            'name' => 'Low stock action test',
            'rule_type' => 'low_stock',
            'trigger_event' => 'manual',
            'severity' => 'high',
            'actions' => [
                'type' => 'create_insight',
                'recommendation' => 'Expedite replenishment from approved supplier.',
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('rule.rule_type', 'low_stock')
            ->assertJsonPath('rule.version', 1)
            ->assertJsonPath('rule.workflow_definition.schema', 'navkwabuild.workflow.v1')
            ->json('rule.id');

        $this->getJson('/api/v1/automation/catalog')
            ->assertOk()
            ->assertJsonStructure(['modules', 'triggers', 'operators', 'actions', 'schedules', 'approval_modes']);

        $templateRuleId = $this->postJson('/api/v1/automation/templates/procurement_approval/instantiate', [
            'name' => 'High value procurement approval',
        ])
            ->assertCreated()
            ->assertJsonPath('rule.name', 'High value procurement approval')
            ->assertJsonPath('rule.status', 'draft')
            ->assertJsonPath('rule.is_active', false)
            ->json('rule.id');

        $this->assertDatabaseHas('automation_rule_versions', [
            'automation_rule_id' => $ruleId,
            'version' => 1,
        ]);

        $eventRuleId = $this->postJson('/api/v1/automation/rules', [
            'name' => 'Low stock event workflow',
            'rule_type' => 'low_stock',
            'trigger_event' => 'stock_low',
            'severity' => 'medium',
            'actions' => [
                'type' => 'create_insight',
                'recommendation' => 'Open a replenishment workflow.',
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('rule.trigger_event', 'stock_low')
            ->json('rule.id');

        $this->postJson('/api/v1/automation/triggers/stock_low', [
            'payload' => ['source' => 'feature_test'],
        ])
            ->assertOk()
            ->assertJsonCount(1, 'runs')
            ->assertJsonPath('runs.0.status', 'completed')
            ->assertJsonPath('runs.0.trigger_event', 'stock_low');

        $this->deleteJson("/api/v1/automation/rules/{$eventRuleId}")
            ->assertOk();

        $this->postJson("/api/v1/automation/rules/{$ruleId}/run")
            ->assertOk()
            ->assertJsonPath('run.status', 'completed')
            ->assertJsonPath('run.matched_count', 1)
            ->assertJsonPath('run.actions_executed', 1);

        $this->patchJson("/api/v1/automation/rules/{$ruleId}", [
            'name' => 'Low stock action test updated',
            'trigger_event' => 'daily',
            'severity' => 'critical',
        ])
            ->assertOk()
            ->assertJsonPath('rule.name', 'Low stock action test updated')
            ->assertJsonPath('rule.severity', 'critical')
            ->assertJsonPath('rule.version', 2);

        $this->assertDatabaseHas('automation_rule_versions', [
            'automation_rule_id' => $ruleId,
            'version' => 2,
        ]);

        $this->postJson("/api/v1/automation/rules/{$ruleId}/versions/1/rollback")
            ->assertOk()
            ->assertJsonPath('rule.name', 'Low stock action test')
            ->assertJsonPath('rule.version', 3);

        $this->assertDatabaseHas('ai_insights', [
            'company_id' => $user->company_id,
            'category' => 'automation',
            'severity' => 'high',
            'source' => 'workflow_automation',
        ]);

        $this->postJson('/api/v1/automation/run-active')
            ->assertOk()
            ->assertJsonCount(1, 'runs');

        $this->deleteJson("/api/v1/automation/rules/{$ruleId}")
            ->assertOk()
            ->assertJsonPath('message', 'Automation rule archived.');
        $this->assertSoftDeleted('automation_rules', ['id' => $ruleId]);
        $this->assertDatabaseHas('automation_rules', ['id' => $templateRuleId, 'status' => 'draft']);
    }

    public function test_automation_email_actions_create_notification_events(): void
    {
        config(['mail.default' => 'array']);
        Mail::purge('array');

        [$user] = $this->tenantScenario();
        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/notifications/settings', [
            'in_app_enabled' => true,
            'email_enabled' => true,
            'minimum_email_severity' => 'low',
            'default_channels' => ['in_app', 'email'],
            'retry_policy' => ['max_retries' => 3, 'on_failure' => 'notify_admin'],
        ])
            ->assertOk()
            ->assertJsonPath('settings.email_enabled', true)
            ->assertJsonPath('settings.retry_policy.max_retries', 3);

        $ruleId = $this->postJson('/api/v1/automation/rules', [
            'name' => 'Low stock email alert',
            'rule_type' => 'low_stock',
            'trigger_event' => 'manual',
            'module' => 'inventory',
            'severity' => 'high',
            'notification_config' => ['channels' => ['in_app', 'email']],
            'actions' => [
                'type' => 'send_email',
                'subject' => 'Low stock requires action',
                'message' => 'Stock is below reorder level.',
                'recipient_email' => $user->email,
            ],
        ])
            ->assertCreated()
            ->json('rule.id');

        $this->postJson("/api/v1/automation/rules/{$ruleId}/run")
            ->assertOk()
            ->assertJsonPath('run.status', 'completed')
            ->assertJsonPath('run.actions_executed', 1)
            ->assertJsonPath('run.action_results.0.type', 'send_email')
            ->assertJsonPath('run.action_results.0.delivery_status.email', 'sent');

        $notificationId = $this->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('summary.unread', 1)
            ->assertJsonPath('events.0.event_type', 'send_email')
            ->assertJsonPath('events.0.delivery_status.email', 'sent')
            ->json('events.0.id');

        $this->assertDatabaseHas('notification_events', [
            'company_id' => $user->company_id,
            'automation_rule_id' => $ruleId,
            'event_type' => 'send_email',
            'recipient_email' => $user->email,
            'status' => 'unread',
        ]);

        $this->postJson("/api/v1/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('notification.status', 'read');

        $this->postJson("/api/v1/notifications/{$notificationId}/acknowledge")
            ->assertOk()
            ->assertJsonPath('notification.status', 'acknowledged');
    }

    private function tenantScenario(): array
    {
        $company = Company::query()->create([
            'name' => 'Phase Four Build Co',
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

        $client = Client::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Phase Four Client',
        ]);

        $project = Project::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'client_id' => $client->id,
            'code' => 'PRJ-P4-001',
            'name' => 'Phase Four Risk Project',
            'status' => 'active',
            'health_status' => 'at_risk',
            'contract_value' => 900000,
            'budget_total' => 500000,
            'committed_total' => 210000,
            'actual_cost' => 260000,
            'forecast_to_complete' => 575000,
            'progress_percent' => 55,
        ]);

        BudgetLine::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'cost_code' => 'C01',
            'description' => 'Concrete works',
            'category' => 'materials',
            'budget_amount' => 500000,
            'committed_amount' => 210000,
            'actual_amount' => 260000,
            'forecast_amount' => 575000,
        ]);

        Invoice::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'client_id' => $client->id,
            'invoice_number' => 'INV-P4-001',
            'title' => 'Overdue interim certificate',
            'status' => 'issued',
            'issue_date' => now()->subMonth()->toDateString(),
            'due_date' => now()->subDays(5)->toDateString(),
            'currency' => 'GHS',
            'subtotal' => 125000,
            'tax_amount' => 0,
            'total_amount' => 125000,
            'amount_paid' => 25000,
            'balance_due' => 100000,
            'payment_status' => 'partial',
            'created_by' => $user->id,
        ]);

        InventoryItem::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'sku' => 'P4-CEM',
            'name' => 'Portland Cement',
            'category' => 'materials',
            'unit' => 'bag',
            'reorder_level' => 20,
            'average_cost' => 95,
            'quantity_on_hand' => 5,
            'status' => 'active',
        ]);

        NonConformanceReport::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'ncr_number' => 'NCR-P4-001',
            'title' => 'Honeycombing in shear wall',
            'severity' => 'high',
            'status' => 'open',
            'raised_by' => $user->id,
        ]);

        SafetyIncident::query()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'project_id' => $project->id,
            'incident_number' => 'HSE-P4-001',
            'incident_type' => 'near_miss',
            'severity' => 'medium',
            'status' => 'reported',
            'occurred_at' => now()->subDay(),
            'description' => 'Near miss during scaffold material handling.',
            'reported_by' => $user->id,
        ]);

        return [$user, $branch, $company, $project, $client];
    }

}
