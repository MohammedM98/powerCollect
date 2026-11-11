<?php

namespace Tests\Feature;

use Symfony\Component\Finder\Finder;
use Tests\TestCase;

class ControllerValidationConventionTest extends TestCase
{
    public function test_controllers_validate_through_form_requests_only(): void
    {
        $offenders = [];

        foreach (Finder::create()->files()->in(app_path('Http/Controllers'))->name('*.php') as $file) {
            if (preg_match('/(\$request|request\(\)|\$this)->validate\(/', $file->getContents())) {
                $offenders[] = $file->getRelativePathname();
            }
        }

        $this->assertSame([], $offenders, 'Move the rules into a Form Request and type-hint it on the controller method.');
    }
}
