<?php

namespace App\Support\Closing;

use App\Enums\AuditAction;
use App\Models\Branch;
use App\Models\CashBox;
use App\Models\CashBoxPayment;
use App\Models\ClosingSetting;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Branches\BranchScope;
use App\Support\Branches\BranchViewContext;
use App\Support\Exports\CsvCells;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Builds the cash box pages: the branch's boxes by place and week, their tabs and the boxes that may be closed.
 */
class CashBoxPage
{
    /**
     * Box tabs include every closed box regardless of historical sending.
     * Auditors see the closed tab; branch staff also see open boxes and entries.
     *
     * @param  EloquentCollection<int, Branch>  $branches
     * @return list<array{key: string, label: string, count: int, url: string}>
     */
    public static function boxTabs(EloquentCollection $branches, ?Branch $branch, User $actor): array
    {
        $query = $branches->count() > 1 && $branch ? ['branch_id' => $branch->id] : [];
        $branchIds = $branch ? [$branch->id] : $branches->modelKeys();
        $counts = app(BranchBoxes::class)->counts($branchIds);
        $openBranchIds = $branches->whereIn('id', $branchIds)->reject(fn (Branch $item): bool => BranchClosingAccess::closedOnly($actor, $item->id))->modelKeys();

        $closedTab = ['key' => 'closed', 'label' => __('Closed boxes'), 'count' => $counts['closed'], 'url' => route('payments.cash-boxes', [...$query, 'place' => 'closed'])];
        if ($openBranchIds === []) {
            return [$closedTab];
        }
        $openCount = $openBranchIds === $branchIds ? $counts['open'] : app(BranchBoxes::class)->counts($openBranchIds)['open'];

        return [
            ['key' => 'entries', 'label' => __('Transactions'), 'count' => CashBoxPayment::query()->visibleInBox()->whereHas('box', fn (Builder $box) => $box->whereIn('branch_id', $openBranchIds)->whereIn('status', ['open', 'pending']))->count(), 'url' => route('payments.cash-boxes.entries', $query)],
            ['key' => 'open', 'label' => __('Open boxes'), 'count' => $openCount, 'url' => route('payments.cash-boxes', [...$query, 'place' => 'open'])],
            $closedTab,
        ];
    }

    /**
     * Every entry of the branch's open boxes, for those who close them,
     * theirs among them: whose box each sits in, narrowed to one person's
     * boxes by `?filter[user]=` and to one type of box by
     * `?filter[type]=`, searched by subscriber, voucher, transfer reference
     * or box number, with a link that opens its box on the financial boxes
     * page, and the open boxes of each type the actor may close at once.
     */
    public static function branchEntries(Request $request): InertiaResponse
    {
        $actor = $request->user();
        [$branches, $branch] = app(BranchBoxes::class)->branch($request, $actor);
        $all = $branches->count() > 1 && (! $request->filled('branch_id') || $request->input('branch_id') === 'all');
        $chosen = $all ? $branches : new EloquentCollection([$branch]);
        $visible = $chosen->reject(fn (Branch $item): bool => BranchClosingAccess::closedOnly($actor, $item->id));
        abort_if($visible->isEmpty(), 403);
        $branchIds = $visible->modelKeys();
        $branch = $all ? null : $branch;
        $people = app(BranchBoxes::class)->people($branchIds);
        $person = $people->firstWhere('id', $request->integer('filter.user'));
        $query = CashBoxPayment::query()->whereHas('box', fn (Builder $box) => $box->whereIn('branch_id', $branchIds)->whereIn('status', ['open', 'pending'])->when($person, fn (Builder $box) => $box->where('user_id', $person->id)));
        $list = CashBoxPresenter::entryList($request, $query, fn (CashBox $box): string => route('payments.cash-boxes', ['branch_id' => $box->branch_id, 'box' => $box->id]));
        $list['filters']['filter']['user'] = $person ? (string) $person->id : '';
        $started = $visible->contains(fn (Branch $item): bool => ClosingSetting::forBranch($item->id)->workflow_started_at !== null);

        return Inertia::render('Payments/Entries', [
            'started' => $started,
            'branch' => $branch, 'branches' => $branches, 'people' => $people,
            // The general management reads, large above the boxes, which branch they are.
            'branchScope' => $branches->count() > 1 || BranchViewContext::id() !== null ? BranchScope::describe($visible) : null,
            'tabs' => self::boxTabs($branches, $branch, $actor),
            ...$list,
            'closableBoxes' => $branch && $started && BranchClosingAccess::receive($actor, $branch->id) ? self::closableBoxes($branch->id, $actor, $person?->id) : null,
            ...($actor->can('viewOwnCashBoxes', Subscription::class) ? CashBoxPresenter::collectionCounts($actor) : ['pendingCount' => 0]),
            'collectionUrls' => CashBoxPresenter::collectionUrls(),
            'urls' => ['index' => route('payments.cash-boxes.entries'), 'actions' => url('/payments/cash-boxes/actions')],
        ]);
    }

    /**
     * The open boxes of the branch the actor may confirm closed, one
     * person's when `$userId` is given, each with whose it is, how many
     * entries are still in effect, their totals, and those entries as the
     * box's summary groups them (by bank, service or currency paid), to
     * close them by type.
     *
     * @return list<array{id: int, number: string, type: string, person: string|null, count: int, totals: array<string, string>, entries: list<array<string, mixed>>}>
     */
    public static function closableBoxes(int $branchId, User $actor, ?int $userId): array
    {
        return CashBoxReceiving::closableBoxes($branchId, $actor, userId: $userId)->load(['user:id,name', 'payments.transaction:id,status,amount,currency,currency_amount,bank_name,notes'])
            ->map(function (CashBox $box): array {
                $active = $box->payments->filter(fn (CashBoxPayment $entry): bool => $entry->transaction?->status === SubscriptionTransaction::STATUS_ACTIVE);

                return [
                    'id' => $box->id, 'number' => $box->number, 'type' => $box->type->value, 'person' => $box->user?->name,
                    'count' => $active->count(),
                    'totals' => $box->totals(),
                    'entries' => $active->map(fn (CashBoxPayment $entry): array => [
                        'amount' => $entry->amount, 'bankName' => $entry->transaction->bank_name, 'service' => $entry->transaction->notes,
                        'currency' => $entry->transaction->currency->value, 'currencyLabel' => __($entry->transaction->currency->label()),
                        'paidAmount' => $entry->transaction->currency_amount ?? ltrim($entry->transaction->amount, '-'),
                    ])->values()->all(),
                ];
            })->all();
    }

    /**
     * The latest closing period of each visible branch, or their open boxes.
     *
     * @param  EloquentCollection<int, Branch>  $branches
     */
    public static function allBranchCashBoxes(Request $request, User $actor, EloquentCollection $branches, BranchClosingWorkflow $workflow): InertiaResponse
    {
        $place = $request->query('place') === 'open' ? 'open' : 'closed';
        $visible = $place === 'open' ? $branches->reject(fn (Branch $item): bool => BranchClosingAccess::closedOnly($actor, $item->id)) : $branches;
        abort_if($visible->isEmpty(), 403);
        $boxes = collect();
        $started = false;
        foreach ($visible as $branch) {
            $branchStarted = ClosingSetting::forBranch($branch->id)->workflow_started_at !== null;
            if ($branchStarted) {
                $workflow->refresh($branch->id);
            }
            $started = $started || $branchStarted;
            $week = $request->filled('week')
                ? app(BranchBoxes::class)->weekOf(ClosingPeriods::date($request->query('week')), $branch->id)
                : (app(BranchBoxes::class)->periods($branch->id)->first()['start'] ?? app(BranchBoxes::class)->weekOf(now(), $branch->id));
            $boxes->push(...app(BranchBoxes::class)->rows($branch->id, $actor, $place, week: $week)
                ->map(fn (array $box): array => [...$box, 'branchName' => $branch->name]));
        }

        return Inertia::render('Payments/BranchCashBoxes', [
            'branch' => null, 'branches' => $branches,
            'branchScope' => BranchScope::describe($visible),
            'started' => $started || $boxes->isNotEmpty(), 'place' => $place,
            'tabs' => self::boxTabs($branches, null, $actor),
            'boxes' => $boxes, 'periods' => [], 'week' => null, 'weekStartsOn' => null,
            'periodAudit' => null, 'canApprovePeriod' => false,
            'canSearchTransfers' => false, 'searchingTransfers' => false, 'transferSearch' => null,
            'access' => [],
            ...($actor->can('viewOwnCashBoxes', Subscription::class) ? CashBoxPresenter::collectionCounts($actor) : ['pendingCount' => 0]),
            'collectionUrls' => CashBoxPresenter::collectionUrls(),
            'urls' => ['index' => route('payments.cash-boxes'), 'actions' => url('/payments/cash-boxes/actions'), 'auditPeriod' => route('payments.period-audits.store')],
        ]);
    }

    /**
     * Open boxes for branch staff, or closed boxes in a chosen business week.
     * Links to a closed box select its closing week automatically.
     */
    public static function branchCashBoxes(Request $request, BranchClosingWorkflow $workflow): InertiaResponse
    {
        $actor = $request->user();
        [$branches, $branch] = app(BranchBoxes::class)->branch($request, $actor);
        if ($branches->count() > 1 && (! $request->filled('branch_id') || $request->input('branch_id') === 'all')) {
            return self::allBranchCashBoxes($request, $actor, $branches, $workflow);
        }
        $started = ClosingSetting::forBranch($branch->id)->workflow_started_at !== null;
        if ($started) {
            $workflow->refresh($branch->id);
        }
        $place = in_array($request->query('place'), BranchBoxes::PLACES, true) ? $request->query('place') : 'closed';
        if (BranchClosingAccess::closedOnly($actor, $branch->id)) {
            $place = 'closed';
        }
        $canSearchTransfers = $actor->is_active && ($actor->isSuperAdmin() || $actor->hasFinancialAuditAccess());
        $searchingTransfers = $request->query('view') === 'transfers';
        abort_if($searchingTransfers && ! $canSearchTransfers, 403);
        if ($searchingTransfers) {
            $place = 'closed';
        }
        $periods = app(BranchBoxes::class)->periods($branch->id);
        $week = $request->query('week')
            ? app(BranchBoxes::class)->weekOf(ClosingPeriods::date($request->query('week')), $branch->id)
            : ($periods->first()['start'] ?? app(BranchBoxes::class)->weekOf(now(), $branch->id));
        $linkedBox = $request->integer('box') ? CashBox::query()->where('branch_id', $branch->id)->where('status', 'received')->find($request->integer('box')) : null;
        if ($linkedBox) {
            $week = app(BranchBoxes::class)->weekOf($linkedBox->closingWeekMoment(), $branch->id);
        }
        if (! $periods->contains('start', $week)) {
            $periods->push(['start' => $week, 'end' => ClosingPeriods::date($week)->addDays(6)->toDateString(), 'count' => 0]);
            $periods = $periods->sortByDesc('start')->values();
        }

        $boxes = $searchingTransfers ? collect() : app(BranchBoxes::class)->rows($branch->id, $actor, $place, $request->integer('box') ?: null, $week);
        $canApprovePeriod = $place === 'closed' && BankTransferAuditing::allowed($actor, AuditAction::ApprovePeriods) && BankTransferAuditing::allowed($actor, AuditAction::ApproveBoxes);
        $periodPreview = fn (): array => app(BranchBoxes::class)->periodAudit($searchingTransfers ? app(BranchBoxes::class)->rows($branch->id, $actor, 'closed', week: $week) : $boxes, $branch->id, $week);

        return Inertia::render('Payments/BranchCashBoxes', [
            // The general management reads, large above the boxes, which branch they are.
            'branchScope' => ($branches->count() > 1 || BranchViewContext::id() !== null) && BranchScope::shownTo($actor) ? BranchScope::describe(collect([$branch])) : null,
            'branch' => $branch, 'branches' => $branches, 'started' => $started || $periods->contains(fn (array $period): bool => $period['count'] > 0),
            'place' => $place,
            'tabs' => self::boxTabs($branches, $branch, $actor),
            'boxes' => $boxes,
            'periodAudit' => $canApprovePeriod ? ($searchingTransfers ? Inertia::optional($periodPreview) : $periodPreview()) : null,
            'canApprovePeriod' => $canApprovePeriod,
            'canSearchTransfers' => $canSearchTransfers,
            'searchingTransfers' => $searchingTransfers,
            'transferSearch' => $searchingTransfers ? app(AuditTransferSearch::class)->results($request, $actor, $branch->id, $week) : null,
            'periods' => $periods, 'week' => $week, 'weekStartsOn' => ClosingSetting::forBranch($branch->id)->week_starts_on,
            'access' => app(BranchBoxes::class)->access($actor, $branch->id),
            ...($actor->can('viewOwnCashBoxes', Subscription::class) ? CashBoxPresenter::collectionCounts($actor) : ['pendingCount' => 0]),
            'collectionUrls' => CashBoxPresenter::collectionUrls(),
            'urls' => ['index' => route('payments.cash-boxes'), 'actions' => url('/payments/cash-boxes/actions'), 'auditPeriod' => route('payments.period-audits.store')],
        ]);
    }

    /**
     * The box as a spreadsheet: its details on top, then every entry.
     *
     * @param  Collection<int, CashBoxPayment>  $entries
     */
    public static function exportCashBox(CashBox $box, Collection $entries): StreamedResponse
    {
        $row = CashBoxPresenter::cashBoxRow($box);
        $local = fn (?CarbonInterface $time): string => $time ? $time->copy()->setTimezone(config('app.business_timezone'))->format('Y-m-d H:i') : '';
        $statuses = ['missing' => __('Missing'), 'rejected' => __('Rejected')];
        $types = ['cash' => __('In cash'), 'bank_transfer' => __('Bank transfers'), 'clearing' => __('Clearings')];
        $stages = ['open' => __('Open'), 'awaiting_confirmation' => __('Closed box'), 'completed' => __('Closed box')];

        return response()->streamDownload(function () use ($box, $row, $entries, $local, $statuses, $types, $stages): void {
            $file = fopen('php://output', 'w');
            fwrite($file, "\xEF\xBB\xBF");
            foreach ([
                [__('Box number'), $box->number],
                [__('Type'), $types[$box->type->value]],
                [__('The collector'), $box->user?->name ?? ''],
                [__('Status'), $stages[$row['stage']]],
                [__('Opened on'), $local($box->opened_at)],
                [__('Closed on'), $local($box->closed_at)],
                [__('Closed by'), $row['closedBy'] ?? ''],
                [__('Total ₪'), (float) $row['totals']['ILS']],
                [__('Amount received ₪'), (float) $row['receivedAmounts']['ILS']],
                [],
            ] as $cells) {
                fputcsv($file, CsvCells::safe($cells));
            }
            fputcsv($file, ['#', __('Date and time'), __('Subscriber'), __('Account number'), __('Voucher number'), __('Receiving bank'), __('Sending bank'), __('Transfer number'), __('Service'), __('Currency'), __('Amount'), __('Status'), __('Date the transfer reached the bank')]);
            foreach ($entries->values() as $index => $entry) {
                $cancelled = $entry->transaction->status !== SubscriptionTransaction::STATUS_ACTIVE;
                fputcsv($file, CsvCells::safe([
                    $index + 1, $local($entry->occurred_at), $entry->transaction->subscription->displayName(), $entry->transaction->subscription->account_number,
                    $entry->transaction->manual_voucher_number ?? $entry->transaction->voucher_number ?? '', $entry->transaction->bank_name ?? '', $entry->transaction->sender_bank_name ?? '',
                    $entry->transaction->reference_number ?? '', $entry->method === 'clearing' ? ($entry->transaction->notes ?? '') : '', $entry->currency, (float) $entry->amount,
                    $cancelled ? __('Cancelled') : ($statuses[$entry->status] ?? __('Standing')),
                    $entry->transaction->bank_received_on?->toDateString() ?? '',
                ]));
            }
            fclose($file);
        }, 'cash-box-'.$box->number.'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
