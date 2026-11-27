<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMobileAdjustmentRequest;
use App\Http\Resources\Mobile\RecordedAdjustmentResource;
use App\Support\Ledger\RecordMobileAdjustment;
use Illuminate\Http\JsonResponse;

class MobileAdjustmentController extends Controller
{
    public function store(StoreMobileAdjustmentRequest $request): JsonResponse
    {
        $subscription = $request->route('subscription');
        $transaction = RecordMobileAdjustment::handle($request, $subscription);

        return response()->json(new RecordedAdjustmentResource($transaction->setRelation('subscription', $subscription)), 201);
    }
}
