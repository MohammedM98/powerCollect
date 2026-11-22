import { TextArea } from '@heroui/react';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useForm, useHttp } from '@inertiajs/react';
import DialogFrame from '@/Components/UI/DialogFrame';
import Icon from '@/Components/UI/Icon';
import FormField from '@/Components/Form/FormField';
import ChoiceChips from '@/Components/UI/ChoiceChips';
import InputError from '@/Components/UI/InputError';
import CompanyFormPaper from './CompanyFormPaper';
import useCompanySource from './useCompanySource';
import DateInput from '@/Components/UI/DateInput';
import { Notice, PrimaryKey, SearchableSelect, SecondaryKey, TextInput } from '@/Components/UI';

const MODE_OPTIONS = [{ value: 'blank', label: 'نموذج فارغ', icon: 'document' }, { value: 'filled', label: 'نسخة معبأة', icon: 'user' }];
const ARCHIVE_LAYOUT = { paper: 'A4', orientation: 'portrait', margin: 16, fontSize: 15, header: { enabled: false }, watermark: { enabled: false }, footer: '', pages: [{ id: 'archive', blocks: [] }], overlays: [] };

export default function IssueModal({ templateId = null, mode = 'blank', onClose }) {
    const archive = mode === 'archive';
    const form = useForm({ operation_id: crypto.randomUUID(), company_form_template_id: templateId, template_version: null, mode, subscription_id: null, values: {}, title: '', paper_reference: '', paper_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hebron' }).format(new Date()), notes: '', attachment: null });
    const { data, setData, errors, processing } = form;
    const [loaded, setLoaded] = useState(null);
    const [setupError, setSetupError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [contextLoading, setContextLoading] = useState(false);
    const [contextError, setContextError] = useState('');
    const [objectUrl, setObjectUrl] = useState('');
    const [fileError, setFileError] = useState('');
    const [overflow, setOverflow] = useState({});
    const fileInput = useRef(null);
    const setupHttp = useHttp();
    const contextHttp = useHttp();
    const lookupHttp = useHttp();
    const setupRef = useRef(setupHttp); setupRef.current = setupHttp;
    const contextRef = useRef(contextHttp); contextRef.current = contextHttp;
    const lookupRef = useRef(lookupHttp); lookupRef.current = lookupHttp;
    const source = archive ? (data.attachment && objectUrl ? { url: objectUrl, name: data.attachment.name, mime: data.attachment.type || (data.attachment.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png') } : null) : loaded?.template.source;
    const sourceState = useCompanySource(source);
    const layout = archive ? ARCHIVE_LAYOUT : loaded?.template.layout;
    const onOverflow = useCallback((index, value) => setOverflow((old) => old[index] === value ? old : { ...old, [index]: value }), []);
    const loadSubscriptions = useCallback(async (search) => {
        const response = await lookupRef.current.get(`/company-forms/subscriptions?${new URLSearchParams({ search })}`);
        return { options: response.options, hasMore: response.options.length === 15 };
    }, []);

    const fillForm = useEffectEvent((...change) => setData(...change));

    useEffect(() => {
        if (!templateId) return undefined;
        let active = true; const client = setupRef.current;
        setSetupError('');
        client.get(`/company-forms/${templateId}`).then((response) => {
            if (!active) return;
            setLoaded(response); fillForm((old) => ({ ...old, template_version: response.template.version, values: response.values ?? {} }));
        }).catch(() => { if (active) setSetupError('تعذّر تحميل النموذج. أعد المحاولة.'); });
        return () => { active = false; client.cancel(); };
    }, [templateId, attempt]);
    useEffect(() => {
        if (!data.subscription_id) { setContextLoading(false); setContextError(''); return undefined; }
        let active = true; const client = contextRef.current;
        setContextLoading(true); setContextError('');
        client.get(`/company-forms/subscriptions?id=${data.subscription_id}`).then((response) => {
            if (active) fillForm('values', response.values);
        }).catch(() => { if (active) setContextError('تعذّر تحميل بيانات الاشتراك. اختره مجددًا قبل الإصدار.'); })
            .finally(() => { if (active) setContextLoading(false); });
        return () => { active = false; client.cancel(); };
    }, [data.subscription_id]);
    useEffect(() => {
        if (!data.attachment) { setObjectUrl(''); return undefined; }
        const url = URL.createObjectURL(data.attachment); setObjectUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [data.attachment]);

    function selectAttachment(file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024 || !/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) { setFileError('اختر PDF أو صورة بحجم 10 ميجابايت أو أقل.'); return; }
        setFileError(''); setData('attachment', file);
    }
    function changeMode(next) {
        if (next === data.mode) return;
        setData({ ...data, mode: next, subscription_id: null, values: next === 'blank' ? {} : loaded?.values ?? {} });
    }
    const ready = (archive ? Boolean(data.attachment && objectUrl) : Boolean(loaded)) && !sourceState.loading && !sourceState.error && !contextLoading && !contextError && !Object.values(overflow).some(Boolean);
    function submit(event) {
        event.preventDefault();
        if (!ready || processing) return;
        form.post('/company-documents', { forceFormData: true, preserveScroll: true });
    }
    const pages = source?.url ? sourceState.pages : layout?.pages.map(() => null) ?? [];

    const footer = (
        <>
            <SecondaryKey disabled={processing} onClick={onClose}>إلغاء</SecondaryKey>
            <PrimaryKey type="submit" form="company-issue-form" disabled={!ready || processing}>
                <Icon name={archive ? 'check' : 'printer'} className="h-4 w-4" />
                {processing ? 'جارٍ الحفظ…' : archive ? 'حفظ الطلب الورقي' : 'حفظ النسخة وفتح الطباعة'}
            </PrimaryKey>
        </>
    );

    return (
        <DialogFrame
            show
            onClose={onClose}
            title={archive ? 'أرشفة طلب ورقي' : loaded?.template.name ?? 'تجهيز النموذج'}
            description={archive ? 'حفظ الورقة بعد إدخالها يدويًا، مع رقمها وتاريخها.' : 'راجع النسخة قبل حفظها وفتح الطباعة.'}
            icon={archive ? 'history' : 'printer'}
            maxWidth="6xl"
            busy={processing}
            footer={footer}
        >
            <form id="company-issue-form" onSubmit={submit}>
                {setupError ? (
                    <Notice tone="danger" role="alert">
                        <p>{setupError}</p>
                        <SecondaryKey className="mt-2" onClick={() => setAttempt((old) => old + 1)}>إعادة المحاولة</SecondaryKey>
                    </Notice>
                ) : !archive && !loaded ? (
                    <div role="status" className="animate-pulse rounded-[18px] bg-(--ma-tile) p-8 text-center text-(--ma-muted)">جارٍ تحميل النموذج…</div>
                ) : (
                    <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
                        <div className="flex flex-col gap-6">
                            {!archive && <ChoiceChips label="طريقة تعبئة النموذج" options={MODE_OPTIONS} value={data.mode} onChange={changeMode} disabled={processing} />}
                            {data.mode === 'blank' && <Notice>تُطبع الترويسة والنصوص الثابتة، وتبقى بيانات المشترك والتوقيعات فارغة للتعبئة اليدوية.</Notice>}
                            {(archive || data.mode === 'filled') && <FormField id="company-issue-subscription" label="الاشتراك" hint="يمكنك تعبئة نموذج لشخص لم يُسجّل بعد."><SearchableSelect value={data.subscription_id ?? ''} options={[]} loadOptions={loadSubscriptions} onChange={(next) => setData({ ...data, subscription_id: next || null, values: next ? {} : loaded?.values ?? {} })} placeholder="ابحث واختر الاشتراك" disabled={processing} /></FormField>}
                            {contextLoading && <p role="status" className="text-sm text-(--ma-muted)">جارٍ تعبئة بيانات الاشتراك…</p>}
                            <InputError message={contextError} />
                            {data.mode === 'filled' && !contextLoading && (
                                <>
                                    <p className="text-xs text-(--ma-muted)">تعديل هذه القيم يخص المستند فقط، وتبقى بيانات المشترك في النظام كما هي.</p>
                                    {loaded.fields.map((field) => <FormField key={field.key} id={`company-value-${field.key}`} label={field.label}><TextInput value={data.values[field.key] ?? ''} onChange={(event) => setData('values', { ...data.values, [field.key]: event.target.value })} className="w-full" maxLength={3000} disabled={processing} /></FormField>)}
                                </>
                            )}
                            {archive && (
                                <>
                                    <FormField id="company-archive-title" label="عنوان المستند" required error={errors.title}><TextInput value={data.title} onChange={(event) => setData('title', event.target.value)} className="w-full" maxLength={150} required /></FormField>
                                    <FormField id="company-paper-reference" label="رقم الطلب الورقي" required error={errors.paper_reference}><TextInput value={data.paper_reference} onChange={(event) => setData('paper_reference', event.target.value)} className="w-full" maxLength={100} required /></FormField>
                                    <FormField id="company-paper-date" label="تاريخ الطلب الورقي" required error={errors.paper_date}><DateInput name="paper_date" value={data.paper_date} onChange={(value) => setData('paper_date', value)} required /></FormField>
                                    <input ref={fileInput} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => { selectAttachment(event.target.files?.[0]); event.target.value = ''; }} />
                                    <SecondaryKey onClick={() => fileInput.current.click()}><Icon name="document-plus" className="h-4 w-4" />{data.attachment ? 'استبدال الملف' : 'اختيار صورة الطلب أو PDF'}</SecondaryKey>
                                    <p className="wrap-break-word text-xs text-(--ma-muted)">{data.attachment?.name ?? 'حتى 10 ميجابايت و10 صفحات.'}</p>
                                    <InputError message={errors.attachment || fileError} />
                                </>
                            )}
                            <FormField id="company-document-notes" label="ملاحظات داخلية" error={errors.notes}><TextArea value={data.notes} onChange={(event) => setData('notes', event.target.value)} className="w-full" rows={3} maxLength={2000} /></FormField>
                            {Object.entries(errors).filter(([key]) => !['notes', 'title', 'paper_reference', 'paper_date', 'attachment'].includes(key)).map(([key, message]) => <InputError key={key} message={message} />)}
                        </div>
                        <div className="min-w-0 space-y-4 rounded-[18px] bg-(--ma-tile) p-3 shadow-(--ma-hl) sm:p-6">
                            <h3 className="text-base font-bold text-(--ma-ink)">معاينة النسخة</h3>
                            {sourceState.loading ? <p role="status" className="py-8 text-center text-sm text-(--ma-muted)">جارٍ تجهيز الصفحات…</p> : sourceState.error ? <Notice tone="danger" role="alert">{sourceState.error}</Notice> : archive && !source ? <p className="py-8 text-center text-sm text-(--ma-muted)">اختر الملف لمعاينة الورقة.</p> : pages.map((sourcePage, index) => <CompanyFormPaper key={index} layout={layout} page={layout.pages[index]} sourcePage={sourcePage} pageIndex={index} blank={data.mode === 'blank'} values={data.values} onOverflow={onOverflow} />)}
                            {Object.values(overflow).some(Boolean) && <Notice tone="warn" role="alert">المحتوى يتجاوز حدود الورقة. عدّل النموذج أو قصّر القيم قبل إصدار النسخة.</Notice>}
                        </div>
                    </div>
                )}
            </form>
        </DialogFrame>
    );
}
