<?php

namespace App\Support\Closing;

use App\Models\CashBox;
use App\Models\CashBoxPayment;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Where the money collected is now, for the finance pages' flow strip: what
 * came in this closing week, what still sits in open boxes, what was handed
 * over and waits for the audit, and what the audit approved this week. All
 * amounts are the ledger's shekels of active entries, so a cancelled payment
 * never counts.
 */
class MoneyFlow
{
    public function __construct(private BranchBoxes $boxes) {}

    /**
     * @return array{week: array{start: string, end: string}, stages: array<string, array{amount: string, boxes: int, entries: int}>, oldestOpenAt: ?string, branchCount: int}
     */
    public function for(Request $request, User $actor): array
    {
        [$branches, $branch] = $this->boxes->branch($request, $actor);
        $branchIds = $request->filled('branch_id') ? [$branch->id] : $branches->pluck('id')->all();
        $start = CarbonImmutable::parse($this->boxes->weekOf(now(), $branch->id), config('app.business_timezone'))->startOfDay();
        $until = $start->addWeek();

        $boxes = CashBox::query()->whereIn('branch_id', $branchIds);
        $open = (clone $boxes)->whereIn('status', ['open', 'pending']);
        $awaiting = (clone $boxes)->where('status', 'received')->whereDoesntHave('audit');
        $approved = (clone $boxes)->where('status', 'received')
            ->whereHas('audit', fn (Builder $audit) => $audit->where('created_at', '>=', $start->utc())->where('created_at', '<', $until->utc()));

        return [
            'week' => ['start' => $start->toDateString(), 'end' => $until->subDay()->toDateString()],
            'stages' => [
                'collected' => $this->entries(CashBoxPayment::query()
                    ->whereHas('box', fn (Builder $box) => $box->whereIn('branch_id', $branchIds))
                    ->where('occurred_at', '>=', $start->utc())->where('occurred_at', '<', $until->utc())),
                'open' => $this->inBoxes($open),
                'awaiting' => $this->inBoxes($awaiting),
                'approved' => $this->inBoxes($approved),
            ],
            'oldestOpenAt' => (clone $open)->whereHas('payments', fn (Builder $entries) => $entries->visibleInBox())->min('opened_at'),
            'branchCount' => count($branchIds),
        ];
    }

    /**
     * The active entries of the given boxes.
     *
     * @param  Builder<CashBox>  $boxes
     * @return array{amount: string, boxes: int, entries: int}
     */
    private function inBoxes(Builder $boxes): array
    {
        $ids = $boxes->pluck('id');

        return $this->entries(CashBoxPayment::query()->whereIn('cash_box_id', $ids));
    }

    /**
     * Sums the shekel amount of active entries, and counts them and their boxes.
     *
     * @param  Builder<CashBoxPayment>  $entries
     * @return array{amount: string, boxes: int, entries: int}
     */
    private function entries(Builder $entries): array
    {
        $active = $entries->join('subscription_transactions', 'subscription_transactions.id', '=', 'cash_box_payments.subscription_transaction_id')
            ->where('subscription_transactions.status', SubscriptionTransaction::STATUS_ACTIVE);
        // A payment is a credit on the ledger (negative); the box holds its size.
        $cents = (int) round((float) (clone $active)->selectRaw('COALESCE(SUM(ABS(subscription_transactions.amount)), 0) as total')->value('total') * 100);

        return [
            'amount' => number_format($cents / 100, 2, '.', ''),
            'boxes' => (clone $active)->distinct()->count('cash_box_payments.cash_box_id'),
            'entries' => (clone $active)->count('cash_box_payments.id'),
        ];
    }
}
