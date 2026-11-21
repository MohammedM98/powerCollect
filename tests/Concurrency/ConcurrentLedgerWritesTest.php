<?php

namespace Tests\Concurrency;

use App\Models\MobileAccessToken;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Process\Pool;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The same request sent twice at the same instant by two PHP processes, each
 * with its own MySQL connection, as a double tap or a retried upload does in
 * production. SQLite and a single test connection cannot show these races:
 * SQLite ignores `lockForUpdate`, and one connection never waits on itself.
 *
 * Rows are committed (workers must see them), so the tables are emptied
 * between tests instead of rolled back, keeping the rows the migrations seed.
 */
class ConcurrentLedgerWritesTest extends TestCase
{
    use DatabaseTruncation;

    private const ROUNDS = 5;

    /** @var list<string> */
    protected $exceptTables = ['migrations', 'banks', 'currency_rates', 'message_templates', 'payment_voucher_sequences', 'permissions'];

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped('Concurrency tests need MySQL: SQLite ignores row locks.');
        }
    }

    public function test_two_identical_website_payments_record_one_line_and_show_both_the_same_receipt(): void
    {
        $collector = User::factory()->branchAdmin()->create();

        for ($round = 1; $round <= self::ROUNDS; $round++) {
            $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
            $payment = ['payment_token' => (string) Str::uuid(), 'amount' => '10', 'currency' => 'ILS', 'payment_method' => 'cash'];
            $job = ['method' => 'POST', 'uri' => route('subscriptions.payments.store', $subscription, false), 'payload' => $payment, 'accept' => 'text/html', 'acting_user_id' => $collector->id];

            [$first, $second] = $this->race($job, $job);

            $this->assertSame([302, 302], [$first['status'], $second['status']], "Round {$round}: ".json_encode([$first, $second], JSON_UNESCAPED_UNICODE));
            $this->assertSame([[], []], [$first['errors'], $second['errors']], "Round {$round}: a duplicate tap was refused instead of replayed.");
            $this->assertSame(1, $this->paymentsOf($subscription), "Round {$round}: one key recorded more than one payment.");
            $this->assertSame(1, DB::table('web_payment_operations')->where('token', $payment['payment_token'])->count());
            $this->assertNotNull($first['flash']['recordedPayment']['voucherNumber'] ?? null);
            $this->assertSame($first['flash']['recordedPayment']['receiptUrl'], $second['flash']['recordedPayment']['receiptUrl'] ?? null, "Round {$round}: the two taps were shown different receipts.");
            $this->assertSame($first['flash']['recordedPayment']['voucherNumber'], $second['flash']['recordedPayment']['voucherNumber'] ?? null);
        }
    }

    public function test_the_same_mobile_collection_uploaded_twice_at_once_records_one_line_and_answers_both_alike(): void
    {
        $collector = User::factory()->branchAdmin()->create();
        $token = MobileAccessToken::issue($collector);

        for ($round = 1; $round <= self::ROUNDS; $round++) {
            $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
            $job = $this->mobileJob($token, route('mobile.collections.store', [], false), [
                'mobile_operation_id' => (string) Str::uuid(), 'collector_confirmed' => true,
                'subscription_id' => $subscription->id, 'amount' => '25', 'currency' => 'ILS', 'payment_method' => 'cash',
            ]);

            [$first, $second] = $this->race($job, $job);

            $this->assertBothCreatedAlike($first, $second, $round);
            $this->assertSame(1, $this->paymentsOf($subscription), "Round {$round}: one upload recorded more than one payment.");
        }
    }

    public function test_the_same_mobile_split_transfer_uploaded_twice_at_once_records_one_group(): void
    {
        $collector = User::factory()->branchAdmin()->create();
        $token = MobileAccessToken::issue($collector);

        for ($round = 1; $round <= self::ROUNDS; $round++) {
            $first = $this->owingSubscription($collector);
            $second = $this->owingSubscription($collector);
            $job = $this->mobileJob($token, route('mobile.split-payments.store', [], false), [
                'mobile_operation_id' => (string) Str::uuid(), 'collector_confirmed' => true,
                'total_amount' => '100', 'bank_name' => 'بنك فلسطين', 'sender_name' => 'محمد', 'reference_number' => 'RACE-SPLIT-'.Str::random(8),
                'parts' => [['subscription_id' => $first->id, 'amount' => '40'], ['subscription_id' => $second->id, 'amount' => '60']],
            ]);

            [$one, $other] = $this->race($job, $job);

            $this->assertBothCreatedAlike($one, $other, $round);
            $this->assertSame([1, 1], [$this->paymentsOf($first), $this->paymentsOf($second)], "Round {$round}: one upload recorded more than one split transfer.");
        }
    }

    public function test_the_same_mobile_charge_uploaded_twice_at_once_records_one_line(): void
    {
        $collector = User::factory()->branchAdmin()->create();
        $token = MobileAccessToken::issue($collector);

        for ($round = 1; $round <= self::ROUNDS; $round++) {
            $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
            $job = $this->mobileJob($token, route('mobile.collections.subscriptions.adjustments', $subscription, false), [
                'mobile_operation_id' => (string) Str::uuid(), 'action' => 'charge', 'type' => 'penalty', 'amount' => 25, 'notes' => 'غرامة',
            ]);

            [$first, $second] = $this->race($job, $job);

            $this->assertBothCreatedAlike($first, $second, $round);
            $this->assertSame(1, SubscriptionTransaction::query()->acrossBranches()->where('subscription_id', $subscription->id)->count(), "Round {$round}: one upload recorded more than one charge.");
        }
    }

    public function test_the_same_transfer_reference_sent_from_two_branches_at_once_is_recorded_only_once(): void
    {
        $firstCollector = User::factory()->branchAdmin()->create();
        $secondCollector = User::factory()->branchAdmin()->create();
        $firstToken = MobileAccessToken::issue($firstCollector);
        $secondToken = MobileAccessToken::issue($secondCollector);

        for ($round = 1; $round <= self::ROUNDS; $round++) {
            $reference = 'RACE'.Str::upper(Str::random(10));
            $jobs = collect([[$firstCollector, $firstToken], [$secondCollector, $secondToken]])->map(fn (array $side): array => $this->mobileJob($side[1], route('mobile.collections.store', [], false), [
                'mobile_operation_id' => (string) Str::uuid(), 'collector_confirmed' => true,
                'subscription_id' => Subscription::factory()->create(['branch_id' => $side[0]->branch_id])->id,
                'amount' => '25', 'currency' => 'ILS', 'payment_method' => 'bank_transfer',
                'bank_name' => 'بنك فلسطين', 'sender_name' => 'Sender', 'reference_number' => $reference,
            ]));

            [$first, $second] = $this->race($jobs[0], $jobs[1]);

            $statuses = [$first['status'], $second['status']];
            sort($statuses);
            $recorded = SubscriptionTransaction::query()->acrossBranches()->where('active_reference', $reference)->count();
            $this->assertSame(1, $recorded, "Round {$round}: one bank reference was recorded {$recorded} times across two branches (responses ".implode(' and ', $statuses).').');
            $this->assertSame([201, 422], $statuses);
        }
    }

    /**
     * Runs both jobs in separate PHP processes that start their request at
     * the same instant, and returns what each one answered.
     *
     * @param  array<string, mixed>  $first
     * @param  array<string, mixed>  $second
     * @return array{0: array<string, mixed>, 1: array<string, mixed>}
     */
    private function race(array $first, array $second): array
    {
        $startAt = microtime(true) + 1.5;
        $connection = config('database.connections.mysql');
        $environment = [
            'APP_ENV' => 'testing', 'APP_KEY' => config('app.key'), 'APP_URL' => config('app.url'),
            'DB_CONNECTION' => 'mysql', 'DB_URL' => (string) $connection['url'], 'DB_HOST' => $connection['host'], 'DB_PORT' => (string) $connection['port'],
            'DB_DATABASE' => $connection['database'], 'DB_USERNAME' => $connection['username'], 'DB_PASSWORD' => (string) $connection['password'],
            'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'MAIL_MAILER' => 'array', 'BROADCAST_CONNECTION' => 'null',
            'BRANCH_DOMAINS_ENABLED' => 'false', 'PULSE_ENABLED' => 'false', 'TELESCOPE_ENABLED' => 'false', 'NIGHTWATCH_ENABLED' => 'false',
        ];

        $results = Process::pool(function (Pool $pool) use ($first, $second, $startAt, $environment): void {
            foreach ([$first, $second] as $job) {
                $pool->path(base_path())->env($environment)->timeout(60)
                    ->command([PHP_BINARY, 'tests/Concurrency/worker.php', json_encode([...$job, 'start_at' => $startAt], JSON_THROW_ON_ERROR)]);
            }
        })->start()->wait();

        $answers = [];
        foreach ($results as $result) {
            $this->assertTrue($result->successful(), 'A worker crashed: '.$result->errorOutput().$result->output());
            $answers[] = json_decode($result->output(), true, flags: JSON_THROW_ON_ERROR);
        }
        $this->assertLessThan(0.05, abs($answers[0]['started_at'] - $answers[1]['started_at']), 'The two requests did not start together.');

        return [$answers[0], $answers[1]];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function mobileJob(string $token, string $uri, array $payload): array
    {
        return ['method' => 'POST', 'uri' => $uri, 'payload' => $payload, 'headers' => ['Authorization' => 'Bearer '.$token]];
    }

    /**
     * @param  array<string, mixed>  $first
     * @param  array<string, mixed>  $second
     */
    private function assertBothCreatedAlike(array $first, array $second, int $round): void
    {
        $this->assertSame([201, 201], [$first['status'], $second['status']], "Round {$round}: ".json_encode([$first['body'], $second['body']], JSON_UNESCAPED_UNICODE));
        $this->assertSame($first['body'], $second['body'], "Round {$round}: the two uploads were answered differently.");
    }

    private function owingSubscription(User $collector): Subscription
    {
        $subscription = Subscription::factory()->create(['branch_id' => $collector->branch_id]);
        SubscriptionTransaction::factory()->for($subscription)->create(['amount' => '100.00']);

        return $subscription;
    }

    private function paymentsOf(Subscription $subscription): int
    {
        return SubscriptionTransaction::query()->acrossBranches()->where('subscription_id', $subscription->id)->where('type', SubscriptionTransaction::TYPE_PAYMENT)->count();
    }
}
