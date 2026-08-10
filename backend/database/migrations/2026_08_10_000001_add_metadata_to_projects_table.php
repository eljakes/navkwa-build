<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            if (! Schema::hasColumn('projects', 'metadata')) {
                $table->json('metadata')->nullable()->after('actual_end_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            if (Schema::hasColumn('projects', 'metadata')) {
                $table->dropColumn('metadata');
            }
        });
    }
};
