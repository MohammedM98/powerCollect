<?php

namespace App\Http\Controllers;

use App\Http\Requests\ViewMoneyFlowRequest;
use App\Support\Closing\MoneyFlow;
use Illuminate\Http\JsonResponse;

class MoneyFlowController extends Controller
{
    /** Where the money collected is now, for the finance pages' flow strip. */
    public function __invoke(ViewMoneyFlowRequest $request, MoneyFlow $flow): JsonResponse
    {
        return response()->json($flow->for($request, $request->user()));
    }
}
