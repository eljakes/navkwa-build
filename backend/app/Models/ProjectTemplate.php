<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectTemplate extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'source_project_id',
        'name',
        'description',
        'template_data',
        'created_by',
    ];

    protected function casts(): array
    {
        return ['template_data' => 'array'];
    }

    public function sourceProject(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'source_project_id')->withTrashed();
    }
}
