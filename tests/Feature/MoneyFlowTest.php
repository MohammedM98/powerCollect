<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\CashBox;
use App\Models\CashBoxAudit;
use App\Models\CashBoxPayment;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MoneyFlowTest extends TestCase
{
    use RefreshDatabase;

    private function entry(CashBox $box, string $amount, string $status = SubscriptionTransaction::STATUS_ACTIVE): void
    {
        $subscriber = Subscription::factory()->create(['branch_id' => $box->branch_id]);
        $transaction = SubscriptionTransaction::withoutEvents(fn (): SubscriptionTransaction => SubscriptionTransaction::factory()->for($subscriber)->create([
            'branch_id' => $box->branch_id, 'type' => 'payment', 'amount' => '-'.$amount, 'currency' => 'ILS',
            'currency_amount' => $amount, 'exchange_rate' => '1', 'payment_method' => 'cash', 'status' => $status,
        ]));
        CashBoxPayment::factory()->for($box, 'box')->for($transaction, 'transaction')->create(['amount' => $amount]);
    }

    public function test_the_flow_shows_where_active_money_is_from_collection_to_audit(): void
    {
        $branch = Branch::factory()->create();
        $open = CashBox::factory()->create(['branch_id' => $branch->id, 'status' => 'open']);
        $this->entry($open, '100');
        $this->entry($open, '40');
        $this->entry($open, '999', 'cancelled');
        $awaiting = CashBox::factory()->create(['branch_id' => $branch->id, 'status' => 'received', 'closed_at' => now(), 'received_at' => now()]);
        $this->entry($awaiting, '150');
        $audited = CashBox::factory()->create(['branch_id' => $branch->id, 'status' => 'received', 'closed_at' => now(), 'received_at' => now()]);
        $this->entry($audited, '50');
        CashBoxAudit::factory()->for($audited, 'box')->create();

        $flow = $this->actingAs(User::factory()->superAdmin()->create())->getJson(route('payments.money-flow'))->assertOk()->json();

        $this->assertSame(['amount' => '340.00', 'boxes' => 3, 'entries' => 4], $flow['stages']['collected']);
        $this->assertSame(['amount' => '140.00', 'boxes' => 1, 'entries' => 2], $flow['stages']['open']);
        $this->assertSame(['amount' => '150.00', 'boxes' => 1, 'entries' => 1], $flow['stages']['awaiting']);
        $this->assertSame(['amount' => '50.00', 'boxes' => 1, 'entries' => 1], $flow['stages']['approved']);
        $this->assertNotNull($flow['oldestOpenAt']);
    }

    public function test_a_collector_without_branch_box_access_cannot_see_the_flow(): void
    {
        $this->actingAs(User::factory()->collector()->create())->getJson(route('payments.money-flow'))->assertForbidden();
    }
}
