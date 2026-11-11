<?php

namespace App\Support\Branding;

use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use RuntimeException;

class CompanyForms
{
    /** @return array<string, mixed> */
    public static function defaultLayout(): array
    {
        $block = static fn (string $id, string $type, string $text = '', array $fields = []): array => [
            'id' => $id, 'type' => $type, 'text' => $text, 'align' => $type === 'heading' ? 'center' : 'right',
            'bold' => $type === 'heading', 'fontSize' => null, 'height' => 8, 'fields' => $fields,
        ];

        $brand = app(Brand::class)->forPage();

        return [
            'paper' => 'A4', 'orientation' => 'portrait', 'margin' => 16, 'fontSize' => 15,
            'header' => ['company' => $brand['name'], 'subtitle' => $brand['tagline'] ?? '', 'logo' => true, 'enabled' => true],
            'watermark' => ['enabled' => true, 'text' => $brand['shortName'], 'logo' => true, 'opacity' => 0.06],
            'footer' => __('This request is filled in and its details reviewed before it is approved.'),
            'pages' => [['id' => 'page_1', 'blocks' => [
                $block('title_1', 'heading', __('New subscription request')),
                $block('intro_1', 'paragraph', __('Please approve the request to subscribe to the electricity service with the following details:')),
                $block('fields_1', 'fields', '', collect(['subscriber_name', 'national_id', 'phone', 'address', 'branch', 'meter_box', 'meter_box_number', 'tariff', 'breaker', 'subscription_fee', 'today', 'employee'])->map(fn (string $key): array => ['key' => $key, 'label' => self::FIELDS[$key]])->all()),
                $block('terms_1', 'paragraph', __('I confirm that the details above are correct and I agree to follow the company\'s instructions and service terms.')),
                $block('signatures_1', 'signatures', __('Applicant\'s signature|Employee\'s signature|Company stamp')),
            ]]],
            'overlays' => [],
        ];
    }

    public const FIELDS = [
        'subscriber_name' => 'اسم المشترك', 'subscription_name' => 'اسم الاشتراك',
        'subscriber_number' => 'رقم المشترك', 'account_number' => 'رقم الاشتراك',
        'national_id' => 'رقم الهوية', 'phone' => 'رقم الهاتف', 'address' => 'العنوان',
        'branch' => 'الفرع', 'area' => 'المنطقة', 'sub_area' => 'منطقة 2',
        'meter_box' => 'اسم الطبلون واللاحقة', 'meter_box_number' => 'رقم الطبلون',
        'tariff' => 'نوع الاشتراك', 'breaker' => 'القاطع',
        'minimum_charge' => 'الحد الأدنى', 'kilo_price' => 'سعر الكيلو',
        'subscription_fee' => 'رسوم الاشتراك', 'subscription_date' => 'تاريخ الاشتراك',
        'previous_reading' => 'القراءة السابقة', 'today' => 'التاريخ', 'employee' => 'اسم الموظف',
    ];

    /** @param array<string, mixed> $layout
     * @return array<string, mixed>
     */
    public static function normalizeLayout(array $layout): array
    {
        $layout['margin'] = (float) $layout['margin'];
        $layout['fontSize'] = (int) $layout['fontSize'];
        foreach (['logo', 'enabled'] as $key) {
            $layout['header'][$key] = (bool) $layout['header'][$key];
            $layout['watermark'][$key] = (bool) $layout['watermark'][$key];
        }
        $layout['watermark']['opacity'] = (float) $layout['watermark']['opacity'];
        foreach ($layout['pages'] as &$page) {
            foreach ($page['blocks'] as &$block) {
                $block['bold'] = (bool) $block['bold'];
                $block['fontSize'] = isset($block['fontSize']) ? (int) $block['fontSize'] : null;
                $block['height'] = (float) ($block['height'] ?? 8);
            }
            unset($block);
        }
        unset($page);
        foreach ($layout['overlays'] as &$overlay) {
            foreach (['page', 'fontSize'] as $key) {
                $overlay[$key] = (int) $overlay[$key];
            }
            foreach (['x', 'y', 'width'] as $key) {
                $overlay[$key] = (float) $overlay[$key];
            }
        }
        unset($overlay);

        return $layout;
    }

    /** @return array<string, string> */
    public static function context(User $actor, ?Subscription $subscription): array
    {
        $base = array_fill_keys(array_keys(self::FIELDS), '');
        $base['today'] = now('Asia/Hebron')->toDateString();
        $base['employee'] = $actor->name;
        $base['branch'] = $actor->workBranch()?->name ?? '';
        if ($subscription === null) {
            return $base;
        }
        $subscription->loadMissing(['profile', 'branch.area', 'meterBox.subArea', 'tariff', 'circuitBreaker', 'latestMeterReading']);

        return [
            ...$base,
            'subscriber_name' => $subscription->full_name,
            'subscription_name' => $subscription->displayName(),
            'subscriber_number' => (string) ($subscription->profile?->subscriber_number ?? ''),
            'account_number' => (string) $subscription->account_number,
            'national_id' => $subscription->national_id ?? '',
            'phone' => $subscription->contactPhone() ?? '',
            'address' => $subscription->address ?? '',
            'branch' => $subscription->branch?->name ?? '',
            'area' => $subscription->branch?->area?->name ?? '',
            'sub_area' => $subscription->meterBox?->subArea?->name ?? '',
            'meter_box' => $subscription->meterBox?->displayName() ?? '',
            'meter_box_number' => $subscription->meterBox?->box_number ?? '',
            'tariff' => $subscription->tariff ? __($subscription->tariff->category->label()) : '',
            'breaker' => (string) ($subscription->circuitBreaker?->ampere ?? ''),
            'minimum_charge' => (string) $subscription->minimum_charge,
            'kilo_price' => (string) $subscription->kilowattPrice(),
            'subscription_fee' => (string) $subscription->subscription_fee,
            'subscription_date' => $subscription->subscription_date?->format('Y-m-d') ?? '',
            'previous_reading' => (string) ($subscription->latestMeterReading?->nextPreviousReading() ?? $subscription->initial_reading ?? ''),
        ];
    }

    /** @param array<string, mixed> $layout
     * @return array<int, array{key: string, label: string}>
     */
    public static function fields(array $layout): array
    {
        $fields = [];
        foreach ($layout['pages'] ?? [] as $page) {
            foreach ($page['blocks'] ?? [] as $block) {
                foreach ($block['fields'] ?? [] as $field) {
                    $fields[$field['key']] = $field['label'];
                }
                preg_match_all('/\{([a-z][a-z0-9_]*)\}/', $block['text'] ?? '', $matches);
                foreach ($matches[1] as $key) {
                    $fields[$key] ??= self::FIELDS[$key] ?? $key;
                }
            }
        }
        foreach ($layout['overlays'] ?? [] as $overlay) {
            $fields[$overlay['key']] = $overlay['label'];
        }

        return collect($fields)->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label])->values()->all();
    }

    /** Files are immutable: issued documents may still refer to an older source.
     * @return array{disk: string, path: string, name: string, mime: string}
     */
    public static function storeFile(UploadedFile $file): array
    {
        $disk = config('filesystems.default') === 'public' ? 'local' : config('filesystems.default');
        $path = $file->store('company-forms', ['disk' => $disk, 'visibility' => 'private']);
        if (! is_string($path) || $path === '') {
            throw new RuntimeException(__('The file could not be saved.'));
        }

        return ['disk' => $disk, 'path' => $path, 'name' => mb_substr($file->getClientOriginalName(), 0, 200), 'mime' => $file->getMimeType()];
    }
}
