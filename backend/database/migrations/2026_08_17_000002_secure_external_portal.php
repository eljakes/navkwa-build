<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portal_users', function (Blueprint $table): void {
            $table->foreignId('supplier_id')->nullable()->after('client_id')->constrained()->nullOnDelete();
            $table->string('password')->nullable()->after('email');
            $table->string('invitation_token_hash', 64)->nullable()->after('status');
            $table->timestampTz('invitation_expires_at')->nullable()->after('invitation_token_hash');
            $table->timestampTz('invitation_accepted_at')->nullable()->after('invitation_expires_at');
            $table->unsignedSmallInteger('failed_login_attempts')->default(0)->after('last_login_at');
            $table->timestampTz('locked_until')->nullable()->after('failed_login_attempts');
            $table->string('last_login_ip', 64)->nullable()->after('locked_until');
            $table->text('mfa_secret')->nullable()->after('last_login_ip');
            $table->timestampTz('mfa_enabled_at')->nullable()->after('mfa_secret');
            $table->text('mfa_recovery_codes')->nullable()->after('mfa_enabled_at');
            $table->timestampTz('mfa_last_used_at')->nullable()->after('mfa_recovery_codes');
        });

        Schema::create('portal_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('portal_user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('subject')->nullable();
            $table->text('message');
            $table->json('attachments')->nullable();
            $table->timestampTz('read_at')->nullable();
            $table->timestampsTz();

            $table->index(['company_id', 'project_id', 'created_at']);
        });

        Schema::create('portal_payment_submissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('portal_user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('currency', 3);
            $table->string('payment_method', 40);
            $table->string('transaction_reference')->nullable();
            $table->string('status')->default('submitted');
            $table->string('proof_path')->nullable();
            $table->text('notes')->nullable();
            $table->timestampTz('submitted_at');
            $table->timestampsTz();

            $table->index(['company_id', 'project_id', 'status']);
        });

        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->foreignId('portal_user_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', fn (Blueprint $table) => $table->dropConstrainedForeignId('portal_user_id'));
        Schema::dropIfExists('portal_payment_submissions');
        Schema::dropIfExists('portal_messages');

        Schema::table('portal_users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('supplier_id');
            $table->dropColumn([
                'password', 'invitation_token_hash', 'invitation_expires_at', 'invitation_accepted_at',
                'failed_login_attempts', 'locked_until', 'last_login_ip', 'mfa_secret',
                'mfa_enabled_at', 'mfa_recovery_codes', 'mfa_last_used_at',
            ]);
        });
    }
};
