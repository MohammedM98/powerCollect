<?php

namespace Database\Factories;

use App\Models\MeterReading;
use App\Models\MeterReadingAdjustment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MeterReadingAdjustment>
 */
class MeterReadingAdjustmentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $user = User::factory();

        return [
            'meter_reading_id' => MeterReading::factory(),
            'user_id' => $user,
            'user_name' => fake()->name(),
            'kind' => 'reading_correction',
            'before' => ['currentReading' => 100],
            'after' => ['currentReading' => 110],
            'reason' => null,
        ];
    }
}
