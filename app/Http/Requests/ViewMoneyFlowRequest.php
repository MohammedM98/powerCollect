<?php

namespace App\Http\Requests;

use App\Support\Closing\BranchClosingAccess;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ViewMoneyFlowRequest extends FormRequest
{
    /** Only those who see the branch's boxes see where its money is. */
    public function authorize(): bool
    {
        return BranchClosingAccess::view($this->user());
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'branch_id' => ['nullable', 'integer'],
        ];
    }
}
