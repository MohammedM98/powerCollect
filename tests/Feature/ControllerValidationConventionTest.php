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

    public function test_controllers_stay_thin(): void
    {
        $tooLong = [];

        foreach (Finder::create()->files()->in(app_path('Http/Controllers'))->name('*.php') as $file) {
            $lines = substr_count($file->getContents(), "\n");

            if ($lines > 250) {
                $tooLong[$file->getRelativePathname()] = $lines;
            }
        }

        $this->assertSame([], $tooLong, 'Move queries and row building into a class under app/Support; a controller validates, authorizes, calls it and responds.');
        $this->assertDirectoryDoesNotExist(app_path('Http/Concerns'));
    }
}
