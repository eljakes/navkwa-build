<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portal_messages', function (Blueprint $table): void {
            $table->index(['company_id', 'user_id', 'read_at'], 'portal_messages_team_unread_index');
            $table->index(['portal_user_id', 'user_id', 'read_at'], 'portal_messages_portal_unread_index');
        });
    }

    public function down(): void
    {
        Schema::table('portal_messages', function (Blueprint $table): void {
            $table->dropIndex('portal_messages_team_unread_index');
            $table->dropIndex('portal_messages_portal_unread_index');
        });
    }
};
