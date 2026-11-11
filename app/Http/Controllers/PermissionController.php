<?php

namespace App\Http\Controllers;

use App\Enums\AuditAction;
use App\Enums\PermissionKey;
use App\Enums\UserRole;
use App\Http\Requests\UpdatePermissionsRequest;
use App\Models\Branch;
use App\Models\Permission;
use App\Models\User;
use App\Notifications\ActionCompleted;
use App\Support\Permissions\PermissionPage;
use App\Support\Queries\DataTableFilters;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class PermissionController extends Controller
{
    public const SORTABLE = ['name', 'username'];

    /**
     * The employees whose permissions the actor may manage, beside the
     * permissions of the selected one (?selected=<id>, or the first one
     * listed). Super Admins already hold every permission implicitly and
     * are never listed.
     *
     * A Branch Admin sees only their own branch's staff (Collector, Data
     * Entry, Accountant) — never another branch's users, another
     * Branch Admin, or a Super Admin — and only the permissions they may
     * grant: never the company-wide ones.
     */
    public function edit(Request $request): InertiaResponse
    {
        $this->authorize('manage', Permission::class);

        $actor = $request->user();
        $grantablePermissionIds = PermissionPage::grantablePermissionIds($actor);

        $query = PermissionPage::manageableUsers($actor)->with(['branch', 'permissions', 'userType']);
        DataTableFilters::applyDataTableFilters($query, $request, ['name', 'username'], self::SORTABLE, 'name');
        DataTableFilters::applyDataTableFilterSelects($query, $request, ['user_type_id', 'branch_id']);

        $page = $query->paginate(DataTableFilters::dataTablePerPage($request))->withQueryString();

        $findManageable = fn (int $id) => PermissionPage::manageableUsers($actor)->with(['branch', 'permissions', 'userType'])->find($id);
        $selectedUser = $findManageable($request->integer('selected')) ?? $findManageable($page->first()?->id ?? 0);
        $granters = User::query()
            ->whereIn('id', collect($page->items())->push($selectedUser)->filter()->flatMap(fn (User $user) => $user->permissions->pluck('pivot.granted_by'))->filter()->unique())
            ->pluck('name', 'id')
            ->all();
        $users = $page->through(fn (User $user) => PermissionPage::employeeSummary($user, $grantablePermissionIds, $granters));

        return Inertia::render('Settings/Permissions', [
            'users' => $users,
            'selectedUser' => $selectedUser ? [
                ...PermissionPage::employeeSummary($selectedUser, $grantablePermissionIds, $granters),
                // How many staff hold each permission because this user handed it on: they lose it with them.
                'grantsGiven' => DB::table('permission_user')->where('granted_by', $selectedUser->id)
                    ->selectRaw('permission_id, count(*) as holders')->groupBy('permission_id')->pluck('holders', 'permission_id'),
            ] : null,
            // Only the Super Admin gives the right to hand permissions on, and only to whoever manages permissions.
            'delegation' => $actor->isSuperAdmin() ? [
                'managePermissionsId' => Permission::query()->where('key', PermissionKey::ManagePermissions->value)->value('id'),
                'delegableIds' => Permission::all()->filter(fn (Permission $permission): bool => PermissionKey::tryFrom($permission->key)?->isDelegable() ?? false)->values()->modelKeys(),
            ] : null,
            'permissionGroups' => PermissionPage::permissionGroups($actor),
            'roleTemplates' => [],
            'scopedToOwnBranch' => ! $actor->isSuperAdmin(),
            'auditOptions' => $actor->isSuperAdmin() ? [
                'permissionId' => Permission::query()->where('key', PermissionKey::AuditClosings->value)->value('id'),
                'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
                'actions' => array_map(fn (AuditAction $action): array => ['value' => $action->value, 'label' => $action->label(), 'hint' => $action->description()], AuditAction::cases()),
            ] : null,
            'filters' => DataTableFilters::dataTableState($request, 'name'),
            'filterOptions' => PermissionPage::filterOptions($actor),
        ]);
    }

    /**
     * Sync each submitted user's custom permission grants, then go back to
     * the page the save came from — same employee, search and filters.
     *
     * Only users actually present in the payload are touched — the list is
     * paginated/searchable, so a save only ever carries the users visible
     * on screen at the time. Looping over every user in the table instead
     * would silently wipe the grants of anyone on another page.
     *
     * The same branch/role scoping as edit() is re-applied here, not just
     * trusted from the page: without it, a Branch Admin could craft a
     * payload naming a user outside their branch (or another Branch Admin)
     * and edit permissions they have no business touching.
     *
     * Likewise only the permissions the actor may grant are changed. A
     * Branch Admin's save ignores company-wide permissions in the payload
     * and keeps any the Super Admin already gave that user.
     */
    public function update(UpdatePermissionsRequest $request): RedirectResponse
    {
        $this->authorize('manage', Permission::class);

        $actor = $request->user();
        $grantablePermissionIds = PermissionPage::grantablePermissionIds($actor);
        $payload = $request->validated('permissions');
        $keys = $actor->isSuperAdmin() ? $request->validated('grantable', []) : [];
        $permissionKeys = Permission::query()->pluck('key', 'id');
        $handedOn = [];

        $users = PermissionPage::manageableUsers($actor)->with('permissions')->whereIn('id', array_keys($payload))->get();

        DB::transaction(function () use ($users, $payload, $keys, $permissionKeys, $grantablePermissionIds, $actor, $request, &$handedOn): void {
            foreach ($users as $user) {
                $held = $user->permissions->keyBy('id');
                $selected = array_intersect(array_map(intval(...), (array) ($payload[$user->id] ?? [])), $grantablePermissionIds);
                $keptAsTheyWere = array_diff($held->keys()->all(), $grantablePermissionIds);
                $final = array_values(array_unique([...$selected, ...$keptAsTheyWere]));
                $keyed = array_key_exists($user->id, $keys) ? array_map(intval(...), $keys[$user->id]) : null;

                $user->permissions()->sync(collect($final)->mapWithKeys(fn (int $id): array => [$id => [
                    'grantable' => $keyed === null
                        ? (bool) $held->get($id)?->pivot->grantable
                        : in_array($id, $keyed, true) && (PermissionKey::tryFrom($permissionKeys[$id] ?? '')?->isDelegable() ?? false),
                    // Who handed it on stays as it was; a new one is the actor's, unless the Super Admin gave it.
                    'granted_by' => $held->has($id) ? $held->get($id)->pivot->granted_by : ($actor->isSuperAdmin() ? null : $actor->id),
                ]])->all());

                $user->withdrawGrantsOf(array_values(array_diff($held->keys()->all(), $final)));

                $added = array_diff($final, $held->keys()->all());
                if (! $actor->isSuperAdmin() && $added !== []) {
                    $handedOn[$user->name] = array_map(fn (int $id): string => __(PermissionKey::tryFrom($permissionKeys[$id])?->label() ?? $permissionKeys[$id]), $added);
                }

                if ($request->user()->isSuperAdmin() && $request->has("audit_settings.{$user->id}")) {
                    $settings = $request->validated("audit_settings.{$user->id}");
                    $settings['branch_ids'] = $settings['scope'] === 'all' ? [] : array_values(array_unique(array_map(intval(...), $settings['branch_ids'])));
                    $settings['actions'] = array_values(array_unique($settings['actions']));
                    $user->audit_settings = $settings;
                    $user->save();
                }
            }
        });

        $actor->notify(new ActionCompleted('permissions-updated', $users->pluck('name')->join('، ')));

        // What a branch manager hands on works at once; the Super Admins are told who got what.
        foreach ($handedOn as $name => $labels) {
            User::query()->where('role', UserRole::SuperAdmin)->get()
                ->each(fn (User $superAdmin) => $superAdmin->notify(new ActionCompleted('permissions-delegated', "{$actor->name} منح {$name}: ".implode('، ', $labels))));
        }

        return redirect()
            ->back(fallback: route('settings.permissions.edit'))
            ->with('status', 'permissions-updated');
    }
}
