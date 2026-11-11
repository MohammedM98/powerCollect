<?php

namespace App\Support\Permissions;

use App\Enums\PermissionKey;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\Permission;
use App\Models\User;
use App\Models\UserType;
use App\Support\Queries\DataTableFilters;
use Illuminate\Database\Eloquent\Builder;

/**
 * Builds the permissions page: each account's grants, what the editor may grant, and the permission groups.
 */
class PermissionPage
{
    /**
     * How an employee appears in the list and above the editor, with the
     * permissions they hold that the actor may change — the ones the
     * editor shows, counts, and copies to another employee.
     *
     * @param  array<int, int>  $grantablePermissionIds
     * @param  array<int, string>  $granters  the names of those who handed permissions on, by id
     * @return array{id: int, name: string, username: string, role: string, roleLabel: string, branchName: ?string, permissionIds: array<int, int>, grantableIds: array<int, int>, grantedBy: array<int, string>, lockedPermissions: array<int, string>}
     */
    public static function employeeSummary(User $user, array $grantablePermissionIds, array $granters = []): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'role' => $user->role->value,
            'roleLabel' => $user->userType?->name ?? 'غير محدد',
            'userTypeName' => $user->userType?->name,
            'branchName' => $user->branch?->name,
            'branchId' => $user->branch_id,
            'auditSettings' => $user->auditSettings(),
            'auditSettingsConfigured' => $user->audit_settings !== null,
            'isActive' => $user->is_active,
            'permissionIds' => array_values(array_intersect($user->permissions->modelKeys(), $grantablePermissionIds)),
            'grantableIds' => $user->permissions->filter(fn (Permission $permission): bool => (bool) $permission->pivot->grantable)->values()->modelKeys(),
            'grantedBy' => $user->permissions
                ->filter(fn (Permission $permission): bool => isset($granters[$permission->pivot->granted_by]))
                ->mapWithKeys(fn (Permission $permission): array => [$permission->id => $granters[$permission->pivot->granted_by]])
                ->all(),
            'lockedPermissions' => $user->permissions
                ->reject(fn (Permission $permission): bool => PermissionKey::tryFrom($permission->key)?->isRetired() ?? false)
                ->reject(fn (Permission $permission): bool => in_array($permission->id, $grantablePermissionIds, true))
                ->map(fn (Permission $permission): string => __(PermissionKey::tryFrom($permission->key)?->label() ?? $permission->label))
                ->values()->all(),
        ];
    }

    /**
     * The users whose permissions the actor may manage: every non-Super-
     * Admin for a Super Admin; for anyone else, only the staff roles in
     * their own branch.
     *
     * @return Builder<User>
     */
    public static function manageableUsers(User $actor): Builder
    {
        return User::query()
            ->where('role', '!=', UserRole::SuperAdmin)
            ->when(! $actor->isSuperAdmin(), fn (Builder $query) => $query
                ->where('branch_id', $actor->workBranchId())
                ->whereDoesntHave('permissions', fn (Builder $permissions) => $permissions->whereIn('key', array_map(
                    fn (PermissionKey $key): string => $key->value,
                    [PermissionKey::ManagePermissions, PermissionKey::AuditClosings, PermissionKey::ManageBranchDomains],
                ))));
    }

    /**
     * Whether the actor may hand out this permission: a Super Admin may
     * grant anything; a branch manager only the ones the Super Admin gave
     * them the right to hand on (see User::canGrantPermission()).
     */
    public static function canGrant(User $actor, PermissionKey $permissionKey): bool
    {
        return $actor->canGrantPermission($permissionKey);
    }

    /**
     * The ids of every permission the actor may grant or revoke.
     *
     * @return array<int, int>
     */
    public static function grantablePermissionIds(User $actor): array
    {
        return Permission::all()
            ->filter(function (Permission $permission) use ($actor) {
                $permissionKey = PermissionKey::tryFrom($permission->key);

                return $permissionKey !== null && ! $permissionKey->isRetired() && self::canGrant($actor, $permissionKey);
            })
            ->modelKeys();
    }

    /**
     * The permissions the actor may grant, grouped by resource, in the shape
     * the Permissions matrix renders: a resource label plus its ordered
     * action columns (view/create/update, or view/record/confirm for
     * Collections). A missing action (e.g. Collections has no "create")
     * comes back as null so the page can render an empty cell instead of a
     * checkbox. A resource with nothing the actor may grant is left out.
     *
     * @return array<int, array{key: string, label: string, actions: array<int, array{action: string, permission: array{id: int, label: string}|null}>}>
     */
    public static function permissionGroups(User $actor): array
    {
        $permissionsByKey = Permission::all()->keyBy('key');

        return collect(PermissionKey::resourceGroups())
            ->map(fn (array $group) => [
                ...$group,
                'actions' => array_filter($group['actions'], fn (PermissionKey $permissionKey) => self::canGrant($actor, $permissionKey)),
            ])
            ->filter(fn (array $group) => $group['actions'] !== [])
            ->map(function (array $group, string $resourceKey) use ($permissionsByKey) {
                return [
                    'key' => $resourceKey,
                    'label' => __($group['label']),
                    'actions' => collect($group['actions'])
                        ->map(function (PermissionKey $permissionKey, string $action) use ($permissionsByKey) {
                            $permission = $permissionsByKey->get($permissionKey->value);

                            return [
                                'action' => $action,
                                'permission' => $permission ? ['id' => $permission->id, 'key' => $permissionKey->value, 'label' => __($permissionKey->label()), 'centralOnly' => $permissionKey->isCompanyWide()] : null,
                            ];
                        })
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * The Filter menu's dropdown groups for the index page. The branch
     * filter only makes sense for a Super Admin — a Branch Admin's list is
     * already scoped to their own single branch.
     *
     * @return array<int, array{key: string, label: string, options: array<int, array{value: string, label: string}>}>
     */
    public static function filterOptions(User $actor): array
    {
        $groups = [
            DataTableFilters::filterGroup('user_type_id', 'نوع المستخدم', UserType::query()->orderBy('name')->get()->map(fn (UserType $type): array => ['value' => (string) $type->id, 'label' => $type->name])->all()),
        ];

        if ($actor->isSuperAdmin()) {
            $groups[] = DataTableFilters::branchFilterGroup();
        }

        return $groups;
    }
}
