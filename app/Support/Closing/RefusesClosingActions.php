<?php

namespace App\Support\Closing;

use Illuminate\Validation\ValidationException;

/**
 * Refuses a closing action with a message on the `action` field when its
 * condition does not hold.
 */
trait RefusesClosingActions
{
    public function require(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['action' => $message]);
        }
    }
}
