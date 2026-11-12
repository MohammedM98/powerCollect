<?php

namespace App\Casts;

use App\Support\Closing\BranchClosingWorkflow;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * A box's amounts by currency, stored as JSON and read back in the order
 * BranchClosingWorkflow::CURRENCIES lists them (shekels, dollars, dinars),
 * since MySQL's JSON type does not keep the order the keys were written in.
 * Any other key keeps its place after them.
 *
 * @implements CastsAttributes<array<string, string>|null, array<string, string>|null>
 */
class CurrencyCounts implements CastsAttributes
{
    /**
     * Cast the given value.
     *
     * @param  array<string, mixed>  $attributes
     * @return array<string, string>|null
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?array
    {
        if ($value === null) {
            return null;
        }

        $counts = json_decode($value, true);

        if (! is_array($counts)) {
            return null;
        }

        $ordered = array_intersect_key(array_flip(BranchClosingWorkflow::CURRENCIES), $counts);

        return array_replace($ordered, $counts);
    }

    /**
     * Prepare the given value for storage.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return $value === null ? null : json_encode($value);
    }
}
