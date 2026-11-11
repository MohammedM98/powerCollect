<?php

namespace App\Http\Requests;

use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateReadingCycleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): Response
    {
        return Gate::inspect('manage', $this->route('readingCycle'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $dateBounds = $this->route('readingCycle')->readingDateBounds();

        return [
            'reading_date' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:'.$dateBounds['min']->toDateString(), 'before_or_equal:'.$dateBounds['max']->toDateString()],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'closed' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reading_date.after_or_equal' => 'اختر يوم القراءة حسب إعدادات الفرع أو يومًا بعده، ولا تختَر تاريخًا قبل اليوم.',
            'reading_date.before_or_equal' => 'يوم القراءة لا يتجاوز ستة أيام بعد الموعد المحدد في إعدادات الفرع.',
        ];
    }
}
