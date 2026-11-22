import { Button } from '@heroui/react';
import Icon from '@/Components/UI/Icon';
import InputError from '@/Components/UI/InputError';
import { FOCUS_RING, Section } from './MessageFormParts';
import { Notice, TextInput } from '@/Components/UI';

/** Who the quick message goes to: the picked subscriptions, a search to add more, and which of them the kind reaches. */
export default function QuickMessageRecipients({
    detailsLoaded,
    errors,
    exclusion,
    id,
    maxRecipients,
    people,
    pick,
    pickedIds,
    previewRow,
    results,
    search,
    searchHttp,
    searchRef,
    selection,
    selectionError,
    setPreviewId,
    setSearch,
    subscriptionIds,
    unpick,
}) {
    return (
        <Section
            title={`المستلمون${pickedIds.length > 0 ? ` (${pickedIds.length.toLocaleString('en')})` : ''}`}
            hint={
                selection?.all
                    ? 'الاشتراكات المطابقة لفلاتر صفحة المشتركين عند فتح النافذة. راجع المستلمين ومعاينة الرسالة قبل الإرسال.'
                    : 'مشترك واحد أو أكثر: ابحث بالاسم أو الهاتف أو رقم الاشتراك وأضفه.'
            }
        >
            {selectionError && (
                <Notice tone="danger" role="alert">
                    {selectionError}
                </Notice>
            )}
            <div>
                <label htmlFor={`${id}-search`} className="sr-only">
                    بحث عن مشترك
                </label>
                <div className="relative">
                    <Icon name="search" className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--ma-faint)" />
                    <TextInput
                        ref={searchRef}
                        id={`${id}-search`}
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && results[0]) {
                                e.preventDefault();
                                pick(results[0]);
                            }
                        }}
                        placeholder="الاسم أو الهاتف أو رقم الاشتراك"
                        autoComplete="off"
                        autoFocus={subscriptionIds.length === 0}
                        disabled={pickedIds.length >= maxRecipients}
                        className="block w-full ps-8 text-sm"
                        aria-describedby={`${id}-search-results`}
                    />
                </div>
                {search.trim().length >= 2 && (
                    <ul
                        id={`${id}-search-results`}
                        aria-label="نتائج البحث"
                        aria-busy={searchHttp.processing}
                        className="mt-2 divide-y divide-(--ma-line) overflow-hidden rounded-control border border-(--ma-line) bg-(--ma-solid) shadow-card"
                    >
                        {results.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-(--ma-muted)">{searchHttp.processing ? 'جارٍ البحث...' : 'لا يوجد مشترك مطابق.'}</li>
                        ) : (
                            results.map((row) => {
                                const alreadyPicked = pickedIds.includes(row.id);

                                return (
                                    <li key={row.id}>
                                        <Button data-raw="" variant="ghost"
                                            onClick={() => pick(row)}
                                            isDisabled={alreadyPicked}
                                            className={`flex w-full items-center gap-3 px-3 py-2 text-start text-sm transition hover:bg-(--ma-tile) disabled:cursor-default disabled:opacity-60 ${FOCUS_RING}`}
                                        >
                                            <Icon name={alreadyPicked ? 'check' : 'plus'} className="h-4 w-4 shrink-0 text-(--ma-faint)" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold text-(--ma-ink)">{row.name}</span>
                                                <span className="block truncate text-xs text-(--ma-muted)">{row.accountNumber}</span>
                                            </span>
                                            <span dir="ltr" className="shrink-0 text-xs text-(--ma-muted)">
                                                {row.phone ?? 'لا يوجد رقم'}
                                            </span>
                                        </Button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                )}
            </div>

            {pickedIds.length >= maxRecipients && (
                <Notice tone="warn">
                    الرسالة السريعة تصل لـ <bdi dir="ltr">{maxRecipients.toLocaleString('en')}</bdi> مشترك على الأكثر؛ للأكثر استخدم صفحة الرسائل.
                </Notice>
            )}

            {pickedIds.length > 0 && (
                <ul
                    aria-label="المستلمون المختارون"
                    className="max-h-56 divide-y divide-(--ma-line) overflow-y-auto rounded-control border border-(--ma-line)"
                >
                    {pickedIds.map((subscriptionId) => {
                        const person = people[subscriptionId];
                        const reason = exclusion(subscriptionId);

                        return (
                            <li
                                key={subscriptionId}
                                className={`flex items-center gap-3 px-3 py-2 text-sm ${previewRow?.id === subscriptionId ? 'bg-(--ma-brand-soft)' : ''}`}
                            >
                                <Button data-raw="" variant="ghost"
                                    onClick={() => setPreviewId(subscriptionId)}
                                    isDisabled={Boolean(reason) || !person}
                                    title="معاينة رسالته"
                                    className={`min-w-0 flex-1 rounded-lg text-start disabled:cursor-default ${FOCUS_RING}`}
                                >
                                    <span className={`block truncate font-semibold ${reason ? 'text-(--ma-faint) line-through' : 'text-(--ma-ink)'}`}>
                                        {person?.name ?? (detailsLoaded ? `مشترك رقم ${subscriptionId}` : '…')}
                                    </span>
                                    <span className="block truncate text-xs text-(--ma-muted)">
                                        {person?.accountNumber}
                                        {person?.phone && (
                                            <>
                                                {' — '}
                                                <bdi dir="ltr">{person.phone}</bdi>
                                            </>
                                        )}
                                    </span>
                                </Button>
                                {reason && (
                                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-(--ma-warn)">
                                        <Icon name="warning" className="h-3.5 w-3.5" />
                                        {reason}
                                    </span>
                                )}
                                <Button data-raw="" variant="ghost"
                                    onClick={() => unpick(subscriptionId)}
                                    aria-label={`إزالة ${person?.name ?? 'المشترك'}`}
                                    title="إزالة"
                                    className={`shrink-0 rounded-lg p-1 text-(--ma-faint) hover:bg-(--ma-tile) hover:text-(--ma-brand) ${FOCUS_RING}`}
                                >
                                    <Icon name="close" className="h-4 w-4" />
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}
            <InputError message={errors.subscription_ids} />
        </Section>
    );
}
