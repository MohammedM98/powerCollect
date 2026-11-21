<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\Branch;
use App\Models\Permission;
use App\Models\SplitPayment;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Notifications\ActionCompleted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * A charge, clearing, discount or split transfer sent twice from its window
 * (a double click, or a retried request) is recorded once, like a payment.
 */
class WebOperationIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, array{string, string, array<string, string>}> */
    public static function operations(): array
    {
        return [
            'charge' => ['subscriptions.charges.store', 'penalty', ['type' => 'penalty', 'amount' => '50', 'notes' => 'تأخر في السداد']],
            'clearing' => ['subscriptions.clearings.store', SubscriptionTransaction::TYPE_CLEARING, ['amount' => '40', 'notes' => 'صيانة الكابل']],
            'discount' => ['subscriptions.discounts.store', SubscriptionTransaction::TYPE_DISCOUNT, ['method' => 'shekel', 'value' => '30']],
        ];
    }

    /** @param array<string, string> $request */
    #[DataProvider('operations')]
    public function test_sending_the_same_request_twice_records_one_line_and_announces_it_once(string $route, string $type, array $request): void
    {
        Notification::fake();
        [$admin, $subscription] = $this->subscriptionOwing('100.00');
        $request = [...$request, 'operation_token' => (string) Str::uuid()];
        $url = route($route, $subscription);

        $this->actingAs($admin)->post($url, $request)->assertSessionHasNoErrors();
        $balance = $subscription->balance();
        $this->post($url, $request)->assertSessionHasNoErrors();

        $this->assertSame(1, SubscriptionTransaction::where('type', $type)->count());
        $this->assertSame($balance, $subscription->balance());
        Notification::assertSentToTimes($admin, ActionCompleted::class, 1);
    }

    /** @param array<string, string> $request */
    #[DataProvider('operations')]
    public function test_a_request_without_a_valid_key_is_refused(string $route, string $type, array $request): void
    {
        [$admin, $subscription] = $this->subscriptionOwing('100.00');
        $url = route($route, $subscription);

        $this->actingAs($admin)->post($url, $request)->assertSessionHasErrors(['operation_token' => 'تعذّر تحديد طلب التسجيل. أعد فتح النموذج ثم حاول مجددًا.']);
        $this->post($url, [...$request, 'operation_token' => 'invalid'])->assertSessionHasErrors(['operation_token' => 'طلب التسجيل غير صالح. أعد فتح النموذج ثم حاول مجددًا.']);

        $this->assertSame(0, SubscriptionTransaction::where('type', $type)->count());
    }

    /** @param array<string, string> $request */
    #[DataProvider('operations')]
    public function test_a_key_cannot_be_reused_with_other_details_or_for_another_subscription(string $route, string $type, array $request): void
    {
        [$admin, $subscription] = $this->subscriptionOwing('100.00');
        $other = Subscription::factory()->create(['branch_id' => $subscription->branch_id]);
        $request = [...$request, 'operation_token' => (string) Str::uuid()];
        $this->actingAs($admin)->post(route($route, $subscription), $request)->assertSessionHasNoErrors();

        $this->post(route($route, $subscription), [...$request, 'notes' => 'تفاصيل أخرى'])
            ->assertSessionHasErrors(['operation_token' => 'تم استخدام طلب التسجيل هذا مسبقًا ببيانات مختلفة. أعد فتح النموذج ثم حاول مجددًا.']);
        $this->post(route($route, $other), $request)->assertSessionHasErrors('operation_token');

        $this->assertSame(1, SubscriptionTransaction::where('type', $type)->count());
    }

    public function test_one_windows_key_is_refused_by_another(): void
    {
        [$admin, $subscription] = $this->subscriptionOwing('100.00');
        $token = (string) Str::uuid();
        $this->actingAs($admin)->post(route('subscriptions.charges.store', $subscription), ['type' => 'penalty', 'amount' => '40', 'notes' => 'غرامة', 'operation_token' => $token])->assertSessionHasNoErrors();

        $this->post(route('subscriptions.clearings.store', $subscription), ['amount' => '40', 'notes' => 'غرامة', 'operation_token' => $token])->assertSessionHasErrors('operation_token');
        $this->post(route('subscriptions.payments.store', $subscription), ['payment_token' => $token, 'amount' => '40', 'currency' => 'ILS', 'payment_method' => 'cash'])->assertSessionHasErrors('payment_token');

        $this->assertSame(0, SubscriptionTransaction::whereIn('type', [SubscriptionTransaction::TYPE_CLEARING, SubscriptionTransaction::TYPE_PAYMENT])->count());
    }

    public function test_a_clearing_retry_returns_the_same_voucher_without_claiming_another(): void
    {
        [$admin, $subscription] = $this->subscriptionOwing('100.00');
        $request = ['amount' => '40', 'notes' => 'صيانة الكابل', 'operation_token' => (string) Str::uuid()];
        $url = route('subscriptions.clearings.store', $subscription);

        $this->actingAs($admin)->post($url, $request)->assertSessionHasNoErrors();
        $clearing = SubscriptionTransaction::where('type', SubscriptionTransaction::TYPE_CLEARING)->sole();

        $this->post($url, $request)
            ->assertSessionHas('inertia.flash_data.recordedClearing', fn (array $flashed): bool => $flashed['receiptUrl'] === route('subscriptions.payments.receipt', [$subscription, $clearing]));
        $this->assertSame($clearing->voucher_number, SubscriptionTransaction::where('type', SubscriptionTransaction::TYPE_CLEARING)->sole()->voucher_number);
    }

    public function test_a_retry_of_a_discount_that_cleared_the_balance_is_accepted(): void
    {
        [$admin, $subscription] = $this->subscriptionOwing('100.00');
        $request = ['method' => 'shekel', 'value' => '100', 'operation_token' => (string) Str::uuid()];
        $url = route('subscriptions.discounts.store', $subscription);

        $this->actingAs($admin)->post($url, $request)->assertSessionHasNoErrors();
        $this->post($url, $request)->assertSessionHasNoErrors();

        $this->assertSame(1, SubscriptionTransaction::where('type', SubscriptionTransaction::TYPE_DISCOUNT)->count());
        $this->assertSame('0.00', $subscription->balance());
    }

    public function test_a_retry_of_a_clearing_beyond_the_balance_is_accepted_without_asking_again(): void
    {
        [$admin, $subscription] = $this->subscriptionOwing('100.00');
        $request = ['amount' => '100', 'notes' => 'صيانة الكابل', 'operation_token' => (string) Str::uuid()];
        $url = route('subscriptions.clearings.store', $subscription);

        $this->actingAs($admin)->post($url, $request)->assertSessionHasNoErrors();
        $this->post($url, $request)->assertSessionHasNoErrors();

        $this->assertSame(1, SubscriptionTransaction::where('type', SubscriptionTransaction::TYPE_CLEARING)->count());
    }

    public function test_a_refused_request_does_not_use_up_its_key(): void
    {
        [$admin, $subscription] = $this->subscriptionOwing('100.00');
        $request = ['amount' => '150', 'notes' => 'صيانة الكابل', 'operation_token' => (string) Str::uuid()];
        $url = route('subscriptions.clearings.store', $subscription);

        $this->actingAs($admin)->post($url, $request)->assertSessionHasErrors('confirm_over_balance');
        $this->assertDatabaseCount('web_payment_operations', 0);
        $this->post($url, [...$request, 'confirm_over_balance' => true])->assertSessionHasNoErrors();

        $this->assertSame(1, SubscriptionTransaction::where('type', SubscriptionTransaction::TYPE_CLEARING)->count());
    }

    public function test_a_split_transfer_sent_twice_is_recorded_once_with_the_same_receipts(): void
    {
        Notification::fake();
        [$cashier, $request] = $this->splitTransfer();

        $this->actingAs($cashier)->post(route('payments.split.store'), $request)->assertSessionHasNoErrors();
        $split = SplitPayment::sole();
        $receipts = $split->payments->map(fn (SubscriptionTransaction $payment): string => route('subscriptions.payments.receipt', [$payment->subscription, $payment]))->all();

        $this->post(route('payments.split.store'), $request)
            ->assertSessionHasNoErrors()
            ->assertSessionHas('inertia.flash_data.recordedSplitPayment', fn (array $flashed): bool => $flashed['id'] === $split->id && array_column($flashed['parts'], 'receiptUrl') === $receipts);

        $this->assertSame(1, SplitPayment::count());
        $this->assertSame(2, SubscriptionTransaction::where('type', SubscriptionTransaction::TYPE_PAYMENT)->count());
        Notification::assertSentToTimes($cashier, ActionCompleted::class, 1);
    }

    public function test_a_split_transfer_key_cannot_be_reused_for_another_division_or_left_out(): void
    {
        [$cashier, $request] = $this->splitTransfer();
        $this->actingAs($cashier)->post(route('payments.split.store'), $request)->assertSessionHasNoErrors();

        $request['parts'][0]['amount'] = '150';
        $request['parts'][1]['amount'] = '50';
        $this->post(route('payments.split.store'), $request)->assertSessionHasErrors('operation_token');
        unset($request['operation_token']);
        $this->post(route('payments.split.store'), $request)->assertSessionHasErrors('operation_token');

        $this->assertSame(1, SplitPayment::count());
    }

    /** @return array{User, Subscription} */
    private function subscriptionOwing(string $owed): array
    {
        $admin = User::factory()->branchAdmin()->create();
        $subscription = Subscription::factory()->create(['branch_id' => $admin->branch_id]);
        $subscription->transactions()->create(['recorded_by' => $admin->id, 'type' => SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE, 'source_key' => 'fee:'.$subscription->id, 'amount' => $owed]);

        return [$admin, $subscription];
    }

    /**
     * A collector and a 200 ₪ transfer shared between two subscriptions owing 100 ₪ each.
     *
     * @return array{User, array<string, mixed>}
     */
    private function splitTransfer(): array
    {
        $branch = Branch::factory()->create();
        $cashier = User::factory()->collector()->create(['branch_id' => $branch->id]);
        $cashier->permissions()->syncWithoutDetaching(Permission::firstOrCreate(['key' => PermissionKey::RecordCollections->value], ['label' => PermissionKey::RecordCollections->label()]));
        $subscriptions = Subscription::factory()->count(2)->create(['branch_id' => $branch->id]);
        foreach ($subscriptions as $subscription) {
            $subscription->transactions()->create(['recorded_by' => $cashier->id, 'type' => SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE, 'source_key' => 'fee:'.$subscription->id, 'amount' => '100.00']);
        }

        return [$cashier, [
            'operation_token' => (string) Str::uuid(),
            'total_amount' => '200',
            'bank_name' => 'بنك فلسطين',
            'sender_name' => 'محمد حمدان',
            'reference_number' => 'BOP-RETRY',
            'parts' => $subscriptions->map(fn (Subscription $subscription): array => ['subscription_id' => $subscription->id, 'amount' => '100'])->all(),
        ]];
    }
}
