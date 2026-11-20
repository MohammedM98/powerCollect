<?php

namespace Tests\Feature;

use Illuminate\Console\Scheduling\Event;
use Illuminate\Support\Facades\Schedule;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The jobs the server runs on its own: the nightly backup, closing the
 * weekly boxes, preparing reading distributions and watching the queue.
 * Removing one, or changing how often it runs, fails here instead of
 * being noticed weeks later.
 */
class ScheduleTest extends TestCase
{
    /**
     * @return array<string, array{0: string, 1: string, 2: bool}>
     */
    public static function scheduledCommands(): array
    {
        return [
            'nightly backup' => ['backup:run', '30 2 * * *', true],
            'weekly box closing' => ['closings:process', '* * * * *', true],
            'reading distributions' => ['readings:prepare-distributions', '0 * * * *', true],
            'queue watch' => ['queue:monitor database:default --max=100', '*/5 * * * *', false],
        ];
    }

    #[DataProvider('scheduledCommands')]
    public function test_the_command_runs_on_its_schedule(string $command, string $expression, bool $withoutOverlapping): void
    {
        $events = collect(Schedule::events())->filter(fn (Event $event): bool => str_ends_with((string) $event->command, "'artisan' {$command}") || str_ends_with((string) $event->command, "artisan {$command}"));

        $this->assertCount(1, $events, "{$command} should be scheduled once.");
        $this->assertSame($expression, $events->first()->expression);
        $this->assertSame($withoutOverlapping, $events->first()->withoutOverlapping);
    }
}
