<?php

use App\Enums\AuditAction;
use App\Enums\PermissionKey;
use App\Enums\UserRole;
use App\Models\Permission;

/** The permission ids each starter set ticks, and every id by its key, for the live scenarios to grant through the website. */
echo json_encode([
    'roles' => collect(UserRole::cases())->mapWithKeys(fn (UserRole $role): array => [$role->value => Permission::idsFor($role->starterPermissions())])->all(),
    'keys' => collect(PermissionKey::cases())->mapWithKeys(fn (PermissionKey $key): array => [$key->value => Permission::idsFor([$key])[0] ?? null])->all(),
    'auditActions' => array_column(AuditAction::cases(), 'value'),
], JSON_THROW_ON_ERROR);
