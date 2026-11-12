<?php

namespace App\Http\Requests;

use App\Enums\MessageKind;
use App\Enums\MessageStatus;
use App\Models\MessageBatch;
use App\Models\Subscription;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ListSubscriptionMessagesRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): Response
    {
        Gate::authorize('viewAny', MessageBatch::class);
        $subscription = $this->route('subscription');
        abort_unless(Subscription::query()->visibleTo($this->user())->whereKey($subscription->id)->exists(), 404);

        return $subscription->archived_at === null ? Response::allow() : Gate::inspect('view', $subscription);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'kind' => ['nullable', Rule::enum(MessageKind::class)],
            'status' => ['nullable', Rule::enum(MessageStatus::class)],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
