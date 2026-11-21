<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum MessageStatus: string
{
    use HasOptions;

    case Pending = 'pending';
    case Sent = 'sent';
    case Failed = 'failed';
    /** Sent to the gateway but not confirmed in time: it may have arrived, so it is never retried on its own. */
    case Unconfirmed = 'unconfirmed';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Waiting to Send',
            self::Sent => 'Sent',
            self::Failed => 'Failed',
            self::Unconfirmed => 'Unconfirmed',
        };
    }
}
