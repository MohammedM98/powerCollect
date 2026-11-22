import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { router, useHttp } from '@inertiajs/react';
import DialogFrame from '@/Components/UI/DialogFrame';
import { renderMessage } from './MessageParts';
import QuickMessageBody from './QuickMessageBody';
import QuickMessageRecipients from './QuickMessageRecipients';
import { recipientsUrl, byId } from '@/lib/quickMessage';
import QuickMessageKind from './QuickMessageKind';
import QuickMessageChannel from './QuickMessageChannel';
import QuickMessageFooter from './QuickMessageFooter';
import AsyncState from '@/Components/UI/AsyncState';
import { ConfirmDialog } from '@/Components/UI';

const SEARCH_DELAY = 250;

/** Keep large selections in the request body, rather than in the URL. */
function loadRecipients(http, data) {
    http.transform(() => data);
    return http.post('/messages/recipients');
}

/**
 * Write a message from any page without leaving it: pick what it's about
 * (a weekly reading, a balance reminder, any news), the subscriptions it
 * goes to — one or several, found by name, phone or account, or already
 * picked on the page — the wording and how it goes out, then send. Each
 * picked subscription the kind doesn't reach (no reading that week, no
 * phone...) is shown with why. SMS go out and the page stays; WhatsApp
 * messages open on their send's page, to be sent one by one.
 */
export default function QuickMessageModal({ subscriptionIds = [], selection = null, onClose }) {
    const id = useId();
    const setupHttp = useHttp();
    const detailsHttp = useHttp();
    const kindHttp = useHttp();
    const searchHttp = useHttp();
    const bodyRef = useRef(null);
    const searchRef = useRef(null);
    const [setup, setSetup] = useState(null);
    const [setupFailed, setSetupFailed] = useState(false);
    const [kind, setKind] = useState('custom');
    const [weekStart, setWeekStart] = useState('');
    const [approvedOnly, setApprovedOnly] = useState(true);
    const [minBalance, setMinBalance] = useState('');
    const [pickedIds, setPickedIds] = useState(subscriptionIds);
    // Each picked subscription's details, as any message reaches them.
    const [people, setPeople] = useState({});
    const [detailsLoaded, setDetailsLoaded] = useState(subscriptionIds.length === 0 && !selection?.all);
    const [selectionError, setSelectionError] = useState('');
    // The picked subscriptions the chosen kind reaches, with its details, and what they were asked for with.
    const [kindRows, setKindRows] = useState({});
    const [kindLoadedKey, setKindLoadedKey] = useState(null);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [templateId, setTemplateId] = useState('');
    const [body, setBody] = useState('');
    const [channel, setChannel] = useState('sms');
    const [previewId, setPreviewId] = useState(null);
    const [errors, setErrors] = useState({});
    const [confirming, setConfirming] = useState(false);
    const [sending, setSending] = useState(false);

    const loadSetupAndPicked = useEffectEvent(() => {
        setupHttp
            .get('/messages/quick')
            .then((loaded) => {
                setSetup(loaded);
                setWeekStart(loaded.weekStart);
                setChannel(loaded.smsDeliversMessages ? 'sms' : 'whatsapp');
                const first = loaded.templates.find((template) => template.kind === 'custom');
                setTemplateId(first?.id ?? '');
                setBody(first?.body ?? '');
            })
            .catch(() => setSetupFailed(true));

        if (subscriptionIds.length > 0 || selection?.all) {
            loadRecipients(detailsHttp, { kind: 'custom', status: '', subscription_ids: subscriptionIds, selection })
                .then((loaded) => {
                    setPeople((current) => ({ ...byId(loaded.recipients), ...current }));
                    if (selection?.all) {
                        setPickedIds(loaded.recipients.map((person) => person.id));
                    }
                })
                .catch(() => setSelectionError('تعذّر تحميل المستلمين. تأكد أن النتائج لا تتجاوز 5,000 اشتراك، ثم أغلق النافذة وحدّدهم مجددًا.'))
                .finally(() => setDetailsLoaded(true));
        }
    });
    useEffect(() => loadSetupAndPicked(), []);

    // What the chosen kind is asked for with: who it reaches out of the picked ones depends on all of it.
    const kindParams = { kind };

    if (kind === 'weekly_reading') {
        Object.assign(kindParams, { week_start: weekStart, approved_only: approvedOnly ? 1 : 0 });
    } else if (kind === 'balance_reminder') {
        kindParams.min_balance = minBalance === '' ? 0 : minBalance;
    }

    const kindKey = JSON.stringify([kindParams, pickedIds]);

    // Which of the picked subscriptions the kind reaches, asked again a moment after anything it depends on changes.
    const askWhoKindReaches = useEffectEvent(() => {
        if (kind === 'custom' || pickedIds.length === 0 || (kind === 'weekly_reading' && !weekStart)) {
            return undefined;
        }

        let current = true;
        const timer = setTimeout(() => {
            loadRecipients(kindHttp, { ...kindParams, status: '', subscription_ids: pickedIds })
                .then((loaded) => {
                    if (current) {
                        setKindRows(byId(loaded.recipients));
                        setKindLoadedKey(kindKey);
                    }
                })
                .catch(() => {});
        }, SEARCH_DELAY);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    });
    useEffect(() => askWhoKindReaches(), [kindKey]);

    // Subscriptions whose name, phone or account matches, once two letters are typed.
    const searchSubscriptions = useEffectEvent(() => {
        const term = search.trim();

        if (term.length < 2) {
            setResults([]);

            return undefined;
        }

        let current = true;
        const timer = setTimeout(() => {
            searchHttp
                .get(recipientsUrl({ kind: 'custom', search: term }))
                .then((loaded) => current && setResults(loaded.recipients))
                .catch(() => current && setResults([]));
        }, SEARCH_DELAY);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    });
    useEffect(() => searchSubscriptions(), [search]);

    // Each branch reads on its own weeks: those of the first picked subscription's branch, or else the user's.
    const weekBranchKey = String(people[pickedIds[0]]?.branchId ?? setup?.weekBranchId ?? '');
    const weekOptions = setup?.weekOptions[weekBranchKey] ?? [];

    const [weeksShown, setWeeksShown] = useState({ branch: null, setup: null });

    // Another branch has other weeks: move to its latest one when the chosen week isn't one of them.
    if (weeksShown.branch !== weekBranchKey || weeksShown.setup !== setup) {
        setWeeksShown({ branch: weekBranchKey, setup });
        if (weekOptions.length > 0 && !weekOptions.some((option) => option.value === weekStart)) {
            setWeekStart(weekOptions[0].value);
        }
    }

    const maxRecipients = setup?.maxRecipients ?? 400;
    const kindTemplates = (setup?.templates ?? []).filter((template) => template.kind === kind);
    const selectedTemplate = kindTemplates.find((template) => String(template.id) === String(templateId));
    const reachedRows = kind === 'custom' ? people : kindRows;
    const kindReady = detailsLoaded && (kind === 'custom' || kindLoadedKey === kindKey);

    /** Why a picked subscription won't get the message, or null when it will (or it isn't known yet). */
    function exclusion(subscriptionId) {
        const person = people[subscriptionId];

        if (!person) {
            return detailsLoaded ? 'غير متاح لك' : null;
        }

        if (!person.phone) {
            return 'لا يوجد رقم هاتف';
        }

        if (kindReady && !reachedRows[subscriptionId]) {
            return kind === 'weekly_reading'
                ? approvedOnly
                    ? 'لا توجد له قراءة معتمدة في هذا الأسبوع'
                    : 'لا توجد له قراءة في هذا الأسبوع'
                : 'رصيده لا يتجاوز الحد';
        }

        return null;
    }

    const reachedIds = kindReady ? pickedIds.filter((subscriptionId) => people[subscriptionId]?.phone && reachedRows[subscriptionId]) : [];
    const previewRow = reachedRows[previewId] && reachedIds.includes(previewId) ? reachedRows[previewId] : reachedRows[reachedIds[0]];
    const previewText = previewRow ? renderMessage(body, previewRow.variables) : body;
    const canSend = setup !== null && !selectionError && reachedIds.length > 0 && body.trim() !== '' && !sending;
    const sendBlocker =
        pickedIds.length === 0
            ? 'ابحث عن مشترك وأضفه.'
            : !kindReady
              ? 'جارٍ التحقق من المستلمين...'
              : reachedIds.length === 0
                ? 'لا يصل نوع الرسالة هذا لأحد من المختارين.'
                : body.trim() === ''
                  ? 'اكتب نص الرسالة.'
                  : null;

    function changeKind(nextKind) {
        // Typed text stays; a template's text gives way to the new kind's first template.
        if (body.trim() === '' || selectedTemplate?.body === body) {
            const first = setup.templates.find((template) => template.kind === nextKind);
            setTemplateId(first?.id ?? '');
            setBody(first?.body ?? '');
        } else {
            setTemplateId('');
        }

        setKind(nextKind);
    }

    function pickTemplate(value) {
        setTemplateId(value);
        const template = kindTemplates.find((item) => String(item.id) === String(value));

        if (template) {
            setBody(template.body);
        }
    }

    function insertPlaceholder(name) {
        const token = `{${name}}`;
        const textarea = bodyRef.current;
        const start = textarea?.selectionStart ?? body.length;
        const end = textarea?.selectionEnd ?? body.length;
        setBody(body.slice(0, start) + token + body.slice(end));

        requestAnimationFrame(() => {
            textarea?.focus();
            textarea?.setSelectionRange(start + token.length, start + token.length);
        });
    }

    function pick(row) {
        if (!pickedIds.includes(row.id) && pickedIds.length < maxRecipients) {
            setPeople((current) => ({ ...current, [row.id]: row }));
            setPickedIds((current) => [...current, row.id]);
        }

        setSearch('');
        setResults([]);
        searchRef.current?.focus();
    }

    function unpick(subscriptionId) {
        setPickedIds((current) => current.filter((item) => item !== subscriptionId));
    }

    function send() {
        setConfirming(false);
        setSending(true);
        router.post(
            '/messages',
            { ...kindParams, approved_only: approvedOnly, status: '', channel, body, subscription_ids: reachedIds, stay_on_page: true },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: onClose,
                onError: setErrors,
                onFinish: () => setSending(false),
            },
        );
    }

    const fullPageUrl = `/messages/create?${new URLSearchParams([['kind', kind], ['status', ''], ...pickedIds.map((subscriptionId) => ['subscription_ids[]', subscriptionId])])}`;

    return (
        <>
            <DialogFrame
                show
                onClose={onClose}
                title="رسالة سريعة"
                icon="send"
                tone="blue"
                maxWidth="3xl"
                footer={
                    <QuickMessageFooter
                        canSend={canSend}
                        fullPageUrl={fullPageUrl}
                        id={id}
                        onClose={onClose}
                        pickedIds={pickedIds}
                        reachedIds={reachedIds}
                        sendBlocker={sendBlocker}
                        sending={sending}
                        setConfirming={setConfirming}
                        setup={setup}
                    />
                }
            >
                {setupFailed || setup === null ? (
                    <div>
                        <AsyncState loading={setup === null} error={setupFailed ? 'تعذّر تحميل نافذة الرسائل. أغلقها وحاول مرة أخرى.' : null} />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <QuickMessageKind
                            approvedOnly={approvedOnly}
                            changeKind={changeKind}
                            errors={errors}
                            id={id}
                            kind={kind}
                            minBalance={minBalance}
                            setApprovedOnly={setApprovedOnly}
                            setMinBalance={setMinBalance}
                            setWeekStart={setWeekStart}
                            setup={setup}
                            weekOptions={weekOptions}
                            weekStart={weekStart}
                        />

                        <QuickMessageRecipients
                            detailsLoaded={detailsLoaded}
                            errors={errors}
                            exclusion={exclusion}
                            id={id}
                            maxRecipients={maxRecipients}
                            people={people}
                            pick={pick}
                            pickedIds={pickedIds}
                            previewRow={previewRow}
                            results={results}
                            search={search}
                            searchHttp={searchHttp}
                            searchRef={searchRef}
                            selection={selection}
                            selectionError={selectionError}
                            setPreviewId={setPreviewId}
                            setSearch={setSearch}
                            subscriptionIds={subscriptionIds}
                            unpick={unpick}
                        />

                        <QuickMessageBody
                            body={body}
                            bodyRef={bodyRef}
                            channel={channel}
                            errors={errors}
                            id={id}
                            insertPlaceholder={insertPlaceholder}
                            kind={kind}
                            kindTemplates={kindTemplates}
                            pickTemplate={pickTemplate}
                            previewRow={previewRow}
                            previewText={previewText}
                            setBody={setBody}
                            setup={setup}
                            templateId={templateId}
                        />

                        <QuickMessageChannel channel={channel} setChannel={setChannel} setup={setup} />
                    </div>
                )}
            </DialogFrame>

            <ConfirmDialog
                show={confirming}
                onConfirm={send}
                onCancel={() => setConfirming(false)}
                title={`إرسال ${reachedIds.length.toLocaleString('en')} رسالة؟`}
                message={
                    channel === 'sms'
                        ? 'تُرسل الرسالة لكل مشترك برسالة نصية، وتُكتب معلوماته فيها. لا يمكن التراجع بعد الإرسال.'
                        : 'تُجهَّز رسالة واتساب لكل مشترك، ثم ترسلها من صفحة الإرسال.'
                }
                confirmLabel="نعم، أرسل"
                icon="send"
            />
        </>
    );
}
