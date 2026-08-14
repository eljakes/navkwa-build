<?php

namespace App\Http\Controllers\Api;

use App\Models\Branch;
use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends ApiController
{
    private const DOCUMENT_TYPES = [
        'general',
        'contract',
        'invoice',
        'photo',
        'video',
        'correspondence',
        'hr',
        'policy',
        'quality',
        'safety',
        'microsoft_excel',
        'autocad',
        'pdf_drawing',
        'csv_import',
        'finance_workbook',
    ];

    private const DOCUMENT_FILE_EXTENSIONS = 'pdf,doc,docx,xls,xlsx,xlsm,csv,dwg,dxf,jpg,jpeg,png,webp';

    public function index(Request $request): JsonResponse
    {
        $documents = Document::query()
            ->forCompany($this->companyId($request))
            ->with(['branch:id,name,code', 'project:id,code,name'])
            ->when($request->query('branch_id'), fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($request->query('project_id'), fn ($query, $projectId) => $query->where('project_id', $projectId))
            ->when($request->query('document_type'), fn ($query, $type) => $query->where('document_type', $type))
            ->when($request->query('scope'), fn ($query, $scope) => $query->where('repository_scope', $scope))
            ->when($request->query('search'), function ($query, $search): void {
                $query->where(function ($nested) use ($search): void {
                    $nested->where('title', 'like', "%{$search}%")
                        ->orWhere('document_number', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate((int) $request->query('per_page', 30));

        return response()->json($documents);
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'document_type' => ['nullable', Rule::in(self::DOCUMENT_TYPES)],
            'repository_scope' => ['nullable', Rule::in(['company', 'branch', 'project'])],
            'folder' => ['nullable', 'string', 'max:255'],
            'tags' => ['nullable', 'array'],
            'description' => ['nullable', 'string', 'max:4000'],
            'file' => ['nullable', 'file', 'max:51200', 'extensions:'.self::DOCUMENT_FILE_EXTENSIONS],
        ]);

        $branchId = $data['branch_id'] ?? $this->user($request)->branch_id;
        $projectId = $data['project_id'] ?? null;

        if ($branchId) {
            Branch::query()->forCompany($companyId)->whereKey($branchId)->firstOrFail();
        }

        if ($projectId) {
            $project = $this->projectForTenant($request, $projectId);
            $branchId = $project->branch_id;
        }

        $filePayload = $this->storeUploadedFile($request, 'file', $companyId, $branchId, $projectId);

        $document = Document::query()->create([
            'company_id' => $companyId,
            'branch_id' => $branchId,
            'project_id' => $projectId,
            'uploaded_by' => $this->user($request)->id,
            'document_number' => $this->nextNumber('DOC', Document::class, 'document_number', $companyId),
            'title' => $data['title'],
            'document_type' => $data['document_type'] ?? 'general',
            'repository_scope' => $data['repository_scope'] ?? ($projectId ? 'project' : ($branchId ? 'branch' : 'company')),
            'folder' => $data['folder'] ?? '/',
            'version' => 1,
            'tags' => $data['tags'] ?? [],
            'description' => $data['description'] ?? null,
            ...$filePayload,
        ]);

        $this->publishAutomationEvent($request, 'document_uploaded', [
            'record_type' => 'document',
            'record_id' => $document->id,
        ]);

        return response()->json(['document' => $document->load(['branch', 'project'])], 201);
    }

    public function update(Request $request, Document $document): JsonResponse
    {
        $this->assertTenant($request, $document);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'document_type' => ['sometimes', Rule::in(self::DOCUMENT_TYPES)],
            'repository_scope' => ['sometimes', Rule::in(['company', 'branch', 'project'])],
            'folder' => ['nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in(['active', 'under_review', 'approved', 'archived'])],
            'tags' => ['nullable', 'array'],
            'description' => ['nullable', 'string', 'max:4000'],
            'file' => ['nullable', 'file', 'max:51200', 'extensions:'.self::DOCUMENT_FILE_EXTENSIONS],
        ]);

        $filePayload = [];

        if ($request->hasFile('file')) {
            $filePayload = [
                ...$this->storeUploadedFile($request, 'file', $document->company_id, $document->branch_id, $document->project_id),
                'version' => $document->version + 1,
            ];
        }

        $document->update([
            ...collect($data)->except('file')->all(),
            ...$filePayload,
        ]);

        return response()->json(['document' => $document->fresh(['branch', 'project'])]);
    }

    public function download(Request $request, Document $document): StreamedResponse|JsonResponse
    {
        $this->assertTenant($request, $document);

        abort_if(! $document->file_path || ! Storage::disk('local')->exists($document->file_path), 404, 'Document file was not found.');

        return Storage::disk('local')->download($document->file_path, $document->original_filename);
    }

    public function destroy(Request $request, Document $document): JsonResponse
    {
        $this->assertTenant($request, $document);
        $document->delete();

        return response()->json(['message' => 'Document archived.']);
    }

    private function storeUploadedFile(Request $request, string $field, int $companyId, ?int $branchId, ?int $projectId): array
    {
        if (! $request->hasFile($field)) {
            return [];
        }

        $file = $request->file($field);
        $path = $file->store("navkwabuild/companies/{$companyId}/branches/".($branchId ?: 'company').'/projects/'.($projectId ?: 'shared'), 'local');

        return [
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
        ];
    }

    private function assertTenant(Request $request, Document $document): void
    {
        abort_if($document->company_id !== $this->companyId($request), 404);
    }
}
