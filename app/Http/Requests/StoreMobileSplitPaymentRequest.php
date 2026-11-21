<?php

namespace App\Http\Requests;

use App\Models\SubscriptionTransaction;
use Illuminate\Support\Arr;

class StoreMobileSplitPaymentRequest extends StoreSplitPaymentRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $payment = $this->existingPayment();

        return $payment ? $payment->recorded_by === $this->user()->id && $payment->split_payment_id !== null : parent::authorize();
    }

    /**
     * The web transfer's rules, keyed by `mobile_operation_id` instead of
     * the web window's `operation_token`.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'mobile_operation_id' => ['required', 'uuid'],
            'collector_confirmed' => ['required', 'accepted'],
            ...($this->existingPayment() ? [] : Arr::except(parent::rules(), 'operation_token')),
        ];
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return $this->existingPayment() ? [] : parent::after();
    }

    public function existingPayment(): ?SubscriptionTransaction
    {
        $id = $this->input('mobile_operation_id');

        return is_string($id) && $id !== ''
            ? SubscriptionTransaction::query()->where('mobile_operation_id', $id)->where('type', SubscriptionTransaction::TYPE_PAYMENT)->first()
            : null;
    }
}
