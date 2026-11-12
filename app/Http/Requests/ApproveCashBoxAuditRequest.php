<?php

namespace App\Http\Requests;

use App\Enums\AuditAction;
use App\Support\Closing\BankTransferAuditing;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ApproveCashBoxAuditRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return BankTransferAuditing::allowed($this->user(), AuditAction::ApproveBoxes);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['confirmed' => ['required', 'accepted']];
    }
}
