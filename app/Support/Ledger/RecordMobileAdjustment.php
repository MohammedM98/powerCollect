<?php

namespace App\Support\Ledger;

use App\Enums\ChargeType;
use App\Enums\DiscountMethod;
use App\Http\Requests\StoreMobileAdjustmentRequest;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Support\Closing\BranchLock;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Validator as ValidationValidator;

/**
 * A charge, discount or clearing sent from the field app, recorded once per
 * `mobile_operation_id`: a retry of the same operation, or one that lost a
 * race with its own retry, returns the line already recorded.
 */
class RecordMobileAdjustment
{
    public static function handle(StoreMobileAdjustmentRequest $request, Subscription $subscription): SubscriptionTransaction
    {
        try {
            return BranchLock::run($subscription->branch_id, function () use ($request, $subscription): SubscriptionTransaction {
                if ($existing = $request->existingTransaction()) {
                    abort_unless($request->ownsOperation($existing), 403);

                    return $existing;
                }

                $validator = Validator::make([], []);
                $validator->after(function (ValidationValidator $validator) use ($request): void {
                    $request->validateBalance($validator);
                });
                $validator->validate();
                $data = $request->validated();
                $transaction = match ($data['action']) {
                    'charge' => RecordCharge::handle($subscription, $request->user(), ChargeType::from($data['type']), $data['amount'], $data['notes'] ?? null),
                    'discount' => RecordDiscount::handle($subscription, $request->user(), DiscountMethod::Shekel, $data['value'], $data['notes'] ?? null),
                    'clearing' => RecordClearing::handle($subscription, $request->user(), $data['amount'], $data['notes'], $data['manual_voucher_number'] ?? null),
                };
                $transaction->update(['mobile_operation_id' => $data['mobile_operation_id']]);

                return $transaction;
            });
        } catch (UniqueConstraintViolationException $exception) {
            $transaction = $request->existingTransaction();
            if (! $transaction) {
                throw $exception;
            }
            abort_unless($request->ownsOperation($transaction), 403);

            return $transaction;
        }
    }
}
