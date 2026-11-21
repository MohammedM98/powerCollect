<?php

use App\Models\Branch;
use App\Models\User;

// A branch, one member of staff holding no permission and one whose account was stopped.
$branch = Branch::factory()->create(['name' => 'فرع الاختبار']);

User::factory()->collector()->create([
    'branch_id' => $branch->id, 'name' => 'موظف بلا صلاحيات',
    'username' => 'no_access', 'password' => 'Strong-Pass-2026',
])->permissions()->sync([]);

User::factory()->collector()->create([
    'branch_id' => $branch->id, 'name' => 'حساب موقوف',
    'username' => 'stopped_user', 'password' => 'Strong-Pass-2026', 'is_active' => false,
]);
