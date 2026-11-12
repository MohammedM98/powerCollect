<?php

namespace App\Http\Requests;

use App\Models\MeterBox;
use App\Models\Subscription;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ListMeterBoxSubscriptionsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        Gate::authorize('viewAny', MeterBox::class);
        Gate::authorize('viewAny', Subscription::class);
        $user = $this->user();
        abort_unless($user->isSuperAdmin() || $this->route('meter_box')->branch_id === $user->workBranchId(), 404);

        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'sort' => ['nullable', 'in:name,account_number'],
            'direction' => ['nullable', 'in:asc,desc'],
        ];
    }
}
