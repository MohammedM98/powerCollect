<?php

namespace Tests\Feature;

use Symfony\Component\Finder\Finder;
use Tests\TestCase;

class RoleChecksConventionTest extends TestCase
{
    public function test_only_the_super_admin_is_told_apart_by_role(): void
    {
        $offenders = [];

        foreach (Finder::create()->files()->in(app_path())->notPath('Enums')->name('*.php') as $file) {
            $comparesAnotherRole = '/(===|!==)\s*UserRole::(?!SuperAdmin\b)\w+|UserRole::(?!SuperAdmin\b)\w+\s*(===|!==)|role->value\s*(===|!==)/';

            if (preg_match($comparesAnotherRole, $file->getContents())) {
                $offenders[] = $file->getRelativePathname();
            }
        }

        $this->assertSame([], $offenders, 'Check a permission with hasPermission() instead of the starter role.');
    }
}
