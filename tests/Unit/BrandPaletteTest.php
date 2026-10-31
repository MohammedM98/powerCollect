<?php

namespace Tests\Unit;

use App\Support\BrandPalette;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class BrandPaletteTest extends TestCase
{
    public function test_a_readable_colour_is_kept_as_the_main_shade(): void
    {
        $palette = BrandPalette::fromHex('#A51D26');

        $this->assertSame('165 29 38', $palette['light'][500]);
        $this->assertSame('165 29 38', $palette['fixed']['solid']);
    }

    public function test_a_colour_white_text_cannot_be_read_on_is_darkened_until_it_can(): void
    {
        $this->assertLessThan(BrandPalette::MIN_CONTRAST, BrandPalette::contrastWithWhite('#FFD600'));

        $main = BrandPalette::fromHex('#FFD600')['light'][500];

        $this->assertGreaterThanOrEqual(BrandPalette::MIN_CONTRAST, BrandPalette::contrastWithWhite($this->hex($main)));
    }

    public function test_the_light_theme_darkens_step_by_step_and_the_dark_theme_lightens_its_ink(): void
    {
        $palette = BrandPalette::fromHex('#1E88E5');
        $light = array_map(fn (string $rgb): float => BrandPalette::contrastWithWhite($this->hex($rgb)), $palette['light']);
        $darkInk = array_map(fn (string $rgb): float => BrandPalette::contrastWithWhite($this->hex($rgb)), array_intersect_key($palette['dark'], array_flip([600, 700, 800, 900])));

        $this->assertSame(array_keys($light), [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
        $this->assertSame($light, $this->sorted($light, ascending: true));
        $this->assertSame($darkInk, $this->sorted($darkInk, ascending: false));
    }

    public function test_rejects_a_colour_that_is_not_six_digit_hex(): void
    {
        $this->expectException(InvalidArgumentException::class);

        BrandPalette::fromHex('red');
    }

    private function hex(string $rgb): string
    {
        return '#'.implode('', array_map(fn (string $channel): string => sprintf('%02X', $channel), explode(' ', $rgb)));
    }

    /**
     * @param  array<int, float>  $values
     * @return array<int, float>
     */
    private function sorted(array $values, bool $ascending): array
    {
        $ascending ? asort($values) : arsort($values);

        return $values;
    }
}
