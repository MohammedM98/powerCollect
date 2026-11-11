<?php

namespace Tests\Feature;

use App\Enums\ChargeType;
use App\Enums\PermissionKey;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\RecordCharge;
use App\Support\Ledger\RecordPayment;
use App\Support\Ledger\TransactionActions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class ImmutableLedgerDeletionTest extends TestCase
{
    use RefreshDatabase;

    #[TestWith([false])]
    #[TestWith([true])]
    public function test_delete_endpoints_preserve_payment_and_create_an_attributed_linked_refund(bool $legacy): void
    {
        $branch = Branch::factory()->create();
        $actor = User::factory()->branchAdmin()->withPermissions([PermissionKey::ForceDeleteTransactions])->create(['branch_id' => $branch->id]);
        $subscription = Subscription::factory()->create(['branch_id' => $branch->id]);
        $payment = RecordPayment::handle($subscription, $actor, ['amount' => '25.17', 'currency' => 'ILS', 'payment_method' => 'cash']);

        $response = $legacy
            ? $this->actingAs($actor)->delete(route('subscriptions.transactions.force-destroy', [$subscription, $payment]), ['correction_notes' => 'Duplicate receipt'])
            : $this->actingAs($actor)->post(route('subscriptions.transactions.actions.store', [$subscription, $payment]), ['action' => 'delete', 'correction_notes' => 'Duplicate receipt']);

        $response->assertSessionHasNoErrors();
        $this->assertModelExists($payment);
        $this->assertSame('-25.17', $payment->refresh()->amount);
        $this->assertSame($actor->id, $payment->cancelled_by);
        $this->assertDatabaseHas('subscription_transactions', [
            'reverses_id' => $payment->id,
            'reference_transaction_id' => $payment->id,
            'type' => SubscriptionTransaction::TYPE_REFUND,
            'amount' => '25.17',
            'recorded_by' => $actor->id,
            'employee_id' => $actor->id,
            'branch_id' => $branch->id,
        ]);
        $this->assertSame('0.00', $subscription->balance());
        $this->assertDatabaseCount('subscription_transactions', 2);

        $this->actingAs($actor)->post(route('subscriptions.transactions.actions.store', [$subscription, $payment]), ['action' => 'delete', 'correction_notes' => 'Retry'])->assertSessionHasErrors('action');
        $this->assertDatabaseCount('subscription_transactions', 2);
    }

    public function test_reversal_and_cancelled_original_cannot_be_removed(): void
    {
        $branch = Branch::factory()->create();
        $actor = User::factory()->branchAdmin()->withPermissions([PermissionKey::ForceDeleteTransactions, PermissionKey::DeleteTransactions])->create(['branch_id' => $branch->id]);
        $subscription = Subscription::factory()->create(['branch_id' => $branch->id]);
        $charge = RecordCharge::handle($subscription, $actor, ChargeType::Penalty, '50', null);
        $this->actingAs($actor)->post(route('subscriptions.transactions.actions.store', [$subscription, $charge]), ['action' => 'delete', 'correction_notes' => 'Duplicate charge'])->assertSessionHasNoErrors();
        $reversal = $subscription->transactions()->where('reverses_id', $charge->id)->firstOrFail();

        $this->post(route('subscriptions.transactions.actions.store', [$subscription, $reversal]), ['action' => 'delete_reversal', 'correction_notes' => 'Erase'])->assertSessionHasErrors('action');
        $this->post(route('subscriptions.transactions.actions.store', [$subscription, $charge]), ['action' => 'delete_tree', 'correction_notes' => 'Erase'])->assertSessionHasErrors('action');

        $this->assertModelExists($charge);
        $this->assertModelExists($reversal);
        $this->assertSame([], TransactionActions::availableActions($reversal, $actor));
        $this->assertSame([], TransactionActions::availableActions($charge->refresh(), $actor));
        $this->assertSame('0.00', $subscription->balance());
    }

    public function test_direct_model_deletion_refuses_to_remove_financial_history(): void
    {
        $transaction = SubscriptionTransaction::factory()->create();

        try {
            $transaction->delete();
            $this->fail('Financial history must not be deleted.');
        } catch (ValidationException) {
            $this->assertModelExists($transaction);
        }
    }

    public function test_legacy_cancellation_refunds_only_the_remainder_of_a_partly_refunded_payment(): void
    {
        $branch = Branch::factory()->create();
        $actor = User::factory()->branchAdmin()->withPermissions([PermissionKey::ForceDeleteTransactions])->create(['branch_id' => $branch->id]);
        $subscription = Subscription::factory()->create(['branch_id' => $branch->id]);
        $payment = RecordPayment::handle($subscription, $actor, ['amount' => '50', 'currency' => 'ILS', 'payment_method' => 'cash']);
        $earlierRefund = $subscription->transactions()->create([
            'type' => SubscriptionTransaction::TYPE_REFUND,
            'recorded_by' => $actor->id,
            'reverses_id' => $payment->id,
            'reference_transaction_id' => $payment->id,
            'amount' => '20.00',
            'source_key' => 'refund:'.$payment->id.':legacy',
        ]);

        $this->actingAs($actor)->delete(route('subscriptions.transactions.force-destroy', [$subscription, $payment]), ['correction_notes' => 'Return the remaining amount'])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertModelExists($earlierRefund);
        $this->assertSame('-50.00', $payment->refresh()->amount);
        $this->assertDatabaseHas('subscription_transactions', ['reverses_id' => $payment->id, 'type' => 'refund', 'amount' => '30.00', 'employee_id' => $actor->id, 'branch_id' => $branch->id]);
        $this->assertDatabaseCount('subscription_transactions', 3);
        $this->assertSame('0.00', $subscription->balance());
    }

    public function test_subscription_fee_blocks_subscription_deletion_and_keeps_the_fee(): void
    {
        $subscription = Subscription::factory()->create();
        $fee = SubscriptionTransaction::factory()->create(['subscription_id' => $subscription->id, 'type' => SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE, 'source_key' => 'subscription:'.$subscription->id, 'amount' => '100']);
        $this->assertNotNull($subscription->deletionBlocker());

        try {
            $subscription->deleteWithSubscriptionFee();
            $this->fail('A subscription with financial history must be retained.');
        } catch (ValidationException) {
            $this->assertModelExists($subscription);
            $this->assertModelExists($fee);
        }
    }

    #[TestWith(['0.5000', '5.00', '45.00', '10.00'])]
    #[TestWith(['0.3333', '3.33', '30.00', '10.00'])]
    #[TestWith(['0.5000', '5.00', '45.00', null])]
    public function test_remaining_foreign_refund_preserves_the_original_currency_total(string $rate, string $earlierAmount, string $remainingAmount, ?string $earlierCurrencyAmount): void
    {
        $actor = User::factory()->branchAdmin()->withPermissions([PermissionKey::RefundPayments])->create();
        $subscription = Subscription::factory()->create(['branch_id' => $actor->branch_id]);
        $payment = RecordPayment::handle($subscription, $actor, ['amount' => '100', 'currency' => 'USD', 'exchange_rate' => $rate, 'payment_method' => 'cash']);
        $subscription->transactions()->create([
            'type' => SubscriptionTransaction::TYPE_REFUND,
            'recorded_by' => $actor->id,
            'reverses_id' => $payment->id,
            'reference_transaction_id' => $payment->id,
            'amount' => $earlierAmount,
            'currency' => 'USD',
            'currency_amount' => $earlierCurrencyAmount,
            'exchange_rate' => $rate,
            'source_key' => 'refund:'.$payment->id.':legacy',
        ]);

        $this->actingAs($actor)->post(route('subscriptions.transactions.actions.store', [$subscription, $payment]), ['action' => 'refund', 'correction_notes' => 'Return the remaining foreign amount'])->assertSessionHasNoErrors();

        $refund = $subscription->transactions()->where('type', SubscriptionTransaction::TYPE_REFUND)->latest('id')->firstOrFail();
        $this->assertSame($remainingAmount, $refund->amount);
        $this->assertSame('90.00', $refund->currency_amount);
        $this->assertSame($rate, $refund->exchange_rate);
        $this->assertSame('0.00', $subscription->balance());
    }

    #[TestWith(['0.0000'])]
    #[TestWith(['-0.5000'])]
    public function test_refunding_a_payment_with_an_invalid_persisted_exchange_rate_is_refused(string $rate): void
    {
        $actor = User::factory()->branchAdmin()->withPermissions([PermissionKey::ForceDeleteTransactions])->create();
        $subscription = Subscription::factory()->create(['branch_id' => $actor->branch_id]);
        $payment = RecordPayment::handle($subscription, $actor, ['amount' => '100', 'currency' => 'USD', 'exchange_rate' => '0.5000', 'payment_method' => 'cash']);
        $payment->update(['exchange_rate' => $rate]);

        $this->actingAs($actor)->post(route('subscriptions.transactions.actions.store', [$subscription, $payment]), ['action' => 'delete', 'correction_notes' => 'Invalid stored exchange rate'])->assertSessionHasErrors('action');

        $this->assertDatabaseCount('subscription_transactions', 1);
        $this->assertNull($payment->refresh()->cancelled_at);
        $this->assertSame('-50.00', $subscription->balance());
    }

    public function test_direct_subscription_deletion_cannot_cascade_financial_history(): void
    {
        $transaction = SubscriptionTransaction::factory()->create();
        $subscription = $transaction->subscription;

        try {
            $subscription->delete();
            $this->fail('Financial history must not be deleted through its subscription.');
        } catch (ValidationException) {
            $this->assertModelExists($subscription);
            $this->assertModelExists($transaction);
        }
    }
}
