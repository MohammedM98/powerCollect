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
        'tableVariant' => ['label' => 'نمط مكوّن الجدول', 'options' => [
            'default' => 'النمط الحالي',
            'ledger' => 'سجل محاسبي',
            'striped' => 'صفوف متناوبة',
            'bordered' => 'شبكة بحدود',
        ]],
        'motionStyle' => ['label' => 'حركة ظهور المحتوى', 'options' => [
            'standard' => 'الحركة الحالية',
            'fade' => 'ظهور تدريجي',
            'slide' => 'انزلاق خفيف',
            'none' => 'بدون حركة',
        ]],
        'details' => ['label' => 'عرض التفاصيل', 'options' => [
            'modal' => 'نافذة منبثقة وسط الشاشة',
        ]],
        'footerStyle' => ['label' => 'تذييل الصفحة', 'options' => [
            'full' => 'كامل',
            'compact' => 'مختصر',
        ]],
        'navigation' => ['label' => 'التنقل', 'options' => [
            'topbar' => 'شريط علوي عائم',
            'sidebar' => 'شريط أقسام عائم',
            'rail' => 'شريط أقسام عائم (الاسم السابق: قائمة مصغّرة)',
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
            'navy' => 'كحلي بإضاءة زرقاء',
            'midnight' => 'أزرق ليلي',
            'graphite' => 'فحمي',
        ]],
        'neutral' => ['label' => 'درجة الرمادي', 'options' => [
            'graphite' => 'جرافيت',
            'slate' => 'رمادي مزرق',
            'zinc' => 'رمادي بارد',
            'neutral' => 'رمادي محايد',
            'stone' => 'رمادي دافئ',
            'sage' => 'رمادي مخضر',
            'navy' => 'كحلي',
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
            'boxed' => 'بطاقة واحدة بفواصل',
            'spreadsheet' => 'جدول بيانات كثيف',
            'elevated' => 'صفوف عائمة بظل عميق',
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
            'spacious' => 'واسعة',
        ]],
        'tableToolbar' => ['label' => 'شريط أدوات الجداول', 'options' => [
            'card' => 'بطاقة بخط علوي',
            'plain' => 'بلا خلفية',
            'tinted' => 'خلفية ملوّنة خفيفة',
        ]],
        'searchStyle' => ['label' => 'البحث والفلاتر', 'options' => [
            'default' => 'بإطار',
            'pill' => 'كبسولة مستديرة',
            'filled' => 'معبأة بخلفية',
            'underline' => 'خط سفلي',
            'panel' => 'داخل لوحة ملوّنة',
        ]],
        'inputs' => ['label' => 'حقول الإدخال', 'options' => [
            'outlined' => 'بإطار',
            'filled' => 'معبأة بخلفية',
            'underline' => 'خط سفلي فقط',
            'pill' => 'كبسولة مستديرة',
            'inset' => 'غائرة بظل داخلي',
            'thick' => 'بإطار سميك',
        ]],
        'inputFocus' => ['label' => 'الحقل عند الكتابة فيه', 'options' => [
            'ring' => 'حلقة خفيفة',
            'glow' => 'هالة بلون الشركة',
            'border' => 'إطار ملوّن فقط',
        ]],
        'checkboxes' => ['label' => 'مربعات الاختيار', 'options' => [
            'square' => 'مربعة',
            'rounded' => 'مستديرة الزوايا',
            'circle' => 'دائرية',
            'large' => 'كبيرة',
        ]],
        'switches' => ['label' => 'مفاتيح التشغيل والإيقاف', 'options' => [
            'pill' => 'خضراء كبسولة',
            'brand' => 'بلون الشركة',
            'square' => 'مربعة',
            'slim' => 'نحيفة بمقبض كبير',
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
        'buttonHover' => ['label' => 'الأزرار عند المرور', 'options' => [
            'brighten' => 'تفتيح',
            'lift' => 'ارتفاع مع ظل',
            'glow' => 'هالة ملوّنة',
            'darken' => 'تغميق',
            'scale' => 'تكبير خفيف',
            'none' => 'بلا تغيير',
        ]],
        'buttonPress' => ['label' => 'الأزرار عند الضغط', 'options' => [
            'sink' => 'نزول خفيف',
            'shrink' => 'انكماش',
            'none' => 'بلا حركة',
        ]],
        'buttonSize' => ['label' => 'حجم الأزرار', 'options' => [
            'regular' => 'عادي',
            'compact' => 'صغير',
            'large' => 'كبير',
        ]],
        'cardHover' => ['label' => 'البطاقات عند المرور', 'options' => [
            'none' => 'ثابتة',
            'lift' => 'ترتفع',
            'glow' => 'هالة بلون الشركة',
            'outline' => 'إطار بلون الشركة',
        ]],
        'rowHover' => ['label' => 'صفوف الجداول عند المرور', 'options' => [
            'lift' => 'ترتفع كبطاقة',
            'tint' => 'تتلون بلون خفيف',
            'edge' => 'خط جانبي فقط',
            'none' => 'بلا تغيير',
        ]],
        'focusRing' => ['label' => 'إطار التركيز (لوحة المفاتيح)', 'options' => [
            'dark' => 'داكن',
            'brand' => 'بلون الشركة',
            'halo' => 'هالة ناعمة',
        ]],
        'navHighlight' => ['label' => 'تمييز القسم الحالي', 'options' => [
            'pill' => 'كبسولة داكنة',
            'brand' => 'كبسولة بلون الشركة',
            'underline' => 'خط سفلي',
            'secondary' => 'كبسولة باللون الثانوي',
            'accent' => 'كبسولة بلون الإبراز',
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
        'radiusScale' => ['label' => 'مقياس الزوايا', 'min' => 0, 'max' => 2, 'step' => 0.05, 'unit' => '×'],
        'fontScale' => ['label' => 'مقياس الخط', 'min' => 0.85, 'max' => 1.25, 'step' => 0.01, 'unit' => '×'],
        'contentWidth' => ['label' => 'أقصى عرض للمحتوى', 'min' => 960, 'max' => 2400, 'step' => 20, 'unit' => 'px'],
        'buttonRadius' => ['label' => 'استدارة الأزرار', 'min' => 0, 'max' => 40, 'step' => 1, 'unit' => 'px'],
        'buttonHeight' => ['label' => 'ارتفاع الأزرار', 'min' => 30, 'max' => 60, 'step' => 1, 'unit' => 'px'],
        'buttonPaddingX' => ['label' => 'الحشو الأفقي للأزرار', 'min' => 6, 'max' => 40, 'step' => 1, 'unit' => 'px'],
        'buttonFontWeight' => ['label' => 'سماكة خط الأزرار', 'min' => 400, 'max' => 800, 'step' => 100, 'unit' => ''],
        'hoverLift' => ['label' => 'مقدار الارتفاع عند المرور', 'min' => 0, 'max' => 8, 'step' => 1, 'unit' => 'px'],
        'shadowStrength' => ['label' => 'قوة الظلال', 'min' => 0, 'max' => 2, 'step' => 0.05, 'unit' => '×'],
        'transitionMs' => ['label' => 'سرعة الحركة', 'min' => 0, 'max' => 800, 'step' => 20, 'unit' => 'ms'],
        'glassAlpha' => ['label' => 'شفافية الزجاج', 'min' => 0.2, 'max' => 0.9, 'step' => 0.05, 'unit' => ''],
        'glassBlur' => ['label' => 'قوة تمويه الزجاج', 'min' => 0, 'max' => 40, 'step' => 2, 'unit' => 'px'],
    ];

    /**
     * Complete looks to start from: each names the choices it changes from
     * today's look (the rest stay as they are).
     *
     * @var array<string, array{label: string, description: string, design: array<string, string>}>
     */
    public const PRESETS = [
        'superpower' => [
            'label' => 'سوبر باور زجاجي كحلي',
            'description' => 'بطاقات زجاجية كحلية فوق خلفية بإضاءة زرقاء، شريط أقسام عائم، جداول داخل لوحات زجاجية، أزرار متدرجة وحقول معبأة.',
            'design' => ['navigation' => 'sidebar', 'background' => 'navy', 'neutral' => 'navy', 'cards' => 'glass', 'tables' => 'boxed', 'tableToolbar' => 'plain', 'searchStyle' => 'filled', 'inputs' => 'filled', 'switches' => 'brand', 'headingFont' => 'cairo', 'rowHover' => 'tint', 'focusRing' => 'brand', 'navHighlight' => 'brand'],
        ],
        'classic' => [
            'label' => 'كلاسيكي فاخر',
            'description' => 'الشكل الحالي: شريط علوي زجاجي، أزرار لامعة وصفوف كبطاقات.',
            'design' => [],
        ],
        'corporate' => [
            'label' => 'مؤسسي',
            'description' => 'شريط أقسام فاتح وجداول بشبكة ورأس رمادي، كأنظمة المؤسسات والبنوك.',
            'design' => ['navigation' => 'sidebar', 'navStyle' => 'solid', 'width' => 'full', 'background' => 'plain', 'neutral' => 'slate', 'radius' => 'soft', 'buttons' => 'solid', 'cards' => 'outlined', 'tables' => 'bordered', 'tableHeader' => 'tinted', 'density' => 'compact', 'headingFont' => 'plex', 'pageTitle' => 'bar', 'searchStyle' => 'filled', 'focusRing' => 'brand', 'checkboxes' => 'rounded'],
        ],
        'minimal' => [
            'label' => 'بسيط وهادئ',
            'description' => 'مساحات بيضاء، أزرار بإطار وجداول بخطوط فاصلة فقط.',
            'design' => ['navStyle' => 'solid', 'width' => 'contained', 'background' => 'plain', 'neutral' => 'zinc', 'radius' => 'soft', 'buttons' => 'outline', 'cards' => 'flat', 'tables' => 'minimal', 'inputs' => 'underline', 'badges' => 'outline', 'headingFont' => 'alexandria', 'rowHover' => 'tint', 'focusRing' => 'halo', 'searchStyle' => 'underline', 'tableToolbar' => 'plain'],
        ],
        'soft' => [
            'label' => 'ناعم عصري',
            'description' => 'قائمة مصغّرة، زوايا مستديرة جداً وبطاقات عائمة وحقول معبأة.',
            'design' => ['navigation' => 'rail', 'background' => 'gradient', 'radius' => 'round', 'buttons' => 'soft', 'cards' => 'floating', 'tables' => 'striped', 'inputs' => 'filled', 'bodyFont' => 'alexandria', 'headingFont' => 'alexandria', 'buttonHover' => 'glow', 'cardHover' => 'glow', 'searchStyle' => 'pill', 'switches' => 'brand', 'checkboxes' => 'circle'],
        ],
        'operations' => [
            'label' => 'تشغيلي كثيف',
            'description' => 'أكبر قدر من البيانات: قائمة داكنة، صفوف متناوبة مضغوطة، خط أصغر وزوايا حادة.',
            'design' => ['navigation' => 'sidebar', 'navStyle' => 'dark', 'width' => 'full', 'background' => 'plain', 'neutral' => 'neutral', 'radius' => 'sharp', 'buttons' => 'solid', 'cards' => 'outlined', 'tableHeader' => 'dark', 'density' => 'compact', 'textSize' => 'small', 'headingFont' => 'plex', 'motion' => 'reduced', 'tables' => 'spreadsheet', 'searchStyle' => 'filled', 'buttonHover' => 'darken', 'buttonSize' => 'compact', 'rowHover' => 'tint'],
        ],
        'executive' => [
            'label' => 'تنفيذي داكن',
            'description' => 'شريط أقسام داكن، بطاقات بخط علوي ملوّن وأزرار بارزة ورأس جداول بلون الشركة.',
            'design' => ['navigation' => 'sidebar', 'navStyle' => 'dark', 'background' => 'glow', 'neutral' => 'stone', 'buttons' => 'raised', 'cards' => 'accent', 'tableHeader' => 'brand', 'badges' => 'solid', 'pageTitle' => 'underline', 'headingFont' => 'messiri', 'buttonHover' => 'lift', 'cardHover' => 'lift', 'navHighlight' => 'brand', 'switches' => 'brand', 'inputFocus' => 'glow'],
        ],
        'glass' => [
            'label' => 'زجاجي حديث',
            'description' => 'بطاقات زجاجية فوق خلفية متدرجة، أزرار كبسولة وزوايا مستديرة جداً.',
            'design' => ['navStyle' => 'glass', 'background' => 'gradient', 'radius' => 'round', 'buttons' => 'pill', 'cards' => 'glass', 'tables' => 'cards', 'inputs' => 'filled', 'bodyFont' => 'cairo', 'headingFont' => 'cairo', 'searchStyle' => 'pill', 'buttonHover' => 'scale', 'buttonPress' => 'shrink', 'cardHover' => 'glow', 'switches' => 'brand', 'inputFocus' => 'glow'],
        ],
        'official' => [
            'label' => 'رسمي حكومي',
            'description' => 'شريط علوي بلون الشركة، جداول بشبكة ورأس ملوّن وعناوين بخط سفلي.',
            'design' => ['navStyle' => 'brand', 'width' => 'contained', 'background' => 'grid', 'neutral' => 'neutral', 'radius' => 'soft', 'buttons' => 'solid', 'cards' => 'outlined', 'tableHeader' => 'brand', 'pageTitle' => 'underline', 'bodyFont' => 'kufi', 'headingFont' => 'kufi', 'tables' => 'boxed', 'tableToolbar' => 'tinted', 'searchStyle' => 'panel', 'checkboxes' => 'large', 'navHighlight' => 'underline'],
        ],
        'friendly' => [
            'label' => 'ودود ومريح',
            'description' => 'خط Tajawal بحجم أكبر، أزرار كبسولة، خلفية نقاط وشارات مصمتة.',
            'design' => ['navigation' => 'rail', 'navStyle' => 'solid', 'background' => 'dots', 'neutral' => 'sage', 'radius' => 'round', 'buttons' => 'pill', 'cards' => 'elevated', 'tables' => 'striped', 'badges' => 'solid', 'textSize' => 'large', 'bodyFont' => 'tajawal', 'headingFont' => 'tajawal', 'inputs' => 'pill', 'checkboxes' => 'circle', 'switches' => 'brand', 'buttonHover' => 'lift', 'buttonSize' => 'large', 'density' => 'spacious'],
        ],
        'paper' => [
            'label' => 'ورقي هادئ',
            'description' => 'كالورق المطبوع: زوايا حادة، بطاقات مسطحة بإطار وجداول بخطوط فقط وخط كوفي للعناوين.',
            'design' => ['navStyle' => 'solid', 'width' => 'contained', 'background' => 'plain', 'neutral' => 'stone', 'radius' => 'sharp', 'buttons' => 'outline', 'cards' => 'outlined', 'tables' => 'minimal', 'tableHeader' => 'plain', 'inputs' => 'underline', 'badges' => 'outline', 'pageTitle' => 'underline', 'headingFont' => 'kufi', 'motion' => 'reduced', 'switches' => 'square', 'searchStyle' => 'underline', 'tableToolbar' => 'plain', 'buttonHover' => 'none', 'buttonPress' => 'none'],
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
