<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\Branch;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The `can` flags every page receives decide which links and keys the
 * website shows. A flag that stays on without its permission shows a
 * locked feature as open; one that stays off hides work from its owner.
 */
class SharedPermissionFlagsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_staff_member_without_permissions_gets_every_flag_off(): void
    {
        $staff = User::factory()->collector()->for(Branch::factory())->create();
        $staff->permissions()->sync([]);

        $flags = $this->flagsFor($staff);

        $this->assertSame(['printAuditReports' => true], array_filter($flags));
    }

    public function test_the_super_admin_gets_every_flag_on_except_audit_only(): void
    {
        config(['powercollect.brand_editor_enabled' => true]);
        $owner = User::factory()->superAdmin()->create();

        $flags = $this->flagsFor($owner);

        $this->assertSame(['auditOnly' => false], array_filter($flags, fn (bool $on): bool => ! $on));
    }

    /**
     * @return array<string, array{0: PermissionKey, 1: string}>
     */
    public static function singlePermissions(): array
    {
        return [
            'users' => [PermissionKey::ViewUsers, 'viewUsers'],
            'user types' => [PermissionKey::ViewUserTypes, 'viewUserTypes'],
            'branches' => [PermissionKey::ViewBranches, 'viewBranches'],
            'tariffs' => [PermissionKey::ViewTariffs, 'viewTariffs'],
            'meter boxes' => [PermissionKey::ViewMeterBoxes, 'viewMeterBoxes'],
            'meter readings' => [PermissionKey::ViewMeterReadings, 'viewMeterReadings'],
            'messages' => [PermissionKey::ViewMessages, 'viewMessages'],
            'sending messages' => [PermissionKey::SendMessages, 'sendMessages'],
            'disconnections' => [PermissionKey::ViewDisconnections, 'viewDisconnections'],
            'governorates' => [PermissionKey::ViewGovernorates, 'viewGovernorates'],
            'new subscriptions' => [PermissionKey::CreateSubscriptions, 'createSubscriptions'],
            'branch performance' => [PermissionKey::ViewBranchPerformance, 'viewBranchPerformance'],
            'debt aging' => [PermissionKey::ViewDebtAging, 'viewDebtAging'],
        ];
    }

    #[DataProvider('singlePermissions')]
    public function test_one_permission_turns_on_its_own_flag(PermissionKey $permission, string $flag): void
    {
        $staff = User::factory()->collector()->for(Branch::factory())->create();
        $staff->permissions()->sync(Permission::idsFor([$permission]));

        $flags = $this->flagsFor($staff->fresh());

        $this->assertTrue($flags[$flag], "{$permission->value} should turn on {$flag}.");
    }

    /**
     * @return array<string, bool>
     */
    private function flagsFor(User $user): array
    {
        $flags = [];
        $this->actingAs($user)->get(route('profile.edit'))
            ->assertInertia(function (AssertableInertia $page) use (&$flags): void {
                $flags = $page->toArray()['props']['can'];
            });

        return $flags;
    }
}
