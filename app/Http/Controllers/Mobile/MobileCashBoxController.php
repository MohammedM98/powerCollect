<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\BranchClosingActionRequest;
use App\Http\Requests\ReplyToMobileAuditNoteRequest;
use App\Http\Requests\SyncMobileCashBoxRequest;
use App\Models\AuditNote;
use App\Models\CashBox;
use App\Models\CashBoxSync;
use App\Models\ClosingSetting;
use App\Models\CollectorDebt;
use App\Models\Subscription;
use App\Support\Closing\BranchClosingWorkflow;
use App\Support\Closing\BranchLock;
use App\Support\Closing\CashBoxReceiving;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MobileCashBoxController extends Controller
{
    public function __construct(private BranchClosingWorkflow $workflow, private CashBoxReceiving $receiving) {}

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $this->authorize('viewOwnCashBoxes', Subscription::class);
        abort_unless($actor->workBranchId(), 403);
        $started = ClosingSetting::ownFor($actor->workBranchId())?->workflow_started_at !== null;
        if ($started) {
            $this->workflow->refresh($actor->workBranchId());
        }
        $boxes = CashBox::query()->where('branch_id', $actor->workBranchId())->where('user_id', $actor->id)->with(['payments' => fn ($entries) => $entries->visibleInBox(), 'payments.transaction:id,subscription_id,reference_number,bank_name,sender_bank_name,voucher_number,notes,status', 'payments.transaction.subscription:id,full_name,subscription_name,account_number'])->latest('id')->limit(100)->get()
            ->map(function (CashBox $box): array {
                $row = $box->toArray();
                $row['status'] = $box->isEditable() ? 'open' : $box->status;
                $row['closed_at'] = $box->isEditable() ? null : $box->closed_at;
                $row['stage'] = $box->stage();
                $row['totals'] = $box->totals();
                if (! $box->collector_counts) {
                    $row['expected_counts'] = null;
                }

                return $row;
            });

        return response()->json(['started' => $started, 'branch_id' => $actor->workBranchId(), 'boxes' => $boxes, 'debts' => CollectorDebt::query()->where('user_id', $actor->id)->where('branch_id', $actor->workBranchId())->where('remaining', '>', 0)->get(), 'notes' => AuditNote::query()->where('assigned_to', $actor->id)->where('status', 'with_collector')->whereHas('closing', fn ($query) => $query->where('branch_id', $actor->workBranchId()))->get()]);
    }

    public function action(BranchClosingActionRequest $request, string $action, int $record): JsonResponse
    {
        $actor = $request->user();
        abort_unless($request->integer('branch_id') === $actor->workBranchId(), 404);
        $this->authorize('viewOwnCashBoxes', Subscription::class);
        abort_unless($action === 'confirm', 403);
        BranchLock::run($actor->workBranchId(), function () use ($record, $actor): void {
            $this->workflow->refresh($actor->workBranchId());
            $box = CashBox::query()->where('branch_id', $actor->workBranchId())->where('user_id', $actor->id)->findOrFail($record);
            $this->receiving->confirmBox($box, $actor);
        });

        return response()->json(['status' => 'saved']);
    }

    public function reply(ReplyToMobileAuditNoteRequest $request, int $note): JsonResponse
    {
        $data = $request->validated();
        $actor = $request->user();
        BranchLock::run($actor->workBranchId(), function () use ($actor, $note, $data): void {
            $item = AuditNote::query()->where('assigned_to', $actor->id)->where('status', 'with_collector')->whereHas('closing', fn ($query) => $query->where('branch_id', $actor->workBranchId()))->findOrFail($note);
            $this->receiving->collectorReply($item, $actor, $data['body']);
        });

        return response()->json(['status' => 'saved']);
    }

    public function sync(SyncMobileCashBoxRequest $request): JsonResponse
    {
        $data = $request->validated();
        $actor = $request->user();
        abort_unless($actor->workBranchId(), 403);
        CashBoxSync::query()->updateOrCreate(['branch_id' => $actor->workBranchId(), 'user_id' => $actor->id], ['synced_at' => now(), 'pending_payments' => $data['pending_payments']]);

        return response()->json(['status' => 'synced']);
    }
}
