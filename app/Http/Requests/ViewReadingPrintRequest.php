<?php

namespace App\Http\Requests;

use App\Models\ReadingCycle;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ViewReadingPrintRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): Response
    {
        return Gate::inspect('viewAny', ReadingCycle::class);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'cycle' => ['nullable', 'integer', 'min:1'],
            'search' => ['nullable', 'string', 'max:100'],
            'area_ids' => ['nullable', 'array', 'max:200'],
            'area_ids.*' => ['string', 'regex:/^(none|[0-9]+)$/'],
            'box_id' => ['nullable', 'integer', 'min:1'],
            'assignment' => ['nullable', 'string', 'regex:/^(assigned|available|paper|reader:[0-9]+)$/'],
            'print_page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'in:15,25,50,100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
