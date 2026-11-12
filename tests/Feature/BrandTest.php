<?php

namespace Tests\Feature;

use App\Support\Branding\Brand;
use App\Support\Branding\BrandDesign;
use App\Support\Branding\CompanyForms;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BrandTest extends TestCase
{
    use RefreshDatabase;

    /** Where each test writes the identity files it imports. */
    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        $this->directory = storage_path('framework/testing/brand-'.uniqid());
        File::ensureDirectoryExists($this->directory);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->directory);

        parent::tearDown();
    }

    /**
     * Write an identity file for "شركة خليل" (its logo beside it) and return its path.
     *
     * @param  array<string, mixed>  $changes
     */
    private function identityFile(array $changes = []): string
    {
        File::put($this->directory.'/khalil.png', UploadedFile::fake()->image('khalil.png', 120, 60)->getContent());

        $identity = array_replace_recursive([
            'version' => 1,
            'company' => ['name' => 'شركة خليل للكهرباء', 'nameEnglish' => 'Khalil Power Co.', 'shortName' => 'خليل', 'tagline' => 'نظام تحصيل خليل'],
            'logos' => ['main' => 'khalil.png'],
            'colors' => ['primary' => '#1E88E5', 'print' => '#0F766E'],
        ], $changes);

        File::put($this->directory.'/identity.json', json_encode($identity, JSON_UNESCAPED_UNICODE));

        return $this->directory.'/identity.json';
    }

    public function test_pages_show_the_default_company_until_one_is_imported(): void
    {
        $response = $this->get(route('login'));

        $response->assertInertia(fn ($page) => $page
            ->where('brand.name', 'سوبر باور')
            ->where('brand.logos.main', '/images/logo-superpower.svg')
            ->where('brand.logos.print', '/images/logo-superpower.svg')
            ->where('brand.animatedLogo', true)
            ->where('brand.printColor', '#A51D26'));
        $response->assertSee('<link rel="icon" href="/favicon.svg">', false);
    }

    public function test_pages_start_in_the_superpower_charcoal_glass_look_in_charcoal(): void
    {
        $response = $this->get(route('login'));

        $response->assertInertia(fn ($page) => $page
            ->where('brand.primaryColor', '#2B3138')
            ->where('brand.design.preset', 'superpower')
            ->where('brand.design.navigation', 'sidebar')
            ->where('brand.design.cards', 'glass')
            ->where('brand.design.details', 'modal'));
        $response->assertSee('data-ui-background="graphite"', false);
        $response->assertSee('data-ui-neutral="graphite"', false);
        $response->assertSee(':root{--brand-50:', false);
        $response->assertSee('.dark{--brand-50:', false);
        // The charcoal look keeps theme.css's own neutral greys: no tinted grey scale is drawn over them.
        $response->assertDontSee('--gray-50:', false);
    }

    public function test_an_imported_identity_reaches_every_page_with_its_logo_and_colours(): void
    {
        $this->artisan('brand:import', ['file' => $this->identityFile()])->assertSuccessful();

        $logo = Storage::disk('public')->files('brand');
        $this->assertCount(1, $logo);
        $this->assertMatchesRegularExpression('#^brand/main-[0-9a-f]{16}\.png$#', $logo[0]);
        $logoUrl = Storage::disk('public')->url($logo[0]);

        $response = $this->get(route('login'));

        $response->assertInertia(fn ($page) => $page
            ->where('brand.name', 'شركة خليل للكهرباء')
            ->where('brand.nameEnglish', 'Khalil Power Co.')
            ->where('brand.shortName', 'خليل')
            ->where('brand.tagline', 'نظام تحصيل خليل')
            ->where('brand.logos.main', $logoUrl)
            ->where('brand.logos.light', $logoUrl)
            ->where('brand.logos.print', $logoUrl)
            ->where('brand.animatedLogo', false)
            ->where('brand.printColor', '#0F766E'));
        $response->assertSee('<link rel="icon" href="'.$logoUrl.'">', false);
        $response->assertSee(':root{--brand-50:', false);
        $response->assertSee('--ui-danger:rgb(var(--danger-600))', false);
    }

    public function test_a_file_naming_only_a_preset_gets_its_whole_look_with_any_choice_it_changes(): void
    {
        $this->artisan('brand:import', ['file' => $this->identityFile(['design' => ['preset' => 'soft', 'tables' => 'bordered']])])->assertSuccessful();

        $this->get(route('login'))->assertInertia(fn ($page) => $page
            ->where('brand.design.navigation', 'sidebar')
            ->where('brand.design.radius', 'round')
            ->where('brand.design.buttons', 'soft')
            ->where('brand.design.tables', 'bordered'))
            ->assertSee('data-ui-navigation="sidebar"', false);
    }

    public function test_company_forms_start_with_the_imported_company_on_their_letterhead(): void
    {
        $this->artisan('brand:import', ['file' => $this->identityFile()])->assertSuccessful();

        $layout = CompanyForms::defaultLayout();

        $this->assertSame('شركة خليل للكهرباء', $layout['header']['company']);
        $this->assertSame('نظام تحصيل خليل', $layout['header']['subtitle']);
        $this->assertSame('خليل', $layout['watermark']['text']);
    }

    public function test_import_rejects_an_identity_without_a_name_or_with_a_colour_that_is_not_hex(): void
    {
        $file = $this->identityFile(['company' => ['name' => ''], 'colors' => ['primary' => 'blue']]);

        $this->artisan('brand:import', ['file' => $file])
            ->expectsOutputToContain('company.name')
            ->expectsOutputToContain('colors.primary')
            ->assertFailed();

        $this->assertFalse(app(Brand::class)->isImported());
        $this->assertSame([], Storage::disk('public')->files('brand'));
    }

    public function test_import_rejects_a_logo_that_is_not_a_png_jpeg_or_webp_image(): void
    {
        File::put($this->directory.'/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

        $this->artisan('brand:import', ['file' => $this->identityFile(['logos' => ['main' => 'logo.svg']])])
            ->expectsOutputToContain('PNG, JPEG or WebP')
            ->assertFailed();

        $this->assertFalse(app(Brand::class)->isImported());
    }

    public function test_import_warns_when_white_text_would_not_read_on_the_main_colour(): void
    {
        $this->artisan('brand:import', ['file' => $this->identityFile(['colors' => ['primary' => '#FFD600']])])
            ->expectsOutputToContain('below the 4.5:1 minimum')
            ->assertSuccessful();
    }

    public function test_an_exported_identity_carries_its_logos_and_imports_the_same_on_another_server(): void
    {
        $this->artisan('brand:import', ['file' => $this->identityFile()])->assertSuccessful();
        $imported = app(Brand::class)->profile();

        $this->artisan('brand:export', ['file' => $this->directory.'/exported.json'])->assertSuccessful();
        $exported = json_decode(File::get($this->directory.'/exported.json'), true);
        $this->assertStringStartsWith('data:image/png;base64,', $exported['logos']['main']);

        // Another server: nothing stored yet.
        Storage::fake('local');
        Storage::fake('public');
        $this->app->forgetScopedInstances();
        File::delete($this->directory.'/khalil.png');

        $this->artisan('brand:import', ['file' => $this->directory.'/exported.json'])->assertSuccessful();

        $this->assertSame($imported, app(Brand::class)->profile());
    }

    public function test_reset_brings_back_the_default_company_and_removes_the_imported_logos(): void
    {
        $this->artisan('brand:import', ['file' => $this->identityFile()])->assertSuccessful();

        $this->artisan('brand:reset', ['--force' => true])->assertSuccessful();

        $this->assertFalse(app(Brand::class)->isImported());
        $this->assertSame([], Storage::disk('public')->files('brand'));
        $this->get(route('login'))->assertInertia(fn ($page) => $page->where('brand.name', 'سوبر باور'));
    }

    public function test_every_ready_company_identity_imports_with_its_logos(): void
    {
        $files = glob(resource_path('brand/companies/*/*.json'));
        $this->assertNotEmpty($files);

        foreach ($files as $file) {
            Storage::fake('public');
            $this->app->forgetScopedInstances();

            $this->artisan('brand:import', ['file' => $file])->assertSuccessful();

            $profile = app(Brand::class)->profile();
            foreach (array_filter($profile['logos']) as $logo) {
                Storage::disk('public')->assertExists($logo);
            }
        }
    }

    public function test_a_neutral_tone_and_status_colours_of_the_companys_own_reach_every_page(): void
    {
        $file = $this->identityFile(['colors' => ['primary' => null, 'success' => '#16A34A'], 'design' => ['neutral' => 'slate', 'navStyle' => 'dark']]);
        $this->artisan('brand:import', ['file' => $file])->assertSuccessful();

        $response = $this->get(route('login'));

        $response->assertSee(':root{--success-50:', false);
        $response->assertSee('--gray-50:237 241 247;', false);
        $response->assertSee('.dark{--gray-50:', false);
        $response->assertSee(":root:is([data-ui-nav-style='dark'],[data-ui-nav-style='brand']) :is(.tn-glass,.sn-panel){--gray-50:", false);
        $response->assertSee('data-ui-nav-style="dark"', false);
        $response->assertInertia(fn ($page) => $page->where('brand.stylesheet', app(Brand::class)->stylesheet()));
    }

    public function test_the_full_example_identity_imports(): void
    {
        $this->artisan('brand:import', ['file' => resource_path('brand/example.json')])->assertSuccessful();

        $profile = app(Brand::class)->profile();
        $this->assertSame('executive', $profile['design']['preset']);
        $this->assertSame('#16A34A', $profile['colors']['success']);
    }

    public function test_the_options_command_lists_every_preset_and_choice(): void
    {
        $this->assertSame(0, Artisan::call('brand:options'));
        $output = Artisan::output();

        foreach ([...array_keys(BrandDesign::PRESETS), ...array_keys(BrandDesign::OPTIONS), ...array_keys(BrandDesign::TOKENS)] as $name) {
            $this->assertStringContainsString($name, $output);
        }
    }

    public function test_an_identity_round_trips_all_palette_roles_and_component_choices(): void
    {
        $colors = ['secondary' => '#334155', 'accent' => '#b45309', 'background' => '#f8fafc', 'surface' => '#ffffff'];
        $design = ['tableVariant' => 'ledger', 'motionStyle' => 'slide', 'details' => 'modal', 'footerStyle' => 'compact', 'navHighlight' => 'accent'];

        $this->artisan('brand:import', ['file' => $this->identityFile(['colors' => $colors, 'design' => $design])])->assertSuccessful();

        $profile = app(Brand::class)->export();
        foreach ($colors as $role => $hex) {
            $this->assertSame(strtoupper($hex), $profile['colors'][$role]);
        }
        foreach ($design as $key => $value) {
            $this->assertSame($value, $profile['design'][$key]);
        }
        $this->get(route('login'))->assertInertia(fn ($page) => $page
            ->where('brand.colors.accent', '#B45309')
            ->where('brand.design.details', 'modal'))
            ->assertSee('--brand-secondary-500:51 65 85;', false)
            ->assertSee('--brand-accent-500:180 83 9;', false)
            ->assertSee('--gray-50:248 250 252;', false)
            ->assertSee('--surface:255 255 255;', false)
            ->assertSee('data-ui-table-variant="ledger"', false);
    }

    public function test_a_look_saved_with_the_retired_side_panel_opens_details_as_a_popup(): void
    {
        $design = BrandDesign::normalize(['preset' => 'superpower', 'details' => 'drawer']);

        $this->assertSame('modal', $design['details']);
        $this->assertSame('superpower', $design['preset']);
    }

    public function test_a_look_saved_in_the_retired_navy_or_night_blue_shows_in_charcoal(): void
    {
        foreach (['superpower', 'custom'] as $preset) {
            foreach (['navy', 'midnight'] as $background) {
                $design = BrandDesign::normalize(['preset' => $preset, 'background' => $background, 'neutral' => 'navy']);

                $this->assertSame('graphite', $design['background'], "{$preset} saved with {$background}");
                $this->assertSame('graphite', $design['neutral'], "{$preset} saved with {$background}");
            }
        }

        $this->assertSame('superpower', BrandDesign::normalize(['preset' => 'superpower', 'background' => 'navy', 'neutral' => 'navy'])['preset']);
    }

    public function test_import_rejects_invalid_palette_roles_and_component_choices_without_saving(): void
    {
        $file = $this->identityFile(['colors' => ['secondary' => 'red', 'accent' => '#123', 'background' => 'url(x)', 'surface' => '#xyzxyz'], 'design' => ['tableVariant' => 'unknown', 'motionStyle' => 'spin', 'details' => 'page', 'footerStyle' => 'missing']]);

        $this->artisan('brand:import', ['file' => $file])
            ->expectsOutputToContain('colors.secondary')
            ->expectsOutputToContain('colors.accent')
            ->expectsOutputToContain('colors.background')
            ->expectsOutputToContain('colors.surface')
            ->expectsOutputToContain('design.tableVariant')
            ->expectsOutputToContain('design.motionStyle')
            ->expectsOutputToContain('design.details')
            ->expectsOutputToContain('design.footerStyle')
            ->assertFailed();

        $this->assertFalse(app(Brand::class)->isImported());
    }

    public function test_exact_values_reach_every_page_and_win_over_the_choices(): void
    {
        $file = $this->identityFile(['design' => ['radius' => 'soft'], 'tokens' => ['radiusScale' => 1.6, 'buttonRadius' => 20, 'transitionMs' => 240, 'glassAlpha' => 0.75, 'glassBlur' => 24]]);
        $this->artisan('brand:import', ['file' => $file])->assertSuccessful();

        $response = $this->get(route('login'));

        $response->assertSee('data-ui-radius="soft"', false);
        $response->assertSee(':root[data-ui-navigation]{--radius-scale:1.6;--ui-transition:240ms;--glass-alpha:0.75;--glass-blur:24px;}', false);
        $response->assertSee(':root[data-ui-navigation] :is(.ui-btn-primary,.ui-btn-secondary,.ui-btn-danger){border-radius:20px;}', false);
    }

    public function test_import_rejects_an_exact_value_outside_its_range(): void
    {
        $this->artisan('brand:import', ['file' => $this->identityFile(['tokens' => ['buttonHeight' => 200]])])
            ->expectsOutputToContain('tokens.buttonHeight')
            ->assertFailed();

        $this->assertFalse(app(Brand::class)->isImported());
    }

    public function test_the_companys_own_css_reaches_pages_without_escaping_its_style_or_loading_other_sites(): void
    {
        $css = '.ui-page-title{letter-spacing:.02em} .x{background:url(https://evil.test/a.png)} .y{background:u\\72l(https://evil.test)} </style><script>alert(1)</script>';
        $this->artisan('brand:import', ['file' => $this->identityFile(['customCss' => $css])])->assertSuccessful();

        $response = $this->get(route('login'));

        $response->assertSee('.ui-page-title{letter-spacing:.02em}', false);
        $response->assertDontSee('url(https://evil.test', false);
        $response->assertDontSee('u\\72l', false);
        $response->assertDontSee('</style><script', false);
        $response->assertDontSee('<script>alert', false);
    }
}
