<?php

namespace Database\Factories;

use App\Models\Subscription;
use App\Models\SubscriptionArchiveEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SubscriptionArchiveEvent>
 */
class SubscriptionArchiveEventFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'subscription_id' => Subscription::factory(),
            'action' => SubscriptionArchiveEvent::ARCHIVE,
            'user_id' => User::factory(),
            'user_name' => fake()->name(),
            'reason' => fake()->sentence(),
            'service_ended_on' => now()->toDateString(),
        ];
    }
}
