<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMobileAdjustmentRequest;
use App\Support\Ledger\LinePresenter;
use App\Support\Ledger\RecordMobileAdjustment;
use Illuminate\Http\JsonResponse;

class MobileAdjustmentController extends Controller
{
    public function store(StoreMobileAdjustmentRequest $request): JsonResponse
    {
        $subscription = $request->route('subscription');
        $transaction = RecordMobileAdjustment::handle($request, $subscription);

        return response()->json([
            'id' => $transaction->id,
            'type' => $transaction->type,
            'amount' => $transaction->amount,
            'voucher_number' => LinePresenter::displayVoucherNumber($transaction),
            'balance_after' => $subscription->balance(),
        ], 201);
    }
}
