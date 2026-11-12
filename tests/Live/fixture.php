<?php

use App\Models\User;
use Database\Seeders\BankSeeder;
use Database\Seeders\CurrencyRateSeeder;
use Database\Seeders\PermissionSeeder;

/**
 * What a deployment starts from before the live scenarios run: the
 * permission list, the currencies, the banks and one Super Admin. Everything
 * else is set up by the scenarios through the website.
 */
if (! app()->environment('local') || ! str_ends_with((string) config('database.connections.'.config('database.default').'.database'), '_live') || ! getenv('LIVE_TEST_CLOCK')) {
    throw new RuntimeException('The live test fixture needs the isolated *_live database and the test clock.');
}

(new PermissionSeeder)->run();
(new CurrencyRateSeeder)->run();
(new BankSeeder)->run();
User::factory()->superAdmin()->create(['name' => 'مالك الشركة', 'username' => 'owner', 'password' => 'Strong-Pass-2026']);
