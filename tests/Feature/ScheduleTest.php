<?php

namespace Tests\Feature;

use Illuminate\Console\Scheduling\Event;
use Illuminate\Support\Facades\Schedule;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The jobs the server runs on its own: the nightly backup, closing the
 * weekly boxes, preparing reading distributions and watching the queue.
 * Removing one, changing how often it runs, or letting a stopped run
 * hold its lock for a day, fails here instead of being noticed weeks later.
 */
class ScheduleTest extends TestCase
{
    /**
     * @return array<string, array{0: string, 1: string, 2: bool, 3: int}>
     */
    public static function scheduledCommands(): array
    {
        return [
            'nightly backup' => ['backup:run', '30 2 * * *', true, 1440],
            'weekly box closing' => ['closings:process', '* * * * *', true, 10],
            'reading distributions' => ['readings:prepare-distributions', '0 * * * *', true, 10],
            'queue watch' => ['queue:monitor database:default --max=100', '*/5 * * * *', false, 1440],
        ];
    }

    #[DataProvider('scheduledCommands')]
    public function test_the_command_runs_on_its_schedule(string $command, string $expression, bool $withoutOverlapping, int $lockMinutes): void
    {
        $events = collect(Schedule::events())->filter(fn (Event $event): bool => str_ends_with((string) $event->command, "'artisan' {$command}") || str_ends_with((string) $event->command, "artisan {$command}"));

        $this->assertCount(1, $events, "{$command} should be scheduled once.");
        $this->assertSame($expression, $events->first()->expression);
        $this->assertSame($withoutOverlapping, $events->first()->withoutOverlapping);
        $this->assertSame($lockMinutes, $events->first()->expiresAt);
    }
}
