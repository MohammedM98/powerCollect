<?php

namespace App\Http\Requests;

use App\Models\SubscriptionTransaction;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ViewLedgerRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): Response
    {
        return Gate::inspect('viewAny', SubscriptionTransaction::class);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'date_basis' => ['sometimes', 'in:recorded,paid'],
            'from' => ['exclude_unless:period,custom', 'required', 'date_format:Y-m-d'],
            'to' => ['exclude_unless:period,custom', 'required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }
}
