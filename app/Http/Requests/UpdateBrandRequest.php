<?php

namespace App\Http\Requests;

use App\Support\Branding\Brand;
use App\Support\Branding\BrandDesign;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The company's identity and look as the settings screen sends them: the
 * names, the colours, the design choices, a new file for any logo, and the
 * logos to remove (all but the main one, which is only ever replaced).
 */
class UpdateBrandRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage-brand');
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'company' => ['required', 'array'],
            'company.name' => ['required', 'string', 'max:150'],
            'company.nameEnglish' => ['nullable', 'string', 'max:150'],
            'company.shortName' => ['nullable', 'string', 'max:80'],
            'company.tagline' => ['nullable', 'string', 'max:150'],
            'colors' => ['nullable', 'array'],
            ...array_fill_keys(array_map(fn (string $role): string => "colors.{$role}", Brand::PALETTE), ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/']),
            'colors.print' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            ...array_fill_keys(array_map(fn (string $status): string => "colors.{$status}", Brand::STATUSES), ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/']),
            ...BrandDesign::rules('design'),
            'logos' => ['nullable', 'array'],
            ...array_fill_keys(array_map(fn (string $logo): string => "logos.{$logo}", Brand::LOGOS), ['nullable', 'file', 'mimes:png,jpg,jpeg,webp', 'max:2048']),
            'remove_logos' => ['nullable', 'array'],
            'remove_logos.*' => ['string', Rule::in(array_diff(Brand::LOGOS, ['main']))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'company.name' => 'اسم الشركة',
            'company.nameEnglish' => 'الاسم بالإنجليزية',
            'company.shortName' => 'الاسم المختصر',
            'company.tagline' => 'العبارة التعريفية',
            'colors.primary' => 'اللون الرئيسي',
            'colors.secondary' => 'اللون الثانوي',
            'colors.accent' => 'لون الإبراز',
            'colors.background' => 'لون خلفية الصفحات',
            'colors.surface' => 'لون البطاقات والأسطح',
            'colors.print' => 'لون الطباعة',
            'logos.main' => 'الشعار الرئيسي',
            'logos.light' => 'شعار الخلفيات الداكنة',
            'logos.icon' => 'أيقونة المتصفح',
            'logos.print' => 'شعار الطباعة',
        ];
    }
}
