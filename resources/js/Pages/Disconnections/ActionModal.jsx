import { TextArea } from '@heroui/react';
import { useEffect, useEffectEvent, useId, useMemo, useState } from 'react';
import { router, useHttp } from '@inertiajs/react';
import DialogFrame from '@/Components/UI/DialogFrame';
import FormField from '@/Components/Form/FormField';
import InputLabel from '@/Components/UI/InputLabel';
import Icon from '@/Components/UI/Icon';
import Balance from '@/Components/Finance/Balance';
import ChoiceChips from '@/Components/UI/ChoiceChips';
import InputError from '@/Components/UI/InputError';
import { formatMoney, formatDate } from '@/lib/format';
import { feeError, fillPlaceholders, itemTone, operationId, smsParts, totalFees } from '@/lib/disconnections';
import HoldToConfirm from './HoldToConfirm';
import DateInput from '@/Components/UI/DateInput';
import { Affix, CheckBox, DangerKey, FieldAction, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, Notice, PrimaryKey, SecondaryKey, StatusPill, TextInput } from '@/Components/UI';

const ACTIONS = {
    reschedule: { title: 'تغيير موعد القطع', icon: 'calendar', tone: 'blue', url: 'reschedule' },
    remove: { title: 'إزالة من القائمة', icon: 'undo', tone: 'amber', url: 'remove' },
    warn: { title: 'إرسال إنذار', icon: 'send', tone: 'blue', url: 'warn' },
    confirm: { title: 'تأكيد تنفيذ القطع', icon: 'power', tone: 'danger', url: 'confirm' },
};

/** Why an item would be left out of the action, or null when it is reached. */
function exclusion(action, item) {
    if (item.status !== 'scheduled') {
        return item.status === 'disconnected' ? 'تم قطعه مسبقًا' : 'أُزيل من القائمة';
    }

    if (action === 'warn' && !item.phone) {
        return 'لا يوجد رقم هاتف';
    }

    if (action === 'confirm' && !item.serviceIsActive) {
        return `خدمته ${item.serviceStatusLabel}`;
    }

    return null;
}

/** One subscriber's value for each placeholder, as the server fills them in. */
function placeholderValues(item, list) {
    return {
        الاسم: item.name,
        رقم_الاشتراك: item.accountNumber,
        الطبلون: item.meterBoxName ?? '',
        الفرع: list.branchName,
        الرصيد: formatMoney(item.balance),
        موعد_القطع: formatDate(item.scheduledFor),
    };
}

/**
 * A bulk action on the list's chosen subscribers. It first loads exactly
 * which subscribers it reaches — the ticked ones, or every match of the
 * filters across all pages — and lists them with those it would leave out
 * and why, then asks for what the action needs and sends it once for the
 * subscribers listed.
 */
export default function ActionModal({ action, list, selection, count, channelOptions, smsDeliversMessages, warningTemplates, defaultWarning, placeholders, today, usualFee, canChangeFee = false, onClose, onDone }) {
    const id = useId();
    const http = useHttp({});
    const [preview, setPreview] = useState(null);
    const [failed, setFailed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [date, setDate] = useState(today);
    const [reason, setReason] = useState('');
    const [channel, setChannel] = useState('sms');
    const [body, setBody] = useState(defaultWarning);
    const [confirmed, setConfirmed] = useState(false);
    const [fees, setFees] = useState({});
    const [feeForAll, setFeeForAll] = useState(String(Number(usualFee)));
    const [sendId] = useState(operationId);
    const meta = ACTIONS[action];

    const loadPreview = useEffectEvent(() => {
        let current = true;
        http.transform(() => selection);
        http.post(`/disconnection-lists/${list.id}/items/preview`)
            .then((loaded) => {
                if (!current) {
                    return;
                }

                setPreview(loaded);
                setFees(Object.fromEntries(loaded.items.map((item) => [item.id, item.fee == null ? '' : String(Number(item.fee))])));
            })
            .catch(() => current && setFailed(true));

        return () => {
            current = false;
        };
    });
    useEffect(() => loadPreview(), []);

    const reached = useMemo(() => (preview?.items ?? []).filter((item) => !exclusion(action, item)), [preview, action]);
    const excluded = useMemo(() => (preview?.items ?? []).filter((item) => exclusion(action, item)), [preview, action]);
    const chosenFees = useMemo(() => reached.map((item) => ({ fee: fees[item.id] })), [reached, fees]);
    const feesAreValid = chosenFees.every(({ fee }) => fee !== '' && Number(fee) >= 0);

    function submit() {
        if (reached.length === 0) {
            return;
        }

        const ids = reached.map((item) => item.id);
        const payload = {
            reschedule: { ids, scheduled_for: date, reason },
            remove: { ids, reason },
            warn: { ids, channel, body, operation_id: sendId },
            confirm: { ids, fees: Object.fromEntries(reached.map((item) => [item.id, fees[item.id]])), confirmed },
        }[action];

        setSaving(true);
        router.post(`/disconnection-lists/${list.id}/items/${meta.url}`, payload, {
            preserveScroll: true,
            onSuccess: onDone,
            onError: (found) => {
                setErrors(found);

                if (found.ids) {
                    onDone();
                }
            },
            onFinish: () => setSaving(false),
        });
    }

    const firstText = reached[0] ? fillPlaceholders(body, placeholderValues(reached[0], list)) : '';
    const parts = smsParts(firstText);

    const description = preview ? (
        <>
            يُطبَّق على <b className="font-display text-(--ma-ink)"><bdi dir="ltr">{reached.length.toLocaleString('en')}</bdi></b> مشترك
            {excluded.length > 0 && <>، يُستثنى <b className="font-display"><bdi dir="ltr">{excluded.length.toLocaleString('en')}</bdi></b></>}
            {selection.all ? ' (من كل النتائج المطابقة للفلاتر في كل الصفحات)' : ' (من المحددين)'}
        </>
    ) : (
        `جارٍ تحميل ${count.toLocaleString('en')} مشترك…`
    );

    const footer = (
        <>
            <SecondaryKey onClick={onClose} disabled={saving}>إلغاء</SecondaryKey>
            {action === 'remove' && (
                <DangerKey type="submit" form={`${id}-form`} disabled={saving || !preview || reached.length === 0}>
                    {saving ? 'جارٍ التنفيذ…' : `إزالة ${reached.length.toLocaleString('en')} مشترك`}
                </DangerKey>
            )}
            {(action === 'reschedule' || action === 'warn') && (
                <PrimaryKey type="submit" form={`${id}-form`} disabled={saving || !preview || reached.length === 0 || (action === 'warn' && !body.trim())}>
                    <Icon name={meta.icon} className="h-4 w-4" />
                    {saving ? 'جارٍ التنفيذ…' : action === 'warn' ? `إرسال إلى ${reached.length.toLocaleString('en')} مشترك` : `تطبيق على ${reached.length.toLocaleString('en')} مشترك`}
                </PrimaryKey>
            )}
        </>
    );

    return (
        <DialogFrame show onClose={onClose} title={meta.title} description={description} icon={meta.icon} tone={meta.tone} maxWidth="3xl" busy={saving} footer={footer}>
            <form
                id={`${id}-form`}
                onSubmit={(event) => {
                    event.preventDefault();

                    // A disconnection is confirmed only by holding its button (or typing the count), never by Enter.
                    if (action !== 'confirm') {
                        submit();
                    }
                }}
                className="space-y-6"
            >
                {failed && <Notice tone="danger" role="alert">تعذّر تحميل المشتركين؛ أغلق النافذة وحاول مرة أخرى.</Notice>}
                {preview?.tooMany && (
                    <Notice tone="warn">
                        النتائج أكثر من <bdi dir="ltr">{preview.max.toLocaleString('en')}</bdi> مشترك؛ ضيّق الفلاتر. لن يُطبَّق الإجراء إلا على المعروضين هنا.
                    </Notice>
                )}

                {preview && (
                    <div className="overflow-hidden rounded-[14px] border border-(--ma-line)">
                        <div className="max-h-64 overflow-y-auto">
                            <ListTable aria-label="المشتركون المشمولون بالإجراء" className="w-full text-sm">
                                <ListHeader className="sticky top-0 bg-(--ma-tile) text-xs text-(--ma-muted)">
                                    <ListColumn id="name" isRowHeader className="px-3 py-2 text-start">المشترك</ListColumn>
                                    <ListColumn id="status" className="px-3 py-2 text-start">الحالة</ListColumn>
                                    {action === 'warn' && <ListColumn id="phone" className="px-3 py-2 text-start">الجوال</ListColumn>}
                                    {action === 'confirm' && <ListColumn id="service" className="px-3 py-2 text-start">الخدمة</ListColumn>}
                                    <ListColumn id="balance" className="px-3 py-2 text-start">الرصيد</ListColumn>
                                    {action === 'confirm' && <ListColumn id="fee" className="px-3 py-2 text-start">رسوم القطع</ListColumn>}
                                    {action !== 'confirm' && <ListColumn id="scheduled_for" className="px-3 py-2 text-start">الموعد</ListColumn>}
                                </ListHeader>
                                <ListBody className="divide-y divide-(--ma-line)">
                                    {preview.items.map((item) => {
                                        const why = exclusion(action, item);

                                        return (
                                            <ListRow key={item.id} id={item.id} className={why ? 'bg-(--ma-tile) text-(--ma-muted)' : undefined}>
                                                <ListCell className="px-3 py-2">
                                                    <b className={why ? 'line-through' : 'text-(--ma-ink)'}>{item.name}</b>
                                                    <bdi dir="ltr" className="block text-end font-display text-xs text-(--ma-muted) rtl:text-start">{item.accountNumber}</bdi>
                                                    {why && <span className="block text-xs text-(--ma-warn)">يُستثنى: {why}</span>}
                                                </ListCell>
                                                <ListCell className="px-3 py-2"><StatusPill tone={itemTone(item)} label={item.isOverdue ? 'متأخر' : item.statusLabel} /></ListCell>
                                                {action === 'warn' && <ListCell className="px-3 py-2 font-display text-xs"><bdi dir="ltr">{item.phone ?? '—'}</bdi></ListCell>}
                                                {action === 'confirm' && <ListCell className="px-3 py-2 text-xs">{item.serviceStatusLabel}</ListCell>}
                                                <ListCell className="whitespace-nowrap px-3 py-2"><Balance value={item.balance} /></ListCell>
                                                {action === 'confirm' && (
                                                    <ListCell className="whitespace-nowrap px-3 py-2 font-semibold">
                                                        {canChangeFee && !why ? (
                                                            <Affix unit="₪">
                                                            <TextInput
                                                                type="number"
                                                                min={0}
                                                                step="0.01"
                                                                value={fees[item.id] ?? ''}
                                                                onChange={(event) => setFees((current) => ({ ...current, [item.id]: event.target.value }))}
                                                                aria-label={`رسوم قطع ${item.name}`}
                                                                className="block w-32"
                                                            />
                                                            </Affix>
                                                        ) : (
                                                            <><bdi dir="ltr">{formatMoney(fees[item.id] ?? item.fee)}</bdi> ₪</>
                                                        )}
                                                    </ListCell>
                                                )}
                                                {action !== 'confirm' && <ListCell className="whitespace-nowrap px-3 py-2 text-xs"><bdi dir="ltr">{formatDate(item.scheduledFor)}</bdi></ListCell>}
                                            </ListRow>
                                        );
                                    })}
                                </ListBody>
                            </ListTable>
                        </div>
                    </div>
                )}

                {preview && action === 'reschedule' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField id={`${id}-date`} label="موعد القطع الجديد" required error={errors.scheduled_for}>
                            <DateInput name="scheduled_for" min={today} value={date} onChange={setDate} required />
                        </FormField>
                        <FormField id={`${id}-reason`} label="سبب التمديد (اختياري)">
                            <TextInput type="text" value={reason} onChange={(event) => setReason(event.target.value)} className="block w-full" maxLength={1000} />
                        </FormField>
                        <Notice className="sm:col-span-2">يُسجَّل كل تمديد بالموعد القديم والجديد. لا تُرسل أي رسالة للمشتركين.</Notice>
                    </div>
                )}

                {preview && action === 'remove' && (
                    <FormField id={`${id}-reason`} label="سبب الإزالة (اختياري)" hint="يبقى سجلهم في القائمة، ويمكن إدراجهم من جديد لاحقًا.">
                        <TextInput type="text" value={reason} onChange={(event) => setReason(event.target.value)} className="block w-full" maxLength={1000} />
                    </FormField>
                )}

                {preview && action === 'warn' && (
                    <div className="space-y-4">
                        <ChoiceChips options={channelOptions} value={channel} onChange={setChannel} label="طريقة الإرسال" />
                        {channel === 'sms' && !smsDeliversMessages && (
                            <Notice tone="warn">بوابة الرسائل غير مفعّلة؛ تُسجَّل الرسائل في السجل فقط ولا تصل للمشتركين.</Notice>
                        )}
                        {warningTemplates.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {warningTemplates.map((template) => (
                                    <FieldAction key={template.id} onClick={() => setBody(template.body)}>{template.name}</FieldAction>
                                ))}
                            </div>
                        )}
                        <div>
                            <InputLabel htmlFor={`${id}-body`} className="mb-2">نص الإنذار</InputLabel>
                            <TextArea id={`${id}-body`} value={body} onChange={(event) => setBody(event.target.value)} rows={4} className="block w-full text-sm" maxLength={1000} required />
                            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-(--ma-muted)">
                                الحقول:
                                {placeholders.map((name) => (
                                    <FieldAction key={name} onClick={() => setBody((current) => `${current} {${name}}`)}>{`{${name}}`}</FieldAction>
                                ))}
                            </p>
                            <InputError message={errors.body} className="mt-1" />
                        </div>
                        {firstText && (
                            <Notice icon="send" title={`معاينة رسالة ${reached[0].name}`}>
                                <p className="whitespace-pre-line">{firstText}</p>
                            </Notice>
                        )}
                        <p className="text-xs text-(--ma-muted)">
                            المستلمون: <b className="font-display">{reached.length.toLocaleString('en')}</b>
                            {channel === 'sms' && <>، كل رسالة نحو <b className="font-display">{parts}</b> جزء SMS، التكلفة التقريبية <b className="font-display">{(parts * reached.length).toLocaleString('en')}</b> رسالة</>}
                            . الإرسال يدوي في كل مرة؛ لا تُرسل إنذارات تلقائيًا.
                        </p>
                    </div>
                )}

                {preview && action === 'confirm' && (
                    <div className="space-y-4">
                        {canChangeFee && reached.length > 0 && (
                            <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-(--ma-line) p-4">
                                <FormField id={`${id}-fee`} label="رسوم قطع الخدمة">
                                    <Affix unit="₪">
                                        <TextInput type="number" min={0} step="0.01" value={feeForAll} onChange={(event) => setFeeForAll(event.target.value)} className="block w-40" />
                                    </Affix>
                                </FormField>
                                <SecondaryKey onClick={() => setFees((current) => ({ ...current, ...Object.fromEntries(reached.map((item) => [item.id, feeForAll])) }))} disabled={feeForAll === '' || Number(feeForAll) < 0}>
                                    تطبيق على الجميع ({reached.length.toLocaleString('en')})
                                </SecondaryKey>
                                <p className="basis-full text-xs text-(--ma-muted)">الرسوم المعتادة <bdi dir="ltr">{formatMoney(usualFee)}</bdi> ₪. يمكنك تغييرها لكل مشترك في الجدول، و0 يعفيه منها.</p>
                            </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-(--ma-owe-s) px-4 py-3">
                            <p className="text-sm text-(--ma-ink)">
                                <b className="font-display"><bdi dir="ltr">{reached.length.toLocaleString('en')}</bdi></b> مشترك، إجمالي رسوم القطع المقدّرة
                            </p>
                            <p className="font-display text-2xl font-bold text-(--ma-owe)"><bdi dir="ltr">{formatMoney(totalFees(chosenFees))}</bdi> ₪</p>
                        </div>
                        <p className="text-xs leading-5 text-(--ma-muted)">
                            عند التأكيد تتحول خدمة كل مشترك إلى «مفصول» وتُحمَّل عليه رسوم قطع الخدمة المبيّنة مرة واحدة. إن تغيّرت حالة الخدمة بعد هذه المعاينة يُستثنى المشترك ويظهر في التقرير.
                        </p>
                        <label className="flex items-start gap-3 rounded-[14px] border border-(--ma-line) p-4 text-sm font-semibold text-(--ma-ink)">
                            <CheckBox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                            أؤكد أن قطع الخدمة قد نُفّذ فعليًا للمشتركين المحددين.
                        </label>
                        <InputError message={errors.confirmed} />
                        <InputError message={feeError(errors)} />
                        {!feesAreValid && <Notice tone="danger">أدخل رسوم القطع لكل مشترك (0 للإعفاء).</Notice>}
                        <HoldToConfirm count={reached.length} disabled={!confirmed || reached.length === 0 || !feesAreValid} busy={saving} onConfirm={() => submit()} label={`اضغط مع الاستمرار لتأكيد قطع ${reached.length.toLocaleString('en')} مشترك`} />
                    </div>
                )}

                <InputError message={errors.ids} />
            </form>
        </DialogFrame>
    );
}
