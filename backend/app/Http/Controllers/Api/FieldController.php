<?php

namespace App\Http\Controllers\Api;

use App\Models\AttendanceRecord;
use App\Models\FieldDailyReport;
use App\Models\FieldIssue;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class FieldController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        return response()->json([
            'daily_reports' => FieldDailyReport::query()
                ->forCompany($companyId)
                ->with(['project:id,code,name', 'issues'])
                ->latest('report_date')
                ->limit(80)
                ->get(),
            'issues' => FieldIssue::query()
                ->forCompany($companyId)
                ->with('project:id,code,name')
                ->latest()
                ->limit(100)
                ->get(),
            'attendance' => AttendanceRecord::query()
                ->forCompany($companyId)
                ->with(['user:id,name,email'])
                ->latest('clock_in_at')
                ->limit(100)
                ->get(),
            'open_attendance' => AttendanceRecord::query()
                ->forCompany($companyId)
                ->where('user_id', $this->user($request)->id)
                ->where('status', 'open')
                ->latest('clock_in_at')
                ->first(),
        ]);
    }

    public function storeDailyReport(Request $request, int $project): JsonResponse
    {
        $projectModel = $this->projectForTenant($request, $project);

        $data = $request->validate([
            'report_date' => ['required', 'date'],
            'weather' => ['nullable', 'string', 'max:120'],
            'shift' => ['nullable', Rule::in(['day', 'night'])],
            'labour_count' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'equipment_notes' => ['nullable', 'string', 'max:4000'],
            'progress_notes' => ['nullable', 'string', 'max:4000'],
            'safety_notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $report = FieldDailyReport::query()->create([
            'company_id' => $projectModel->company_id,
            'branch_id' => $projectModel->branch_id,
            'project_id' => $projectModel->id,
            'report_number' => $this->nextNumber('DR', FieldDailyReport::class, 'report_number', $projectModel->company_id),
            'shift' => $data['shift'] ?? 'day',
            'status' => 'draft',
            'submitted_by' => $this->user($request)->id,
            ...$data,
        ]);

        return response()->json(['daily_report' => $report->load('project')], 201);
    }

    public function transitionDailyReport(Request $request, FieldDailyReport $dailyReport): JsonResponse
    {
        $this->assertTenant($request, $dailyReport);

        $data = $request->validate([
            'status' => ['required', Rule::in(['submitted', 'approved'])],
        ]);

        $allowed = [
            'draft' => ['submitted'],
            'submitted' => ['approved'],
            'approved' => [],
        ];

        abort_if(! in_array($data['status'], $allowed[$dailyReport->status] ?? [], true), 422, 'Invalid daily report transition.');

        $updates = ['status' => $data['status']];

        if ($data['status'] === 'submitted') {
            $updates['submitted_by'] = $this->user($request)->id;
            $updates['submitted_at'] = now();
        }

        if ($data['status'] === 'approved') {
            $updates['approved_by'] = $this->user($request)->id;
            $updates['approved_at'] = now();
        }

        $dailyReport->update($updates);

        if ($data['status'] === 'submitted') {
            $this->publishAutomationEvent($request, 'daily_report_submitted', [
                'record_type' => 'daily_report',
                'record_id' => $dailyReport->id,
            ]);
        }

        return response()->json(['daily_report' => $dailyReport->fresh(['project', 'issues'])]);
    }

    public function storeIssue(Request $request, int $project): JsonResponse
    {
        $projectModel = $this->projectForTenant($request, $project);

        $data = $request->validate([
            'field_daily_report_id' => ['nullable', 'integer'],
            'assigned_to' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:4000'],
            'category' => ['nullable', Rule::in(['quality', 'safety', 'blocker', 'material', 'labour', 'design'])],
            'severity' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
            'gps_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'gps_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'due_date' => ['nullable', 'date'],
            'photo' => ['nullable', 'file', 'max:20480'],
        ]);

        $photoPath = null;

        if ($request->hasFile('photo')) {
            $photoPath = $request->file('photo')->store("navkwabuild/companies/{$projectModel->company_id}/field/issues", 'local');
        }

        $issue = FieldIssue::query()->create([
            'company_id' => $projectModel->company_id,
            'branch_id' => $projectModel->branch_id,
            'project_id' => $projectModel->id,
            'reported_by' => $this->user($request)->id,
            'category' => $data['category'] ?? 'blocker',
            'severity' => $data['severity'] ?? 'medium',
            'photo_path' => $photoPath,
            ...collect($data)->except('photo')->all(),
        ]);

        return response()->json(['issue' => $issue->load('project')], 201);
    }

    public function updateIssue(Request $request, FieldIssue $issue): JsonResponse
    {
        $this->assertTenant($request, $issue);

        $data = $request->validate([
            'assigned_to' => ['nullable', 'integer'],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:4000'],
            'category' => ['sometimes', Rule::in(['quality', 'safety', 'blocker', 'material', 'labour', 'design'])],
            'severity' => ['sometimes', Rule::in(['low', 'medium', 'high', 'critical'])],
            'status' => ['sometimes', Rule::in(['open', 'in_progress', 'resolved', 'closed'])],
            'due_date' => ['nullable', 'date'],
        ]);

        if (($data['status'] ?? $issue->status) === 'resolved' && ! $issue->resolved_at) {
            $data['resolved_at'] = now();
        }

        $issue->update($data);

        return response()->json(['issue' => $issue->fresh('project')]);
    }

    public function destroyIssue(Request $request, FieldIssue $issue): JsonResponse
    {
        $this->assertTenant($request, $issue);

        $issue->delete();

        return response()->json(['message' => 'Site issue archived.']);
    }

    public function clockIn(Request $request): JsonResponse
    {
        $user = $this->user($request);

        abort_if(
            AttendanceRecord::query()->where('company_id', $user->company_id)->where('user_id', $user->id)->where('status', 'open')->exists(),
            422,
            'You already have an open attendance record.',
        );

        $data = $request->validate([
            'project_id' => ['nullable', 'integer'],
            'clock_in_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'clock_in_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'face' => ['nullable', 'file', 'max:10240'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $project = null;
        if (! empty($data['project_id'])) {
            $project = Project::query()->forCompany($user->company_id)->whereKey($data['project_id'])->firstOrFail();
        }

        $facePath = null;
        if ($request->hasFile('face')) {
            $facePath = $request->file('face')->store("navkwabuild/companies/{$user->company_id}/attendance", 'local');
        }

        $record = AttendanceRecord::query()->create([
            'company_id' => $user->company_id,
            'branch_id' => $project?->branch_id ?? $user->branch_id,
            'project_id' => $project?->id,
            'user_id' => $user->id,
            'clock_in_at' => now(),
            'face_in_path' => $facePath,
            'status' => 'open',
            ...collect($data)->except('face')->all(),
        ]);

        return response()->json(['attendance' => $record->load('user')], 201);
    }

    public function clockOut(Request $request, AttendanceRecord $attendance): JsonResponse
    {
        $this->assertTenant($request, $attendance);
        abort_if($attendance->user_id !== $this->user($request)->id && ! $this->user($request)->hasPermission('attendance.manage'), 403);
        abort_if($attendance->status !== 'open', 422, 'Attendance record is already closed.');

        $data = $request->validate([
            'clock_out_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'clock_out_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'face' => ['nullable', 'file', 'max:10240'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $facePath = null;
        if ($request->hasFile('face')) {
            $facePath = $request->file('face')->store("navkwabuild/companies/{$attendance->company_id}/attendance", 'local');
        }

        $clockOut = now();

        $attendance->update([
            'clock_out_at' => $clockOut,
            'clock_out_latitude' => $data['clock_out_latitude'] ?? null,
            'clock_out_longitude' => $data['clock_out_longitude'] ?? null,
            'face_out_path' => $facePath,
            'status' => 'closed',
            'total_minutes' => max(0, $attendance->clock_in_at->diffInMinutes($clockOut)),
            'notes' => $data['notes'] ?? $attendance->notes,
        ]);

        return response()->json(['attendance' => $attendance->fresh('user')]);
    }

    public function downloadIssuePhoto(Request $request, FieldIssue $issue)
    {
        $this->assertTenant($request, $issue);

        abort_if(! $issue->photo_path || ! Storage::disk('local')->exists($issue->photo_path), 404, 'Issue photo was not found.');

        return Storage::disk('local')->download($issue->photo_path);
    }

    private function assertTenant(Request $request, object $model): void
    {
        abort_if((int) $model->company_id !== $this->companyId($request), 404);
    }
}
