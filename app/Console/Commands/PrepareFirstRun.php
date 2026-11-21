<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Illuminate\Console\Command;

class PrepareFirstRun extends Command
{
    protected $signature = 'powercollect:install';

    protected $description = 'Prepare an empty live database: the full list of permissions and the first Super Admin, with no sample data';

    /**
     * Safe to run on every deployment: the permission list is brought up to
     * date each time, and an account is only made while there is no Super Admin.
     */
    public function handle(PermissionSeeder $permissions): int
    {
        $permissions->run();
        $this->components->info('The list of permissions is up to date.');

        if (User::query()->where('role', UserRole::SuperAdmin)->exists()) {
            $this->components->info('A Super Admin already exists; no account was created.');

            return self::SUCCESS;
        }

        $password = config('powercollect.super_admin.password');

        if (! is_string($password) || $password === '') {
            $this->components->error('Set SUPER_ADMIN_PASSWORD before the first run; no account was created.');

            return self::FAILURE;
        }

        $superAdmin = User::query()->create([
            'name' => config('powercollect.super_admin.name'),
            'username' => config('powercollect.super_admin.username'),
            'password' => $password,
            'role' => UserRole::SuperAdmin,
            'is_active' => true,
        ]);

        $this->components->info('Super Admin created; sign in as '.$superAdmin->username.' and change the password.');

        return self::SUCCESS;
    }
}
