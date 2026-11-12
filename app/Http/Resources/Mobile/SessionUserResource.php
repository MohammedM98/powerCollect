<?php

namespace App\Http\Resources\Mobile;

use App\Enums\PaymentMethod;
use App\Enums\PermissionKey;
use App\Models\Bank;
use App\Models\CurrencyRate;
use App\Models\MessageBatch;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The signed-in user as the field app sees them: who they are and what they may do, with the banks, wallets and currencies the payment form offers.
 *
 * @property-read User $resource
 */
class SessionUserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $this->resource;
        $user->loadMissing('branch');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'branch_name' => $user->branch?->name,
            'can_record_readings' => $user->hasPermission(PermissionKey::RecordMeterReadings),
            'can_distribute_readings' => $user->hasPermission(PermissionKey::ManageReadingAssignments),
            'can_approve_reading_assignments' => $user->hasPermission(PermissionKey::ApproveReadingAssignments),
            'can_view_readings' => $user->can('viewAny', MeterReading::class),
            'can_record_collections' => $user->can('recordAnyPayment', Subscription::class),
            'can_adjust_balances' => $user->hasAnyPermission(PermissionKey::AddCharges, PermissionKey::AddDiscounts, PermissionKey::AddClearings),
            'can_add_clearings' => $user->hasPermission(PermissionKey::AddClearings),
            'can_view_subscriptions' => $user->can('viewAny', Subscription::class),
            'can_record_split_payments' => $user->can('recordSplitPayment', Subscription::class),
            'can_send_messages' => $user->can('create', MessageBatch::class),
            'can_view_messages' => $user->can('viewAny', MessageBatch::class),
            // The ways the collector may take a payment (each is its own permission): the server refuses the others.
            'payment_methods' => array_map(fn (PaymentMethod $method): string => $method->value, $user->allowedPaymentMethods()),
            'transfer_banks' => Bank::receiverNames(),
            'sender_banks' => Bank::senderNames(),
            'currencies' => CurrencyRate::options(),
        ];

    }
}
