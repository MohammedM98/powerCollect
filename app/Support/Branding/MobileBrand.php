<?php

namespace App\Support\Branding;

/**
 * The company's identity as the field app draws it: its names, logos, fonts
 * and the colours of both themes. The colours are read from the same
 * variables the website paints with (resources/css/theme.css, then the
 * company's own stylesheet from Brand::stylesheet()), so the app always
 * looks like the site, whatever the Super Admin sets.
 */
class MobileBrand
{
    /**
     * Each colour the app uses, as the website variable it is taken from in
     * the light and in the dark theme.
     *
     * @var array<string, array{0: string, 1: string}>
     */
    private const COLORS = [
        'page' => ['panel-page', 'panel-page'],
        'surface' => ['panel-bg', 'panel-bg'],
        'raised' => ['panel-tile', 'panel-tile'],
        'field' => ['panel-field', 'panel-field'],
        'line' => ['gray-200', 'gray-200'],
        'line_soft' => ['gray-100', 'gray-100'],
        'ink' => ['gray-900', 'gray-900'],
        'ink2' => ['gray-700', 'gray-700'],
        'muted' => ['gray-500', 'gray-500'],
        'faint' => ['gray-400', 'gray-400'],
        'brand' => ['brand-500', 'brand-600'],
        'brand_strong' => ['brand-600', 'brand-700'],
        'brand_tint' => ['brand-50', 'brand-100'],
        'brand_fill' => ['brand-solid', 'brand-solid'],
        'brand_fill_ink' => ['brand-ink', 'brand-ink'],
        'action' => ['action', 'action'],
        'action_hover' => ['action-hover', 'action-hover'],
        'action_ink' => ['action-ink', 'action-ink'],
        'success' => ['success-700', 'success-400'],
        'warning' => ['warning-700', 'warning-400'],
        'danger' => ['danger-600', 'danger-400'],
        'info' => ['blue-600', 'blue-600'],
        'hero_from' => ['graphite-700', 'graphite-700'],
        'hero_via' => ['graphite-800', 'graphite-800'],
        'hero_to' => ['graphite-900', 'graphite-900'],
    ];

    /** The font each of the website's font choices (BrandDesign) is drawn with in the app. */
    public const FONTS = ['zain', 'plex', 'alexandria', 'cairo', 'tajawal', 'kufi', 'messiri'];

    public function __construct(private Brand $brand) {}

    /**
     * @return array{fingerprint: string, company: array{name: string, short_name: string, tagline: ?string}, logos: array<string, string>, fonts: array{body: string, heading: string}, colors: array{light: array<string, string>, dark: array<string, string>}}
     */
    public function payload(): array
    {
        $profile = $this->brand->profile();
        [$light, $dark] = $this->variables();
        $pick = fn (array $variables, int $theme): array => array_map(
            fn (array $names): string => self::hex($variables[$names[$theme]]),
            self::COLORS,
        );

        $payload = [
            'company' => [
                'name' => $profile['company']['name'],
                'short_name' => $profile['company']['shortName'] ?? $profile['company']['name'],
                'tagline' => $profile['company']['tagline'],
            ],
            'logos' => [
                'main' => url($this->brand->logoUrl('main')),
                'light' => url($this->brand->logoUrl('light')),
                'icon' => url($this->brand->logoUrl('icon')),
            ],
            'fonts' => [
                'body' => in_array($profile['design']['bodyFont'], self::FONTS, true) ? $profile['design']['bodyFont'] : 'zain',
                'heading' => in_array($profile['design']['headingFont'], self::FONTS, true) ? $profile['design']['headingFont'] : 'zain',
            ],
            'colors' => ['light' => $pick($light, 0), 'dark' => $pick($dark, 1)],
        ];

        // Changes whenever anything the app draws changes, so it knows to refresh what it keeps.
        return ['fingerprint' => hash('sha256', json_encode($payload, JSON_THROW_ON_ERROR)), ...$payload];
    }

    /**
     * The website's colour variables (`R G B`) in the light and the dark
     * theme: theme.css's own, under the company's stylesheet.
     *
     * @return array{0: array<string, string>, 1: array<string, string>}
     */
    private function variables(): array
    {
        $theme = self::declarations((string) file_get_contents(resource_path('css/theme.css')));
        $company = self::declarations($this->brand->stylesheet() ?? '');
        $light = [...$theme['light'], ...$company['light']];
        $dark = [...$light, ...$theme['dark'], ...$company['dark']];

        return [self::resolved($light), self::resolved($dark)];
    }

    /**
     * The colour variables set on `:root` and on `.dark` in a stylesheet, in order.
     *
     * @return array{light: array<string, string>, dark: array<string, string>}
     */
    private static function declarations(string $css): array
    {
        $css = (string) preg_replace('~/\*.*?\*/~s', '', $css);
        $found = ['light' => [], 'dark' => []];
        preg_match_all('~(?<![^\s}])(:root|\.dark)\s*\{([^}]*)\}~', $css, $blocks, PREG_SET_ORDER);

        foreach ($blocks as [, $selector, $body]) {
            preg_match_all('~--([\w-]+)\s*:\s*([^;]+);~', $body, $declarations, PREG_SET_ORDER);
            foreach ($declarations as [, $name, $value]) {
                $found[$selector === ':root' ? 'light' : 'dark'][$name] = trim($value);
            }
        }

        return $found;
    }

    /**
     * The variables whose value is a colour, with `var(--other)` followed to it.
     *
     * @param  array<string, string>  $variables
     * @return array<string, string>
     */
    private static function resolved(array $variables): array
    {
        $value = function (string $name, int $depth = 0) use (&$value, $variables): ?string {
            $raw = $variables[$name] ?? null;
            if ($raw !== null && $depth < 5 && preg_match('~^var\(--([\w-]+)\)$~', $raw, $reference)) {
                return $value($reference[1], $depth + 1);
            }

            return $raw !== null && preg_match('~^\d{1,3} \d{1,3} \d{1,3}$~', $raw) ? $raw : null;
        };

        return array_filter(array_combine(array_keys($variables), array_map(fn (string $name): ?string => $value($name), array_keys($variables))));
    }

    private static function hex(string $triple): string
    {
        return vsprintf('#%02X%02X%02X', array_map('intval', explode(' ', $triple)));
    }
}
