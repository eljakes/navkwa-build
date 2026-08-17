<?php

use App\Http\Middleware\CheckPermission;
use App\Http\Middleware\EnsurePortalUser;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            RateLimiter::for('api', function (Request $request): Limit {
                return Limit::perMinute((int) config('security.rate_limits.api_per_minute', 120))
                    ->by((string) ($request->user()?->id ?: $request->ip()));
            });

            RateLimiter::for('auth.login', function (Request $request): array {
                $email = hash('sha256', strtolower((string) $request->input('email')));

                return [
                    Limit::perMinute((int) config('security.rate_limits.login_per_minute', 5))
                        ->by($email.'|'.$request->ip()),
                    Limit::perMinute((int) config('security.rate_limits.login_ip_per_minute', 20))
                        ->by((string) $request->ip()),
                    Limit::perMinute((int) config('security.rate_limits.login_email_per_minute', 10))
                        ->by($email),
                ];
            });

            RateLimiter::for('auth.mfa', function (Request $request): array {
                return [
                    Limit::perMinute((int) config('security.rate_limits.mfa_per_minute', 5))
                        ->by(hash('sha256', (string) $request->input('challenge_token')).'|'.$request->ip()),
                    Limit::perMinute((int) config('security.rate_limits.mfa_ip_per_minute', 15))
                        ->by((string) $request->ip()),
                ];
            });
        },
    )
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('navkwabuild:backup-daily')
            ->dailyAt((string) config('backup.daily_at', '02:00'))
            ->timezone((string) config('app.timezone', 'UTC'))
            ->withoutOverlapping(180)
            ->appendOutputTo(storage_path('logs/navkwabuild-backups.log'));
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(SecurityHeaders::class);
        $middleware->alias([
            'permission' => CheckPermission::class,
            'portal.user' => EnsurePortalUser::class,
        ]);
        $middleware->redirectGuestsTo(fn (Request $request): ?string => $request->is('api/*') ? null : '/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
