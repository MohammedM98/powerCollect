<?php

namespace Tests\Feature;

use Tests\TestCase;

class AppLocaleConfigTest extends TestCase
{
    /** The app config as it comes out when the host never sets APP_LOCALE. */
    private function appConfigWithoutLocale(): array
    {
        $before = [$_SERVER['APP_LOCALE'] ?? null, $_ENV['APP_LOCALE'] ?? null, getenv('APP_LOCALE')];
        unset($_SERVER['APP_LOCALE'], $_ENV['APP_LOCALE']);
        putenv('APP_LOCALE');

        try {
            return require config_path('app.php');
        } finally {
            [$server, $env, $process] = $before;
            $server === null || $_SERVER['APP_LOCALE'] = $server;
            $env === null || $_ENV['APP_LOCALE'] = $env;
            putenv($process === false ? 'APP_LOCALE' : "APP_LOCALE={$process}");
        }
    }

    public function test_a_host_without_app_locale_shows_the_arabic_labels(): void
    {
        $locale = $this->appConfigWithoutLocale()['locale'];
        app()->setLocale($locale);

        $this->assertSame('ar', $locale);
        $this->assertSame('منطقة 2', __('Second area'));
        $this->assertSame('قيد الانتظار', __('Suspended'));
    }
}
