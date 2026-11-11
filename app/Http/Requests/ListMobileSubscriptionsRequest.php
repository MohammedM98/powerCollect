<?php

namespace App\Http\Requests;

use App\Enums\PermissionKey;
use App\Models\Subscription;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ListMobileSubscriptionsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        return $user->can('recordAnyPayment', Subscription::class)
            || $user->can('viewAny', Subscription::class)
            || $user->hasAnyPermission(PermissionKey::AddCharges, PermissionKey::AddDiscounts, PermissionKey::AddClearings);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['search' => ['nullable', 'string', 'max:100']];
    }
}
