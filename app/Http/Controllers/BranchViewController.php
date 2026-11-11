<?php

namespace App\Http\Controllers;

use App\Http\Requests\SwitchBranchViewRequest;
use App\Support\BranchViewContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BranchViewController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(SwitchBranchViewRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $key = BranchViewContext::sessionKey($request->user());
        if (isset($validated['branch_id'])) {
            $request->session()->put($key, (int) $validated['branch_id']);
        } else {
            $request->session()->forget($key);
        }

        return redirect()->route('dashboard');
    }
}
