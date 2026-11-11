<?php

namespace App\Http\Requests;

use App\Models\MeterBox;
use App\Models\Subscription;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class PrintMeterBoxSubscriptionsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): Response
    {
        Gate::authorize('viewAny', MeterBox::class);

        return Gate::inspect('viewAny', Subscription::class);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'subscription_sort' => ['nullable', 'in:name,account_number'],
            'subscription_direction' => ['nullable', 'in:asc,desc'],
        ];
    }
}
