<?php

namespace App\Http\Middleware;

use App\Models\PortalUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePortalUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $portalUser = $request->user();

        abort_unless($portalUser instanceof PortalUser, 403, 'A portal account is required.');
        abort_unless($portalUser->status === 'active', 403, 'This portal account is not active.');

        return $next($request);
    }
}
