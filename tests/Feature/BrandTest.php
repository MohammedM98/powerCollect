<?php

namespace Tests\Feature;

use App\Support\Brand;
use App\Support\CompanyForms;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
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
            ->where('brand.name', 'شركة أبناء فارس أبو زايد للتجارة والاستيراد')
            ->where('brand.logos.main', '/images/logo-af.webp')
            ->where('brand.logos.print', '/images/logo-af.webp')
            ->where('brand.animatedLogo', true)
            ->where('brand.printColor', '#A51D26'));
        $response->assertSee('<link rel="icon" href="/favicon.svg">', false);
        $response->assertDontSee('<style>', false);
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
        $this->get(route('login'))->assertInertia(fn ($page) => $page->where('brand.name', 'شركة أبناء فارس أبو زايد للتجارة والاستيراد'));
    }
}
