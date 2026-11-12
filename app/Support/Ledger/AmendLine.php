<?php

namespace App\Support\Ledger;

use App\Enums\Currency;
use App\Models\Bank;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\TransactionAmendment;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Changes a payment's descriptive details (bank, sender, reference, notes), recording every old and new value.
 */
class AmendLine
{
    /**
     * Change only descriptive payment details and record every old/new value.
     * Amount, currency, method, date, type and subscription never pass this boundary.
     *
     * @param  array<string, mixed>  $fields
     */
    public static function amend(SubscriptionTransaction $transaction, User $actor, array $fields, string $reason): TransactionAmendment
    {
        $unexpectedFields = array_diff(array_keys($fields), SubscriptionTransaction::AMENDABLE_FIELDS);

        if ($unexpectedFields !== []) {
            throw ValidationException::withMessages(['details' => __('The financial fields and the identity of the transaction cannot be changed.')]);
        }

        return $transaction->withMutationLock(function () use ($actor, $fields, $reason, $transaction): TransactionAmendment {
            $line = SubscriptionTransaction::query()->lockForUpdate()->findOrFail($transaction->id);

            if (! LineRules::isAmendable($line, lockForUpdate: true)) {
                throw ValidationException::withMessages(['details' => __('This transaction\'s details cannot be edited.')]);
            }

            $changes = [];
            $updates = [];

            foreach ($fields as $field => $value) {
                $oldValue = $line->getAttribute($field);
                if ($field === 'bank_received_on') {
                    $oldValue = $line->bank_received_on?->toDateString();
                }
                $newValue = filled($value) ? trim((string) $value) : null;

                if ((string) ($oldValue ?? '') === (string) ($newValue ?? '')) {
                    continue;
                }

                $changes[$field] = [$oldValue, $newValue];
                $updates[$field] = $newValue;
            }

            if ($changes === []) {
                throw ValidationException::withMessages(['details' => __('Change at least one detail before saving.')]);
            }

            if (array_key_exists('reference_number', $updates)) {
                $reference = PaymentReferences::normalizeReference($updates['reference_number']);
                if ($reference === null) {
                    throw ValidationException::withMessages(['reference_number' => __('Enter a valid reference number.')]);
                }
                if (PaymentReferences::activeReferenceConflict($reference, $line->id, $line->split_payment_id) !== null) {
                    throw ValidationException::withMessages(['reference_number' => __('This reference number is already recorded on another payment.')]);
                }
                $updates['active_reference'] = $reference;
            }

            $line->update($updates);
            $amendment = $line->amendments()->create([
                'user_id' => $actor->id,
                'changes' => $changes,
                'reason' => $reason,
            ]);
            $transaction->setRawAttributes($line->getAttributes(), true);

            return $amendment;
        });
    }
}
