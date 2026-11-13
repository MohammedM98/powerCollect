<?php

namespace App\Support\Branding;

use finfo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use JsonException;

/**
 * The company this copy of the application is for: its names, its logos and
 * its colours, shown on every page, in the footer and on every printout.
 *
 * Each company runs its own copy, so its identity belongs to the server, not
 * to a row in the database. It is one JSON file (see resources/brand/
 * default.json for its shape) imported with `php artisan brand:import`,
 * exported with `brand:export` and put back to the default with
 * `brand:reset`. Until one is imported the default is used.
 *
 * The company's identity is not the maker's: who made the application (its
 * product name, company and team, resources/brand/maker.json) is part of the
 * code, the same on every copy, and nothing here changes it.
 *
 * The imported file is kept on the local disk and its logos on the public
 * disk under brand/, both of which the nightly backup copies. A logo is
 * named after its content, so a new logo never shows from an old cache.
 */
class Brand
{
    /** The shape of the file this version reads. */
    public const VERSION = 1;

    /** The logos a company has: the main one, one for dark backgrounds, the browser's icon and one for printing. */
    public const LOGOS = ['main', 'light', 'icon', 'print'];

    /** The status colours a company may set: each replaces theme.css's scale of that name. */
    public const STATUSES = ['success', 'warning', 'danger', 'info'];

    /** The five interface palette roles; status colours remain independent. */
    public const PALETTE = ['primary', 'secondary', 'accent', 'background', 'surface'];

    /** The navigation drawn dark in both themes (theme.css, section 7), whose greys follow the neutral tone's dark ones. */
    private const DARK_PANELS = ":root:is([data-ui-nav-style='dark'],[data-ui-nav-style='brand']) .tn-bar";

    /** The colour theme.css is drawn in; a company in it needs no shades of its own. */
    public const THEME_PRIMARY = '#20B2A0';

    /** Where the imported file is kept, on the local disk. */
    private const STORED = 'brand/brand.json';

    /** Where the logos are kept, on the public disk. */
    private const LOGO_DIRECTORY = 'brand';

    /** The logo files a company may use, by their content type. */
    private const LOGO_TYPES = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];

    /** The largest logo, in bytes. */
    private const MAX_LOGO_BYTES = 2 * 1024 * 1024;

    /** @var array<string, mixed>|null */
    private ?array $profile = null;

    /**
     * The company's identity: the imported one, or the default until one is.
     *
     * @return array{version: int, company: array{name: string, nameEnglish: ?string, shortName: ?string, tagline: ?string}, logos: array<string, ?string>, colors: array{primary: ?string, secondary: ?string, accent: ?string, background: ?string, surface: ?string, print: ?string, success: ?string, warning: ?string, danger: ?string, info: ?string}, design: array<string, string>, tokens: array<string, int|float|null>, customCss: ?string}
     */
    public function profile(): array
    {
        if ($this->profile !== null) {
            return $this->profile;
        }

        $stored = Storage::disk('local')->get(self::STORED);

        try {
            $profile = $stored !== null ? json_decode($stored, true, flags: JSON_THROW_ON_ERROR) : null;
        } catch (JsonException) {
            $profile = null;
        }

        return $this->profile = $this->normalize(is_array($profile) ? $profile : self::defaults());
    }

    /**
     * Whether a company's own identity has been imported.
     */
    public function isImported(): bool
    {
        return Storage::disk('local')->exists(self::STORED);
    }

    /**
     * What every page gets: the names, each logo's address and the colour printouts are drawn in.
     *
     * @return array{name: string, nameEnglish: ?string, shortName: string, tagline: ?string, logos: array<string, string>, animatedLogo: bool, printColor: string, primaryColor: ?string, colors: array<string, ?string>, design: array<string, string>, stylesheet: ?string}
     */
    public function forPage(): array
    {
        $profile = $this->profile();

        return [
            'name' => $profile['company']['name'],
            'nameEnglish' => $profile['company']['nameEnglish'],
            'shortName' => $profile['company']['shortName'] ?? $profile['company']['name'],
            'tagline' => $profile['company']['tagline'],
            'logos' => array_combine(self::LOGOS, array_map($this->logoUrl(...), self::LOGOS)),
            // The sign-in screen draws the default logo in with its own animation; another company's logo fades in.
            'animatedLogo' => $profile['logos']['main'] === self::defaults()['logos']['main'],
            'printColor' => $this->printColor(),
            'primaryColor' => $profile['colors']['primary'],
            'colors' => $profile['colors'],
            'design' => $profile['design'],
            // What the page's <style id="brand-colors"> holds, so pages visited without reloading keep it in step.
            'stylesheet' => $this->stylesheet(),
        ];
    }

    /**
     * The address of one of the company's logos. The dark-background and print
     * logos fall back to the main one, and so does the icon.
     */
    public function logoUrl(string $variant): string
    {
        $logos = $this->profile()['logos'];
        $path = $logos[$variant] ?? $logos['main'];

        return str_starts_with($path, '/') ? $path : Storage::disk('public')->url($path);
    }

    /**
     * The colour of the lines on a printout: the company's print colour, else its main colour.
     */
    public function printColor(): string
    {
        $colors = $this->profile()['colors'];

        return $colors['print'] ?? $colors['primary'] ?? self::THEME_PRIMARY;
    }

    /**
     * The stylesheet that redraws the interface in the company's colours, or
     * null while they are theme.css's own: the brand's shades from its main
     * colour (errors keep their red, which theme.css draws in the brand's
     * burgundy), any status colour of its own, its neutral tone's greys (also
     * inside the dark navigation, see theme.css, section 7), its exact values
     * (`tokens`) and, last, its own CSS (`customCss`).
     */
    public function stylesheet(): ?string
    {
        ['colors' => $colors, 'design' => $design] = $this->profile();
        $declare = fn (array $shades, string $prefix): string => implode('', array_map(
            fn (string|int $step, string $rgb): string => "--{$prefix}-{$step}:{$rgb};",
            array_keys($shades),
            $shades,
        ));
        $root = $dark = $panels = '';

        if ($colors['primary'] !== null && strcasecmp($colors['primary'], self::THEME_PRIMARY) !== 0) {
            $palette = BrandPalette::fromHex($colors['primary']);
            // Another company's colour carries white text, and the open page's pill is that colour in both themes.
            $onColour = '--brand-ink:255 255 255;--nav-active:var(--brand-solid);--nav-active-ink:255 255 255;--nav-active-icon:255 255 255;';
            $root .= $declare($palette['light'], 'brand').$declare($palette['fixed'], 'brand').$onColour.'--ui-danger:rgb(var(--danger-600));--ui-danger-t:rgb(var(--danger-600) / 0.08);';
            $dark .= $declare($palette['dark'], 'brand').$declare(BrandPalette::darkButtons($colors['primary']), 'brand').$onColour.'--ui-danger:rgb(var(--danger-400));--ui-danger-t:rgb(var(--danger-400) / 0.12);';
        }

        foreach (self::STATUSES as $status) {
            if ($colors[$status] !== null) {
                $root .= $declare(BrandPalette::statusScale($colors[$status]), $status);
            }
        }

        if ($design['neutral'] !== 'graphite') {
            $neutral = BrandPalette::neutral($design['neutral']);
            $root .= $declare($neutral['light'], 'gray');
            $dark .= $declare($neutral['dark'], 'gray').'--surface:'.$neutral['darkSurface'].';';
            $panels .= $declare($neutral['dark'], 'gray').'--surface:'.$neutral['darkSurface'].';';
        }

        foreach (['secondary', 'accent'] as $role) {
            if ($colors[$role] !== null) {
                $palette = BrandPalette::fromHex($colors[$role]);
                $prefix = 'brand-'.$role;
                $root .= $declare($palette['light'], $prefix).$declare($palette['fixed'], $prefix)
                    ."--{$prefix}-hover:{$palette['fixed']['lo']};--{$prefix}-on-solid:255 255 255;--{$prefix}-on-soft:{$palette['light'][900]};"
                    ."--ui-{$role}:rgb(var(--{$prefix}-600));--ui-{$role}-t:rgb(var(--{$prefix}-500) / 0.08);";
                $dark .= $declare($palette['dark'], $prefix)
                    ."--{$prefix}-on-soft:{$palette['dark'][900]};--ui-{$role}:rgb(var(--{$prefix}-700));--ui-{$role}-t:rgb(var(--{$prefix}-500) / 0.12);";
            }
        }

        foreach (['background' => ['gray-50', 'page', 0.158], 'surface' => ['surface', 'surface', 0.204]] as $role => [$variable, $semantic, $lightness]) {
            if ($colors[$role] !== null) {
                $surface = BrandPalette::surface($colors[$role], $lightness);
                $root .= "--{$variable}:{$surface['light']};--ui-{$semantic}:rgb(var(--{$variable}));";
                $dark .= "--{$variable}:{$surface['dark']};--ui-{$semantic}:rgb(var(--{$variable}));";
            }
        }

        $css = ($root !== '' ? ':root{'.$root.'}' : '').($dark !== '' ? '.dark{'.$dark.'}' : '').($panels !== '' ? self::DARK_PANELS.'{'.$panels.'}' : '')
            .BrandDesign::tokenStylesheet($this->profile()['tokens'])
            .($this->profile()['customCss'] ?? '');

        return $css !== '' ? $css : null;
    }

    /**
     * The company's look as attributes for <html> (see BrandDesign), escaped.
     */
    public function htmlAttributes(): string
    {
        return collect(BrandDesign::htmlAttributes($this->profile()['design']))
            ->map(fn (string $value, string $name): string => $name.'="'.e($value).'"')
            ->implode(' ');
    }

    /**
     * Make the file the company's identity. A logo is given as a `data:` URL,
     * as a path relative to `$directory` (where the file was read from), or as
     * an address under public/ starting with "/". Returns notes worth telling
     * whoever imported it.
     *
     * @param  array<string, mixed>  $data
     * @return list<string>
     *
     * @throws ValidationException
     */
    public function import(array $data, ?string $directory = null): array
    {
        $validated = Validator::make($data, [
            'version' => ['required', 'integer', 'in:'.self::VERSION],
            'company' => ['required', 'array'],
            'company.name' => ['required', 'string', 'max:150'],
            'company.nameEnglish' => ['nullable', 'string', 'max:150'],
            'company.shortName' => ['nullable', 'string', 'max:80'],
            'company.tagline' => ['nullable', 'string', 'max:150'],
            'logos' => ['required', 'array'],
            'logos.main' => ['required', 'string'],
            ...array_fill_keys(array_map(fn (string $logo): string => "logos.{$logo}", array_diff(self::LOGOS, ['main'])), ['nullable', 'string']),
            'colors' => ['nullable', 'array'],
            ...array_fill_keys(array_map(fn (string $role): string => "colors.{$role}", self::PALETTE), ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/']),
            'colors.print' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            ...array_fill_keys(array_map(fn (string $status): string => "colors.{$status}", self::STATUSES), ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/']),
            ...BrandDesign::rules('design'),
            ...BrandDesign::tokenRules('tokens'),
            'customCss' => ['nullable', 'string', 'max:20000'],
        ])->validate();

        $profile = $this->normalize($validated);

        foreach (self::LOGOS as $variant) {
            if ($profile['logos'][$variant] !== null) {
                $profile['logos'][$variant] = $this->storeLogo($variant, $profile['logos'][$variant], $directory);
            }
        }

        Storage::disk('local')->put(self::STORED, json_encode($profile, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $this->profile = $profile;
        $this->removeUnusedLogos();

        return $this->notes($profile);
    }

    /**
     * The company's identity as a file that carries its logos inside it, to
     * keep or to import on another server. Logos shipped under public/ stay
     * addresses, since every copy of the application has them.
     *
     * @return array<string, mixed>
     */
    public function export(): array
    {
        $profile = $this->profile();

        foreach (self::LOGOS as $variant) {
            $path = $profile['logos'][$variant];

            if ($path !== null && ! str_starts_with($path, '/')) {
                $contents = Storage::disk('public')->get($path);
                $profile['logos'][$variant] = 'data:'.$this->contentType($contents).';base64,'.base64_encode($contents);
            }
        }

        return $profile;
    }

    /**
     * Go back to the default identity.
     */
    public function reset(): void
    {
        Storage::disk('local')->delete(self::STORED);
        $this->profile = null;
        $this->removeUnusedLogos();
    }

    /**
     * The identity the application ships with.
     *
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return json_decode(file_get_contents(resource_path('brand/default.json')), true, flags: JSON_THROW_ON_ERROR);
    }

    /**
     * Every field in place, empty text as null.
     *
     * @param  array<string, mixed>  $profile
     * @return array<string, mixed>
     */
    private function normalize(array $profile): array
    {
        $text = fn (mixed $value): ?string => is_string($value) && trim($value) !== '' ? trim($value) : null;

        return [
            'version' => self::VERSION,
            'company' => [
                'name' => $text($profile['company']['name'] ?? null) ?? self::defaults()['company']['name'],
                'nameEnglish' => $text($profile['company']['nameEnglish'] ?? null),
                'shortName' => $text($profile['company']['shortName'] ?? null),
                'tagline' => $text($profile['company']['tagline'] ?? null),
            ],
            'logos' => [
                ...array_combine(self::LOGOS, array_map(fn (string $logo): ?string => $text($profile['logos'][$logo] ?? null), self::LOGOS)),
                'main' => $text($profile['logos']['main'] ?? null) ?? self::defaults()['logos']['main'],
            ],
            'colors' => [
                ...array_combine(self::PALETTE, array_map(fn (string $role): ?string => BrandPalette::isHex($profile['colors'][$role] ?? null) ? strtoupper($profile['colors'][$role]) : null, self::PALETTE)),
                'print' => BrandPalette::isHex($profile['colors']['print'] ?? null) ? strtoupper($profile['colors']['print']) : null,
                ...array_combine(self::STATUSES, array_map(fn (string $status): ?string => BrandPalette::isHex($profile['colors'][$status] ?? null) ? strtoupper($profile['colors'][$status]) : null, self::STATUSES)),
            ],
            'design' => BrandDesign::normalize(is_array($profile['design'] ?? null) ? $profile['design'] : []),
            'tokens' => BrandDesign::normalizeTokens(is_array($profile['tokens'] ?? null) ? $profile['tokens'] : []),
            'customCss' => BrandDesign::safeCss(is_string($profile['customCss'] ?? null) ? $profile['customCss'] : null),
        ];
    }

    /**
     * Keep one logo and return where it is: an address under public/ as it
     * is, anything else copied to the public disk under its content's name.
     *
     * @throws ValidationException
     */
    private function storeLogo(string $variant, string $source, ?string $directory): string
    {
        $fail = fn (string $message) => throw ValidationException::withMessages(["logos.{$variant}" => $message]);

        // A logo kept from before (the settings screen sends back the ones it didn't change).
        if ($source === ($this->profile()['logos'][$variant] ?? null) && ! str_starts_with($source, 'data:')) {
            return $source;
        }

        if (str_starts_with($source, '/')) {
            $file = public_path(ltrim($source, '/'));

            return ! str_contains($source, '..') && is_file($file) ? $source : $fail("There is no file at public{$source}.");
        }

        if (str_starts_with($source, 'data:')) {
            $contents = preg_match('/^data:[\w.+\/-]+;base64,(.+)$/s', $source, $match) ? base64_decode($match[1], true) : false;
        } else {
            $file = ($directory !== null ? rtrim($directory, '/\\').DIRECTORY_SEPARATOR : '').$source;
            $contents = is_file($file) ? file_get_contents($file) : $fail("There is no logo file at {$file}.");
        }

        if ($contents === false || $contents === '') {
            $fail('The logo could not be read.');
        }

        if (strlen($contents) > self::MAX_LOGO_BYTES) {
            $fail('The logo is larger than 2 MB.');
        }

        $extension = self::LOGO_TYPES[$this->contentType($contents)] ?? $fail('The logo must be a PNG, JPEG or WebP image.');
        $path = self::LOGO_DIRECTORY.'/'.$variant.'-'.substr(hash('sha256', $contents), 0, 16).'.'.$extension;

        Storage::disk('public')->put($path, $contents);

        return $path;
    }

    /**
     * Delete the logos on the public disk no longer named in the identity.
     */
    private function removeUnusedLogos(): void
    {
        $used = array_filter($this->profile()['logos']);

        foreach (Storage::disk('public')->files(self::LOGO_DIRECTORY) as $file) {
            if (! in_array($file, $used, true)) {
                Storage::disk('public')->delete($file);
            }
        }
    }

    /**
     * What the file's bytes are, e.g. `image/png`.
     */
    private function contentType(string $contents): string
    {
        return (new finfo(FILEINFO_MIME_TYPE))->buffer($contents) ?: 'application/octet-stream';
    }

    /**
     * What is worth knowing about the identity just imported.
     *
     * @param  array<string, mixed>  $profile
     * @return list<string>
     */
    private function notes(array $profile): array
    {
        $notes = [];
        $primary = $profile['colors']['primary'];

        if ($primary !== null && BrandPalette::contrastWithWhite($primary) < BrandPalette::MIN_CONTRAST) {
            $notes[] = sprintf(
                'White text on %s reads at %.1f:1, below the %.1f:1 minimum, so buttons and links use a darker shade of it.',
                $primary,
                BrandPalette::contrastWithWhite($primary),
                BrandPalette::MIN_CONTRAST,
            );
        }

        if ($profile['logos']['print'] === null) {
            $notes[] = 'No print logo was given, so printouts use the main logo. A black-and-white version prints better on receipt printers.';
        }

        return $notes;
    }
}
