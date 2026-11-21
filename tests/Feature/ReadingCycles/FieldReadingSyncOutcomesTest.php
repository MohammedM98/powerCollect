<?php

namespace Tests\Feature\ReadingCycles;

use App\Enums\ReadingSubmissionStatus;
use App\Models\Branch;
use App\Models\MeterBox;
use App\Models\MeterReading;
use App\Models\MobileAccessToken;
use App\Models\ReadingCycle;
use App\Models\ReadingSubmission;
use App\Models\Subscription;
use App\Models\User;
use Closure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * What becomes of a reading the field app uploads for its assignment, for
 * the outcomes the reading cycle tests do not reach, and a supervisor's
 * review of a held one.
 */
class FieldReadingSyncOutcomesTest extends TestCase
{
    use RefreshDatabase;

    private Branch $branch;

    private User $branchAdmin;

    private User $reader;

    private ReadingCycle $cycle;

    private Subscription $subscription;

    /** @var array{id: int, authorization: string} */
    private array $download;

    protected function setUp(): void
    {
        parent::setUp();

        // The branch reads on Thursdays; the week of 16–22 October is read on the 22nd.
        $this->travelTo(Carbon::parse('2026-10-20 09:00', 'Asia/Gaza'));
        $this->branch = Branch::factory()->create();
        $this->branchAdmin = User::factory()->branchAdmin()->create(['branch_id' => $this->branch->id]);
        $this->reader = User::factory()->dataEntry()->create(['branch_id' => $this->branch->id]);
        $box = MeterBox::factory()->create(['branch_id' => $this->branch->id]);
        $this->subscription = Subscription::factory()->create(['branch_id' => $this->branch->id, 'meter_box_id' => $box->id, 'circuit_breaker_id' => null, 'initial_reading' => 100]);
        $this->cycle = ReadingCycle::factory()->create([
            'branch_id' => $this->branch->id, 'week_start' => '2026-10-16', 'week_end' => '2026-10-22', 'reading_date' => '2026-10-22', 'created_by' => $this->branchAdmin->id,
        ]);
        $this->actingAs($this->branchAdmin)->post(route('reading-cycles.assignments.store', $this->cycle), ['box_ids' => [$box->id], 'target' => 'mobile', 'user_id' => $this->reader->id]);
        $this->post(route('reading-cycles.assignments.approve', $this->cycle), []);

        $this->travelTo(Carbon::parse('2026-10-22 10:00', 'Asia/Gaza'));
        $this->withHeader('Authorization', 'Bearer '.MobileAccessToken::issue($this->reader));
        $this->download = $this->getJson(route('mobile.reading-assignments.index'))->json('assignments.0');
    }

    private function upload(float $currentReading, ?string $capturedAt = null): TestResponse
    {
        return $this->postJson(route('mobile.reading-assignments.sync'), ['readings' => [[
            'operation_id' => (string) Str::uuid(), 'assignment_id' => $this->download['id'], 'authorization' => $this->download['authorization'],
            'subscription_id' => $this->subscription->id, 'current_reading' => $currentReading,
            'captured_at' => ($capturedAt === null ? now() : Carbon::parse($capturedAt, 'Asia/Gaza'))->toIso8601String(),
        ]]])->assertOk();
    }

    public function test_a_reading_on_its_day_within_the_limits_becomes_the_weeks_reading(): void
    {
        $this->upload(150)->assertJsonPath('results.0.status', 'accepted')->assertJsonPath('results.0.issue', null);

        $this->assertSame(150.0, MeterReading::query()->sole()->current_reading);
    }

    /**
     * @return array<string, array{0: Closure(self): void, 1: float|(Closure(): float), 2: string, 3: string}>
     */
    public static function heldOrRefused(): array
    {
        return [
            'the cycle was closed' => [fn (self $test) => $test->cycle->forceFill(['closed_at' => now()])->save(), 150, 'needs_review', 'cycle_closed'],
            'uploaded after the sync deadline' => [fn (self $test) => $test->travelTo(Carbon::parse('2026-10-25 09:00', 'Asia/Gaza')), 150, 'needs_review', 'late_sync'],
            'a later week is already read' => [fn (self $test) => MeterReading::factory()->for($test->subscription)->create([
                'week_start' => '2026-10-23', 'week_end' => '2026-10-29', 'previous_reading' => 100, 'current_reading' => 120, 'consumption' => 20,
            ]), 150, 'needs_review', 'later_week_read'],
            'below the previous reading' => [fn (self $test) => null, 90, 'needs_review', 'below_previous'],
            'an impossible consumption' => [fn (self $test) => null, fn (): float => 100 + (float) config('powercollect.readings.max_weekly_kwh') + 1, 'needs_review', 'impossible_consumption'],
            'the subscription left the box' => [fn (self $test) => $test->subscription->update(['meter_box_id' => MeterBox::factory()->create(['branch_id' => $test->branch->id])->id]), 150, 'rejected', 'not_on_box'],
        ];
    }

    /**
     * @param  Closure(self): void  $before
     * @param  float|(Closure(): float)  $currentReading  a closure where the value comes from the configuration
     */
    #[DataProvider('heldOrRefused')]
    public function test_a_reading_that_does_not_check_out_is_kept_but_not_saved(Closure $before, float|Closure $currentReading, string $status, string $issue): void
    {
        $before($this);
        $readings = MeterReading::query()->count();

        $this->upload($currentReading instanceof Closure ? $currentReading() : $currentReading, '2026-10-22 10:00')
            ->assertJsonPath('results.0.status', $status)
            ->assertJsonPath('results.0.issue', $issue)
            ->assertJsonPath('results.0.message', __(ReadingSubmission::ISSUES[$issue]));

        $this->assertSame($issue, ReadingSubmission::query()->sole()->issue);
        $this->assertSame($readings, MeterReading::query()->count());
    }

    public function test_a_supervisor_rejects_a_held_reading_once_and_it_stays_on_record(): void
    {
        $this->upload(90)->assertJsonPath('results.0.issue', 'below_previous');
        $held = ReadingSubmission::query()->sole();

        $this->actingAs($this->branchAdmin)->post(route('reading-submissions.review', $held), ['decision' => 'reject', 'note' => 'العداد لم يُقرأ جيدًا'])
            ->assertSessionHas('status', 'reading-submission-rejected');
        $this->assertSame([ReadingSubmissionStatus::Rejected, $this->branchAdmin->id, 'العداد لم يُقرأ جيدًا'], [$held->fresh()->status, $held->fresh()->reviewed_by, $held->fresh()->review_note]);

        $this->post(route('reading-submissions.review', $held), ['decision' => 'reject'])->assertSessionHasErrors(['decision' => 'تمت مراجعة هذه القراءة من قبل.']);
        $this->post(route('reading-submissions.review', $held), ['decision' => 'accept'])->assertSessionHasErrors(['decision' => __('This reading was already reviewed.')]);

        $this->assertSame(ReadingSubmissionStatus::Rejected, $held->fresh()->status);
        $this->assertSame(0, MeterReading::query()->count());
    }
}
