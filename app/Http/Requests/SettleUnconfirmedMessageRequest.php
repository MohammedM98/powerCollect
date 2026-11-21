<?php

namespace App\Http\Requests;

use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * How someone settles an SMS the gateway did not confirm: it arrived
 * (`delivered`), or it did not and is sent again (`resend`).
 */
class SettleUnconfirmedMessageRequest extends FormRequest
{
    public function authorize(): Response
    {
        return Gate::inspect('update', $this->route('batch'));
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'outcome' => ['required', 'in:delivered,resend'],
        ];
    }
}
