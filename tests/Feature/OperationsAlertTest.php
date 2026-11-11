<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\OperationsAlert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Queue\Events\QueueBusy;
use Illuminate\Support\Facades\Exceptions;
use RuntimeException;
use Tests\TestCase;

class OperationsAlertTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_failed_duty_is_shown_to_the_active_super_admins_only(): void
    {
        $superAdmin = User::factory()->superAdmin()->create();
        $inactiveSuperAdmin = User::factory()->superAdmin()->create(['is_active' => false]);
        $branchAdmin = User::factory()->branchAdmin()->create();

        OperationsAlert::notifySuperAdmins('backup-failed');

        $this->assertSame('backup-failed', $superAdmin->notifications()->sole()->data['action']);
        $this->assertSame(0, $inactiveSuperAdmin->notifications()->count());
        $this->assertSame(0, $branchAdmin->notifications()->count());
    }

    public function test_a_duty_that_keeps_failing_is_not_repeated_until_the_alert_is_read(): void
    {
        $superAdmin = User::factory()->superAdmin()->create();

        OperationsAlert::notifySuperAdmins('closings-failed');
        OperationsAlert::notifySuperAdmins('closings-failed');
        OperationsAlert::notifySuperAdmins('backup-failed');

        $this->assertSame(2, $superAdmin->notifications()->count());

        $superAdmin->unreadNotifications->markAsRead();
        OperationsAlert::notifySuperAdmins('closings-failed');

        $this->assertSame(3, $superAdmin->notifications()->count());
    }

    public function test_a_busy_queue_is_reported_and_shown_to_the_super_admins(): void
    {
        Exceptions::fake();
        $superAdmin = User::factory()->superAdmin()->create();

        event(new QueueBusy('database', 'default', 150));

        Exceptions::assertReported(fn (RuntimeException $exception) => str_contains($exception->getMessage(), '150 jobs waiting'));
        $this->assertSame('queue-busy', $superAdmin->notifications()->sole()->data['action']);
    }
}
