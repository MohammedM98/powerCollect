<?php

namespace App\Http\Requests;

use App\Enums\PermissionKey;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ViewMobileReadingDistributionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->hasAnyPermission(PermissionKey::ManageReadingAssignments, PermissionKey::ApproveReadingAssignments);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['branch_id' => ['nullable', 'integer', 'exists:branches,id']];
    }
}
