<?php

namespace Tests\Feature;

use App\Models\MobileAccessToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class MobileDiagnosticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_signed_in_app_sends_its_error_log_to_the_server_log(): void
    {
        $user = User::factory()->create();
        Log::spy();

        $this->withHeaders(['Authorization' => 'Bearer '.MobileAccessToken::issue($user), 'X-App-Build' => '42'])
            ->postJson(route('mobile.v1.diagnostics.store'), ['log' => "2026-11-12T08:00:00Z flutter StateError\n#0 main"])
            ->assertAccepted()
            ->assertJson(['status' => 'received']);

        Log::shouldHaveReceived('warning')->once()->withArgs(fn (string $message, array $context): bool => $message === 'Mobile app diagnostics'
            && $context['user_id'] === $user->id
            && $context['build'] === '42'
            && str_contains($context['log'], 'StateError'));
    }

    public function test_the_log_needs_a_signed_in_app_and_a_bounded_text(): void
    {
        $this->postJson(route('mobile.v1.diagnostics.store'), ['log' => 'x'])->assertUnauthorized();

        $this->withHeader('Authorization', 'Bearer '.MobileAccessToken::issue(User::factory()->create()))
            ->postJson(route('mobile.v1.diagnostics.store'), ['log' => str_repeat('x', 65537)])
            ->assertJsonValidationErrors('log');
    }
}
