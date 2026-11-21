<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FieldAppTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_guest_opening_the_field_app_is_sent_to_its_own_sign_in(): void
    {
        $this->get(route('field.home'))->assertRedirect(route('field.login'));
        $this->get(route('field.login'))->assertInertia(fn ($page) => $page->component('Field/Login'));
    }

    public function test_signing_in_to_the_field_app_lands_on_the_field_home(): void
    {
        $user = User::factory()->create();

        $this->post(route('field.login.store'), ['username' => $user->username, 'password' => 'password'])
            ->assertRedirect(route('field.home', absolute: false));

        $this->assertAuthenticatedAs($user);
    }

    public function test_a_wrong_password_does_not_sign_in_to_the_field_app(): void
    {
        $user = User::factory()->create();

        $this->from(route('field.login'))->post(route('field.login.store'), ['username' => $user->username, 'password' => 'wrong-password'])
            ->assertRedirect(route('field.login'));

        $this->assertGuest();
    }

    public function test_a_signed_in_user_opening_the_field_sign_in_goes_to_the_field_home(): void
    {
        $this->actingAs(User::factory()->create())->get(route('field.login'))->assertRedirect(route('field.home'));
    }

    public function test_a_meter_reader_sees_only_the_readings_tasks(): void
    {
        $reader = $this->userWith([PermissionKey::RecordMeterReadings]);

        $this->actingAs($reader)->get(route('field.home'))->assertInertia(fn ($page) => $page
            ->component('Field/Home')
            ->has('sections', 1)
            ->where('sections.0.key', 'readings')
            ->where('sections.0.tasks', fn ($tasks): bool => collect($tasks)->pluck('key')->all() === ['record-readings'])
            ->where('sections.0.tasks.0.href', route('meter-readings.index', absolute: false)));
    }

    public function test_a_collector_sees_only_the_collection_tasks(): void
    {
        $collector = $this->userWith([PermissionKey::RecordCollections, PermissionKey::RecordCashPayments]);

        $this->actingAs($collector)->get(route('field.home'))->assertInertia(fn ($page) => $page
            ->has('sections', 1)
            ->where('sections.0.key', 'collection')
            ->where('sections.0.tasks', fn ($tasks): bool => collect($tasks)->pluck('key')->all() === ['record-payments', 'collection-summary', 'cash-boxes']));
    }

    public function test_a_user_without_field_permissions_sees_no_tasks(): void
    {
        $this->actingAs($this->userWith([]))->get(route('field.home'))->assertInertia(fn ($page) => $page
            ->where('sections', []));
    }

    public function test_signing_out_of_the_field_app_returns_to_its_sign_in(): void
    {
        $this->actingAs(User::factory()->create())->post(route('field.logout'))->assertRedirect(route('field.login'));

        $this->assertGuest();
    }

    public function test_the_manifest_opens_the_app_on_the_field_home(): void
    {
        $this->get(route('field.manifest'))
            ->assertOk()
            ->assertHeader('Content-Type', 'application/manifest+json')
            ->assertJsonPath('start_url', route('field.home', absolute: false))
            ->assertJsonPath('display', 'standalone');
    }

    /**
     * A branch user holding exactly these permissions.
     *
     * @param  array<int, PermissionKey>  $permissions
     */
    private function userWith(array $permissions): User
    {
        $user = User::factory()->create();
        $user->permissions()->sync(Permission::idsFor($permissions));

        return $user->refresh();
    }
}
