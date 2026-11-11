<?php

namespace App\Http\Requests;

use App\Models\Subscription;
use App\Support\BranchClosingAccess;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ViewCashBoxesRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return BranchClosingAccess::view($this->user()) || $this->user()->can('viewOwnCashBoxes', Subscription::class);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'week' => ['nullable', 'date_format:Y-m-d'],
            'transfer_search' => ['nullable', 'string', 'max:100'],
            'transfer_state' => ['nullable', 'in:differences,unreviewed,draft,missing,short,over,matched'],
        ];
    }
}
