<?php

namespace Tests\Feature;

use App\Http\Resources\Mobile\RecordedCollectionResource;
use App\Models\SubscriptionTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The field app's tests read the server's answers from mobile/test/fixtures
 * (mobile/test/core/api_contract_test.dart). These keep each fixture's
 * fields the ones the API Resource sends, so a field renamed or dropped on
 * either side fails a test on both.
 */
class MobileApiFixturesTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, mixed>
     */
    private function fixture(string $name): array
    {
        return json_decode((string) file_get_contents(base_path("mobile/test/fixtures/{$name}.json")), true, flags: JSON_THROW_ON_ERROR);
    }

    public function test_the_recorded_payment_fixture_has_the_fields_the_server_sends(): void
    {
        $payment = SubscriptionTransaction::factory()->create([
            'type' => SubscriptionTransaction::TYPE_PAYMENT,
            'payment_method' => 'cash',
            'amount' => '-25',
            'currency_amount' => '25',
        ])->fresh();

        $sent = (new RecordedCollectionResource($payment))->resolve();
        $fixture = $this->fixture('recorded_collection');

        $this->assertEqualsCanonicalizing(array_keys($sent), array_keys($fixture));

        foreach ($sent as $field => $value) {
            if ($value !== null && $fixture[$field] !== null) {
                $this->assertSame(is_numeric($value), is_numeric($fixture[$field]), "\"{$field}\" changed between a number and text");
            }
        }
    }
}
