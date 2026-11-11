<?php

namespace App\Support\Branding;

/**
 * How the interface is laid out and drawn for a company: the navigation and
 * its style, the page's width and background, the tone of its greys, the
 * corners, buttons, cards, tables, fields, status badges, page titles, the
 * text's size and faces, and whether things move. Each is one named choice,
 * set on <html> as a `data-ui-*` attribute (see app.blade.php) that app.css
 * draws; the greys are drawn by Brand::stylesheet().
 *
 * The presets are complete looks to start from, each a familiar style of
 * business software; any choice in one can then be changed on its own.
 */
class BrandDesign
{
    /**
     * Every choice and its options, in the order the settings screen and
     * `php artisan brand:options` list them, with their Arabic names. The
     * first option of each is today's look.
     *
     * @var array<string, array{label: string, options: array<string, string>}>
     */
    public const OPTIONS = [
        'tableVariant' => ['label' => 'Table component style', 'options' => [
            'default' => 'Current style',
            'ledger' => 'Accounting ledger',
            'striped' => 'Alternating rows',
            'bordered' => 'Bordered grid',
        ]],
        'motionStyle' => ['label' => 'Content entrance motion', 'options' => [
            'standard' => 'Current motion',
            'fade' => 'Gradual fade-in',
            'slide' => 'Gentle slide',
            'none' => 'No motion',
        ]],
        'details' => ['label' => 'Details view', 'options' => [
            'modal' => 'Centred pop-up window',
        ]],
        'footerStyle' => ['label' => 'Page footer', 'options' => [
            'full' => 'Full',
            'compact' => 'Compact',
        ]],
        'navigation' => ['label' => 'Navigation', 'options' => [
            'sidebar' => 'Floating section bar',
        ]],
        'navStyle' => ['label' => 'Bar and menu style', 'options' => [
            'glass' => 'Transparent glass',
            'solid' => 'Solid light',
            'dark' => 'Dark',
            'brand' => 'Company colour',
        ]],
        'width' => ['label' => 'Page width', 'options' => [
            'wide' => 'Wide',
            'contained' => 'Medium',
            'full' => 'Full screen',
        ]],
        'background' => ['label' => 'Page background', 'options' => [
            'glow' => 'Soft glow in the company colour',
            'plain' => 'Plain',
            'gradient' => 'Gradient from the top',
            'dots' => 'Dots',
            'grid' => 'Line grid',
            'navy' => 'Navy with blue light',
            'midnight' => 'Night blue',
            'graphite' => 'Charcoal',
        ]],
        'neutral' => ['label' => 'Grey tone', 'options' => [
            'graphite' => 'Graphite',
            'slate' => 'Bluish grey',
            'zinc' => 'Cool grey',
            'neutral' => 'Neutral grey',
            'stone' => 'Warm grey',
            'sage' => 'Greenish grey',
            'navy' => 'Navy',
        ]],
        'radius' => ['label' => 'Corners', 'options' => [
            'rounded' => 'Rounded',
            'soft' => 'Slight',
            'sharp' => 'Sharp',
            'round' => 'Very rounded',
        ]],
        'buttons' => ['label' => 'Buttons', 'options' => [
            'gradient' => 'Glossy gradient',
            'solid' => 'Solid',
            'soft' => 'Soft',
            'outline' => 'Outlined',
            'raised' => 'Raised 3D',
            'pill' => 'Rounded pill',
        ]],
        'cards' => ['label' => 'Cards', 'options' => [
            'elevated' => 'With a light shadow',
            'outlined' => 'With a border',
            'flat' => 'Flat',
            'floating' => 'Floating with a deep shadow',
            'glass' => 'Glass',
            'accent' => 'With a top line in the company colour',
        ]],
        'tables' => ['label' => 'Tables', 'options' => [
            'cards' => 'Rows as cards',
            'striped' => 'Alternating rows',
            'bordered' => 'Bordered grid',
            'minimal' => 'Dividing lines only',
            'boxed' => 'One card with dividers',
            'spreadsheet' => 'Dense data table',
            'elevated' => 'Floating rows with a deep shadow',
        ]],
        'tableHeader' => ['label' => 'Table header', 'options' => [
            'plain' => 'No background',
            'tinted' => 'Light grey',
            'dark' => 'Dark',
            'brand' => 'Company colour',
        ]],
        'density' => ['label' => 'Table density', 'options' => [
            'comfortable' => 'Comfortable',
            'compact' => 'Condensed',
            'spacious' => 'Spacious',
        ]],
        'tableToolbar' => ['label' => 'Table toolbar', 'options' => [
            'card' => 'Card with a top line',
            'plain' => 'No background',
            'tinted' => 'Light coloured background',
        ]],
        'searchStyle' => ['label' => 'Search and filters', 'options' => [
            'default' => 'With a border',
            'pill' => 'Rounded pill',
            'filled' => 'Filled with a background',
            'underline' => 'Underline',
            'panel' => 'Inside a coloured panel',
        ]],
        'inputs' => ['label' => 'Input fields', 'options' => [
            'outlined' => 'With a border',
            'filled' => 'Filled with a background',
            'underline' => 'Underline only',
            'pill' => 'Rounded pill',
            'inset' => 'Inset with an inner shadow',
            'thick' => 'With a thick border',
        ]],
        'inputFocus' => ['label' => 'Field while typing', 'options' => [
            'ring' => 'Light ring',
            'glow' => 'Glow in the company colour',
            'border' => 'Coloured border only',
        ]],
        'checkboxes' => ['label' => 'Checkboxes', 'options' => [
            'square' => 'Square',
            'rounded' => 'Rounded corners',
            'circle' => 'Circular',
            'large' => 'Large (checkbox)',
        ]],
        'switches' => ['label' => 'On/off switches', 'options' => [
            'pill' => 'Green pill',
            'brand' => 'Company colour',
            'square' => 'Square',
            'slim' => 'Thin with a large knob',
        ]],
        'badges' => ['label' => 'Status badges', 'options' => [
            'soft' => 'Soft',
            'solid' => 'Solid',
            'outline' => 'With a border',
        ]],
        'pageTitle' => ['label' => 'Page titles', 'options' => [
            'plain' => 'Text only',
            'bar' => 'With a coloured side bar',
            'underline' => 'With a coloured underline',
        ]],
        'textSize' => ['label' => 'Font size', 'options' => [
            'normal' => 'Normal',
            'small' => 'Smaller',
            'large' => 'Larger',
        ]],
        'bodyFont' => ['label' => 'Body font', 'options' => [
            'plex' => 'IBM Plex Sans Arabic',
            'alexandria' => 'Alexandria',
            'cairo' => 'Cairo',
            'tajawal' => 'Tajawal',
            'kufi' => 'Noto Kufi Arabic',
        ]],
        'headingFont' => ['label' => 'Heading font', 'options' => [
            'messiri' => 'El Messiri',
            'alexandria' => 'Alexandria',
            'plex' => 'IBM Plex Sans Arabic',
            'cairo' => 'Cairo',
            'tajawal' => 'Tajawal',
            'kufi' => 'Noto Kufi Arabic',
        ]],
        'motion' => ['label' => 'Motion', 'options' => [
            'full' => 'Full motion',
            'reduced' => 'No animation',
        ]],
        'buttonHover' => ['label' => 'Buttons on hover', 'options' => [
            'brighten' => 'Lighten',
            'lift' => 'Lift with a shadow',
            'glow' => 'Coloured glow',
            'darken' => 'Darken',
            'scale' => 'Slight zoom',
            'none' => 'No change',
        ]],
        'buttonPress' => ['label' => 'Buttons when pressed', 'options' => [
            'sink' => 'Slight press down',
            'shrink' => 'Shrink',
            'none' => 'No animation',
        ]],
        'buttonSize' => ['label' => 'Button size', 'options' => [
            'regular' => 'Normal',
            'compact' => 'Small (size)',
            'large' => 'Large (size)',
        ]],
        'cardHover' => ['label' => 'Cards on hover', 'options' => [
            'none' => 'Static',
            'lift' => 'Lift',
            'glow' => 'Glow in the company colour',
            'outline' => 'Border in the company colour',
        ]],
        'rowHover' => ['label' => 'Table rows on hover', 'options' => [
            'lift' => 'Lift like a card',
            'tint' => 'Light colour tint',
            'edge' => 'Side line only',
            'none' => 'No change',
        ]],
        'focusRing' => ['label' => 'Focus ring (keyboard)', 'options' => [
            'dark' => 'Dark',
            'brand' => 'Company colour',
            'halo' => 'Soft glow',
        ]],
        'navHighlight' => ['label' => 'Current section highlight', 'options' => [
            'pill' => 'Dark pill',
            'brand' => 'Pill in the company colour',
            'underline' => 'Underline',
            'secondary' => 'Pill in the secondary colour',
            'accent' => 'Pill in the accent colour',
        ]],
    ];

    /**
     * Exact values a company may set beyond the choices (`tokens` in the
     * file), each within its range: the unit it is written in and what it
     * changes. Left out, the choices above decide.
     *
     * @var array<string, array{label: string, min: float, max: float, step: float, unit: string}>
     */
    public const TOKENS = [
        'radiusScale' => ['label' => 'Corner scale', 'min' => 0, 'max' => 2, 'step' => 0.05, 'unit' => '×'],
        'fontScale' => ['label' => 'Font scale', 'min' => 0.85, 'max' => 1.25, 'step' => 0.01, 'unit' => '×'],
        'contentWidth' => ['label' => 'Maximum content width', 'min' => 960, 'max' => 2400, 'step' => 20, 'unit' => 'px'],
        'buttonRadius' => ['label' => 'Button rounding', 'min' => 0, 'max' => 40, 'step' => 1, 'unit' => 'px'],
        'buttonHeight' => ['label' => 'Button height', 'min' => 30, 'max' => 60, 'step' => 1, 'unit' => 'px'],
        'buttonPaddingX' => ['label' => 'Button horizontal padding', 'min' => 6, 'max' => 40, 'step' => 1, 'unit' => 'px'],
        'buttonFontWeight' => ['label' => 'Button font weight', 'min' => 400, 'max' => 800, 'step' => 100, 'unit' => ''],
        'hoverLift' => ['label' => 'Lift amount on hover', 'min' => 0, 'max' => 8, 'step' => 1, 'unit' => 'px'],
        'shadowStrength' => ['label' => 'Shadow strength', 'min' => 0, 'max' => 2, 'step' => 0.05, 'unit' => '×'],
        'transitionMs' => ['label' => 'Motion speed', 'min' => 0, 'max' => 800, 'step' => 20, 'unit' => 'ms'],
        'glassAlpha' => ['label' => 'Glass transparency', 'min' => 0.2, 'max' => 0.9, 'step' => 0.05, 'unit' => ''],
        'glassBlur' => ['label' => 'Glass blur strength', 'min' => 0, 'max' => 40, 'step' => 2, 'unit' => 'px'],
    ];

    /**
     * Complete looks to start from: each names the choices it changes from
     * today's look (the rest stay as they are).
     *
     * @var array<string, array{label: string, description: string, design: array<string, string>}>
     */
    public const PRESETS = [
        'superpower' => [
            'label' => 'Navy glass super power',
            'description' => 'Navy glass cards over a blue-lit background, a floating section bar, tables inside glass panels, gradient buttons and filled fields.',
            'design' => ['background' => 'navy', 'neutral' => 'navy', 'cards' => 'glass', 'tables' => 'boxed', 'tableToolbar' => 'plain', 'searchStyle' => 'filled', 'inputs' => 'filled', 'switches' => 'brand', 'headingFont' => 'cairo', 'rowHover' => 'tint', 'focusRing' => 'brand', 'navHighlight' => 'brand'],
        ],
        'classic' => [
            'label' => 'Classic premium',
            'description' => 'The classic look: glossy buttons and rows as cards.',
            'design' => [],
        ],
        'corporate' => [
            'label' => 'Corporate',
            'description' => 'A light section bar and grid tables with a grey header, like corporate and bank systems.',
            'design' => ['navStyle' => 'solid', 'width' => 'full', 'background' => 'plain', 'neutral' => 'slate', 'radius' => 'soft', 'buttons' => 'solid', 'cards' => 'outlined', 'tables' => 'bordered', 'tableHeader' => 'tinted', 'density' => 'compact', 'headingFont' => 'plex', 'pageTitle' => 'bar', 'searchStyle' => 'filled', 'focusRing' => 'brand', 'checkboxes' => 'rounded'],
        ],
        'minimal' => [
            'label' => 'Simple and calm',
            'description' => 'White space, outlined buttons and tables with dividing lines only.',
            'design' => ['navStyle' => 'solid', 'width' => 'contained', 'background' => 'plain', 'neutral' => 'zinc', 'radius' => 'soft', 'buttons' => 'outline', 'cards' => 'flat', 'tables' => 'minimal', 'inputs' => 'underline', 'badges' => 'outline', 'headingFont' => 'alexandria', 'rowHover' => 'tint', 'focusRing' => 'halo', 'searchStyle' => 'underline', 'tableToolbar' => 'plain'],
        ],
        'soft' => [
            'label' => 'Soft modern',
            'description' => 'A compact menu, very rounded corners, floating cards and filled fields.',
            'design' => ['background' => 'gradient', 'radius' => 'round', 'buttons' => 'soft', 'cards' => 'floating', 'tables' => 'striped', 'inputs' => 'filled', 'bodyFont' => 'alexandria', 'headingFont' => 'alexandria', 'buttonHover' => 'glow', 'cardHover' => 'glow', 'searchStyle' => 'pill', 'switches' => 'brand', 'checkboxes' => 'circle'],
        ],
        'operations' => [
            'label' => 'Dense operational',
            'description' => 'The most data: a dark menu, condensed alternating rows, a smaller font and sharp corners.',
            'design' => ['navStyle' => 'dark', 'width' => 'full', 'background' => 'plain', 'neutral' => 'neutral', 'radius' => 'sharp', 'buttons' => 'solid', 'cards' => 'outlined', 'tableHeader' => 'dark', 'density' => 'compact', 'textSize' => 'small', 'headingFont' => 'plex', 'motion' => 'reduced', 'tables' => 'spreadsheet', 'searchStyle' => 'filled', 'buttonHover' => 'darken', 'buttonSize' => 'compact', 'rowHover' => 'tint'],
        ],
        'executive' => [
            'label' => 'Dark executive',
            'description' => 'A dark section bar, cards with a coloured top line, raised buttons and a table header in the company colour.',
            'design' => ['navStyle' => 'dark', 'background' => 'glow', 'neutral' => 'stone', 'buttons' => 'raised', 'cards' => 'accent', 'tableHeader' => 'brand', 'badges' => 'solid', 'pageTitle' => 'underline', 'headingFont' => 'messiri', 'buttonHover' => 'lift', 'cardHover' => 'lift', 'navHighlight' => 'brand', 'switches' => 'brand', 'inputFocus' => 'glow'],
        ],
        'glass' => [
            'label' => 'Modern glass',
            'description' => 'Glass cards over a gradient background, pill buttons and very rounded corners.',
            'design' => ['navStyle' => 'glass', 'background' => 'gradient', 'radius' => 'round', 'buttons' => 'pill', 'cards' => 'glass', 'tables' => 'cards', 'inputs' => 'filled', 'bodyFont' => 'cairo', 'headingFont' => 'cairo', 'searchStyle' => 'pill', 'buttonHover' => 'scale', 'buttonPress' => 'shrink', 'cardHover' => 'glow', 'switches' => 'brand', 'inputFocus' => 'glow'],
        ],
        'official' => [
            'label' => 'Formal government',
            'description' => 'A section bar in the company colour, grid tables with a coloured header and underlined titles.',
            'design' => ['navStyle' => 'brand', 'width' => 'contained', 'background' => 'grid', 'neutral' => 'neutral', 'radius' => 'soft', 'buttons' => 'solid', 'cards' => 'outlined', 'tableHeader' => 'brand', 'pageTitle' => 'underline', 'bodyFont' => 'kufi', 'headingFont' => 'kufi', 'tables' => 'boxed', 'tableToolbar' => 'tinted', 'searchStyle' => 'panel', 'checkboxes' => 'large', 'navHighlight' => 'underline'],
        ],
        'friendly' => [
            'label' => 'Friendly and comfortable',
            'description' => 'Tajawal font at a larger size, pill buttons, a dotted background and solid badges.',
            'design' => ['navStyle' => 'solid', 'background' => 'dots', 'neutral' => 'sage', 'radius' => 'round', 'buttons' => 'pill', 'cards' => 'elevated', 'tables' => 'striped', 'badges' => 'solid', 'textSize' => 'large', 'bodyFont' => 'tajawal', 'headingFont' => 'tajawal', 'inputs' => 'pill', 'checkboxes' => 'circle', 'switches' => 'brand', 'buttonHover' => 'lift', 'buttonSize' => 'large', 'density' => 'spacious'],
        ],
        'paper' => [
            'label' => 'Calm paper',
            'description' => 'Like printed paper: sharp corners, flat bordered cards, tables with lines only and a Kufi font for headings.',
            'design' => ['navStyle' => 'solid', 'width' => 'contained', 'background' => 'plain', 'neutral' => 'stone', 'radius' => 'sharp', 'buttons' => 'outline', 'cards' => 'outlined', 'tables' => 'minimal', 'tableHeader' => 'plain', 'inputs' => 'underline', 'badges' => 'outline', 'pageTitle' => 'underline', 'headingFont' => 'kufi', 'motion' => 'reduced', 'switches' => 'square', 'searchStyle' => 'underline', 'tableToolbar' => 'plain', 'buttonHover' => 'none', 'buttonPress' => 'none'],
        ],
    ];

    /**
     * The design choices with their labels in the current language, for
     * the brand page.
     *
     * @return array<string, array{label: string, options: array<string, string>}>
     */
    public static function translatedOptions(): array
    {
        return array_map(fn (array $choice): array => [
            ...$choice,
            'label' => __($choice['label']),
            'options' => array_map(fn (string $label): string => __($label), $choice['options']),
        ], self::OPTIONS);
    }

    /**
     * The complete looks with their names and descriptions in the current
     * language, for the brand page.
     *
     * @return array<string, array{label: string, description: string, design: array<string, string>}>
     */
    public static function translatedPresets(): array
    {
        return array_map(fn (array $preset): array => [...$preset, 'label' => __($preset['label']), 'description' => __($preset['description'])], self::PRESETS);
    }

    /**
     * Today's look: each choice's first option.
     *
     * @return array<string, string>
     */
    public static function defaults(): array
    {
        return array_map(fn (array $choice): string => array_key_first($choice['options']), self::OPTIONS);
    }

    /**
     * A preset's whole look: today's, with the choices the preset changes.
     *
     * @return array<string, string>
     */
    public static function look(?string $preset): array
    {
        return [...self::defaults(), ...($preset !== null ? self::PRESETS[$preset]['design'] : [])];
    }

    /**
     * Every choice set to a known option: the given one, else the named
     * preset's, else today's. `preset` stays named only while every choice
     * is still the preset's.
     *
     * @param  array<string, mixed>  $design
     * @return array<string, string>
     */
    public static function normalize(array $design): array
    {
        $preset = is_string($design['preset'] ?? null) && isset(self::PRESETS[$design['preset']]) ? $design['preset'] : null;
        $base = self::look($preset);
        $chosen = [];

        foreach (self::OPTIONS as $key => $choice) {
            $value = $design[$key] ?? null;
            $chosen[$key] = is_string($value) && isset($choice['options'][$value]) ? $value : $base[$key];
        }

        // A preset with any choice changed is a look of the company's own.
        return ['preset' => $preset !== null && $chosen == $base ? $preset : 'custom', ...$chosen];
    }

    /**
     * The validation rules for a design, under `$prefix` (e.g. "design").
     *
     * @return array<string, array<int, string>>
     */
    public static function rules(string $prefix): array
    {
        $rules = [$prefix => ['nullable', 'array'], "{$prefix}.preset" => ['nullable', 'string', 'in:custom,'.implode(',', array_keys(self::PRESETS))]];

        foreach (self::OPTIONS as $key => $choice) {
            $rules["{$prefix}.{$key}"] = ['nullable', 'string', 'in:'.implode(',', array_keys($choice['options']))];
        }

        return $rules;
    }

    /**
     * The validation rules for exact values, under `$prefix` (e.g. "tokens").
     *
     * @return array<string, array<int, string>>
     */
    public static function tokenRules(string $prefix): array
    {
        $rules = [$prefix => ['nullable', 'array']];

        foreach (self::TOKENS as $key => $token) {
            $rules["{$prefix}.{$key}"] = ['nullable', 'numeric', "between:{$token['min']},{$token['max']}"];
        }

        return $rules;
    }

    /**
     * Each exact value as a number within its range, or null when not set.
     *
     * @param  array<string, mixed>  $tokens
     * @return array<string, int|float|null>
     */
    public static function normalizeTokens(array $tokens): array
    {
        return array_map(function (array $token) use ($tokens): int|float|null {
            $key = array_search($token, self::TOKENS, true);
            $value = $tokens[$key] ?? null;

            if (! is_numeric($value)) {
                return null;
            }

            $value = max($token['min'], min($token['max'], (float) $value));

            return floor($token['step']) == $token['step'] ? (int) round($value) : round($value, 3);
        }, self::TOKENS);
    }

    /**
     * The CSS the exact values draw: variables the stylesheets read, and the
     * buttons' own measures (only those set, so a page's own sizes stay).
     *
     * @param  array<string, int|float|null>  $tokens
     */
    public static function tokenStylesheet(array $tokens): string
    {
        $variables = array_filter([
            '--radius-scale' => $tokens['radiusScale'],
            '--ui-content-width' => $tokens['contentWidth'] !== null ? $tokens['contentWidth'].'px' : null,
            '--hover-lift' => $tokens['hoverLift'] !== null ? $tokens['hoverLift'].'px' : null,
            '--shadow-strength' => $tokens['shadowStrength'],
            '--ui-transition' => $tokens['transitionMs'] !== null ? $tokens['transitionMs'].'ms' : null,
            '--glass-alpha' => $tokens['glassAlpha'],
            '--glass-blur' => $tokens['glassBlur'] !== null ? $tokens['glassBlur'].'px' : null,
        ], fn ($value): bool => $value !== null);
        $buttons = array_filter([
            'border-radius' => $tokens['buttonRadius'] !== null ? $tokens['buttonRadius'].'px' : null,
            'min-height' => $tokens['buttonHeight'] !== null ? $tokens['buttonHeight'].'px' : null,
            'padding-inline' => $tokens['buttonPaddingX'] !== null ? $tokens['buttonPaddingX'].'px' : null,
            'font-weight' => $tokens['buttonFontWeight'],
        ], fn ($value): bool => $value !== null);
        $declare = fn (array $properties): string => implode('', array_map(fn (string $name, int|float|string $value): string => "{$name}:{$value};", array_keys($properties), $properties));

        // `[data-ui-navigation]` (always on <html>) matches the choices' own strength, so an exact value, written after them, wins.
        return ($variables !== [] ? ':root[data-ui-navigation]{'.$declare($variables).'}' : '')
            .($tokens['fontScale'] !== null ? ':root[data-ui-navigation]{font-size:'.round($tokens['fontScale'] * 100, 2).'%}' : '')
            .($buttons !== [] ? ':root[data-ui-navigation] :is(.ui-btn-primary,.ui-btn-secondary,.ui-btn-danger){'.$declare($buttons).'}' : '');
    }

    /**
     * A company's own CSS, made safe to put in a <style>: it cannot close the
     * element, load anything from elsewhere or run script.
     */
    public static function safeCss(?string $css): ?string
    {
        if ($css === null || trim($css) === '') {
            return null;
        }

        // Escapes (\75rl, \40import) could spell what the checks below look for, so none are kept.
        $css = str_replace('\\', '', $css);
        // CSS needs no "<" (">" stays, as the child combinator), so no tag can open or close in it.
        $css = str_ireplace(['<', '-->', 'javascript:', 'expression(', '@import', 'behavior:', '-moz-binding'], '', $css);
        // url() may only point at data: images, never at another site.
        $css = preg_replace('/url\(\s*+[\'"]?+(?!data:image\/)[^)]*\)/i', 'none', $css);

        return trim($css) !== '' ? trim($css) : null;
    }

    /**
     * The design as <html> attributes, e.g. `data-ui-buttons="solid"`.
     *
     * @param  array<string, string>  $design
     * @return array<string, string>
     */
    public static function htmlAttributes(array $design): array
    {
        $attributes = [];

        foreach (array_keys(self::OPTIONS) as $key) {
            $attributes['data-ui-'.strtolower((string) preg_replace('/[A-Z]/', '-$0', $key))] = $design[$key];
        }

        return $attributes;
    }
}
