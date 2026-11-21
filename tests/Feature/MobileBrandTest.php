<?php

namespace Tests\Feature;

use App\Support\Branding\BrandPalette;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

class MobileBrandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
    }

    public function test_the_app_gets_the_websites_default_look_before_anyone_signs_in(): void
    {
        $required = Yaml::parseFile(__DIR__.'/mobile-api-contract.yaml')['components']['schemas']['BrandColors']['required'];

        $response = $this->getJson(route('mobile.v1.brand'))->assertOk()
            ->assertJsonPath('company.name', 'مصعب العجل وأحمد الكفارنة')
            ->assertJsonPath('logos.main', url('/images/logo-ma.svg'))
            ->assertJsonPath('fonts.body', 'zain')
            // The MA identity's orange, with theme.css's charcoal main button and graphite page.
            ->assertJsonPath('colors.light.brand', '#CA4E05')
            ->assertJsonPath('colors.light.action', '#24272E')
            ->assertJsonPath('colors.light.page', '#ECEEF1')
            ->assertJsonPath('colors.dark.brand', '#DC642E')
            ->assertJsonPath('colors.dark.surface', '#15181D');

        foreach (['light', 'dark'] as $theme) {
            $this->assertSame($required, array_keys($response->json("colors.$theme")));
        }
    }

    public function test_a_companys_own_identity_reaches_the_app_in_both_themes(): void
    {
        $before = $this->getJson(route('mobile.v1.brand'))->json('fingerprint');
        Artisan::call('brand:import', ['file' => resource_path('brand/companies/ma/ma.json')]);
        $palette = BrandPalette::fromHex('#E2642A');
        $hex = fn (string $triple): string => vsprintf('#%02X%02X%02X', array_map('intval', explode(' ', $triple)));

        $response = $this->getJson(route('mobile.v1.brand'))->assertOk()
            ->assertJsonPath('company.name', 'مصعب العجل وأحمد الكفارنة')
            ->assertJsonPath('company.tagline', 'للتجارة العامة')
            ->assertJsonPath('colors.light.brand', $hex($palette['light'][500]))
            ->assertJsonPath('colors.dark.brand', $hex($palette['dark'][600]))
            ->assertJsonPath('colors.light.brand_fill_ink', '#FFFFFF');

        $this->assertStringStartsWith(url('/storage/brand/main-'), $response->json('logos.main'));
        $this->assertStringStartsWith(url('/storage/brand/light-'), $response->json('logos.light'));
        $this->assertNotSame($before, $response->json('fingerprint'));
    }

    public function test_the_look_the_app_ships_with_is_the_servers_default(): void
    {
        $shipped = json_decode((string) file_get_contents(base_path('mobile/assets/brand/default.json')), true, flags: JSON_THROW_ON_ERROR);
        $server = $this->getJson(route('mobile.v1.brand'))->json();

        $this->assertSame([$server['company'], $server['fonts'], $server['colors']], [$shipped['company'], $shipped['fonts'], $shipped['colors']]);
    }
}
