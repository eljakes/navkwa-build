<?php

namespace App\Http\Controllers\Api;

use App\Models\Branch;
use App\Models\Drawing;
use App\Models\DrawingMarkup;
use App\Models\DrawingReview;
use App\Models\DrawingRevision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DrawingController extends ApiController
{
    private const DRAWING_FILE_EXTENSIONS = 'pdf,dwg,dxf';

    public function index(Request $request): JsonResponse
    {
        $drawings = Drawing::query()
            ->forCompany($this->companyId($request))
            ->with(['project:id,code,name', 'revisions' => fn ($query) => $query->latest()])
            ->when($request->query('branch_id'), fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($request->query('project_id'), fn ($query, $projectId) => $query->where('project_id', $projectId))
            ->when($request->query('discipline'), fn ($query, $discipline) => $query->where('discipline', $discipline))
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('search'), function ($query, $search): void {
                $query->where(function ($nested) use ($search): void {
                    $nested->where('title', 'like', "%{$search}%")
                        ->orWhere('drawing_number', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate((int) $request->query('per_page', 30));

        return response()->json($drawings);
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'drawing_number' => ['nullable', 'string', 'max:80'],
            'title' => ['required', 'string', 'max:255'],
            'discipline' => ['required', Rule::in(['architectural', 'structural', 'mep', 'landscape', 'interiors', 'civil', 'other'])],
            'status' => ['nullable', Rule::in(['draft', 'issued_for_review', 'approved_for_construction', 'superseded'])],
            'revision_code' => ['nullable', 'string', 'max:24'],
            'description' => ['nullable', 'string', 'max:4000'],
            'tags' => ['nullable', 'array'],
            'linked_records' => ['nullable', 'array'],
            'file' => ['nullable', 'file', 'max:102400', 'extensions:'.self::DRAWING_FILE_EXTENSIONS],
        ]);

        $projectId = $data['project_id'] ?? null;
        $branchId = $data['branch_id'] ?? $this->user($request)->branch_id;

        if ($projectId) {
            $project = $this->projectForTenant($request, $projectId);
            $branchId = $project->branch_id;
        } else {
            Branch::query()->forCompany($companyId)->whereKey($branchId)->firstOrFail();
        }

        $drawingNumber = $this->suppliedCode($data['drawing_number'] ?? null)
            ?? $this->nextCompanyCode($this->codePrefix($data['discipline'], 'DRG'), Drawing::class, 'drawing_number', $companyId);

        abort_if(
            Drawing::query()
                ->forCompany($companyId)
                ->where('project_id', $projectId)
                ->where('drawing_number', $drawingNumber)
                ->exists(),
            422,
            'Drawing number already exists for this project.',
        );

        $drawing = DB::transaction(function () use ($request, $data, $companyId, $branchId, $projectId, $drawingNumber) {
            $revisionCode = strtoupper($data['revision_code'] ?? 'P01');

            $drawing = Drawing::query()->create([
                'company_id' => $companyId,
                'branch_id' => $branchId,
                'project_id' => $projectId,
                'uploaded_by' => $this->user($request)->id,
                'drawing_number' => $drawingNumber,
                'title' => $data['title'],
                'discipline' => $data['discipline'],
                'status' => $data['status'] ?? 'draft',
                'current_revision' => $revisionCode,
                'description' => $data['description'] ?? null,
                'tags' => $data['tags'] ?? [],
                'linked_records' => $data['linked_records'] ?? [],
            ]);

            DrawingRevision::query()->create([
                'company_id' => $companyId,
                'drawing_id' => $drawing->id,
                'uploaded_by' => $this->user($request)->id,
                'revision_code' => $revisionCode,
                'status' => $drawing->status === 'draft' ? 'draft' : 'issued_for_review',
                'issued_at' => now(),
                ...$this->storeUploadedFile($request, $companyId, $branchId, $projectId),
            ]);

            return $drawing;
        });

        $this->publishAutomationEvent($request, 'document_uploaded', [
            'record_type' => 'drawing',
            'record_id' => $drawing->id,
        ]);

        return response()->json(['drawing' => $drawing->load(['project', 'revisions'])], 201);
    }

    public function revise(Request $request, Drawing $drawing): JsonResponse
    {
        $this->assertTenant($request, $drawing);

        $data = $request->validate([
            'revision_code' => ['nullable', 'string', 'max:24'],
            'status' => ['nullable', Rule::in(['draft', 'issued_for_review', 'approved_for_construction'])],
            'notes' => ['nullable', 'string', 'max:4000'],
            'file' => ['nullable', 'file', 'max:102400', 'extensions:'.self::DRAWING_FILE_EXTENSIONS],
        ]);

        $revisionCode = $this->suppliedCode($data['revision_code'] ?? null) ?? $this->nextRevisionCode($drawing);

        abort_if($drawing->revisions()->where('revision_code', $revisionCode)->exists(), 422, 'Revision code already exists for this drawing.');

        $revision = DB::transaction(function () use ($request, $drawing, $data, $revisionCode) {
            $drawing->revisions()
                ->whereNull('superseded_at')
                ->where('revision_code', '!=', $revisionCode)
                ->update([
                    'status' => 'superseded',
                    'superseded_at' => now(),
                ]);

            $revision = DrawingRevision::query()->create([
                'company_id' => $drawing->company_id,
                'drawing_id' => $drawing->id,
                'uploaded_by' => $this->user($request)->id,
                'revision_code' => $revisionCode,
                'status' => $data['status'] ?? 'issued_for_review',
                'notes' => $data['notes'] ?? null,
                'issued_at' => now(),
                ...$this->storeUploadedFile($request, $drawing->company_id, $drawing->branch_id, $drawing->project_id),
            ]);

            $drawing->update([
                'current_revision' => $revisionCode,
                'status' => $data['status'] ?? 'issued_for_review',
            ]);

            return $revision;
        });

        return response()->json(['revision' => $revision, 'drawing' => $drawing->fresh('revisions')], 201);
    }

    public function transition(Request $request, Drawing $drawing): JsonResponse
    {
        $this->assertTenant($request, $drawing);

        $data = $request->validate([
            'status' => ['required', Rule::in(['draft', 'issued_for_review', 'approved_for_construction', 'superseded'])],
        ]);

        $allowed = [
            'draft' => ['issued_for_review', 'superseded'],
            'issued_for_review' => ['approved_for_construction', 'draft', 'superseded'],
            'approved_for_construction' => ['superseded'],
            'superseded' => [],
        ];

        abort_if(! in_array($data['status'], $allowed[$drawing->status] ?? [], true), 422, 'Invalid drawing status transition.');

        $drawing->update(['status' => $data['status']]);
        $currentRevision = $drawing->revisions()
            ->where('revision_code', $drawing->current_revision)
            ->latest()
            ->first();

        $currentRevision?->update(['status' => $data['status']]);

        return response()->json(['drawing' => $drawing->fresh('revisions')]);
    }

    public function downloadRevision(Request $request, DrawingRevision $revision): StreamedResponse|JsonResponse
    {
        abort_if($revision->company_id !== $this->companyId($request), 404);
        abort_if(! $revision->file_path || ! Storage::disk('local')->exists($revision->file_path), 404, 'Drawing revision file was not found.');

        return Storage::disk('local')->download($revision->file_path, $revision->original_filename);
    }

    public function storeMarkup(Request $request, Drawing $drawing): JsonResponse
    {
        $this->assertTenant($request, $drawing);

        $data = $request->validate([
            'drawing_revision_id' => ['nullable', 'integer'],
            'markup_type' => ['nullable', Rule::in(['comment', 'cloud', 'dimension', 'pin', 'area'])],
            'x' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'y' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'width' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'height' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'comment' => ['required', 'string', 'max:4000'],
        ]);

        $revisionId = $data['drawing_revision_id'] ?? $drawing->revisions()->where('revision_code', $drawing->current_revision)->latest()->value('id');

        if ($revisionId) {
            DrawingRevision::query()
                ->where('company_id', $drawing->company_id)
                ->where('drawing_id', $drawing->id)
                ->whereKey($revisionId)
                ->firstOrFail();
        }

        $markup = DrawingMarkup::query()->create([
            'company_id' => $drawing->company_id,
            'drawing_id' => $drawing->id,
            'drawing_revision_id' => $revisionId,
            'author_id' => $this->user($request)->id,
            'markup_type' => $data['markup_type'] ?? 'comment',
            'x' => $data['x'] ?? 0,
            'y' => $data['y'] ?? 0,
            'width' => $data['width'] ?? null,
            'height' => $data['height'] ?? null,
            'comment' => $data['comment'],
        ]);

        return response()->json(['markup' => $markup], 201);
    }

    public function resolveMarkup(Request $request, DrawingMarkup $markup): JsonResponse
    {
        abort_if($markup->company_id !== $this->companyId($request), 404);

        $markup->update([
            'status' => 'resolved',
            'resolved_by' => $this->user($request)->id,
            'resolved_at' => now(),
        ]);

        return response()->json(['markup' => $markup->fresh()]);
    }

    public function storeReview(Request $request, Drawing $drawing): JsonResponse
    {
        $this->assertTenant($request, $drawing);

        $data = $request->validate([
            'drawing_revision_id' => ['nullable', 'integer'],
            'decision' => ['required', Rule::in(['approved', 'changes_required', 'rejected'])],
            'comments' => ['nullable', 'string', 'max:4000'],
        ]);

        $revision = null;

        if (! empty($data['drawing_revision_id'])) {
            $revision = DrawingRevision::query()
                ->where('company_id', $drawing->company_id)
                ->where('drawing_id', $drawing->id)
                ->whereKey($data['drawing_revision_id'])
                ->firstOrFail();
        } else {
            $revision = $drawing->revisions()->where('revision_code', $drawing->current_revision)->latest()->first();
        }

        $review = DrawingReview::query()->create([
            'company_id' => $drawing->company_id,
            'drawing_id' => $drawing->id,
            'drawing_revision_id' => $revision?->id,
            'reviewer_id' => $this->user($request)->id,
            'decision' => $data['decision'],
            'comments' => $data['comments'] ?? null,
            'reviewed_at' => now(),
        ]);

        $status = match ($data['decision']) {
            'approved' => 'approved_for_construction',
            'changes_required' => 'issued_for_review',
            'rejected' => 'draft',
        };

        $drawing->update(['status' => $status]);
        $revision?->update(['status' => $status]);

        return response()->json(['review' => $review, 'drawing' => $drawing->fresh(['revisions', 'markups', 'reviews'])], 201);
    }

    private function storeUploadedFile(Request $request, int $companyId, ?int $branchId, ?int $projectId): array
    {
        if (! $request->hasFile('file')) {
            return [];
        }

        $file = $request->file('file');
        $path = $file->store("navkwabuild/companies/{$companyId}/branches/{$branchId}/drawings/".($projectId ?: 'shared'), 'local');

        return [
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
        ];
    }

    private function assertTenant(Request $request, Drawing $drawing): void
    {
        abort_if($drawing->company_id !== $this->companyId($request), 404);
    }

    private function nextRevisionCode(Drawing $drawing): string
    {
        $next = $drawing->revisions()->count() + 1;

        do {
            $revisionCode = sprintf('P%02d', $next);
            $exists = $drawing->revisions()->where('revision_code', $revisionCode)->exists();
            $next++;
        } while ($exists);

        return $revisionCode;
    }
}
