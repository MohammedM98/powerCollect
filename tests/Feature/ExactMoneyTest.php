<?php

namespace Tests\Feature;

use App\Enums\DiscountMethod;
use App\Http\Requests\StoreSubscriptionPaymentRequest;
use App\Models\Closing;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Money;
use App\Support\Readings\ReadingCharges;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExactMoneyTest extends TestCase
{
    use RefreshDatabase;

    public function test_discounts_preserve_decimal_cents_beyond_binary_float_precision(): void
    {
        $this->assertSame('90071992547409.91', LedgerAmounts::discountFor(DiscountMethod::Shekel, '90071992547409.91', null));
        $this->assertSame('0.01', LedgerAmounts::discountFor(DiscountMethod::Percentage, '50', '0.01'));
    }

    public function test_reading_charges_multiply_and_apply_minimums_as_decimal_strings(): void
    {
        $this->assertSame([
            'reading_fee' => '90071992547409.91',
            'discount_amount' => '0.00',
            'amount_due' => '90071992547409.91',
        ], ReadingCharges::chargesFor(1, '90071992547409.91', '0.00'));
    }

    public function test_conversion_and_minor_units_never_pass_through_binary_floats(): void
    {
        $this->assertSame('90071992547409.91', Money::multiply('90071992547409.91', '1.0000'));
        $this->assertSame('1.02', Money::multiply('0.29', '3.5000'));
        $this->assertSame('1.02', StoreSubscriptionPaymentRequest::amountInShekels('0.29', 'USD', '3.5000'));
        $this->assertSame('0.29', StoreSubscriptionPaymentRequest::amountInShekels('0.29', 'ILS', null));
        $this->assertSame('90071992547409.91', Closing::money(9007199254740991));
        $this->assertSame(9007199254740991, Closing::cents('90071992547409.91'));
    }

    public function test_running_balances_preserve_decimal_credits_and_debits(): void
    {
        $subscription = Subscription::factory()->create();
        $recorder = User::factory()->create();
        foreach (['0.10', '0.20', '-0.01'] as $index => $amount) {
            $line = $subscription->transactions()->create([
                'type' => SubscriptionTransaction::TYPE_INVOICE,
                'recorded_by' => $recorder->id,
                'source_key' => 'exact-money:'.$index,
                'amount' => $amount,
            ]);
        }

        $this->assertSame('0.29', $line->balance_after);
        $this->assertSame('0.29', $subscription->balance());
    }

    public function test_reading_discounts_round_half_cents_and_cap_at_the_reading_fee(): void
    {
        $this->assertSame('0.01', ReadingCharges::discountFor(DiscountMethod::Percentage, '50', 1, '0.01'));
        $this->assertSame('0.01', ReadingCharges::discountFor(DiscountMethod::Kilowatt, '2', 1, '0.01'));
        $this->assertSame('0.01', ReadingCharges::discountFor(DiscountMethod::Shekel, '2', 1, '0.01'));
        $this->assertSame('10.00', ReadingCharges::chargesFor(1, '0.01', '10.00')['amount_due']);
    }
}
