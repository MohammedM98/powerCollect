<?php

namespace Tests\Unit;

use App\Enums\PermissionKey;
use PHPUnit\Framework\TestCase;

class PermissionLabelTranslationTest extends TestCase
{
    public function test_every_permission_has_an_arabic_name(): void
    {
        $arabic = json_decode((string) file_get_contents(__DIR__.'/../../lang/ar.json'), true, flags: JSON_THROW_ON_ERROR);

        $untranslated = array_values(array_filter(
            array_map(fn (PermissionKey $permission): string => $permission->label(), PermissionKey::cases()),
            fn (string $label): bool => ! isset($arabic[$label]),
        ));

        $this->assertSame([], $untranslated, 'These permissions show in English: '.implode(', ', $untranslated));
    }
}
