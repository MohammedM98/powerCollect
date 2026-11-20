<?php

namespace Tests\Feature;

use App\Enums\ChargeType;
use App\Enums\CorrectionReason;
use App\Enums\PermissionKey;
use App\Enums\TransactionAction;
use App\Models\Branch;
use App\Models\Permission;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\AmendLine;
use App\Support\Ledger\CancelLine;
use App\Support\Ledger\CorrectLine;
use App\Support\Ledger\RecordCharge;
use App\Support\Ledger\RecordPayment;
use App\Support\Ledger\TransactionActions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransactionAuditTest extends TestCase
{
    use RefreshDatabase;

    private Branch $branch;

    private User $branchAdmin;

    private Subscription $subscription;

    protected function setUp(): void
    {
        parent::setUp();

        // 15:00 on Sunday 20 September in Gaza (UTC+3), the business's time zone.
        $this->travelTo('2026-09-20 12:00:00');
        $this->branch = Branch::factory()->create(['name' => 'فرع الكرادة']);
        $this->branchAdmin = User::factory()->branchAdmin()->withPermissions([PermissionKey::ForceDeleteTransactions])->create(['branch_id' => $this->branch->id, 'name' => 'Mohammed']);
        $this->subscription = Subscription::factory()->create(['branch_id' => $this->branch->id, 'full_name' => 'Ahmad Nasser']);
    }

    public function test_guests_are_sent_to_log_in(): void
    {
        $this->get(route('transaction-audit.index'))->assertRedirect(route('login'));
    }

    public function test_the_log_takes_its_own_view_audit_log_permission(): void
    {
        $dataEntry = User::factory()->dataEntry()->create(['branch_id' => $this->branch->id]);
        $this->actingAs($dataEntry)->get(route('transaction-audit.index'))->assertForbidden();

        $dataEntry->permissions()->attach(Permission::idsFor([PermissionKey::ViewCollections]));
        $this->actingAs($dataEntry->fresh())->get(route('transaction-audit.index'))->assertForbidden();

        $dataEntry->permissions()->attach(Permission::idsFor([PermissionKey::ViewTransactionAudit]));
        $this->actingAs($dataEntry->fresh())->get(route('transaction-audit.index'))->assertOk();
    }

    public function test_every_change_is_listed_newest_first_with_who_made_it_and_why(): void
    {
        $sara = User::factory()->branchAdmin()->create(['branch_id' => $this->branch->id, 'name' => 'Sara']);
        $this->recordTheChanges($sara);

        $this->actingAs($this->branchAdmin)
            ->get(route('transaction-audit.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('TransactionAudit/Index')
                ->where('counts', ['amendment' => 1, 'cancellation' => 2, 'correction' => 1, 'refund' => 1, 'deletion' => 0])
                ->has('events.data', 5)
                ->where('events.data.0.kind', 'cancellation')
                ->where('events.data.0.day', '2026-09-08')
                ->where('events.data.0.time', '15:00')
                ->where('events.data.0.userName', 'Mohammed')
                ->where('events.data.0.subscription.name', 'Ahmad Nasser')
                ->where('events.data.0.lines', [['label' => __(ChargeType::Penalty->label()), 'amount' => '5', 'voucherNumber' => null]])
                ->where('events.data.0.reason', __(CorrectionReason::Other->label()))
                ->where('events.data.0.notes', 'سُجّلت بالخطأ')
                ->where('events.data.1.kind', 'refund')
                ->where('events.data.1.kindNote', 'كامل')
                ->where('events.data.1.lines.0', ['label' => 'دفعة', 'amount' => '100', 'voucherNumber' => '000001'])
                ->where('events.data.1.lines.1.amount', '100')
                ->where('events.data.1.reason', __(CorrectionReason::PaymentRefunded->label()))
                ->where('events.data.1.notes', 'سُجّلت بمبلغ خطأ')
                ->where('events.data.2.kind', 'correction')
                ->where('events.data.2.reason', __(CorrectionReason::WrongAmount->label()))
                ->where('events.data.2.notes', 'المبلغ الصحيح 15')
                ->where('events.data.3.kind', 'cancellation')
                ->where('events.data.3.userName', 'Sara')
                ->where('events.data.3.lines.0.amount', '30')
                ->where('events.data.3.reason', __(CorrectionReason::Duplicate->label()))
                ->where('events.data.3.notes', 'مكررة')
                ->where('events.data.4.kind', 'amendment')
                ->where('events.data.4.changes', [['label' => 'الملاحظات', 'from' => null, 'to' => 'دفعة أيلول']])
                ->where('events.data.4.reason', 'توضيح')
                // What each change moved the subscriber's balance by, and what it was before and after.
                ->where('events.data.0.impact', '-5')
                ->where('events.data.1.impact', '100')
                ->where('events.data.2.impact', '5')
                ->where('events.data.2.before', '10')
                ->where('events.data.2.after', '15')
                ->where('events.data.3.impact', '-30')
                ->where('events.data.4.impact', '0')
                ->where('events.data.0.sensitive', false)
                ->where('impactSummary', ['net' => '70.00', 'users' => 2, 'sensitive' => 0, 'cancelled' => '140.00']));
    }

    public function test_a_change_to_a_line_in_a_received_box_is_marked_for_the_auditor(): void
    {
        $this->travelTo('2026-09-01 12:00:00');
        $payment = RecordPayment::handle($this->subscription, $this->branchAdmin, ['amount' => '40', 'currency' => 'ILS', 'payment_method' => 'cash']);
        AmendLine::amend($payment, $this->branchAdmin, ['notes' => 'قبل الإغلاق'], 'توضيح');
        $payment->boxEntry->box->update(['status' => 'received', 'closed_at' => now(), 'received_at' => now()]);
        $this->travelTo('2026-09-20 12:00:00');

        $this->actingAs($this->branchAdmin)->get(route('transaction-audit.index'))
            ->assertInertia(fn ($page) => $page
                ->where('events.data.0.sensitive', true)
                ->where('events.data.0.sensitiveReason', 'على حركة من صندوق مستلم')
                ->where('impactSummary.sensitive', 1));
    }

    public function test_the_log_filters_by_kind_and_by_who_made_the_change(): void
    {
        $sara = User::factory()->branchAdmin()->create(['branch_id' => $this->branch->id, 'name' => 'Sara']);
        $this->recordTheChanges($sara);

        $this->actingAs($this->branchAdmin)
            ->get(route('transaction-audit.index', ['filter' => ['kind' => 'cancellation']]))
            ->assertInertia(fn ($page) => $page
                ->has('events.data', 2)
                ->where('events.data.0.kind', 'cancellation')
                // The figures cover every kind.
                ->where('counts.amendment', 1));

        $this->actingAs($this->branchAdmin)
            ->get(route('transaction-audit.index', ['filter' => ['user_id' => $sara->id]]))
            ->assertInertia(fn ($page) => $page->has('events.data', 1)->where('events.data.0.kind', 'cancellation'));
    }

    public function test_branch_staff_see_only_their_own_branchs_changes(): void
    {
        $otherSubscription = Subscription::factory()->create(['branch_id' => Branch::factory()->create()->id]);
        $otherCharge = RecordCharge::handle($otherSubscription, $this->branchAdmin, ChargeType::Penalty, '30', null);
        RecordCharge::handle($otherSubscription, $this->branchAdmin, ChargeType::Penalty, '10', null);
        CancelLine::cancel($otherCharge, $this->branchAdmin, CorrectionReason::Duplicate, null);

        $this->actingAs($this->branchAdmin)
            ->get(route('transaction-audit.index'))
            ->assertInertia(fn ($page) => $page->has('events.data', 0)->where('counts.cancellation', 0));

        $this->actingAs(User::factory()->superAdmin()->create())
            ->get(route('transaction-audit.index'))
            ->assertInertia(fn ($page) => $page->has('events.data', 1)->where('events.data.0.subscription.id', $otherSubscription->id));
    }

    public function test_the_period_tabs_limit_the_log_to_recent_changes(): void
    {
        $this->travelTo('2026-08-01 12:00:00');
        $payment = RecordPayment::handle($this->subscription, $this->branchAdmin, ['amount' => '100', 'currency' => 'ILS', 'payment_method' => 'cash']);
        AmendLine::amend($payment, $this->branchAdmin, ['notes' => 'قديمة'], 'توضيح');
        $this->travelTo('2026-09-20 12:00:00');

        $this->actingAs($this->branchAdmin)
            ->get(route('transaction-audit.index'))
            ->assertInertia(fn ($page) => $page->where('period', '30')->has('events.data', 0));

        $this->actingAs($this->branchAdmin)
            ->get(route('transaction-audit.index', ['period' => 'all']))
            ->assertInertia(fn ($page) => $page->has('events.data', 1));
    }

    /**
     * One change of every kind on the subscription's account, a day apart in
     * September: a payment's notes edited, a charge cancelled (by `$canceller`),
     * another corrected, the payment partly refunded, and a last charge
     * deleted for good.
     */
    private function recordTheChanges(User $canceller): void
    {
        $this->travelTo('2026-09-01 12:00:00');
        $payment = RecordPayment::handle($this->subscription, $this->branchAdmin, ['amount' => '100', 'currency' => 'ILS', 'payment_method' => 'cash']);
        $this->travelTo('2026-09-02 12:00:00');
        AmendLine::amend($payment, $this->branchAdmin, ['notes' => 'دفعة أيلول'], 'توضيح');
        $this->travelTo('2026-09-03 12:00:00');
        $cancelled = RecordCharge::handle($this->subscription, $this->branchAdmin, ChargeType::Penalty, '30', null);
        $this->travelTo('2026-09-04 12:00:00');
        $corrected = RecordCharge::handle($this->subscription, $this->branchAdmin, ChargeType::Penalty, '10', null);
        $this->travelTo('2026-09-05 12:00:00');
        CancelLine::cancel($cancelled, $canceller, CorrectionReason::Duplicate, 'مكررة');
        $this->travelTo('2026-09-06 12:00:00');
        CorrectLine::correct($corrected, $this->branchAdmin, CorrectionReason::WrongAmount, 'المبلغ الصحيح 15', fn (Subscription $subscription): SubscriptionTransaction => RecordCharge::handle($subscription, $this->branchAdmin, ChargeType::Penalty, '15', null));
        $this->travelTo('2026-09-07 12:00:00');
        TransactionActions::applyAction($payment, $this->branchAdmin, TransactionAction::Refund, ['correction_notes' => 'سُجّلت بمبلغ خطأ']);
        $this->travelTo('2026-09-08 12:00:00');
        TransactionActions::applyAction(RecordCharge::handle($this->subscription, $this->branchAdmin, ChargeType::Penalty, '5', null), $this->branchAdmin, TransactionAction::Delete, ['correction_notes' => 'سُجّلت بالخطأ']);
        $this->travelTo('2026-09-20 12:00:00');
    }
}
