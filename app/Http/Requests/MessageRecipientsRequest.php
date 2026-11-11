<?php

namespace App\Http\Requests;

use App\Models\MessageBatch;
use App\Support\Messaging\MessageComposer;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class MessageRecipientsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): Response
    {
        return Gate::inspect('create', MessageBatch::class);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rules = [
            'selection' => ['nullable', 'array'],
            'selection.all' => ['sometimes', 'boolean'],
            'subscription_ids' => ['nullable', 'array', 'max:'.MessageComposer::MAX_RECIPIENTS],
            'subscription_ids.*' => ['integer'],
            'search' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->boolean('selection.all')) {
            $rules['selection'] = ['array'];
            $rules['selection.search'] = ['nullable', 'string', 'max:255'];
            $rules['selection.filter'] = ['nullable', 'array'];
        }

        return $rules;
    }
}
