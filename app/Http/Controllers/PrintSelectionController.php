<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePrintSelectionRequest;
use App\Models\MeterReading;
use App\Models\ReadingCycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class PrintSelectionController extends Controller
{
    public function store(StorePrintSelectionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $this->authorize('viewAny', $validated['page'] === '/meter-readings' ? MeterReading::class : ReadingCycle::class);
        $tokens = $request->session()->get('print_selection_tokens', []);
        foreach (array_slice($tokens, 0, max(0, count($tokens) - 4)) as $oldToken) {
            Cache::forget('print_selection:'.$oldToken);
        }
        $token = (string) Str::uuid();
        Cache::put('print_selection:'.$token, [
            'user_id' => $request->user()->id,
            'session_hash' => hash('sha256', $request->session()->getId()),
            'page' => $validated['page'],
            'ids' => array_map(intval(...), $validated['ids']),
        ], now()->addHour());
        $request->session()->put('print_selection_tokens', [...array_slice($tokens, -4), $token]);

        return response()->json(['token' => $token])->header('Cache-Control', 'no-store, private');
    }
}
