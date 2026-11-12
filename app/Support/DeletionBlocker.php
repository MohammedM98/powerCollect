<?php

namespace App\Support;

/**
 * Why a record can't be deleted yet: the records that still use it.
 * Deleting only ever removes what nothing else points to, so history
 * (readings, account lines, who recorded what) is never lost.
 */
final class DeletionBlocker
{
    /**
     * Why the record cannot be deleted, listing what uses it and how much
     * (for a branch: subscriptions 12 · users 3), or null when nothing uses
     * it. The wording is in lang/ar.json: deletion.{record} names the
     * record, deletion.{record}.{use} each use, and deletion.{record}.instead
     * what to do instead, for records that are rarely unused.
     *
     * @param  string  $record  the record's key, such as branch or meter_box
     * @param  array<string, int>  $uses  each use's key => how many
     */
    public static function describe(string $record, array $uses, bool $instead = false): ?string
    {
        $inUse = array_filter($uses);

        if ($inUse === []) {
            return null;
        }

        $list = implode(' · ', array_map(fn (string $use, int $count): string => __("deletion.{$record}.{$use}").": {$count}", array_keys($inUse), $inUse));
        $message = __('deletion.blocked', ['record' => __("deletion.{$record}"), 'list' => $list]);

        return $instead ? $message.' '.__("deletion.{$record}.instead") : $message;
    }
}
