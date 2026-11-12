<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use App\Support\Branding\Brand;
use App\Support\Branding\BrandDesign;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The company's identity and look set from Settings: only the Super Admin
 * changes it, and only while the server lets the screen do so; what it
 * saves reaches every page and comes back out as the identity file.
 */
class BrandSettingTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        config(['powercollect.brand_editor_enabled' => true]);
        $this->superAdmin = User::factory()->superAdmin()->create();
    }

    /**
     * @param  array<string, mixed>  $changes
     * @return array<string, mixed>
     */
    private function form(array $changes = []): array
    {
        return array_replace_recursive([
            'company' => ['name' => 'شركة خليل للكهرباء', 'nameEnglish' => 'Khalil Power Co.', 'shortName' => 'خليل', 'tagline' => 'نظام تحصيل خليل'],
            'colors' => ['primary' => '#0F766E', 'print' => null],
            'design' => ['preset' => 'custom', ...BrandDesign::PRESETS['corporate']['design']],
        ], $changes);
    }

    public function test_only_the_super_admin_changes_the_identity(): void
    {
        $branchAdmin = User::factory()->branchAdmin()->create();

        $this->actingAs($branchAdmin)->get(route('settings.appearance.edit'))->assertForbidden();
        $this->actingAs($branchAdmin)->post(route('settings.appearance.update'), $this->form())->assertForbidden();
        $this->actingAs($branchAdmin)->get(route('settings.appearance.export'))->assertForbidden();
        $this->actingAs($branchAdmin)->post(route('settings.appearance.reset'))->assertForbidden();
        $this->assertFalse(app(Brand::class)->isImported());

        $this->actingAs($this->superAdmin)->get(route('settings.appearance.edit'))
            ->assertInertia(fn ($page) => $page
                ->component('Settings/Appearance')
                ->where('profile.design.navigation', 'sidebar')
                ->where('profile.ownLogos', ['main', 'icon'])
                ->where('presets.corporate.design.navStyle', 'solid')
                ->where('can.manageBrand', true));
    }

    public function test_a_server_that_keeps_the_identity_closes_the_screen_even_to_the_super_admin(): void
    {
        config(['powercollect.brand_editor_enabled' => false]);

        $this->actingAs($this->superAdmin)->get(route('settings.appearance.edit'))->assertForbidden();
        $this->actingAs($this->superAdmin)->post(route('settings.appearance.update'), $this->form())->assertForbidden();
        $this->actingAs($this->superAdmin)->get(route('dashboard'))->assertInertia(fn ($page) => $page->where('can.manageBrand', false));
    }

    public function test_saving_reaches_every_page_with_the_new_logo_colour_and_look(): void
    {
        $this->actingAs($this->superAdmin)
            ->post(route('settings.appearance.update'), $this->form(['design' => ['bodyFont' => 'cairo', 'headingFont' => 'kufi'], 'logos' => ['main' => UploadedFile::fake()->image('khalil.png', 120, 60)]]))
            ->assertRedirect(route('settings.appearance.edit'))
            ->assertSessionHas('status', 'brand-updated');

        $logo = Storage::disk('public')->files('brand');
        $this->assertCount(1, $logo);

        $response = $this->get(route('dashboard'));

        $response->assertInertia(fn ($page) => $page
            ->where('brand.name', 'شركة خليل للكهرباء')
            ->where('brand.logos.main', Storage::disk('public')->url($logo[0]))
            ->where('brand.primaryColor', '#0F766E')
            ->where('brand.printColor', '#0F766E')
            ->where('brand.design.navigation', 'sidebar')
            ->where('brand.design.tables', 'bordered'));
        $response->assertSee('data-ui-navigation="sidebar"', false);
        $response->assertSee('data-ui-buttons="solid"', false);
        $response->assertSee('data-ui-density="compact"', false);
        $response->assertSee('data-ui-body-font="cairo"', false);
        $response->assertSee('data-ui-heading-font="kufi"', false);
        $response->assertSee('<style id="brand-colors">:root{--brand-50:', false);
    }

    public function test_a_logo_without_a_new_file_is_kept_and_one_marked_is_removed(): void
    {
        $this->actingAs($this->superAdmin)->post(route('settings.appearance.update'), $this->form(['logos' => [
            'main' => UploadedFile::fake()->image('main.png', 120, 60),
            'print' => UploadedFile::fake()->image('print.png', 120, 60),
        ]]))->assertSessionHasNoErrors();
        $saved = app(Brand::class)->profile()['logos'];
        $this->app->forgetScopedInstances();

        $this->actingAs($this->superAdmin)->post(route('settings.appearance.update'), $this->form(['company' => ['name' => 'شركة خليل'], 'remove_logos' => ['print']]))->assertSessionHasNoErrors();

        $logos = app(Brand::class)->profile()['logos'];
        $this->assertSame($saved['main'], $logos['main']);
        $this->assertNull($logos['print']);
        $this->assertSame([$saved['main']], Storage::disk('public')->files('brand'));
    }

    public function test_saving_palette_roles_reaches_the_page_and_export(): void
    {
        $colors = ['secondary' => '#334155', 'accent' => '#B45309', 'background' => '#F8FAFC', 'surface' => '#FFFFFF'];

        $this->actingAs($this->superAdmin)
            ->post(route('settings.appearance.update'), $this->form(['colors' => $colors, 'design' => ['tableVariant' => 'ledger']]))
            ->assertSessionHasNoErrors();

        foreach ($colors as $role => $hex) {
            $this->assertSame($hex, app(Brand::class)->export()['colors'][$role]);
        }
        $this->get(route('dashboard'))->assertInertia(fn ($page) => $page
            ->where('brand.colors.secondary', '#334155')
            ->where('brand.design.tableVariant', 'ledger'));
    }

    public function test_rejects_a_look_the_interface_cannot_draw_and_a_logo_that_is_not_an_image(): void
    {
        $this->actingAs($this->superAdmin)->post(route('settings.appearance.update'), $this->form([
            'design' => ['navigation' => 'floating-cube', 'buttons' => 'neon'],
            'colors' => ['primary' => 'teal'],
            'logos' => ['main' => UploadedFile::fake()->create('logo.svg', 4, 'image/svg+xml')],
        ]))->assertSessionHasErrors(['design.navigation', 'design.buttons', 'colors.primary', 'logos.main']);

        $this->assertFalse(app(Brand::class)->isImported());
    }

    public function test_the_identity_downloads_as_a_file_that_uploads_back_the_same(): void
    {
        $this->actingAs($this->superAdmin)->post(route('settings.appearance.update'), $this->form(['logos' => ['main' => UploadedFile::fake()->image('khalil.png', 120, 60)]]));
        $saved = app(Brand::class)->profile();

        $file = $this->actingAs($this->superAdmin)->get(route('settings.appearance.export'))->assertOk()->streamedContent();
        $exported = json_decode($file, true);
        $this->assertSame('sidebar', $exported['design']['navigation']);
        $this->assertStringStartsWith('data:image/png;base64,', $exported['logos']['main']);

        $this->actingAs($this->superAdmin)->post(route('settings.appearance.reset'))->assertSessionHas('status', 'brand-reset');
        $this->assertFalse(app(Brand::class)->isImported());
        $this->app->forgetScopedInstances();

        $this->actingAs($this->superAdmin)
            ->post(route('settings.appearance.import'), ['file' => UploadedFile::fake()->createWithContent('brand.json', $file)])
            ->assertSessionHas('status', 'brand-updated');

        $this->assertSame($saved, app(Brand::class)->profile());
    }

    public function test_an_uploaded_file_that_is_not_an_identity_is_refused(): void
    {
        $this->actingAs($this->superAdmin)
            ->post(route('settings.appearance.import'), ['file' => UploadedFile::fake()->createWithContent('notes.json', 'not json')])
            ->assertSessionHasErrors('file');

        $this->assertFalse(app(Brand::class)->isImported());
    }

    public function test_saving_from_the_screen_keeps_the_exact_values_and_css_only_the_file_sets(): void
    {
        $this->actingAs($this->superAdmin)->post(route('settings.appearance.import'), ['file' => UploadedFile::fake()->createWithContent('brand.json', json_encode([
            'version' => 1,
            'company' => ['name' => 'شركة خليل'],
            'logos' => ['main' => '/images/logo-superpower.svg'],
            'tokens' => ['buttonRadius' => 18],
            'customCss' => '.ui-page-title{color:red}',
        ]))])->assertSessionHasNoErrors();
        $this->app->forgetScopedInstances();

        $this->actingAs($this->superAdmin)->post(route('settings.appearance.update'), $this->form())->assertSessionHasNoErrors();

        $profile = app(Brand::class)->profile();
        $this->assertSame(18, $profile['tokens']['buttonRadius']);
        $this->assertSame('.ui-page-title{color:red}', $profile['customCss']);
        $this->assertSame('شركة خليل للكهرباء', $profile['company']['name']);
    }
}
