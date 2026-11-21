<?php

use App\Support\OperationsAlert;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// The database and stored files are backed up every night, and sent off the server when a backup disk is set.
Schedule::command('backup:run')->dailyAt('02:30')->withoutOverlapping()->onFailure(function (): void {
    report(new RuntimeException('The nightly backup failed; see the log.'));
    OperationsAlert::notifySuperAdmins('backup-failed');
});
// A run stopped half way (a deploy, a restart) holds its lock ten minutes, not Laravel's default day.
Schedule::command('closings:process')->everyMinute()->withoutOverlapping(10)->onFailure(function (): void {
    report(new RuntimeException('Processing the scheduled closings failed; see the log.'));
    OperationsAlert::notifySuperAdmins('closings-failed');
});
Schedule::command('readings:prepare-distributions')->hourly()->withoutOverlapping(10);

// A queue that keeps more than 100 jobs waiting (a stopped worker) is reported, through the QueueBusy event.
Schedule::command('queue:monitor database:default --max=100')->everyFiveMinutes();
