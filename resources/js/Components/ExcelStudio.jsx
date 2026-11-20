import CheckBox from '@/Components/CheckBox';
import { Button, Input } from '@heroui/react';
import { useEffect, useEffectEvent, useId, useMemo, useState } from 'react';
import { useHttp } from '@inertiajs/react';
import Modal from '@/Components/Modal';
import { DialogHeader } from '@/Components/DialogFrame';
import Icon from '@/Components/Icon';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import Switch from '@/Components/Switch';
import TextInput from '@/Components/TextInput';
import { buildWorkbookModel, COLUMN_WIDTH_RANGE, columnLetter, columnWidth, defaultExcelSettings, excelFileName, fitExcelSettings } from '@/lib/excelSheet';
import { Preview } from './ExcelPreview';
import { store, Section } from './ExcelStudioParts';
import ExcelCompanyTemplates from './ExcelCompanyTemplates';
import ExcelLookSection from './ExcelLookSection';

const LOOK = [
    ['header', 'العنوان والفرع والفترة أعلى الورقة'],
    ['totals', 'صف الإجمالي', 'ومجموع لكل مجموعة عند التجميع'],
    ['formulas', 'معادلات حيّة', 'الإجماليات SUBTOTAL تتحدّث عند التعديل أو التصفية في Excel'],
    ['freeze', 'تثبيت صف العناوين'],
    ['autofilter', 'فلتر على الأعمدة'],
    ['rtl', 'الورقة من اليمين إلى اليسار'],
    ['zebra', 'صفوف متناوبة اللون'],
    ['currency', 'رمز الشيكل في الخلايا', 'أوقفه إن كانت الأرقام ستُنقل إلى نظام محاسبي'],
    ['pageSetup', 'جاهز للطباعة من Excel', 'A4 بعرض الصفحة، وصف العناوين وترقيم الصفحات في كل صفحة'],
    ['criteria', 'ورقة «معايير التقرير»', 'الفرع والفترة والتصفية، ومن أعدّ الملف ومتى'],
];

/**
 * The Excel editor: the parts a page can export (see lib/excelSheet.js),
 * which of them the file holds, each part's columns and their order, how
 * its rows are grouped, the title and the file's name and look — beside a
 * preview of the sheets as Excel will show them — then a formatted .xlsx.
 * `loadParts` resolves the parts (a page may fetch rows for them); the
 * settings are kept per `storageKey`, with templates saved under names in
 * this browser, and the company's own templates (ExcelTemplateController)
 * under the same key — the default of which is where someone with no
 * settings of their own starts.
 */
export default function ExcelStudio({ show, onClose, title, storageKey, templateKind = storageKey, loadParts, defaults, meta = {} }) {
    const id = useId();
    const [parts, setParts] = useState(null);
    const [failed, setFailed] = useState(false);
    const [loadedRows, setLoadedRows] = useState(0);
    const [settings, setSettings] = useState(null);
    const [editing, setEditing] = useState(null);
    const [sheetIndex, setSheetIndex] = useState(0);
    const [activeCell, setActiveCell] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [templates, setTemplates] = useState([]);
    const [tab, setTab] = useState('settings');
    const [company, setCompany] = useState({ templates: [], canManage: false });
    const [companyName, setCompanyName] = useState('');
    const [companyDefault, setCompanyDefault] = useState(false);
    const listHttp = useHttp({});
    const saveHttp = useHttp({});

    // Each opening reads the rows and the saved settings afresh, with whatever the caller passes then.
    const loadWorkbook = useEffectEvent(() => {
        let cancelled = false;
        const controller = new AbortController();
        setParts(null);
        setFailed(false);
        setLoadedRows(0);
        setError('');
        setTemplates(store.read(`excel-templates:${storageKey}`, []));
        const companyTemplates = listHttp.get(`/excel-templates/${templateKind}`).catch(() => ({ templates: [], canManage: false }));
        Promise.all([loadParts({ signal: controller.signal, onProgress: setLoadedRows }), companyTemplates])
            .then(([loaded, shared]) => {
                if (cancelled) return;
                const base = defaultExcelSettings(loaded, defaults);
                const own = store.read(`excel-settings:${storageKey}`, null);
                setCompany(shared);
                setParts(loaded);
                setSettings(fitExcelSettings(own ?? shared.templates.find((template) => template.isDefault)?.settings ?? null, loaded, base));
                setEditing(loaded.find((part) => part.columns.length > 2)?.key ?? loaded[0]?.key ?? null);
                setSheetIndex(0);
                setActiveCell(null);
            })
            .catch(() => !cancelled && setFailed(true));

        return () => {
            cancelled = true;
            controller.abort();
        };
    });

    useEffect(() => {
        if (!show) {
            return undefined;
        }

        return loadWorkbook();
    }, [show]);

    const sheets = useMemo(() => (parts && settings ? buildWorkbookModel(parts, settings, meta) : []), [parts, settings, meta]);
    const sheet = sheets[Math.min(sheetIndex, Math.max(sheets.length - 1, 0))] ?? null;
    const firstFormula = useMemo(() => {
        for (const row of sheet?.rows ?? []) {
            const index = row.cells.findIndex((cell) => cell.f);
            if (index >= 0) return { address: `${columnLetter(index)}${row.row}`, formula: row.cells[index].f };
        }
        return null;
    }, [sheet]);
    const shownCell = activeCell ?? firstFormula;
    const part = parts?.find((candidate) => candidate.key === editing) ?? null;
    const partSettings = part ? settings.parts[part.key] : null;
    const fileName = settings ? excelFileName(settings.fileName) : '';

    const change = (patch) => setSettings((current) => ({ ...current, ...patch }));
    const changePart = (key, patch) => setSettings((current) => ({ ...current, parts: { ...current.parts, [key]: { ...current.parts[key], ...patch } } }));

    function moveColumn(index, step) {
        const columns = [...partSettings.columns];
        const target = index + step;
        if (target < 0 || target >= columns.length) return;
        [columns[index], columns[target]] = [columns[target], columns[index]];
        changePart(part.key, { columns });
    }

    function setColumnWidth(key, width) {
        changePart(part.key, { columns: partSettings.columns.map((candidate) => (candidate.key === key ? { ...candidate, width } : candidate)) });
    }

    /** The layout of a template laid over this export, keeping its own title and file name. */
    function applyTemplate(saved) {
        setSettings((current) => fitExcelSettings({ ...saved, title: current.title, fileName: current.fileName }, parts, { ...defaultExcelSettings(parts, defaults), title: current.title, fileName: current.fileName }));
    }

    /** The settings as a template keeps them: everything but this file's title and name. */
    function layout() {
        const { title: _title, fileName: _fileName, ...look } = settings;

        return look;
    }

    async function reloadCompany() {
        setCompany(await listHttp.get(`/excel-templates/${templateKind}`));
    }

    async function sendCompany(method, url, data) {
        saveHttp.clearErrors();
        saveHttp.transform(() => data);
        try {
            const response = await saveHttp[method](url);
            if (!response) return false;
            await reloadCompany();

            return true;
        } catch {
            return false;
        }
    }

    async function saveCompanyTemplate() {
        const name = companyName.trim();
        if (!name) return;
        if (await sendCompany('post', '/excel-templates', { kind: templateKind, name, is_default: companyDefault, settings: layout() })) {
            setCompanyName('');
            setCompanyDefault(false);
        }
    }

    function saveTemplate() {
        const name = templateName.trim();
        if (!name) return;
        const next = [...templates.filter((template) => template.name !== name), { name, settings: layout() }];
        setTemplates(next);
        store.write(`excel-templates:${storageKey}`, next);
        setTemplateName('');
    }

    function removeTemplate(name) {
        const next = templates.filter((template) => template.name !== name);
        setTemplates(next);
        store.write(`excel-templates:${storageKey}`, next);
    }

    async function download() {
        setSaving(true);
        setError('');
        try {
            const { workbookBlob, saveBlob } = await import('@/lib/excelWorkbook');
            saveBlob(await workbookBlob(sheets, settings), fileName);
            store.write(`excel-settings:${storageKey}`, layout());
            onClose();
        } catch {
            setError('تعذّر إنشاء الملف. تحقّق من الاتصال وأعد المحاولة.');
        } finally {
            setSaving(false);
        }
    }

    const rowsCount = sheets.reduce((total, current) => total + (current.key === 'criteria' ? 0 : current.count), 0);

    return (
        <Modal show={show} onClose={saving ? undefined : onClose} maxWidth="full" panelClassName="sm:max-w-[1280px]">
            <div data-excel-source="custom" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} dir="rtl" className="flex h-[min(92dvh,900px)] min-h-0 flex-col">
                <DialogHeader titleId={`${id}-title`} title={title} description="ملف ‎.xlsx منسّق: اختر الأجزاء والأعمدة والعنوان، وشاهد الورقة قبل التنزيل." icon="excel" tone="primary" onClose={onClose} closeDisabled={saving} />

                {failed ? (
                    <p role="alert" className="m-6 rounded-control bg-red-500/10 p-4 text-sm text-red-700">تعذّر تحميل بيانات التقرير. أغلق النافذة وأعد المحاولة.</p>
                ) : !parts || !settings ? (
                    <div className="flex flex-1 items-center justify-center p-10 text-sm text-gray-500" role="status">جارٍ تجهيز بيانات الجدول…{loadedRows > 0 && ` تم تحميل ${loadedRows.toLocaleString('en-US')} سجل`}</div>
                ) : (
                    <>
                        <div className="flex shrink-0 gap-1 border-b border-gray-100 p-2 lg:hidden" role="tablist">
                            {[['settings', 'الإعدادات'], ['preview', 'المعاينة']].map(([key, label]) => (
                                <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex-1 rounded-control px-3 py-2 text-sm font-semibold ${tab === key ? 'bg-brand-gradient text-white' : 'text-gray-600'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
                            <div className={`min-h-0 overflow-y-auto border-gray-100 px-5 pb-6 lg:block lg:border-e ${tab === 'settings' ? 'block' : 'hidden'}`}>
                                <Section title="ماذا يحوي الملف" hint={`${parts.filter((candidate) => settings.parts[candidate.key].on).length} من ${parts.length}`}>
                                    <ul className="space-y-1.5">
                                        {parts.map((candidate) => (
                                            <li key={candidate.key} className={`flex items-center gap-2 rounded-control border px-3 py-2 ${editing === candidate.key ? 'border-excel-500/50 bg-excel-500/5' : 'border-gray-100'}`}>
                                                <CheckBox checked={settings.parts[candidate.key].on} onChange={(event) => changePart(candidate.key, { on: event.target.checked })} aria-label={`تضمين ${candidate.name}`} />
                                                <Button className="flex min-w-0 flex-1 items-center justify-between gap-2 text-start text-sm" onClick={() => setEditing(candidate.key)}>
                                                    <span className="truncate font-semibold text-gray-900">{candidate.name}</span>
                                                    <span className="shrink-0 font-display text-xs text-gray-500">{candidate.rows.length.toLocaleString('en')} صف</span>
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </Section>

                                {part && (
                                    <Section title={`أعمدة «${part.name}»`} hint={`${partSettings.columns.filter((column) => column.on).length} من ${part.columns.length}`}>
                                        <ul className="overflow-hidden rounded-control border border-gray-100">
                                            {partSettings.columns.map((column, index) => {
                                                const definition = part.columns.find((candidate) => candidate.key === column.key);
                                                return (
                                                    <li key={column.key} className="flex items-center gap-2 border-b border-gray-100 px-3 py-1.5 last:border-b-0">
                                                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                                                            <CheckBox checked={column.on} onChange={() => changePart(part.key, { columns: partSettings.columns.map((candidate) => (candidate.key === column.key ? { ...candidate, on: !candidate.on } : candidate)) })} />
                                                            <span className="truncate">{definition.label}</span>
                                                            {definition.sum && <span className="text-xs text-gray-400">مجموع</span>}
                                                        </label>
                                                        <Input
                                                            type="number"
                                                            min={COLUMN_WIDTH_RANGE[0]}
                                                            max={COLUMN_WIDTH_RANGE[1]}
                                                            value={columnWidth(definition, partSettings)}
                                                            onChange={(event) => setColumnWidth(column.key, event.target.value === '' ? undefined : Number(event.target.value))}
                                                            className="w-14 rounded-md border-gray-200 px-1.5 py-0.5 text-center font-display text-xs"
                                                            aria-label={`عرض عمود ${definition.label}`}
                                                            title="عرض العمود بالأحرف"
                                                        />
                                                        <Button onClick={() => moveColumn(index, -1)} isDisabled={index === 0} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label={`نقل ${definition.label} للأعلى`}><Icon name="arrow-up" className="h-4 w-4" /></Button>
                                                        <Button onClick={() => moveColumn(index, 1)} isDisabled={index === partSettings.columns.length - 1} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label={`نقل ${definition.label} للأسفل`}><Icon name="arrow-down" className="h-4 w-4" /></Button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                            <span>الرقم بجانب كل عمود: عرضه بالأحرف ({COLUMN_WIDTH_RANGE[0]}–{COLUMN_WIDTH_RANGE[1]}).</span>
                                            {partSettings.columns.some((column) => column.width !== undefined) && (
                                                <Button className="font-semibold text-gray-700 hover:text-gray-900" onClick={() => changePart(part.key, { columns: partSettings.columns.map(({ width: _width, ...column }) => column) })}>
                                                    العرض الافتراضي
                                                </Button>
                                            )}
                                        </div>
                                        {(part.groupBys ?? []).length > 0 && (
                                            <label className="mt-3 block text-sm font-semibold text-gray-700">
                                                تجميع الصفوف حسب
                                                <select className="mt-1.5 block w-full rounded-control border-gray-200 text-sm" value={partSettings.groupBy} onChange={(event) => changePart(part.key, { groupBy: event.target.value })}>
                                                    <option value="">بدون تجميع</option>
                                                    {part.groupBys.map((group) => (
                                                        <option key={group.key} value={group.key}>{group.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                    </Section>
                                )}

                                <Section title="العنوان والملف">
                                    <label className="block text-sm font-semibold text-gray-700">
                                        عنوان الملف (أول سطر في كل ورقة)
                                        <TextInput className="mt-1.5 w-full" value={settings.title} onChange={(event) => change({ title: event.target.value })} />
                                    </label>
                                    <label className="mt-3 block text-sm font-semibold text-gray-700">
                                        اسم الملف
                                        <TextInput className="mt-1.5 w-full font-display text-sm" dir="auto" value={settings.fileName} onChange={(event) => change({ fileName: event.target.value })} />
                                    </label>
                                </Section>

                                <ExcelLookSection change={change} settings={settings} />

                                <Section title="الشكل داخل Excel">
                                    <div className="space-y-3">
                                        {LOOK.map(([key, label, hint]) => (
                                            <div key={key}>
                                                <Switch checked={Boolean(settings[key])} onChange={(value) => change({ [key]: value })} label={label} hint={hint} />
                                            </div>
                                        ))}
                                    </div>
                                </Section>

                                <ExcelCompanyTemplates
                                            saveCompanyTemplate={saveCompanyTemplate}
                                            sendCompany={sendCompany}
                                    applyTemplate={applyTemplate}
                                    company={company}
                                    companyDefault={companyDefault}
                                    companyName={companyName}
                                    layout={layout}
                                    saveHttp={saveHttp}
                                    setCompanyDefault={setCompanyDefault}
                                    setCompanyName={setCompanyName}
                                />

                                <Section title="قوالبي" hint="تُحفظ في هذا المتصفح">
                                    {templates.length > 0 && (
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            {templates.map((template) => (
                                                <span key={template.name} className="inline-flex items-center gap-1 rounded-control border border-gray-200 bg-surface ps-3 text-sm font-semibold">
                                                    <Button className="py-1.5" onClick={() => applyTemplate(template.settings)}>{template.name}</Button>
                                                    <Button className="rounded p-1.5 text-gray-400 hover:text-red-600" onClick={() => removeTemplate(template.name)} aria-label={`حذف القالب ${template.name}`}><Icon name="close" className="h-3.5 w-3.5" /></Button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <TextInput className="min-w-0 flex-1 text-sm" placeholder="اسم القالب، مثلاً: نسخة المحاسب" value={templateName} onChange={(event) => setTemplateName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveTemplate()} aria-label="اسم القالب" />
                                        <SecondaryButton onClick={saveTemplate} disabled={!templateName.trim()}>حفظ</SecondaryButton>
                                    </div>
                                </Section>
                            </div>

                            <div className={`min-h-0 flex-col bg-gray-50 p-4 lg:flex ${tab === 'preview' ? 'flex' : 'hidden'}`}>
                                <Preview sheet={sheet} sheets={sheets} sheetIndex={sheetIndex} onSheet={(index) => { setSheetIndex(index); setActiveCell(null); }} shownCell={shownCell} onCell={setActiveCell} settings={settings} />
                            </div>
                        </div>
                    </>
                )}

                <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <div className="min-w-0 basis-full text-sm text-gray-500 sm:flex-1 sm:basis-0">
                        {settings && parts && (
                            <>
                                <bdi className="block truncate font-display font-bold text-gray-900">{fileName}</bdi>
                                <span className="block">{sheets.length} {sheets.length === 1 ? 'ورقة' : sheets.length === 2 ? 'ورقتان' : 'أوراق'}، {rowsCount.toLocaleString('en')} صف</span>
                            </>
                        )}
                        {error && <span role="alert" className="block text-red-700">{error}</span>}
                    </div>
                    <SecondaryButton onClick={onClose} disabled={saving}>إلغاء</SecondaryButton>
                    <PrimaryButton type="button" onClick={download} disabled={saving || !sheets.length}>
                        <Icon name="arrow-down-tray" className="h-4 w-4" />
                        {saving ? 'جارٍ إنشاء الملف…' : 'تنزيل ملف Excel'}
                    </PrimaryButton>
                </footer>
            </div>
        </Modal>
    );
}
