<?php

namespace Tests\Feature;

use App\Models\MobileAccessToken;
use App\Models\Subscription;
use App\Models\User;
use App\Support\Ledger\RecordPayment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class PaymentReferencePrivacyTest extends TestCase
{
    use RefreshDatabase;

    #[TestWith([false])]
    #[TestWith([true])]
    public function test_a_reference_conflict_hides_other_branch_details_without_branch_domains(bool $split): void
    {
        config(['powercollect.branch_domains_enabled' => false]);
        $actor = User::factory()->branchAdmin()->create();
        $own = Subscription::factory()->create(['branch_id' => $actor->branch_id]);
        $foreignActor = User::factory()->branchAdmin()->create();
        $foreign = Subscription::factory()->create(['branch_id' => $foreignActor->branch_id, 'full_name' => 'Private Foreign Subscriber']);
        RecordPayment::handle($foreign, $foreignActor, ['amount' => '40', 'currency' => 'ILS', 'payment_method' => 'bank_transfer', 'bank_name' => 'بنك فلسطين', 'sender_name' => 'Foreign Sender', 'reference_number' => 'PRIVATE-123']);

        $url = $split
            ? route('payments.split.reference-status', ['reference_number' => 'PRIVATE-123'])
            : route('subscriptions.payments.reference-status', [$own, 'reference_number' => 'PRIVATE-123']);

        $this->actingAs($actor)->getJson($url)
            ->assertOk()->assertJsonPath('available', false)->assertJsonPath('conflict.id', null)
            ->assertJsonPath('conflict.voucherNumber', null)->assertJsonPath('conflict.url', null)
            ->assertDontSee('Private Foreign Subscriber');
    }

    public function test_a_possible_duplicate_warning_hides_other_branch_details_without_branch_domains(): void
    {
        config(['powercollect.branch_domains_enabled' => false]);
        $actor = User::factory()->branchAdmin()->create();
        $own = Subscription::factory()->create(['branch_id' => $actor->branch_id]);
        $foreignActor = User::factory()->branchAdmin()->create();
        $foreign = Subscription::factory()->create(['branch_id' => $foreignActor->branch_id, 'full_name' => 'Private Foreign Subscriber']);
        RecordPayment::handle($foreign, $foreignActor, ['amount' => '40', 'currency' => 'ILS', 'payment_method' => 'bank_transfer', 'bank_name' => 'بنك فلسطين', 'sender_name' => 'Foreign Sender', 'reference_number' => 'PRIVATE-123']);

        $this->actingAs($actor)->getJson(route('subscriptions.payments.reference-status', [$own, 'reference_number' => 'NEW-123', 'amount' => '40', 'currency' => 'ILS', 'sender_name' => 'Foreign Sender']))
            ->assertOk()->assertJsonPath('available', true)->assertJsonPath('warning.id', null)
            ->assertJsonPath('warning.url', null)->assertDontSee('Private Foreign Subscriber');
    }

    public function test_a_rejected_reference_does_not_disclose_a_foreign_subscriber_in_validation_errors(): void
    {
        config(['powercollect.branch_domains_enabled' => false]);
        $actor = User::factory()->branchAdmin()->create();
        $own = Subscription::factory()->create(['branch_id' => $actor->branch_id]);
        $foreignActor = User::factory()->branchAdmin()->create();
        $foreign = Subscription::factory()->create(['branch_id' => $foreignActor->branch_id, 'full_name' => 'Private Foreign Subscriber']);
        $payment = ['amount' => '40', 'currency' => 'ILS', 'payment_method' => 'bank_transfer', 'bank_name' => 'بنك فلسطين', 'sender_name' => 'Foreign Sender', 'reference_number' => 'PRIVATE-123'];
        RecordPayment::handle($foreign, $foreignActor, $payment);
        $this->actingAs($actor);

        try {
            RecordPayment::handle($own, $actor, $payment);
            $this->fail('A reference already used by another branch must be refused.');
        } catch (ValidationException $exception) {
            $this->assertSame(['reference_number' => ['هذا الرقم المرجعي مسجّل مسبقًا على دفعة أخرى.']], $exception->errors());
        }

        $this->assertDatabaseCount('subscription_transactions', 1);
    }

    public function test_mobile_reference_checks_do_not_disclose_another_branch_subscriber(): void
    {
        $actor = User::factory()->branchAdmin()->create();
        $foreignActor = User::factory()->branchAdmin()->create();
        $foreign = Subscription::factory()->create(['branch_id' => $foreignActor->branch_id, 'full_name' => 'Private Foreign Subscriber']);
        RecordPayment::handle($foreign, $foreignActor, ['amount' => '40', 'currency' => 'ILS', 'payment_method' => 'bank_transfer', 'bank_name' => 'بنك فلسطين', 'sender_name' => 'Foreign Sender', 'reference_number' => 'PRIVATE-123']);

        $this->withHeader('Authorization', 'Bearer '.MobileAccessToken::issue($actor))
            ->getJson(route('mobile.collections.reference-status', ['reference_number' => 'PRIVATE-123']))
            ->assertOk()->assertJsonPath('available', false)->assertJsonPath('conflict.voucher_number', null)
            ->assertJsonPath('conflict.subscription_name', null)->assertDontSee('Private Foreign Subscriber');
    }
}
