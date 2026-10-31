<?php

namespace App\Support;

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
        'navigation' => ['label' => 'التنقل', 'options' => [
            'topbar' => 'شريط علوي عائم',
            'sidebar' => 'قائمة جانبية',
            'rail' => 'قائمة جانبية مصغّرة',
        ]],
        'navStyle' => ['label' => 'شكل الشريط والقائمة', 'options' => [
            'glass' => 'زجاجي شفاف',
            'solid' => 'مصمت فاتح',
            'dark' => 'داكن',
            'brand' => 'بلون الشركة',
        ]],
        'width' => ['label' => 'عرض الصفحة', 'options' => [
            'wide' => 'عريض',
            'contained' => 'متوسط',
            'full' => 'كامل الشاشة',
        ]],
        'background' => ['label' => 'خلفية الصفحات', 'options' => [
            'glow' => 'توهج خفيف بلون الشركة',
            'plain' => 'سادة',
            'gradient' => 'تدرّج من الأعلى',
            'dots' => 'نقاط',
            'grid' => 'شبكة خطوط',
        ]],
        'neutral' => ['label' => 'درجة الرمادي', 'options' => [
            'graphite' => 'جرافيت',
            'slate' => 'رمادي مزرق',
            'zinc' => 'رمادي بارد',
            'neutral' => 'رمادي محايد',
            'stone' => 'رمادي دافئ',
            'sage' => 'رمادي مخضر',
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
            'raised' => 'بارزة ثلاثية الأبعاد',
            'pill' => 'كبسولة مستديرة',
        ]],
        'cards' => ['label' => 'البطاقات', 'options' => [
            'elevated' => 'بظل خفيف',
            'outlined' => 'بإطار',
            'flat' => 'مسطحة',
            'floating' => 'عائمة بظل عميق',
            'glass' => 'زجاجية',
            'accent' => 'بخط علوي بلون الشركة',
        ]],
        'tables' => ['label' => 'الجداول', 'options' => [
            'cards' => 'صفوف كبطاقات',
            'striped' => 'صفوف متناوبة',
            'bordered' => 'شبكة بحدود',
            'minimal' => 'خطوط فاصلة فقط',
        ]],
        'tableHeader' => ['label' => 'رأس الجداول', 'options' => [
            'plain' => 'بلا خلفية',
            'tinted' => 'رمادي فاتح',
            'dark' => 'داكن',
            'brand' => 'بلون الشركة',
        ]],
        'density' => ['label' => 'كثافة الجداول', 'options' => [
            'comfortable' => 'مريحة',
            'compact' => 'مضغوطة',
        ]],
        'inputs' => ['label' => 'حقول الإدخال', 'options' => [
            'outlined' => 'بإطار',
            'filled' => 'معبأة بخلفية',
            'underline' => 'خط سفلي فقط',
        ]],
        'badges' => ['label' => 'شارات الحالة', 'options' => [
            'soft' => 'ناعمة',
            'solid' => 'مصمتة',
            'outline' => 'بإطار',
        ]],
        'pageTitle' => ['label' => 'عناوين الصفحات', 'options' => [
            'plain' => 'نص فقط',
            'bar' => 'بشريط جانبي ملوّن',
            'underline' => 'بخط سفلي ملوّن',
        ]],
        'textSize' => ['label' => 'حجم الخط', 'options' => [
            'normal' => 'عادي',
            'small' => 'أصغر',
            'large' => 'أكبر',
        ]],
        'bodyFont' => ['label' => 'خط النصوص', 'options' => [
            'plex' => 'IBM Plex Sans Arabic',
            'alexandria' => 'Alexandria',
            'cairo' => 'Cairo',
            'tajawal' => 'Tajawal',
            'kufi' => 'Noto Kufi Arabic',
        ]],
        'headingFont' => ['label' => 'خط العناوين', 'options' => [
            'messiri' => 'El Messiri',
            'alexandria' => 'Alexandria',
            'plex' => 'IBM Plex Sans Arabic',
            'cairo' => 'Cairo',
            'tajawal' => 'Tajawal',
            'kufi' => 'Noto Kufi Arabic',
        ]],
        'motion' => ['label' => 'الحركة', 'options' => [
            'full' => 'حركة كاملة',
            'reduced' => 'بلا حركة',
        ]],
    ];

    /**
     * Complete looks to start from: each names the choices it changes from
     * today's look (the rest stay as they are).
     *
     * @var array<string, array{label: string, description: string, design: array<string, string>}>
     */
    public const PRESETS = [
        'classic' => [
            'label' => 'كلاسيكي فاخر',
            'description' => 'الشكل الحالي: شريط علوي زجاجي، أزرار لامعة وصفوف كبطاقات.',
            'design' => [],
        ],
        'corporate' => [
            'label' => 'مؤسسي',
            'description' => 'قائمة جانبية فاتحة وجداول بشبكة ورأس رمادي، كأنظمة المؤسسات والبنوك.',
            'design' => ['navigation' => 'sidebar', 'navStyle' => 'solid', 'width' => 'full', 'background' => 'plain', 'neutral' => 'slate', 'radius' => 'soft', 'buttons' => 'solid', 'cards' => 'outlined', 'tables' => 'bordered', 'tableHeader' => 'tinted', 'density' => 'compact', 'headingFont' => 'plex', 'pageTitle' => 'bar'],
        ],
        'minimal' => [
            'label' => 'بسيط وهادئ',
            'description' => 'مساحات بيضاء، أزرار بإطار وجداول بخطوط فاصلة فقط.',
            'design' => ['navStyle' => 'solid', 'width' => 'contained', 'background' => 'plain', 'neutral' => 'zinc', 'radius' => 'soft', 'buttons' => 'outline', 'cards' => 'flat', 'tables' => 'minimal', 'inputs' => 'underline', 'badges' => 'outline', 'headingFont' => 'alexandria'],
        ],
        'soft' => [
            'label' => 'ناعم عصري',
            'description' => 'قائمة مصغّرة، زوايا مستديرة جداً وبطاقات عائمة وحقول معبأة.',
            'design' => ['navigation' => 'rail', 'background' => 'gradient', 'radius' => 'round', 'buttons' => 'soft', 'cards' => 'floating', 'tables' => 'striped', 'inputs' => 'filled', 'bodyFont' => 'alexandria', 'headingFont' => 'alexandria'],
        ],
        'operations' => [
            'label' => 'تشغيلي كثيف',
            'description' => 'أكبر قدر من البيانات: قائمة داكنة، صفوف متناوبة مضغوطة، خط أصغر وزوايا حادة.',
            'design' => ['navigation' => 'sidebar', 'navStyle' => 'dark', 'width' => 'full', 'background' => 'plain', 'neutral' => 'neutral', 'radius' => 'sharp', 'buttons' => 'solid', 'cards' => 'outlined', 'tables' => 'striped', 'tableHeader' => 'dark', 'density' => 'compact', 'textSize' => 'small', 'headingFont' => 'plex', 'motion' => 'reduced'],
        ],
        'executive' => [
            'label' => 'تنفيذي داكن',
            'description' => 'قائمة جانبية داكنة، بطاقات بخط علوي ملوّن وأزرار بارزة ورأس جداول بلون الشركة.',
            'design' => ['navigation' => 'sidebar', 'navStyle' => 'dark', 'background' => 'glow', 'neutral' => 'stone', 'buttons' => 'raised', 'cards' => 'accent', 'tableHeader' => 'brand', 'badges' => 'solid', 'pageTitle' => 'underline', 'headingFont' => 'messiri'],
        ],
        'glass' => [
            'label' => 'زجاجي حديث',
            'description' => 'بطاقات زجاجية فوق خلفية متدرجة، أزرار كبسولة وزوايا مستديرة جداً.',
            'design' => ['navStyle' => 'glass', 'background' => 'gradient', 'radius' => 'round', 'buttons' => 'pill', 'cards' => 'glass', 'tables' => 'cards', 'inputs' => 'filled', 'bodyFont' => 'cairo', 'headingFont' => 'cairo'],
        ],
        'official' => [
            'label' => 'رسمي حكومي',
            'description' => 'شريط علوي بلون الشركة، جداول بشبكة ورأس ملوّن وعناوين بخط سفلي.',
            'design' => ['navStyle' => 'brand', 'width' => 'contained', 'background' => 'grid', 'neutral' => 'neutral', 'radius' => 'soft', 'buttons' => 'solid', 'cards' => 'outlined', 'tables' => 'bordered', 'tableHeader' => 'brand', 'pageTitle' => 'underline', 'bodyFont' => 'kufi', 'headingFont' => 'kufi'],
        ],
        'friendly' => [
            'label' => 'ودود ومريح',
            'description' => 'خط Tajawal بحجم أكبر، أزرار كبسولة، خلفية نقاط وشارات مصمتة.',
            'design' => ['navigation' => 'rail', 'navStyle' => 'solid', 'background' => 'dots', 'neutral' => 'sage', 'radius' => 'round', 'buttons' => 'pill', 'cards' => 'elevated', 'tables' => 'striped', 'inputs' => 'filled', 'badges' => 'solid', 'textSize' => 'large', 'bodyFont' => 'tajawal', 'headingFont' => 'tajawal'],
        ],
        'paper' => [
            'label' => 'ورقي هادئ',
            'description' => 'كالورق المطبوع: زوايا حادة، بطاقات مسطحة بإطار وجداول بخطوط فقط وخط كوفي للعناوين.',
            'design' => ['navStyle' => 'solid', 'width' => 'contained', 'background' => 'plain', 'neutral' => 'stone', 'radius' => 'sharp', 'buttons' => 'outline', 'cards' => 'outlined', 'tables' => 'minimal', 'tableHeader' => 'plain', 'inputs' => 'underline', 'badges' => 'outline', 'pageTitle' => 'underline', 'headingFont' => 'kufi', 'motion' => 'reduced'],
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
