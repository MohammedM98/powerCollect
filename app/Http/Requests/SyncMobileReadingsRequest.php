<?php

namespace App\Http\Requests;

use App\Enums\PermissionKey;
use App\Http\Controllers\Mobile\MobileReadingAssignmentController;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SyncMobileReadingsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->hasPermission(PermissionKey::RecordMeterReadings);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'readings' => ['required', 'array', 'min:1', 'max:'.MobileReadingAssignmentController::MAX_READINGS],
            'readings.*.operation_id' => ['required', 'uuid', 'distinct'],
            'readings.*.assignment_id' => ['required', 'integer'],
            'readings.*.authorization' => ['required', 'string', 'max:1000'],
            'readings.*.subscription_id' => ['required', 'integer'],
            'readings.*.current_reading' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'readings.*.captured_at' => ['required', 'date'],
            'readings.*.device_id' => ['nullable', 'string', 'max:100'],
            'readings.*.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
