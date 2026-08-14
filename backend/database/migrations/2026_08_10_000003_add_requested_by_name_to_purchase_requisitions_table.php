<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table): void {
            if (! Schema::hasColumn('purchase_requisitions', 'requested_by_name')) {
                $table->string('requested_by_name')->nullable()->after('justification');
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table): void {
            if (Schema::hasColumn('purchase_requisitions', 'requested_by_name')) {
                $table->dropColumn('requested_by_name');
            }
        });
    }
};
