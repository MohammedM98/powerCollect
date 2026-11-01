<?php

namespace Tests\Feature;

use App\Enums\ChargeType;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Notifications\ActionCompleted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class WebPaymentIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_retrying_a_successful_payment_returns_the_same_receipt_without_another_voucher_or_notification(): void
    {
        Notification::fake();
        $collector = User::factory()->branchAdmin()->create();
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        $payment = $this->payment();
        $url = route('subscriptions.payments.store', $subscription);

        $this->actingAs($collector)->post($url, $payment)->assertSessionHasNoErrors();
        $original = SubscriptionTransaction::where('type', 'payment')->sole();
        $voucherSequence = DB::table('payment_voucher_sequences')->where('id', 1)->value('last_number');
        $this->post($url, $payment)->assertSessionHasNoErrors();

        $this->assertSame(1, SubscriptionTransaction::where('type', 'payment')->count());
        $this->assertSame($original->voucher_number, SubscriptionTransaction::where('type', 'payment')->sole()->voucher_number);
        $this->assertSame($voucherSequence, DB::table('payment_voucher_sequences')->where('id', 1)->value('last_number'));
        Notification::assertSentToTimes($collector, ActionCompleted::class, 1);
    }

    public function test_an_operation_cannot_be_reused_for_different_data_or_another_subscription_or_actor(): void
    {
        $collector = User::factory()->branchAdmin()->create();
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        $otherSubscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        $otherCollector = User::factory()->branchAdmin()->create(['branch_id' => $collector->branch_id]);
        $payment = $this->payment();
        $url = route('subscriptions.payments.store', $subscription);
        $this->actingAs($collector)->post($url, $payment)->assertSessionHasNoErrors();

        $this->post($url, [...$payment, 'amount' => '11'])->assertSessionHasErrors('payment_token');
        $this->post(route('subscriptions.payments.store', $otherSubscription), $payment)->assertSessionHasErrors('payment_token');
        $this->actingAs($otherCollector)->post($url, $payment)->assertSessionHasErrors('payment_token');
        $otherBranchCollector = User::factory()->branchAdmin()->create();
        $otherBranchSubscription = Subscription::factory()->create(['branch_id' => $otherBranchCollector->branch_id]);
        $this->actingAs($otherBranchCollector)->post(route('subscriptions.payments.store', $otherBranchSubscription), $payment)->assertSessionHasErrors('payment_token');
        $this->assertSame(1, SubscriptionTransaction::where('type', 'payment')->count());
    }

    public function test_each_distinct_operation_can_record_an_identical_payment(): void
    {
        $collector = User::factory()->branchAdmin()->create();
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        $url = route('subscriptions.payments.store', $subscription);
        $this->actingAs($collector)->post($url, $this->payment())->assertSessionHasNoErrors();
        $this->post($url, $this->payment())->assertSessionHasNoErrors();
        $this->assertSame(2, SubscriptionTransaction::where('type', 'payment')->count());
    }

    public function test_a_retry_is_accepted_when_the_original_payment_changed_the_overpayment_threshold(): void
    {
        $collector = User::factory()->branchAdmin()->create();
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        SubscriptionTransaction::recordCharge($subscription, $collector, ChargeType::Penalty, '1000', null);
        $payment = [...$this->payment(), 'amount' => '1000'];
        $url = route('subscriptions.payments.store', $subscription);

        $this->actingAs($collector)->post($url, $payment)->assertSessionHasNoErrors();
        $this->post($url, $payment)->assertSessionHasNoErrors();

        $this->assertSame(1, SubscriptionTransaction::where('type', 'payment')->count());
        $this->assertSame('0.00', $subscription->balance());
    }

    public function test_payments_without_a_valid_operation_key_are_refused(): void
    {
        $collector = User::factory()->branchAdmin()->create();
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        $payment = $this->payment();
        unset($payment['payment_token']);
        $url = route('subscriptions.payments.store', $subscription);
        $this->actingAs($collector)->post($url, $payment)->assertSessionHasErrors('payment_token');
        $this->post($url, [...$payment, 'payment_token' => 'invalid'])->assertSessionHasErrors('payment_token');
        $this->assertSame(0, SubscriptionTransaction::where('type', 'payment')->count());
    }

    public function test_a_transfer_retry_returns_the_existing_payment_before_checking_its_used_reference(): void
    {
        $collector = User::factory()->branchAdmin()->create();
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        $payment = [...$this->payment(), 'payment_method' => 'bank_transfer', 'bank_name' => 'بنك فلسطين', 'sender_name' => 'صاحب الحساب', 'reference_number' => 'WEB-RETRY'];
        $url = route('subscriptions.payments.store', $subscription);

        $this->actingAs($collector)->post($url, $payment)->assertSessionHasNoErrors();
        $this->post($url, $payment)->assertSessionHasNoErrors();

        $this->assertSame(1, SubscriptionTransaction::where('type', 'payment')->count());
    }

    public function test_a_refused_payment_does_not_consume_its_operation_key(): void
    {
        $collector = User::factory()->branchAdmin()->create();
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        $payment = [...$this->payment(), 'amount' => '1000'];
        $url = route('subscriptions.payments.store', $subscription);

        $this->actingAs($collector)->post($url, $payment)->assertSessionHasErrors('confirm_overpayment');
        $this->assertDatabaseCount('web_payment_operations', 0);
        $this->post($url, [...$payment, 'confirm_overpayment' => true])->assertSessionHasNoErrors();

        $this->assertDatabaseCount('web_payment_operations', 1);
        $this->assertSame(1, SubscriptionTransaction::where('type', 'payment')->count());
    }

    /** @return array<string, string> */
    private function payment(): array
    {
        return ['payment_token' => (string) Str::uuid(), 'amount' => '10', 'currency' => 'ILS', 'payment_method' => 'cash'];
    }
}
