<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMobileDiagnosticsRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class MobileDiagnosticsController extends Controller
{
    /**
     * Keep the error log a collector sent from the app's account screen in the
     * server log, with who sent it and from which build, for support to read.
     */
    public function store(StoreMobileDiagnosticsRequest $request): JsonResponse
    {
        Log::warning('Mobile app diagnostics', [
            'user_id' => $request->user()->id,
            'build' => $request->header('X-App-Build'),
            'log' => $request->validated('log'),
        ]);

        return response()->json(['status' => 'received'], 202);
    }
}
