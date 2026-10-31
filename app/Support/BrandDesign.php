<?php

namespace App\Support;

/**
 * How the interface is laid out and drawn for a company: the navigation,
 * the corners, the buttons, the cards, the tables, the fonts and the page's
 * width. Each is one named choice, set on <html> as a `data-ui-*` attribute
 * (see app.blade.php) that app.css draws.
 *
 * The presets are complete looks to start from, each a familiar style of
 * business software; any choice in one can then be changed on its own.
 */
class BrandDesign
{
    /**
     * Every choice and its options, in the order the settings screen shows
     * them, with the Arabic names it shows. The first option of each is
     * today's look.
     *
     * @var array<string, array{label: string, options: array<string, string>}>
     */
    public const OPTIONS = [
        'navigation' => ['label' => 'التنقل', 'options' => [
            'topbar' => 'شريط علوي عائم',
            'sidebar' => 'قائمة جانبية',
            'rail' => 'قائمة جانبية مصغّرة',
        ]],
        'width' => ['label' => 'عرض الصفحة', 'options' => [
            'wide' => 'عريض',
            'contained' => 'متوسط',
            'full' => 'كامل الشاشة',
        ]],
        'radius' => ['label' => 'الزوايا', 'options' => [
            'rounded' => 'مستديرة',
            'soft' => 'خفيفة',
            'sharp' => 'حادة',
            'round' => 'مستديرة جداً',
        ]],
        'buttons' => ['label' => 'الأزرار', 'options' => [
            'gradient' => 'متدرّجة لامعة',
            'solid' => 'مصمتة',
            'soft' => 'ناعمة',
            'outline' => 'محدّدة بإطار',
        ]],
        'cards' => ['label' => 'البطاقات', 'options' => [
            'elevated' => 'بظل خفيف',
            'outlined' => 'بإطار',
            'flat' => 'مسطحة',
            'floating' => 'عائمة بظل عميق',
        ]],
        'tables' => ['label' => 'الجداول', 'options' => [
            'cards' => 'صفوف كبطاقات',
            'striped' => 'صفوف متناوبة',
            'bordered' => 'شبكة بحدود',
            'minimal' => 'خطوط فاصلة فقط',
        ]],
        'density' => ['label' => 'كثافة الجداول', 'options' => [
            'comfortable' => 'مريحة',
            'compact' => 'مضغوطة',
        ]],
        'bodyFont' => ['label' => 'خط النصوص', 'options' => [
            'plex' => 'IBM Plex Sans Arabic',
            'alexandria' => 'Alexandria',
        ]],
        'headingFont' => ['label' => 'خط العناوين', 'options' => [
            'messiri' => 'El Messiri',
            'alexandria' => 'Alexandria',
            'plex' => 'IBM Plex Sans Arabic',
        ]],
    ];

    /**
     * Complete looks to start from.
     *
     * @var array<string, array{label: string, description: string, design: array<string, string>}>
     */
    public const PRESETS = [
        'classic' => [
            'label' => 'كلاسيكي فاخر',
            'description' => 'الشكل الحالي: شريط علوي عائم، أزرار لامعة وصفوف كبطاقات.',
            'design' => ['navigation' => 'topbar', 'width' => 'wide', 'radius' => 'rounded', 'buttons' => 'gradient', 'cards' => 'elevated', 'tables' => 'cards', 'density' => 'comfortable', 'bodyFont' => 'plex', 'headingFont' => 'messiri'],
        ],
        'corporate' => [
            'label' => 'مؤسسي',
            'description' => 'قائمة جانبية وجداول بشبكة واضحة، كأنظمة المؤسسات والبنوك.',
            'design' => ['navigation' => 'sidebar', 'width' => 'full', 'radius' => 'soft', 'buttons' => 'solid', 'cards' => 'outlined', 'tables' => 'bordered', 'density' => 'compact', 'bodyFont' => 'plex', 'headingFont' => 'plex'],
        ],
        'minimal' => [
            'label' => 'بسيط وهادئ',
            'description' => 'مساحات بيضاء، أزرار بإطار وجداول بخطوط فاصلة فقط.',
            'design' => ['navigation' => 'topbar', 'width' => 'contained', 'radius' => 'soft', 'buttons' => 'outline', 'cards' => 'flat', 'tables' => 'minimal', 'density' => 'comfortable', 'bodyFont' => 'plex', 'headingFont' => 'alexandria'],
        ],
        'soft' => [
            'label' => 'ناعم عصري',
            'description' => 'قائمة مصغّرة، زوايا مستديرة وبطاقات عائمة وألوان ناعمة.',
            'design' => ['navigation' => 'rail', 'width' => 'wide', 'radius' => 'round', 'buttons' => 'soft', 'cards' => 'floating', 'tables' => 'striped', 'density' => 'comfortable', 'bodyFont' => 'alexandria', 'headingFont' => 'alexandria'],
        ],
        'operations' => [
            'label' => 'تشغيلي كثيف',
            'description' => 'أكبر قدر من البيانات على الشاشة: قائمة جانبية، صفوف متناوبة مضغوطة وزوايا حادة.',
            'design' => ['navigation' => 'sidebar', 'width' => 'full', 'radius' => 'sharp', 'buttons' => 'solid', 'cards' => 'outlined', 'tables' => 'striped', 'density' => 'compact', 'bodyFont' => 'plex', 'headingFont' => 'plex'],
        ],
    ];

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
        $base = $preset !== null ? self::PRESETS[$preset]['design'] : self::defaults();
        $chosen = [];

        foreach (self::OPTIONS as $key => $choice) {
            $value = $design[$key] ?? null;
            $chosen[$key] = is_string($value) && isset($choice['options'][$value]) ? $value : $base[$key];
        }

        // A preset with any choice changed is a look of the company's own.
        return ['preset' => $preset !== null && $chosen == self::PRESETS[$preset]['design'] ? $preset : 'custom', ...$chosen];
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
