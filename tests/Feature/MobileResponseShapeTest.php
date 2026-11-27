<?php

namespace Tests\Feature;

use App\Enums\CashBoxType;
use App\Enums\PermissionKey;
use App\Jobs\SendSubscriptionMessage;
use App\Models\AuditNote;
use App\Models\Branch;
use App\Models\CashBox;
use App\Models\Closing;
use App\Models\CollectorDebt;
use App\Models\MobileAccessToken;
use App\Models\Permission;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Closing\BranchClosingWorkflow;
use App\Support\Ledger\RecordPayment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The field app reads these answers by their field names, so each one's
 * shape (every key, at every depth) is pinned in
 * mobile-response-shapes.json. A field added, renamed or dropped fails
 * here first; when the change is meant, update the app and the snapshot
 * together.
 */
class MobileResponseShapeTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_cash_boxes_answer_keeps_its_shape(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 11)->setTime(10, 0));
        $branch = Branch::factory()->create();
        $head = User::factory()->branchAdmin()->for($branch)->create();
        $collector = User::factory()->collector()->for($branch)->create();
        app(BranchClosingWorkflow::class)->start($branch->id, $head);
        RecordPayment::handle(Subscription::factory()->for($branch)->create(), $collector, ['amount' => '100', 'currency' => 'ILS', 'payment_method' => CashBoxType::BankTransfer->value, 'bank_name' => 'بنك فلسطين', 'reference_number' => 'TRX-'.Str::ulid()]);
        $box = CashBox::query()->where('user_id', $collector->id)->sole();
        CollectorDebt::factory()->create(['cash_box_id' => $box->id, 'user_id' => $collector->id, 'branch_id' => $branch->id]);
        AuditNote::factory()->create(['closing_id' => Closing::factory()->submitted()->create(['branch_id' => $branch->id])->id, 'cash_box_id' => $box->id, 'assigned_to' => $collector->id, 'status' => 'with_collector']);

        $answer = $this->withToken(MobileAccessToken::issue($collector))->getJson(route('mobile.cash-boxes.index'))->assertOk()->json();

        $this->assertShape('cash-boxes.index', $answer);
    }

    public function test_the_adjustment_answer_keeps_its_shape(): void
    {
        $collector = User::factory()->withPermissions([PermissionKey::AddClearings])->create();
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        SubscriptionTransaction::factory()->create(['subscription_id' => $subscription->id, 'amount' => 100]);

        $answer = $this->withToken(MobileAccessToken::issue($collector))
            ->postJson(route('mobile.collections.subscriptions.adjustments', $subscription), ['mobile_operation_id' => (string) Str::uuid(), 'action' => 'clearing', 'amount' => 25, 'notes' => 'خدمة'])
            ->assertCreated()->json();

        $this->assertShape('collections.subscriptions.adjustments', $answer);
    }

    public function test_the_split_transfer_answer_keeps_its_shape(): void
    {
        $actor = User::factory()->branchAdmin()->create();
        [$first, $second] = Subscription::factory()->count(2)->create(['branch_id' => $actor->branch_id]);

        $answer = $this->withToken(MobileAccessToken::issue($actor))->postJson(route('mobile.split-payments.store'), [
            'mobile_operation_id' => (string) Str::uuid(), 'collector_confirmed' => true,
            'total_amount' => '100', 'bank_name' => 'بنك فلسطين', 'sender_name' => 'محمد', 'reference_number' => 'SPLIT-SHAPE-1',
            'parts' => [['subscription_id' => $first->id, 'amount' => '40'], ['subscription_id' => $second->id, 'amount' => '60']],
        ])->assertCreated()->json();

        $this->assertShape('split-payments.store', $answer);
    }

    public function test_the_message_answers_keep_their_shape(): void
    {
        Queue::fake([SendSubscriptionMessage::class]);
        config(['services.sms.driver' => 'http']);
        $collector = User::factory()->collector()->create();
        $collector->permissions()->sync(Permission::idsFor([PermissionKey::RecordCollections, PermissionKey::RecordCashPayments, PermissionKey::SendMessages]));
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id, 'phone' => '0599000111']);
        $this->withToken(MobileAccessToken::issue($collector));

        $list = $this->getJson(route('mobile.messages.subscriptions'))->assertOk()->json();
        $sent = $this->postJson(route('mobile.collections.subscriptions.messages.store', $subscription), ['mobile_operation_id' => (string) Str::uuid(), 'body' => 'مرحباً'])
            ->assertCreated()->json();

        $this->assertShape('messages.subscriptions', $list);
        $this->assertShape('collections.subscriptions.messages.store', $sent);
    }

    /**
     * Compare an answer's shape with the snapshot. Run with
     * MOBILE_SHAPES_UPDATE=1 to write the snapshot from the answer instead.
     */
    private function assertShape(string $name, mixed $answer): void
    {
        $file = __DIR__.'/mobile-response-shapes.json';
        $shapes = is_file($file) ? json_decode((string) file_get_contents($file), true, flags: JSON_THROW_ON_ERROR) : [];

        if (getenv('MOBILE_SHAPES_UPDATE')) {
            $shapes[$name] = $this->shape($answer);
            ksort($shapes);
            file_put_contents($file, json_encode($shapes, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
        }

        $this->assertArrayHasKey($name, $shapes, "No snapshot for {$name}; run with MOBILE_SHAPES_UPDATE=1.");
        $this->assertSame($shapes[$name], $this->shape($answer), "The shape of {$name} changed.");
    }

    /**
     * Every key at every depth, sorted: an object as its keys' shapes, a
     * list as its first item's shape, and any other value as its JSON type.
     */
    private function shape(mixed $value): mixed
    {
        if (is_array($value) && array_is_list($value)) {
            return $value === [] ? [] : [$this->shape($value[0])];
        }

        if (is_array($value)) {
            $keys = array_map(fn (mixed $item): mixed => $this->shape($item), $value);
            ksort($keys);

            return $keys;
        }

        return $value === null ? 'null' : 'value';
    }
}
