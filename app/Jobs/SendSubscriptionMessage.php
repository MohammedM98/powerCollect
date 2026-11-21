<?php

namespace App\Jobs;

use App\Enums\MessageStatus;
use App\Models\SubscriptionMessage;
use App\Notifications\ActionCompleted;
use App\Support\Messaging\SmsDeliveryFailed;
use App\Support\Messaging\SmsGateway;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Sends one SMS to a subscription through the SMS gateway, and records
 * whether it went out. A message that was already sent is left alone, so
 * sending a batch again only retries what's still waiting or failed. When
 * the gateway can't be reached or is busy, the message stays waiting and is
 * tried again later, and is marked failed only once its tries run out.
 */
class SendSubscriptionMessage implements ShouldQueue
{
    use Queueable;

    /**
     * How many times the message is tried in all.
     */
    public int $tries = 3;

    /**
     * The seconds to wait before each try after the first.
     *
     * @var list<int>
     */
    public array $backoff = [60, 300];

    public function __construct(public SubscriptionMessage $message) {}

    public function handle(SmsGateway $gateway): void
    {
        $message = $this->message->fresh();

        if ($message === null || $message->status === MessageStatus::Sent) {
            return;
        }

        try {
            $gateway->send($message->phone, $message->body);
        } catch (SmsDeliveryFailed $exception) {
            if ($this->canTryAgain($exception)) {
                $this->release($this->backoff[$this->attempts() - 1] ?? end($this->backoff));

                return;
            }

            $exception->isUnconfirmed ? $message->markUnconfirmed($exception->getMessage()) : $message->markFailed($exception->getMessage());

            return;
        }

        $message->markSent();
    }

    /**
     * The job gave up for a reason the gateway did not report (an unexpected
     * error, a timeout, tries used up by the worker): the message is marked
     * failed with the reason so it can be retried from its batch, and the
     * person who created the batch is told once, on the batch's first failure.
     */
    public function failed(?Throwable $exception): void
    {
        $message = $this->message->fresh();

        if ($message === null || in_array($message->status, [MessageStatus::Sent, MessageStatus::Unconfirmed], true)) {
            return;
        }

        $message->markFailed($exception?->getMessage() ?: 'The message could not be sent.');

        $batch = $message->batch;

        if ($batch?->createdBy === null) {
            return;
        }

        $failedInBatch = $batch->messages()->where('status', MessageStatus::Failed)->count();

        if ($failedInBatch === 1) {
            $batch->createdBy->notify(new ActionCompleted('messages-failed', $message->phone));
        }
    }

    /**
     * A temporary failure is tried again while tries are left. A message sent
     * right away (the sync queue) can't wait for a later try.
     */
    private function canTryAgain(SmsDeliveryFailed $exception): bool
    {
        return $exception->isTemporary
            && $this->job !== null
            && $this->job->getConnectionName() !== 'sync'
            && $this->attempts() < $this->tries;
    }
}
