<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Enums\SubscriptionStatus;
use App\Models\Branch;
use App\Models\Permission;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SubscriptionListSummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_list_figures_count_statuses_debts_credits_and_missing_phones_in_the_viewers_branch(): void
    {
        $branch = Branch::factory()->create();
        $viewer = User::factory()->create(['branch_id' => $branch->id]);
        $viewer->permissions()->sync(Permission::idsFor([PermissionKey::ViewSubscriptions]));

        $debtor = Subscription::factory()->create(['branch_id' => $branch->id, 'status' => SubscriptionStatus::Active, 'phone' => '0599000001']);
        $creditor = Subscription::factory()->create(['branch_id' => $branch->id, 'status' => SubscriptionStatus::Suspended, 'phone' => null, 'subscription_phone' => null]);
        Subscription::factory()->create(['branch_id' => $branch->id, 'status' => SubscriptionStatus::Disconnected, 'phone' => null, 'subscription_phone' => '0599000002']);
        $elsewhere = Subscription::factory()->create(['branch_id' => Branch::factory()->create()->id]);
        Subscription::factory()->create(['branch_id' => $branch->id, 'archived_at' => now()]);

        SubscriptionTransaction::factory()->create(['subscription_id' => $debtor->id, 'amount' => '150.00']);
        SubscriptionTransaction::factory()->create(['subscription_id' => $debtor->id, 'type' => SubscriptionTransaction::TYPE_PAYMENT, 'source_key' => 'payment:summary-1', 'amount' => '-50.00']);
        SubscriptionTransaction::factory()->create(['subscription_id' => $creditor->id, 'type' => SubscriptionTransaction::TYPE_PAYMENT, 'source_key' => 'payment:summary-2', 'amount' => '-40.00']);
        SubscriptionTransaction::factory()->create(['subscription_id' => $elsewhere->id, 'amount' => '999.00']);

        $this->actingAs($viewer)->get(route('subscriptions.index', ['filter' => ['status' => 'active']]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('listSummary.total', 3)
                ->where('listSummary.byStatus', ['active' => 1, 'suspended' => 1, 'disconnected' => 1])
                ->where('listSummary.owed', '100.00')
                ->where('listSummary.debtors', 1)
                ->where('listSummary.credit', '40.00')
                ->where('listSummary.creditors', 1)
                ->where('listSummary.withoutPhone', 1));
    }
}
