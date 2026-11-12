<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMobileSessionRequest;
use App\Http\Resources\Mobile\SessionUserResource;
use App\Models\User;
use App\Support\UserDeviceAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class MobileSessionController extends Controller
{
    public function store(StoreMobileSessionRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $rateLimitKey = Str::transliterate(Str::lower($validated['username']).'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($rateLimitKey, 5)) {
            return response()->json(['message' => trans('auth.throttle', [
                'seconds' => RateLimiter::availableIn($rateLimitKey),
                'minutes' => ceil(RateLimiter::availableIn($rateLimitKey) / 60),
            ])], 429);
        }

        $user = User::query()->where('username', $validated['username'])->first();

        if (! $user || ! $user->is_active || ! Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($rateLimitKey);

            return response()->json(['message' => trans('auth.failed')], 422);
        }

        RateLimiter::clear($rateLimitKey);

        abort_if($user->isAuditOnly(), 403);

        return response()->json([
            'user' => new SessionUserResource($user),
            'token' => app(UserDeviceAccess::class)->issueMobile($user, $request->bearerToken(), $request->boolean('remember')),
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json(['user' => new SessionUserResource($request->user())]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->attributes->get('mobile_access_token')->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}
