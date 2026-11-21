<?php

namespace App\Http\Controllers\Field;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Support\UserDeviceAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Signing in to and out of the field app: the same accounts and checks as
 * the website's sign-in (LoginRequest), landing on the field home instead.
 */
class FieldSessionController extends Controller
{
    public function create(): InertiaResponse
    {
        return Inertia::render('Field/Login');
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $intended = $request->session()->get('url.intended');
        if (is_string($intended) && parse_url($intended, PHP_URL_HOST) !== $request->getHost()) {
            $request->session()->forget('url.intended');
        }

        return redirect()->intended(route('field.home', absolute: false));
    }

    public function destroy(Request $request): RedirectResponse
    {
        app(UserDeviceAccess::class)->releaseWeb($request);
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('field.login');
    }
}
