<?php

namespace Database\Factories;

use App\Enums\AuditAction;
use App\Models\User;
use App\Models\UserAuditScope;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserAuditScope>
 */
class UserAuditScopeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'scope' => 'all',
            'actions' => array_column(AuditAction::cases(), 'value'),
        ];
    }
}
