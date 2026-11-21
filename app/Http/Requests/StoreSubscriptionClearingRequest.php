<?php

namespace App\Http\Requests;

use App\Models\Subscription;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\Money;
use App\Support\Ledger\WebPaymentOperation;
use Brick\Math\BigDecimal;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreSubscriptionClearingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('addClearing', $this->route('subscription'));
    }

    /**
     * `amount` is what the service is worth in shekels; `notes` says what
     * the service was; `manual_voucher_number` is the paper voucher's, if any.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [...self::clearingRules(), ...WebPaymentOperation::operationTokenRules()];
    }

    /**
     * The clearing's rules; shared with correcting a clearing.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public static function clearingRules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:1000000'],
            'notes' => ['required', 'string', 'max:1000'],
            'manual_voucher_number' => ['nullable', 'string', 'max:50'],
            'confirm_over_balance' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * A clearing worth more than what the subscription owes — even one for a
     * new subscription who owes nothing — leaves them in credit. It is never
     * refused, but it is saved only once the user confirms it.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var Subscription $subscription */
                $subscription = $this->route('subscription');
                if ($validator->errors()->isNotEmpty() || app(WebPaymentOperation::class)->replay($subscription, $this->user(), $validator->validated(), WebPaymentOperation::CLEARING)) {
                    return;
                }

                self::checkAgainstBalance($validator, $subscription->balance(), $this->input('amount'), $this->boolean('confirm_over_balance'));
            },
        ];
    }

    /**
     * Ask for confirmation (`confirm_over_balance`) of a clearing worth more
     * than `$owed`, saying the credit it leaves; shared with correcting a
     * clearing, where `$owed` leaves out the clearing being corrected.
     */
    public static function checkAgainstBalance(Validator $validator, int|float|string $owed, float|string $amount, bool $confirmed): void
    {
        $owing = (string) BigDecimal::max((string) $owed, '0');

        if ($confirmed || Money::decimal($amount)->isLessThanOrEqualTo($owing)) {
            return;
        }

        $validator->errors()->add('confirm_over_balance', sprintf(
            'قيمة المقاصة (%s شيكل) أكبر من الرصيد المستحق (%s شيكل)، فيصبح للمشترك رصيد لصالحه قدره %s شيكل. أكّد إذا كنت تريد فعلًا إضافة المقاصة لهذا المشترك.',
            LedgerAmounts::formatAmount($amount),
            LedgerAmounts::formatAmount($owing),
            LedgerAmounts::formatAmount(Money::subtract($amount, $owed)),
        ));
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [...self::clearingMessages(), ...WebPaymentOperation::operationTokenMessages()];
    }

    /**
     * @return array<string, string>
     */
    public static function clearingMessages(): array
    {
        return ['notes.required' => 'اكتب الخدمة التي قدّمها المشترك؛ تظهر في كشف حسابه.'];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['amount' => 'قيمة الخدمة', 'notes' => 'الخدمة'];
    }
}
