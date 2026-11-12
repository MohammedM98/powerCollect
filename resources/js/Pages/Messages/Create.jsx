import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Icon from '@/Components/Icon';
import ChoiceChips from '@/Components/ChoiceChips';
import ConfirmDialog from '@/Components/ConfirmDialog';
import { CHANNEL_ICONS, KIND_HINTS, KIND_ICONS, MessageText, renderMessage, withIcons } from './MessageParts';
import { scopedOptions } from '@/lib/filterGroups';
import PageHeader, { BackLink } from '@/Components/PageHeader';
import MessageRecipientList from './MessageRecipientList';
import MessageBodyCard from './MessageBodyCard';
import MessageRecipientCriteria from './MessageRecipientCriteria';
import { Card } from './MessageFormParts';

/**
 * Write a message to subscriptions: pick what it's about, who gets it, the
 * wording (from a saved template or typed, with placeholders for each
 * subscription's own details) and how it goes out, check each recipient's
 * own text, untick anyone it shouldn't reach, then send.
 */
export default function Create({
    kinds,
    channels,
    smsDeliversMessages,
    templates,
    placeholders,
    weekOptions,
    weekBranchId,
    statusOptions,
    branchOptions,
    meterBoxGroups,
    circuitBreakerOptions,
    maxRecipients,
    criteria: initialCriteria,
    recipients: loadedRecipients,
}) {
    const { errors } = usePage().props;
    const bodyRef = useRef(null);
    const [kind, setKind] = useState(initialCriteria.kind);
    const [channel, setChannel] = useState(smsDeliversMessages ? 'sms' : 'whatsapp');
    const [criteria, setCriteria] = useState({
        week_start: initialCriteria.week_start,
        approved_only: initialCriteria.approved_only,
        min_balance: initialCriteria.min_balance > 0 ? String(initialCriteria.min_balance) : '',
        status: initialCriteria.status ?? '',
        branch_id: initialCriteria.branch_id ?? '',
        meter_box_name: initialCriteria.meter_box_name ?? '',
        meter_box_id: initialCriteria.meter_box_id ?? '',
        circuit_breaker_id: initialCriteria.circuit_breaker_id ?? '',
        search: initialCriteria.search ?? '',
        subscription_ids: initialCriteria.subscription_ids ?? [],
    });
    const kindTemplates = templates.filter((template) => template.kind === kind);
    const [templateId, setTemplateId] = useState(() => kindTemplates[0]?.id ?? '');
    const [body, setBody] = useState(() => kindTemplates[0]?.body ?? '');
    const [recipients, setRecipients] = useState(null);
    const [loadedKey, setLoadedKey] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const [previewId, setPreviewId] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [sending, setSending] = useState(false);
    const [templateName, setTemplateName] = useState(null);
    const [confirmingTemplateDelete, setConfirmingTemplateDelete] = useState(false);

    // What the recipient list is asked for with; the list is out of date once this changes.
    const requestData = useMemo(() => {
        const data = { kind, status: criteria.status, search: criteria.search };

        for (const key of ['branch_id', 'meter_box_name', 'meter_box_id', 'circuit_breaker_id']) {
            if (criteria[key] !== '') {
                data[key] = criteria[key];
            }
        }

        if (criteria.subscription_ids.length > 0) {
            data.subscription_ids = criteria.subscription_ids;
        }

        if (kind === 'weekly_reading') {
            data.week_start = criteria.week_start;
            data.approved_only = criteria.approved_only ? 1 : 0;
        }

        if (kind === 'balance_reminder') {
            data.min_balance = criteria.min_balance === '' ? 0 : criteria.min_balance;
        }

        return data;
    }, [kind, criteria]);
    const requestKey = JSON.stringify(requestData);
    // Each branch reads on its own weeks: those of the branch messaged, or else of the branch the page starts on.
    const weekBranchKey = String(criteria.branch_id !== '' ? criteria.branch_id : weekBranchId);
    const branchWeekOptions = weekOptions[weekBranchKey] ?? [];
    const [receivedRecipients, setReceivedRecipients] = useState(undefined);
    const [shownWeekBranchKey, setShownWeekBranchKey] = useState(weekBranchKey);
    const isStale = recipients !== null && loadedKey !== requestKey;

    // Keep the list loaded here: a template save reloads the page without it.
    if (loadedRecipients !== undefined && loadedRecipients !== receivedRecipients) {
        setReceivedRecipients(loadedRecipients);
        setRecipients(loadedRecipients);
        setSelected(new Set(loadedRecipients.filter((recipient) => recipient.phone).map((recipient) => recipient.id)));
        setPreviewId(loadedRecipients.find((recipient) => recipient.phone)?.id ?? null);
    }

    // Another branch has other weeks: move to its latest one when the chosen week isn't one of them.
    if (shownWeekBranchKey !== weekBranchKey) {
        setShownWeekBranchKey(weekBranchKey);
        if (branchWeekOptions.length > 0 && !branchWeekOptions.some((option) => option.value === criteria.week_start)) {
            setCriterion('week_start', branchWeekOptions[0].value);
        }
    }

    const openShortcut = useEffectEvent(() => {
        if (criteria.subscription_ids.length > 0 || initialCriteria.kind === 'weekly_reading') {
            loadRecipients();
        }
    });

    // A subscription or weekly-reading shortcut opens its recipients straight away.
    useEffect(() => {
        openShortcut();
    }, []);

    function loadRecipients() {
        setLoading(true);
        router.reload({
            only: ['recipients'],
            data: requestData,
            preserveScroll: true,
            onSuccess: () => setLoadedKey(requestKey),
            onFinish: () => setLoading(false),
        });
    }

    function setCriterion(key, value) {
        setCriteria((current) => ({ ...current, [key]: value }));
    }

    function changeKind(nextKind) {
        setKind(nextKind);
        const first = templates.find((template) => template.kind === nextKind);
        setTemplateId(first?.id ?? '');
        setBody(first?.body ?? '');
    }

    function pickTemplate(id) {
        setTemplateId(id);
        const template = templates.find((item) => String(item.id) === String(id));

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

    function saveTemplate() {
        router.post(
            '/message-templates',
            { name: templateName, kind, body },
            { preserveScroll: true, preserveState: true, onSuccess: () => setTemplateName(null) },
        );
    }

    function updateTemplate() {
        const template = templates.find((item) => String(item.id) === String(templateId));
        router.put(`/message-templates/${templateId}`, { name: template.name, kind, body }, { preserveScroll: true, preserveState: true });
    }

    function deleteTemplate() {
        setConfirmingTemplateDelete(false);
        router.delete(`/message-templates/${templateId}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setTemplateId(''),
        });
    }

    function toggle(id) {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
    }

    function send() {
        setConfirming(false);
        setSending(true);
        router.post(
            '/messages',
            { ...requestData, approved_only: Boolean(requestData.approved_only), channel, body, subscription_ids: [...selected] },
            { preserveScroll: true, onFinish: () => setSending(false) },
        );
    }

    const withPhone = recipients?.filter((recipient) => recipient.phone) ?? [];
    const allSelected = withPhone.length > 0 && withPhone.every((recipient) => selected.has(recipient.id));
    const previewRecipient = recipients?.find((recipient) => recipient.id === previewId) ?? null;
    const previewText = previewRecipient ? renderMessage(body, previewRecipient.variables) : body;
    const selectedTemplate = templates.find((template) => String(template.id) === String(templateId));
    // Only the chosen branch's boxes.
    const meterBoxNames = meterBoxGroups[0] ? scopedOptions(meterBoxGroups[0], criteria) : [];
    const meterBoxNumbers = meterBoxGroups[1]
        ? scopedOptions(meterBoxGroups[1], criteria).filter((option) => option.parent === criteria.meter_box_name)
        : [];
    const canSend = selected.size > 0 && body.trim() !== '' && !isStale && !sending;
    // Why the send button can't be used yet, said under it.
    const sendBlocker =
        recipients === null
            ? 'اضغط «عرض المستلمين» أولًا لتختار من تصله الرسالة.'
            : isStale
              ? 'حدّث المستلمين بعد تغيير الشروط.'
              : body.trim() === ''
                ? 'اكتب نص الرسالة.'
                : selected.size === 0
                  ? 'حدّد مشتركًا واحدًا على الأقل.'
                  : null;

    return (
        <AuthenticatedLayout
            header={
                <PageHeader eyebrow={<BackLink href="/messages">الرسائل</BackLink>} title="رسالة جديدة" />
            }
        >
            <Head title="رسالة جديدة" />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-6">
                    <Card icon="tag" title="نوع الرسالة" description={KIND_HINTS[kind]}>
                        <ChoiceChips options={withIcons(kinds, KIND_ICONS)} value={kind} onChange={changeKind} label="نوع الرسالة" />
                    </Card>

                    <MessageRecipientCriteria
                        branchOptions={branchOptions}
                        branchWeekOptions={branchWeekOptions}
                        circuitBreakerOptions={circuitBreakerOptions}
                        criteria={criteria}
                        kind={kind}
                        loadRecipients={loadRecipients}
                        loading={loading}
                        meterBoxGroups={meterBoxGroups}
                        meterBoxNames={meterBoxNames}
                        meterBoxNumbers={meterBoxNumbers}
                        recipients={recipients}
                        setCriteria={setCriteria}
                        setCriterion={setCriterion}
                        statusOptions={statusOptions}
                    />

                    <MessageBodyCard
                        body={body}
                        bodyRef={bodyRef}
                        channel={channel}
                        errors={errors}
                        insertPlaceholder={insertPlaceholder}
                        kind={kind}
                        kindTemplates={kindTemplates}
                        pickTemplate={pickTemplate}
                        placeholders={placeholders}
                        previewText={previewText}
                        saveTemplate={saveTemplate}
                        selectedTemplate={selectedTemplate}
                        setBody={setBody}
                        setConfirmingTemplateDelete={setConfirmingTemplateDelete}
                        setTemplateName={setTemplateName}
                        templateId={templateId}
                        templateName={templateName}
                        updateTemplate={updateTemplate}
                    />

                    <Card icon="send" title="طريقة الإرسال">
                        <ChoiceChips options={withIcons(channels, CHANNEL_ICONS)} value={channel} onChange={setChannel} label="طريقة الإرسال" />
                        {channel === 'sms' && !smsDeliversMessages && (
                            <p role="note" className="mt-3 flex items-start gap-2 rounded-control bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                                <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                                لم تُضبط بوابة الرسائل النصية بعد، فتُسجَّل الرسائل في سجل النظام فقط ولا تصل للمشتركين. اطلب ضبط مزوّد SMS، أو أرسل عبر واتساب.
                            </p>
                        )}
                        {channel === 'whatsapp' && (
                            <p className="mt-3 text-sm text-gray-500">
                                تُجهَّز الرسائل، ثم ترسلها من صفحة الإرسال: زر لكل مشترك يفتح واتساب والرسالة مكتوبة.
                            </p>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card icon="eye" title="معاينة الرسالة" description={previewRecipient ? `كما تصل إلى ${previewRecipient.name}` : 'اعرض المستلمين لترى رسالة كل مشترك.'}>
                        <div className="whitespace-pre-line rounded-2xl rounded-tr-sm bg-emerald-500/10 px-4 py-3 leading-7 text-gray-900">
                            {previewText ? <MessageText text={previewText} /> : <span className="text-gray-500">نص الرسالة</span>}
                        </div>
                    </Card>

                    <MessageRecipientList
                        allSelected={allSelected}
                        branchOptions={branchOptions}
                        canSend={canSend}
                        errors={errors}
                        isStale={isStale}
                        maxRecipients={maxRecipients}
                        previewId={previewId}
                        recipients={recipients}
                        selected={selected}
                        sendBlocker={sendBlocker}
                        sending={sending}
                        setConfirming={setConfirming}
                        setPreviewId={setPreviewId}
                        setSelected={setSelected}
                        toggle={toggle}
                        withPhone={withPhone}
                    />
                </div>
            </div>

            <ConfirmDialog
                show={confirmingTemplateDelete}
                onConfirm={deleteTemplate}
                onCancel={() => setConfirmingTemplateDelete(false)}
                title="حذف القالب؟"
                message={`سيُحذف القالب «${selectedTemplate?.name ?? ''}» نهائيًا. الرسائل التي أُرسلت به تبقى كما هي.`}
                confirmLabel="نعم، احذف القالب"
                icon="trash"
                tone="danger"
            />

            <ConfirmDialog
                show={confirming}
                onConfirm={send}
                onCancel={() => setConfirming(false)}
                title={`إرسال ${selected.size.toLocaleString('en')} رسالة؟`}
                message={
                    channel === 'sms'
                        ? 'تُرسل الرسالة لكل مشترك محدد برسالة نصية، وتُكتب معلوماته فيها. لا يمكن التراجع بعد الإرسال.'
                        : 'تُجهَّز رسالة واتساب لكل مشترك محدد، ثم ترسلها من صفحة الإرسال.'
                }
                confirmLabel="نعم، أرسل"
                icon="send"
            />
        </AuthenticatedLayout>
    );
}
