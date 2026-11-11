<?php

namespace App\Providers;

use App\Models\CashBox;
use App\Models\CashBoxPayment;
use App\Models\DisconnectionListItem;
use App\Models\MeterBox;
use App\Models\MeterReading;
use App\Models\SmsSetting;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Branches\BranchDomainScope;
use App\Support\Branches\BranchSettings;
use App\Support\Branding\Brand;
use App\Support\Closing\BranchClosingWorkflow;
use App\Support\Messaging\HttpSmsGateway;
use App\Support\Messaging\LogSmsGateway;
use App\Support\Messaging\SmsGateway;
use App\Support\OperationsAlert;
use App\Support\Reports\ReportCache;
use Illuminate\Queue\Events\QueueBusy;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // The reading and closing schedules are read by every week and period calculation, so loaded once per request or job.
        $this->app->scoped(BranchSettings::class);

        // The company's identity is read once per request: every page, its head and its printouts show it.
        $this->app->scoped(Brand::class);

        // SMS go out through the provider set up in the dashboard while it is on, else the gateway named in
        // services.sms.driver; until one is set up they're only logged.
        $this->app->bind(SmsGateway::class, function (): SmsGateway {
            $setting = SmsSetting::active();

            if ($setting !== null) {
                return new HttpSmsGateway($setting->gatewayConfig(), $setting->country_code);
            }

            return match (config('services.sms.driver')) {
                'http' => new HttpSmsGateway(config('services.sms.http'), (string) config('services.sms.country_code')),
                default => new LogSmsGateway,
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        BranchDomainScope::register();
        SubscriptionTransaction::created(function (SubscriptionTransaction $payment): void {
            app(BranchClosingWorkflow::class)->capture($payment);
        });
        SubscriptionTransaction::updated(function (SubscriptionTransaction $payment): void {
            if ($payment->wasChanged(['currency', 'currency_amount', 'amount', 'payment_method', 'status'])) {
                app(BranchClosingWorkflow::class)->syncEditablePayment($payment);
            }
        });
        SubscriptionTransaction::deleting(function (SubscriptionTransaction $payment): void {
            app(BranchClosingWorkflow::class)->releaseEditablePayment($payment);
        });
        Event::listen(function (QueueBusy $event): void {
            report(new RuntimeException("The {$event->connectionName}:{$event->queue} queue has {$event->size} jobs waiting."));
            OperationsAlert::notifySuperAdmins('queue-busy', (string) $event->size);
        });
        // Report figures stay cached until what they count changes (ReportCache).
        SubscriptionTransaction::updated(fn () => ReportCache::touch(ReportCache::HISTORY));
        SubscriptionTransaction::created(function (SubscriptionTransaction $line): void {
            if ($line->created_at?->lt(now()->subMinute())) {
                ReportCache::touch(ReportCache::HISTORY);
            }
        });
        foreach ([SubscriptionTransaction::class, MeterReading::class, CashBox::class, CashBoxPayment::class, Subscription::class, MeterBox::class, DisconnectionListItem::class] as $model) {
            $model::saved(fn () => ReportCache::touch(ReportCache::ACTIVITY));
            $model::deleted(fn () => ReportCache::touch(ReportCache::ACTIVITY));
        }
        Password::defaults(fn (): Password => Password::min(8));

        // The company's identity and look: the Super Admin's, unless the server keeps it (powercollect.brand_editor_enabled).
        Gate::define('manage-brand', fn (User $user): bool => $user->isSuperAdmin() && config('powercollect.brand_editor_enabled'));
    }
}
