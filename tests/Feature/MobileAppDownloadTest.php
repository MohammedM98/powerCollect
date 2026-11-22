<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class MobileAppDownloadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['powercollect.mobile_app.directory' => Storage::disk('local')->path('release')]);
    }

    private function publishFixture(string $type = 'release'): void
    {
        Storage::disk('local')->put('release/release.json', json_encode([
            'version' => '1.0.1', 'type' => $type, 'size' => 19, 'sha256' => str_repeat('a', 64),
            'download_url' => 'https://github.com/MohammedM98/powerCollect/releases/download/android-v1.0.1/powercollect.apk',
        ]));
    }

    public function test_guests_cannot_open_the_page_or_download_the_application(): void
    {
        $this->publishFixture();
        $this->get(route('settings.mobile-app.index'))->assertRedirect(route('login'));
        $this->get(route('settings.mobile-app.download'))->assertRedirect(route('login'));
    }

    public function test_staff_can_download_without_receiving_permission_to_manage_settings(): void
    {
        $this->publishFixture();
        $user = User::factory()->collector()->create();
        $this->actingAs($user)->get(route('settings.mobile-app.index'))->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Settings/MobileApp')
                ->where('release.version', '1.0.1')->where('release.downloadUrl', route('settings.mobile-app.download')));
        $this->get(route('settings.mobile-app.download', ['url' => 'https://untrusted.test/app.apk']))
            ->assertRedirect('https://github.com/MohammedM98/powerCollect/releases/download/android-v1.0.1/powercollect.apk')
            ->assertHeader('Cache-Control', 'no-store, private')->assertHeader('Referrer-Policy', 'no-referrer');
        $this->assertFileDoesNotExist(Storage::disk('local')->path('release/powercollect.apk'));
        $this->get(route('settings.sms.edit'))->assertForbidden();
    }

    public function test_an_unpublished_or_incomplete_upload_is_not_offered_for_download(): void
    {
        $this->actingAs(User::factory()->create())->get(route('settings.mobile-app.index'))->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('release', null));
        $this->get(route('settings.mobile-app.download'))->assertNotFound();
        Storage::disk('local')->put('release/release.json', '{"version":');
        $this->get(route('settings.mobile-app.index'))->assertInertia(fn (AssertableInertia $page) => $page->where('release', null));
        $this->get(route('settings.mobile-app.download'))->assertNotFound();
    }

    public function test_debug_builds_are_not_offered_as_production_downloads(): void
    {
        $this->publishFixture('debug');
        $this->actingAs(User::factory()->create())->get(route('settings.mobile-app.index'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('release', null));
        $this->get(route('settings.mobile-app.download'))->assertNotFound();
    }

    public function test_with_a_token_the_private_release_apk_is_handed_out_through_a_short_lived_link(): void
    {
        $this->publishFixture();
        config(['powercollect.mobile_app.github_token' => 'read-only-token']);
        $signed = 'https://release-assets.githubusercontent.com/github-production-release-asset/1/apk?sig=abc';
        Http::preventStrayRequests();
        Http::fake([
            'api.github.com/repos/MohammedM98/powerCollect/releases/tags/android-v1.0.1' => Http::response(['assets' => [
                ['id' => 11, 'name' => 'notes.txt'], ['id' => 42, 'name' => 'powercollect.apk'],
            ]]),
            'api.github.com/repos/MohammedM98/powerCollect/releases/assets/42' => Http::response('', 302, ['Location' => $signed]),
        ]);

        $this->actingAs(User::factory()->collector()->create())->get(route('settings.mobile-app.download'))
            ->assertRedirect($signed)->assertHeader('Cache-Control', 'no-store, private');
        Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer read-only-token')
            && str_ends_with($request->url(), 'releases/assets/42') && $request->hasHeader('Accept', 'application/octet-stream'));
    }

    public function test_a_private_release_without_the_apk_or_an_unreachable_github_offers_no_download(): void
    {
        $this->publishFixture();
        config(['powercollect.mobile_app.github_token' => 'read-only-token']);
        $user = User::factory()->collector()->create();

        Http::fake(['api.github.com/*' => Http::sequence()
            ->push(['assets' => [['id' => 11, 'name' => 'notes.txt']]])
            ->push(['message' => 'Bad credentials'], 401)]);
        $this->actingAs($user)->get(route('settings.mobile-app.download'))->assertNotFound();
        $this->get(route('settings.mobile-app.download'))->assertServiceUnavailable();
    }

    #[TestWith(['download_url', null])]
    #[TestWith(['download_url', 'http://github.com/MohammedM98/powerCollect/releases/download/android-v1.0.1/powercollect.apk'])]
    #[TestWith(['download_url', 'https://untrusted.test/powercollect.apk'])]
    #[TestWith(['download_url', 'https://github.com/other/project/releases/download/android-v1.0.1/powercollect.apk'])]
    #[TestWith(['download_url', 'https://github.com/MohammedM98/powerCollect/releases/download/android-v1.0.2/powercollect.apk'])]
    #[TestWith(['version', '../1.0.1'])]
    #[TestWith(['sha256', 'invalid'])]
    #[TestWith(['size', 0])]
    #[TestWith(['size', '19'])]
    public function test_invalid_release_metadata_does_not_offer_a_download(string $field, mixed $value): void
    {
        $this->publishFixture();
        $release = json_decode(Storage::disk('local')->get('release/release.json'), true);
        $release[$field] = $value;
        Storage::disk('local')->put('release/release.json', json_encode($release));

        $this->actingAs(User::factory()->create())->get(route('settings.mobile-app.index'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('release', null));
        $this->get(route('settings.mobile-app.download'))->assertNotFound();
    }
}
