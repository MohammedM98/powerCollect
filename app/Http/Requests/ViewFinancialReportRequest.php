<?php

namespace App\Http\Requests;

use App\Support\Reports\FinancialReportAccess;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class ViewFinancialReportRequest extends FinancialReportFiltersRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return FinancialReportAccess::view($this->user());
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'section' => ['nullable', Rule::in(['overview', 'collections', 'boxes', 'debts', 'statement', 'movements'])],
            'subscription' => ['nullable', 'integer', 'min:1'],
            'search' => ['nullable', 'string', 'max:100'],
            'filter' => ['nullable', 'array'],
            'filter.*' => ['nullable', 'string', 'max:200'],
            'sort' => ['nullable', 'string', 'max:40'],
        ];
    }
}
