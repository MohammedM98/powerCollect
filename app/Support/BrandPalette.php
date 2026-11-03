<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * The brand's shades, worked out from the one colour a company is known by.
 *
 * resources/css/theme.css names every shade the interface uses (`--brand-50`
 * to `--brand-900` for each theme, and the shades that look the same in both:
 * `--brand-tint` … `--brand-deep`). This builds all of them from a single
 * hex colour so that a company's own colour reaches every page.
 *
 * The shades are spaced in OKLCH, where equal steps of lightness look equal,
 * at the distances theme.css's hand-tuned burgundy keeps from its 500. The
 * colour itself becomes 500 unless white text on it would read below the
 * WCAG AA minimum of 4.5:1, when it is darkened until it reads.
 */
class BrandPalette
{
    /** White text on the main colour must read at least this well (WCAG AA). */
    public const MIN_CONTRAST = 4.5;

    /**
     * The light theme's steps: lighter ones as the share of the way from 500
     * to the page's near-white, darker ones as a share of 500's lightness,
     * and each step's chroma as a share of 500's.
     *
     * @var array<int, array{lift?: float, scale?: float, chroma: float}>
     */
    private const LIGHT = [
        50 => ['lift' => 1.0, 'chroma' => 0.07],
        100 => ['lift' => 0.87, 'chroma' => 0.2],
        200 => ['lift' => 0.74, 'chroma' => 0.32],
        300 => ['lift' => 0.48, 'chroma' => 0.6],
        400 => ['lift' => 0.24, 'chroma' => 0.86],
        500 => ['scale' => 1.0, 'chroma' => 1.0],
        600 => ['scale' => 0.9, 'chroma' => 0.9],
        700 => ['scale' => 0.785, 'chroma' => 0.78],
        800 => ['scale' => 0.66, 'chroma' => 0.65],
        900 => ['scale' => 0.495, 'chroma' => 0.55],
    ];

    /**
     * The dark theme's steps, from the deep tint behind a badge (50) to the
     * pale ink on the dark page (900), at fixed lightness; 500 sits a little
     * above the light theme's so it holds up on graphite.
     *
     * @var array<int, array{lightness?: float, scale?: float, chroma: float}>
     */
    private const DARK = [
        50 => ['lightness' => 0.214, 'chroma' => 0.25],
        100 => ['lightness' => 0.252, 'chroma' => 0.35],
        200 => ['lightness' => 0.33, 'chroma' => 0.55],
        300 => ['lightness' => 0.435, 'chroma' => 0.79],
        400 => ['lightness' => 0.57, 'chroma' => 0.95],
        500 => ['scale' => 1.087, 'chroma' => 1.08],
        600 => ['lightness' => 0.642, 'chroma' => 0.96],
        700 => ['lightness' => 0.721, 'chroma' => 0.78],
        800 => ['lightness' => 0.797, 'chroma' => 0.55],
        900 => ['lightness' => 0.885, 'chroma' => 0.3],
    ];

    /**
     * The shades that look the same in both themes: on the graphite panels,
     * in gradients, glows and the signature line.
     *
     * @var array<string, array{lightness?: float, scale?: float, chroma: float}>
     */
    private const FIXED = [
        'tint' => ['lightness' => 0.792, 'chroma' => 0.71],
        'soft' => ['lightness' => 0.678, 'chroma' => 0.82],
        'bright' => ['lightness' => 0.597, 'chroma' => 1.1],
        'glow' => ['lightness' => 0.544, 'chroma' => 1.08],
        'hi' => ['scale' => 1.087, 'chroma' => 1.08],
        'solid' => ['scale' => 1.0, 'chroma' => 1.0],
        'lo' => ['scale' => 0.815, 'chroma' => 0.82],
        'deep' => ['scale' => 0.66, 'chroma' => 0.65],
    ];

    /** How light the lightest step (50) is, near the page's white. */
    private const LIGHTEST = 0.966;

    /**
     * Every brand shade for the colour, as `R G B` triples like theme.css's.
     *
     * @return array{light: array<int, string>, dark: array<int, string>, fixed: array<string, string>}
     */
    public static function fromHex(string $hex): array
    {
        [$lightness, $chroma, $hue] = self::readableMain(self::hexToOklch($hex));

        $shade = fn (array $step): string => self::triple(self::oklchToRgb(
            $step['lightness'] ?? (isset($step['lift']) ? $lightness + ($step['lift'] * (self::LIGHTEST - $lightness)) : $lightness * $step['scale']),
            $chroma * $step['chroma'],
            $hue,
        ));

        return [
            'light' => array_map($shade, self::LIGHT),
            'dark' => array_map($shade, self::DARK),
            'fixed' => array_map($shade, self::FIXED),
        ];
    }

    /**
     * The neutral tones a company may draw its pages, lines and text in, as a
     * hue and how strongly it tints the greys (1 = theme.css's own graphite).
     * A strong tint may cap its chroma (`maxChroma`), so its mid greys, the
     * ones quiet text is set in, stay grey enough to read.
     *
     * @var array<string, array{hue: float, tint: float, maxChroma?: float}>
     */
    public const NEUTRALS = [
        'slate' => ['hue' => 257, 'tint' => 2.0],
        'zinc' => ['hue' => 286, 'tint' => 0.45],
        'neutral' => ['hue' => 0, 'tint' => 0.0],
        'stone' => ['hue' => 70, 'tint' => 0.7],
        'sage' => ['hue' => 150, 'tint' => 0.9],
        // The Superpower navy (theme.css, section 8): its dark page is 5 12 31.
        'navy' => ['hue' => 264, 'tint' => 5.8, 'maxChroma' => 0.06],
    ];

    /**
     * theme.css's graphite greys as OKLCH lightness and chroma, step by step,
     * for each theme: the spacing every other neutral keeps.
     *
     * @var array{light: array<int, array{float, float}>, dark: array<int, array{float, float}>}
     */
    private const GREYS = [
        'light' => [50 => [0.957, 0.0046], 100 => [0.942, 0.0052], 200 => [0.912, 0.0063], 300 => [0.864, 0.0117], 400 => [0.51, 0.022], 500 => [0.443, 0.0222], 600 => [0.421, 0.0211], 700 => [0.354, 0.0198], 800 => [0.282, 0.0194], 900 => [0.206, 0.0192], 950 => [0.158, 0.0072]],
        'dark' => [50 => [0.158, 0.0072], 100 => [0.238, 0.013], 200 => [0.283, 0.0164], 300 => [0.346, 0.0177], 400 => [0.627, 0.0209], 500 => [0.722, 0.0184], 600 => [0.8, 0.0143], 700 => [0.859, 0.0111], 800 => [0.921, 0.0063], 900 => [0.97, 0.0029], 950 => [0.985, 0.0013]],
    ];

    /** The dark theme's card colour, as lightness and chroma. */
    private const DARK_SURFACE = [0.204, 0.011];

    /**
     * The greys of a named neutral tone for both themes, at theme.css's
     * spacing, and the dark theme's card colour.
     *
     * @return array{light: array<int, string>, dark: array<int, string>, darkSurface: string}
     */
    public static function neutral(string $name): array
    {
        if (! isset(self::NEUTRALS[$name])) {
            throw new InvalidArgumentException("[{$name}] is not a neutral tone.");
        }

        ['hue' => $hue, 'tint' => $tint] = self::NEUTRALS[$name];
        $maxChroma = self::NEUTRALS[$name]['maxChroma'] ?? INF;
        $grey = fn (array $step): string => self::triple(self::oklchToRgb($step[0], min($step[1] * $tint, $maxChroma), $hue));

        return [
            'light' => array_map($grey, self::GREYS['light']),
            'dark' => array_map($grey, self::GREYS['dark']),
            'darkSurface' => $grey(self::DARK_SURFACE),
        ];
    }

    /**
     * A status colour's shades, 50 to 950, the colour itself as 500 (a
     * status colour sits on tints and beside text, so it is kept as given).
     *
     * @return array<int, string>
     */
    public static function statusScale(string $hex): array
    {
        [$lightness, $chroma, $hue] = self::hexToOklch($hex);
        $steps = self::LIGHT + [950 => ['scale' => 0.33, 'chroma' => 0.45]];

        return array_map(fn (array $step): string => self::triple(self::oklchToRgb(
            isset($step['lift']) ? $lightness + ($step['lift'] * (self::LIGHTEST - $lightness)) : $lightness * $step['scale'],
            $chroma * $step['chroma'],
            $hue,
        )), $steps);
    }

    /**
     * A page or surface keeps its exact light colour and a subdued dark tint.
     *
     * @return array{light: string, dark: string}
     */
    public static function surface(string $hex, float $darkLightness): array
    {
        [, $chroma, $hue] = self::hexToOklch($hex);

        return [
            'light' => self::triple(self::hexToRgb($hex)),
            'dark' => self::triple(self::oklchToRgb($darkLightness, min($chroma, 0.025), $hue)),
        ];
    }

    /**
     * Whether the colour is a six-digit hex colour, e.g. `#A51D26`.
     */
    public static function isHex(mixed $value): bool
    {
        return is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) === 1;
    }

    /**
     * How well white text reads on the colour, from 1 (not at all) to 21.
     */
    public static function contrastWithWhite(string $hex): float
    {
        return 1.05 / (self::luminance(self::hexToRgb($hex)) + 0.05);
    }

    /**
     * The colour as the main shade: as it is, or darkened just enough for
     * white text on it to reach the minimum contrast.
     *
     * @param  array{float, float, float}  $oklch
     * @return array{float, float, float}
     */
    private static function readableMain(array $oklch): array
    {
        [$lightness, $chroma, $hue] = $oklch;

        while ($lightness > 0.05 && 1.05 / (self::luminance(self::oklchToRgb($lightness, $chroma, $hue)) + 0.05) < self::MIN_CONTRAST) {
            $lightness -= 0.01;
        }

        return [$lightness, $chroma, $hue];
    }

    /**
     * @return array{float, float, float} lightness (0–1), chroma and hue (degrees)
     */
    private static function hexToOklch(string $hex): array
    {
        [$red, $green, $blue] = array_map(self::toLinear(...), self::hexToRgb($hex));

        $long = (0.4122214708 * $red + 0.5363325363 * $green + 0.0514459929 * $blue) ** (1 / 3);
        $medium = (0.2119034982 * $red + 0.6806995451 * $green + 0.1073969566 * $blue) ** (1 / 3);
        $short = (0.0883024619 * $red + 0.2817188376 * $green + 0.6299787005 * $blue) ** (1 / 3);

        $lightness = 0.2104542553 * $long + 0.7936177850 * $medium - 0.0040720468 * $short;
        $a = 1.9779984951 * $long - 2.4285922050 * $medium + 0.4505937099 * $short;
        $b = 0.0259040371 * $long + 0.7827717662 * $medium - 0.8086757660 * $short;

        return [$lightness, sqrt($a ** 2 + $b ** 2), fmod(rad2deg(atan2($b, $a)) + 360, 360)];
    }

    /**
     * The OKLCH colour in sRGB (0–255 channels), its chroma lowered until it
     * fits, so a vivid colour keeps its hue and lightness at every step.
     *
     * @return array{int, int, int}
     */
    private static function oklchToRgb(float $lightness, float $chroma, float $hue): array
    {
        $lightness = max(0.0, min(1.0, $lightness));

        for ($attempt = 0; $attempt < 60; $attempt++) {
            $linear = self::oklchToLinear($lightness, $chroma, $hue);

            if (min($linear) >= -0.0005 && max($linear) <= 1.0005) {
                break;
            }

            $chroma *= 0.95;
        }

        return array_map(fn (float $channel): int => (int) round(255 * self::fromLinear(max(0.0, min(1.0, $channel)))), $linear);
    }

    /**
     * @return array{float, float, float} linear sRGB, possibly out of range
     */
    private static function oklchToLinear(float $lightness, float $chroma, float $hue): array
    {
        $a = $chroma * cos(deg2rad($hue));
        $b = $chroma * sin(deg2rad($hue));

        $long = ($lightness + 0.3963377774 * $a + 0.2158037573 * $b) ** 3;
        $medium = ($lightness - 0.1055613458 * $a - 0.0638541728 * $b) ** 3;
        $short = ($lightness - 0.0894841775 * $a - 1.2914855480 * $b) ** 3;

        return [
            4.0767416621 * $long - 3.3077115913 * $medium + 0.2309699292 * $short,
            -1.2684380046 * $long + 2.6097574011 * $medium - 0.3413193965 * $short,
            -0.0041960863 * $long - 0.7034186147 * $medium + 1.7076147010 * $short,
        ];
    }

    /**
     * @return array{int, int, int}
     */
    private static function hexToRgb(string $hex): array
    {
        if (! self::isHex($hex)) {
            throw new InvalidArgumentException("[{$hex}] is not a six-digit hex colour.");
        }

        return array_map('hexdec', str_split(substr($hex, 1), 2));
    }

    /**
     * The colour's relative luminance, as WCAG defines it.
     *
     * @param  array{int, int, int}  $rgb
     */
    private static function luminance(array $rgb): float
    {
        [$red, $green, $blue] = array_map(self::toLinear(...), $rgb);

        return 0.2126 * $red + 0.7152 * $green + 0.0722 * $blue;
    }

    private static function toLinear(int $channel): float
    {
        $value = $channel / 255;

        return $value <= 0.04045 ? $value / 12.92 : (($value + 0.055) / 1.055) ** 2.4;
    }

    private static function fromLinear(float $value): float
    {
        return $value <= 0.0031308 ? 12.92 * $value : 1.055 * ($value ** (1 / 2.4)) - 0.055;
    }

    /**
     * @param  array{int, int, int}  $rgb
     */
    private static function triple(array $rgb): string
    {
        return implode(' ', $rgb);
    }
}
