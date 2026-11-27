<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMobileSplitPaymentRequest;
use App\Http\Resources\Mobile\RecordedSplitPaymentResource;
use App\Models\Branch;
use App\Models\SplitPayment;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MobileSplitPaymentController extends Controller
{
    public function store(StoreMobileSplitPaymentRequest $request): JsonResponse
    {
        try {
            $split = DB::transaction(function () use ($request): SplitPayment {
                $existing = $request->existingPayment();
                if ($existing !== null) {
                    return $existing->splitPayment;
                }

                $parts = $request->parts();
                $branchIds = collect($parts)->pluck('subscription.branch_id')->unique()->sort()->values();
                Branch::query()->whereIn('id', $branchIds)->orderBy('id')->lockForUpdate()->get();
                $existing = $request->existingPayment(latest: true);
                if ($existing !== null) {
                    abort_unless($existing->recorded_by === $request->user()->id && $existing->split_payment_id !== null, 403);

                    // Recorded by the same upload while this one waited: read it past the snapshot too.
                    return $existing->splitPayment()->sharedLock()->firstOrFail();
                }

                $split = SplitPayment::record($request->user(), $request->safe()->except(['parts', 'mobile_operation_id', 'collector_confirmed']), $parts);
                $split->payments()->firstOrFail()->forceFill(['mobile_operation_id' => $request->validated('mobile_operation_id')])->save();

                return $split;
            }, 3);
        } catch (UniqueConstraintViolationException $exception) {
            $payment = $request->existingPayment();
            if ($payment === null) {
                throw $exception;
            }
            abort_unless($payment->recorded_by === $request->user()->id && $payment->split_payment_id !== null, 403);
            $split = $payment->splitPayment;
        }

        return response()->json(new RecordedSplitPaymentResource($split), 201);
    }
}
