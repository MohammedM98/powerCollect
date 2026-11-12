<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreMobileDiagnosticsRequest extends FormRequest
{
    /**
     * Any signed-in field app may send its own error log.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The app's error log: times, error types and stacks, never tokens or subscriber data.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['log' => ['required', 'string', 'max:65536']];
    }
}
