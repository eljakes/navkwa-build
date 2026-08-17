<?php

namespace App\Providers;

use App\Models\ClientApproval;
use App\Models\IntegrationConnector;
use App\Models\PortalMessage;
use App\Models\PortalPaymentSubmission;
use App\Models\PortalWorkItem;
use App\Observers\AuditableObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        foreach ([PortalWorkItem::class, PortalMessage::class, PortalPaymentSubmission::class, ClientApproval::class, IntegrationConnector::class] as $model) {
            $model::observe(AuditableObserver::class);
        }

        RateLimiter::for('api', function (Request $request): Limit {
            return Limit::perMinute(
                (int) config('security.rate_limits.api_per_minute', 120)
            )->by((string) ($request->user()?->id ?: $request->ip()));
        });

        RateLimiter::for('auth.login', function (Request $request): array {
            $email = hash(
                'sha256',
                strtolower((string) $request->input('email'))
            );

            return [
                Limit::perMinute(
                    (int) config('security.rate_limits.login_per_minute', 5)
                )->by($email.'|'.$request->ip()),

                Limit::perMinute(
                    (int) config('security.rate_limits.login_ip_per_minute', 20)
                )->by((string) $request->ip()),

                Limit::perMinute(
                    (int) config('security.rate_limits.login_email_per_minute', 10)
                )->by($email),
            ];
        });

        RateLimiter::for('auth.mfa', function (Request $request): array {
            return [
                Limit::perMinute(
                    (int) config('security.rate_limits.mfa_per_minute', 5)
                )->by(
                    hash(
                        'sha256',
                        (string) $request->input('challenge_token')
                    ).'|'.$request->ip()
                ),

                Limit::perMinute(
                    (int) config('security.rate_limits.mfa_ip_per_minute', 15)
                )->by((string) $request->ip()),
            ];
        });
    }
}
