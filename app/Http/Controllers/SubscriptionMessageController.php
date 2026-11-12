<?php

namespace App\Http\Controllers;

use App\Enums\MessageKind;
use App\Enums\MessageStatus;
use App\Http\Requests\ListSubscriptionMessagesRequest;
use App\Models\Subscription;
use App\Models\SubscriptionMessage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class SubscriptionMessageController extends Controller
{
    public function index(ListSubscriptionMessagesRequest $request, Subscription $subscription): JsonResponse
    {
        $actor = $request->user();

        $filters = $request->validated();

        $messages = SubscriptionMessage::query()->visibleTo($actor)
            ->where('subscription_id', $subscription->id)
            ->with(['batch.createdBy', 'sentBy'])
            ->when($filters['kind'] ?? null, fn (Builder $query, string $kind) => $query->whereHas('batch', fn (Builder $batch) => $batch->where('kind', $kind)))
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->latest('id')->paginate(15)
            ->through(fn (SubscriptionMessage $message): array => [
                'id' => $message->id,
                'body' => $message->body,
                'phone' => $message->phone,
                'kind' => $message->batch?->kind->value,
                'kindLabel' => $message->batch ? __($message->batch->kind->label()) : 'غير محدد',
                'channel' => $message->batch?->channel->value,
                'channelLabel' => $message->batch ? __($message->batch->channel->label()) : 'غير محدد',
                'status' => $message->status->value,
                'statusLabel' => __($message->status->label()),
                'createdAt' => $message->created_at->toIso8601String(),
                'sentAt' => $message->sent_at?->toIso8601String(),
                'createdBy' => $message->batch?->createdBy?->name,
                'sentBy' => $message->sentBy?->name,
                'error' => $message->error,
            ]);

        return response()->json([
            'messages' => $messages,
            'kinds' => MessageKind::options(),
            'statuses' => MessageStatus::options(),
        ]);
    }
}
