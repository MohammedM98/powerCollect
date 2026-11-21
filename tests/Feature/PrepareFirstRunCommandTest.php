<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Enums\UserRole;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PrepareFirstRunCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['powercollect.super_admin' => ['name' => 'مالك الشركة', 'username' => 'owner', 'password' => 'Strong-Pass-2026']]);
    }

    public function test_an_empty_database_gets_every_permission_and_one_super_admin_and_nothing_else(): void
    {
        $this->artisan('powercollect:install')->assertSuccessful();

        $currentKeys = array_map(fn (PermissionKey $key): string => $key->value, array_filter(PermissionKey::cases(), fn (PermissionKey $key): bool => ! $key->isRetired()));
        $this->assertSame([], array_values(array_diff($currentKeys, Permission::query()->pluck('key')->all())));

        $superAdmin = User::query()->sole();
        $this->assertSame('owner', $superAdmin->username);
        $this->assertSame(UserRole::SuperAdmin, $superAdmin->role);
        $this->assertTrue($superAdmin->is_active);
        $this->assertTrue(Hash::check('Strong-Pass-2026', $superAdmin->password));

        $this->assertDatabaseCount('branches', 0);
        $this->assertDatabaseCount('tariffs', 0);
        $this->assertDatabaseCount('subscriptions', 0);
    }

    public function test_a_second_run_adds_missing_permissions_and_does_not_create_another_account(): void
    {
        $this->artisan('powercollect:install')->assertSuccessful();
        Permission::query()->where('key', PermissionKey::CreateSubscriptions->value)->delete();
        config(['powercollect.super_admin.username' => 'someone-else']);

        $this->artisan('powercollect:install')->assertSuccessful();

        $this->assertDatabaseHas('permissions', ['key' => PermissionKey::CreateSubscriptions->value]);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseMissing('users', ['username' => 'someone-else']);
    }

    public function test_no_account_is_created_without_a_configured_password(): void
    {
        config(['powercollect.super_admin.password' => null]);

        $this->artisan('powercollect:install')->assertFailed();

        $this->assertDatabaseCount('users', 0);
    }
}
