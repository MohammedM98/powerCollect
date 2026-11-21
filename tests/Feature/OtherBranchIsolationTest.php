<?php

namespace Tests\Feature;

use App\Enums\AuditAction;
use App\Enums\PermissionKey;
use App\Enums\ReadingAssignmentChannel;
use App\Enums\ReadingAssignmentStatus;
use App\Enums\ReadingSubmissionStatus;
use App\Models\Area;
use App\Models\AuditNote;
use App\Models\Branch;
use App\Models\CashBox;
use App\Models\Closing;
use App\Models\DisconnectionList;
use App\Models\MessageBatch;
use App\Models\MeterBox;
use App\Models\MeterReading;
use App\Models\MobileAccessToken;
use App\Models\PaperSheet;
use App\Models\ReadingAssignment;
use App\Models\ReadingCycle;
use App\Models\ReadingSubmission;
use App\Models\SubArea;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\RecordPayment;
use App\Support\Readings\ReadingWeeks;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * A branch administrator who holds every permission still cannot open or
 * change another branch's records. These are the routes that had no
 * "another branch" test before.
 */
class OtherBranchIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Branch $ownBranch;

    private Branch $foreignBranch;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ownBranch = Branch::factory()->inArea(Area::factory()->create())->create();
        $this->foreignBranch = Branch::factory()->inArea(Area::factory()->create())->create();
        $this->admin = User::factory()->branchAdmin()->withPermissions(PermissionKey::cases())->create(['branch_id' => $this->ownBranch->id]);
        // Audit access reaches every branch unless narrowed; here it covers the admin's own branch only.
        $this->admin->audit_settings = ['scope' => 'selected', 'branch_ids' => [$this->ownBranch->id], 'actions' => array_column(AuditAction::cases(), 'value')];
        $this->admin->save();
    }

    /**
     * Each case builds the other branch's record and returns the route's
     * parameters, the record that must stay as it was, and the request body.
     * The admin is passed for records that are addressed to a person.
     *
     * @return array<string, array{0: string, 1: string, 2: callable(Branch, User): array{0: array<int, Model>, 1: Model, 2?: array<string, mixed>}}>
     */
    public static function foreignRecordRoutes(): array
    {
        $subscription = fn (Branch $branch): array => [[$record = Subscription::factory()->create(['branch_id' => $branch->id])], $record];
        $payment = fn (Branch $branch, string $method): SubscriptionTransaction => RecordPayment::handle(
            Subscription::factory()->create(['branch_id' => $branch->id]),
            User::factory()->collector()->create(['branch_id' => $branch->id]),
            ['amount' => '100', 'currency' => 'ILS', 'payment_method' => $method, 'bank_name' => 'بنك فلسطين', 'reference_number' => 'REF-'.$branch->id],
        );
        $transaction = function (Branch $branch) use ($payment): array {
            $line = $payment($branch, 'cash');

            return [[$line->subscription, $line], $line, ['notes' => 'تعديل من فرع آخر']];
        };
        $reading = function (Branch $branch): array {
            // The last week before the latest ended one: the week a "last reading" may still be corrected.
            $week = ReadingWeeks::weekStartFor(ReadingWeeks::latestEndedWeekStart($branch->id)->subDay(), $branch->id);
            $reading = MeterReading::factory()->for(Subscription::factory()->create(['branch_id' => $branch->id]))->create([
                'week_start' => $week->toDateString(), 'week_end' => ReadingWeeks::weekEndFor($week, $branch->id)->toDateString(),
            ]);

            return [[$reading], $reading, ['current_reading' => 9999]];
        };
        $cycle = fn (Branch $branch): array => [[$record = ReadingCycle::factory()->create(['branch_id' => $branch->id])], $record];
        $sheet = function (Branch $branch): array {
            $sheet = PaperSheet::create(['reading_cycle_id' => ReadingCycle::factory()->create(['branch_id' => $branch->id])->id, 'sheet_number' => $branch->id, 'print_count' => 0, 'created_by' => User::factory()->create(['branch_id' => $branch->id])->id]);

            return [[$sheet], $sheet];
        };
        $submission = function (Branch $branch): array {
            $assignment = ReadingAssignment::factory()->for(ReadingCycle::factory()->create(['branch_id' => $branch->id]), 'cycle')->create();
            $subscription = Subscription::factory()->create(['branch_id' => $branch->id, 'meter_box_id' => $assignment->meter_box_id]);
            $held = ReadingSubmission::create([
                'reading_cycle_id' => $assignment->reading_cycle_id, 'reading_assignment_id' => $assignment->id,
                'subscription_id' => $subscription->id, 'user_id' => User::factory()->create(['branch_id' => $branch->id])->id,
                'operation_id' => (string) Str::uuid(), 'assignment_version' => 1, 'current_reading' => 120,
                'captured_at' => now(), 'received_at' => now(), 'status' => ReadingSubmissionStatus::NeedsReview, 'issue' => 'below_previous',
            ]);

            return [[$held], $held, ['decision' => 'reject']];
        };
        $box = fn (Branch $branch): array => [[$record = MeterBox::factory()->create(['branch_id' => $branch->id])], $record];
        $list = fn (Branch $branch): array => [[$record = DisconnectionList::factory()->create(['branch_id' => $branch->id])], $record];
        $listItems = function (Branch $branch): array {
            $list = DisconnectionList::factory()->create(['branch_id' => $branch->id]);
            $subscription = Subscription::factory()->create(['branch_id' => $branch->id]);

            return [[$list], $list, ['subscription_ids' => [$subscription->id], 'items' => [$subscription->id]]];
        };

        return [
            'preview a subscription reading baseline' => ['POST', 'subscriptions.reading-baseline.preview', fn (Branch $branch): array => [...$subscription($branch), ['initial_reading' => 10]]],
            'set a standing discount' => ['PUT', 'subscriptions.standing-discount.update', fn (Branch $branch): array => [...$subscription($branch), ['method' => 'fixed', 'value' => 5]]],
            'amend an account line' => ['PATCH', 'subscriptions.transactions.amend', $transaction],
            'reply to an audit note' => ['POST', 'payments.audit-notes.reply', function (Branch $branch, User $admin): array {
                $note = AuditNote::factory()->create([
                    'closing_id' => Closing::factory()->submitted()->create(['branch_id' => $branch->id])->id,
                    'assigned_to' => $admin->id, 'status' => 'with_collector',
                ]);

                return [[$note], $note, ['body' => 'رد من فرع آخر']];
            }],
            'open a bank transfer audit' => ['GET', 'payments.bank-audits.show', function (Branch $branch) use ($payment): array {
                $entry = $payment($branch, 'bank_transfer')->boxEntry;

                return [[$entry], $entry];
            }],
            'preview a reading adjustment' => ['POST', 'meter-readings.adjustment-preview', $reading],
            'preview a last reading' => ['POST', 'meter-readings.last-reading-preview', $reading],
            'open a paper sheet' => ['GET', 'paper-sheets.show', $sheet],
            'mark a paper sheet printed' => ['POST', 'paper-sheets.printed', $sheet],
            'change a reading cycle' => ['PATCH', 'reading-cycles.update', fn (Branch $branch): array => [...$cycle($branch), ['reading_date' => now()->toDateString()]]],
            'assign readers in a cycle' => ['POST', 'reading-cycles.assignments.store', $cycle],
            'approve a cycle\'s assignments' => ['POST', 'reading-cycles.assignments.approve', $cycle],
            'copy last week into a cycle' => ['POST', 'reading-cycles.copy-previous', $cycle],
            'print paper sheets for a cycle' => ['POST', 'reading-cycles.paper-sheets.store', $cycle],
            'see a cycle\'s held mobile readings' => ['GET', 'reading-cycles.submissions.index', $cycle],
            'review a held mobile reading' => ['POST', 'reading-submissions.review', $submission],
            'edit a meter box' => ['GET', 'meter-boxes.edit', $box],
            'delete a meter box' => ['DELETE', 'meter-boxes.destroy', $box],
            'change a disconnection list' => ['PATCH', 'disconnection-lists.update', fn (Branch $branch): array => [...$list($branch), ['name' => 'قائمة من فرع آخر']]],
            'see disconnection candidates' => ['GET', 'disconnection-lists.candidates', $list],
            'preview disconnection items' => ['POST', 'disconnection-lists.items.preview', $listItems],
            'remove disconnection items' => ['POST', 'disconnection-lists.items.remove', $listItems],
            'reschedule disconnection items' => ['POST', 'disconnection-lists.items.reschedule', $listItems],
            'warn disconnection items' => ['POST', 'disconnection-lists.items.warn', $listItems],
            'retry a message send' => ['POST', 'messages.retry', fn (Branch $branch): array => [[$record = MessageBatch::factory()->create(['branch_id' => $branch->id])], $record]],
            'delete a sub-area' => ['DELETE', 'sub-areas.destroy', fn (Branch $branch): array => [[$record = SubArea::factory()->create(['area_id' => $branch->area_id])], $record]],
            'delete a staff member' => ['DELETE', 'users.destroy', fn (Branch $branch): array => [[$record = User::factory()->collector()->create(['branch_id' => $branch->id])], $record]],
        ];
    }

    /**
     * @param  callable(Branch, User): array{0: array<int, Model>, 1: Model, 2?: array<string, mixed>}  $makeRecord
     */
    #[DataProvider('foreignRecordRoutes')]
    public function test_another_branchs_record_is_refused_and_left_as_it_was(string $method, string $routeName, callable $makeRecord): void
    {
        // The same request on the admin's own branch gets past the branch check, so a refusal below is the branch's doing.
        [$ownParameters, , $ownPayload] = [...$makeRecord($this->ownBranch, $this->admin), []];
        $own = $this->actingAs($this->admin)->call($method, route($routeName, $ownParameters), $ownPayload);
        $this->assertNotContains($own->status(), [403, 404], "{$routeName} refused the admin's own branch with {$own->status()}");

        [$parameters, $record, $payload] = [...$makeRecord($this->foreignBranch, $this->admin), []];
        $before = $record->fresh()->getAttributes();

        $response = $this->actingAs($this->admin)->call($method, route($routeName, $parameters), $payload);

        $this->assertContains($response->status(), [403, 404], "{$routeName} answered {$response->status()}");
        $this->assertSame($before, $record->fresh()?->getAttributes());
    }

    public function test_another_branchs_id_in_a_list_or_a_new_record_is_ignored(): void
    {
        $foreignCycle = ReadingCycle::factory()->create(['branch_id' => $this->foreignBranch->id]);
        PaperSheet::create(['reading_cycle_id' => $foreignCycle->id, 'sheet_number' => 1, 'print_count' => 0, 'created_by' => $this->admin->id]);
        $this->actingAs($this->admin);

        $this->getJson(route('payments.money-flow', ['branch_id' => $this->foreignBranch->id]))->assertNotFound();
        $this->getJson(route('payments.money-flow', ['branch_id' => $this->ownBranch->id]))->assertOk();
        $this->getJson(route('messages.quick', ['branch_id' => $this->foreignBranch->id]))->assertOk()->assertJsonPath('weekBranchId', $this->ownBranch->id);
        $this->get(route('messages.create', ['branch_id' => $this->foreignBranch->id]))->assertInertia(fn ($page) => $page->where('weekBranchId', $this->ownBranch->id));
        $this->get(route('paper-sheets.index'))->assertOk();

        $week = ReadingWeeks::weekStartFor(now(), $this->ownBranch->id);
        $this->post(route('reading-cycles.store'), [
            'branch_id' => $this->foreignBranch->id, 'week_start' => $week->toDateString(), 'reading_date' => ReadingWeeks::weekEndFor($week, $this->ownBranch->id)->toDateString(),
        ])->assertSessionHasNoErrors();
        $this->assertSame([$this->foreignBranch->id, $this->ownBranch->id], ReadingCycle::query()->orderBy('id')->pluck('branch_id')->all());
        $this->get(route('reading-cycles.index', ['branch_id' => $this->foreignBranch->id]))
            ->assertInertia(fn ($page) => $page->where('cycle.branchName', $this->ownBranch->name));
    }

    public function test_the_mobile_app_never_hands_out_or_confirms_another_branchs_work(): void
    {
        $reader = User::factory()->collector()->withPermissions([PermissionKey::RecordMeterReadings])->create(['branch_id' => $this->ownBranch->id]);
        $assignments = [];
        foreach ([$this->ownBranch, $this->foreignBranch] as $branch) {
            $cycle = ReadingCycle::factory()->create(['branch_id' => $branch->id, 'reading_date' => now()->toDateString()]);
            $assignments[] = ReadingAssignment::factory()->for($cycle, 'cycle')->create([
                'user_id' => $reader->id, 'channel' => ReadingAssignmentChannel::Mobile, 'status' => ReadingAssignmentStatus::Approved,
            ]);
        }
        $foreignBox = CashBox::factory()->create(['branch_id' => $this->foreignBranch->id, 'user_id' => $reader->id, 'status' => 'received']);
        $this->withHeader('Authorization', 'Bearer '.MobileAccessToken::issue($reader));

        $this->getJson(route('mobile.reading-assignments.index'))->assertOk()
            ->assertJsonPath('assignments.*.id', [$assignments[0]->id]);
        $this->assertNull($assignments[1]->fresh()->downloaded_at);

        foreach ([$this->foreignBranch->id, $this->ownBranch->id] as $branchId) {
            $this->postJson(route('mobile.cash-boxes.actions', ['confirm', $foreignBox]), ['branch_id' => $branchId])->assertNotFound();
        }
        $this->assertNull($foreignBox->fresh()->confirmed_at);
    }
}
