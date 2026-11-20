import Icon from '@/Components/Icon';

import { formatDate, formatMoney } from '@/lib/format';

/** Keeps dates like 2026-09-18 reading left to right inside Arabic text. */
export function withLtrDates(text) {
    return text.split(/(\d{4}-\d{2}-\d{2})/).map((part, index) =>
        index % 2 === 1 ? (
            <bdi key={index} dir="ltr">
                {part}
            </bdi>
        ) : (
            part
        ),
    );
}

export function Dash() {
    return <span className="text-gray-300">—</span>;
}

/** Keeps the date and time together on separate, right-aligned lines. */
export function StatementDate({ value }) {
    const [date, ...time] = String(value ?? '—').split(' ');

    return (
        <span className="statement-date">
            <bdi dir="ltr">{formatDate(date)}</bdi>
            {time.length > 0 && <bdi dir="ltr" className="statement-time">{time.join(' ')}</bdi>}
        </span>
    );
}

/** Under a corrected or cancelled line: why, who did it and when. */
export function CancellationNote({ cancellation, onJump }) {
    return (
        <p className="ledger-description mt-1.5 flex items-start gap-1.5 text-xs font-normal text-gray-600">
            <Icon name={cancellation.wasCorrected ? 'repeat' : 'close'} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>
                {cancellation.wasCorrected ? (
                    <button type="button" onClick={() => onJump(cancellation.correctionId)} className="font-semibold text-amber-700 hover:underline">
                        صُحّحت بالحركة #{cancellation.correctionLineNumber}
                    </button>
                ) : <b className="font-semibold text-gray-700">أُلغيت</b>}
                <>: {cancellation.reasonLabel}</>
                {cancellation.notes && <> — {cancellation.notes}</>}
                <span className="text-gray-500">
                    {' '}
                   ، {cancellation.byName}، <bdi dir="ltr">{cancellation.at}</bdi>
                </span>
            </span>
        </p>
    );
}

/** Under a line that replaces a corrected one: which line it corrects, further up the statement. */
export function CorrectsNote({ corrects, onJump }) {
    return (
        <p className="ledger-description mt-1.5 flex items-center gap-1.5 text-xs font-normal text-amber-700 dark:text-amber-400">
            <Icon name="repeat" className="h-3.5 w-3.5 shrink-0" />
            <button type="button" onClick={() => onJump(corrects.id)} className="font-semibold hover:underline">
                تصحيح للحركة #{corrects.lineNumber} ↑
            </button>
        </p>
    );
}

export function ReversalNote({ entry, reverses, onJump }) {
    return (
        <p className="ledger-description mt-1.5 flex items-center gap-1.5 text-xs font-normal text-blue-700">
            <Icon name="repeat" className="h-3.5 w-3.5 shrink-0" />
            <button type="button" onClick={() => onJump(reverses.id)} className="font-semibold hover:underline">
                {entry.type === 'refund' ? 'يُرجع الدفعة' : 'يُلغي الحركة'} #{reverses.lineNumber} ↑
            </button>
        </p>
    );
}

export function LinkedReversalNote({ reversal, onJump }) {
    return (
        <p className="ledger-description mt-1.5 flex items-center gap-1.5 text-xs font-normal text-blue-700 dark:text-blue-400">
            <Icon name="repeat" className="h-3.5 w-3.5 shrink-0" />
            <button type="button" onClick={() => onJump(reversal.id)} className="font-semibold hover:underline">
                {reversal.type === 'refund' ? 'أُرجعت بالحركة' : 'أُلغيت بالحركة'} #{reversal.lineNumber} ↓
            </button>
        </p>
    );
}

/**
 * In the compact view, on a line that replaced or outlived cancelled ones:
 * opens them, with their reversals, under it.
 */
export function HistoryToggle({ entry, isOpen, onToggle }) {
    const wasCorrected = entry.isCorrection || entry.history.some((line) => line.cancellation?.wasCorrected);

    return (
        <p className="ledger-description mt-1.5 flex items-center gap-1.5 text-xs font-normal">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="statement-screen-only inline-flex items-center gap-1.5 font-semibold text-amber-700 hover:underline dark:text-amber-400"
            >
                <Icon name="history" className="h-3.5 w-3.5 shrink-0" />
                {wasCorrected ? 'صُحّحت' : 'لها حركات ملغاة'}، {isOpen ? 'إخفاء السجل' : `السجل (${entry.history.length})`}
            </button>
        </p>
    );
}

/** Under a reading's line in the compact view: the standing discount it was billed with. */
export function ReadingDiscountNote({ discountLine }) {
    return (
        <p className="ledger-description mt-1.5 flex items-center gap-1.5 text-xs font-normal text-emerald-700 dark:text-emerald-400">
            <Icon name="tag" className="h-3.5 w-3.5 shrink-0" />
            <span>
                {withLtrDates(discountLine.description)}: − <bdi dir="ltr">{formatMoney(discountLine.amount)}</bdi>
            </span>
        </p>
    );
}

export function amendmentValue(value) {
    return value === null || value === '' ? '—' : value;
}

/** The payment's in-place edit badge and its complete old-to-new history. */
export function AmendmentBadge({ amendments }) {
    return (
        <span className="group/amend relative inline-flex">
            <button
                type="button"
                aria-label={`سجل تعديلات البيانات، ${amendments.length}`}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
                <Icon name="history" className="h-3.5 w-3.5" />
                معدّلة
            </button>
            <span
                role="tooltip"
                className="pointer-events-none invisible absolute inset-e-0 top-full z-40 mt-2 grid w-[min(360px,calc(100vw-2rem))] gap-3 rounded-2xl p-4 text-start opacity-0 gl-pop transition group-hover/amend:visible group-hover/amend:opacity-100 group-focus-within/amend:visible group-focus-within/amend:opacity-100"
            >
                {amendments.map((amendment) => (
                    <span key={amendment.id} className="grid gap-1.5 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                        {amendment.changes.map((change) => (
                            <span key={change.field} className="text-xs text-gray-700">
                                <b className="font-semibold text-gray-900">{change.label}:</b>{' '}
                                <bdi>{amendmentValue(change.from)}</bdi> <span dir="ltr">→</span> <bdi>{amendmentValue(change.to)}</bdi>
                            </span>
                        ))}
                        <span className="text-[11px] text-gray-500">
                            عدّلها {amendment.userName ?? 'مستخدم محذوف'}، <bdi dir="ltr">{amendment.at}</bdi>، السبب: {amendment.reason}
                        </span>
                    </span>
                ))}
            </span>
        </span>
    );
}
