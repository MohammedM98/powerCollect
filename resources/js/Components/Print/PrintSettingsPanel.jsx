import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import ChoiceSelect from '@/Components/UI/ChoiceSelect';
import { Input } from '@heroui/react';
import { useState } from 'react';
import ChoiceChips from '@/Components/UI/ChoiceChips';
import Switch from '@/Components/UI/Switch';
import Notice from '@/Components/UI/Notice';
import ConfirmDialog from '@/Components/UI/ConfirmDialog';
import { PAPER_SIZES, applyPrintPreset } from '@/lib/printLayout';
import { FOCUS_RING, ORIENTATIONS, DENSITIES, BORDERS, ACCENTS } from './printSettingsOptions';
import { Section, Field, Group, FontField, NumberField, Highlights } from './PrintSettingsFields';
import { TemplatesSection } from './PrintTemplatesSection';
import PrintFooterSection from './PrintFooterSection';
import PrintSortSection from './PrintSortSection';
import PrintColumnsSection from './PrintColumnsSection';
import PrintHeaderSection from './PrintHeaderSection';

/**
 * Every setting of the printout, in folding sections: templates, which
 * rows, the paper, the heading, the columns (shown, named, ordered,
 * aligned, totalled), sorting and grouping, the table's look and the
 * footer. Each change shows
 * in the preview at once.
 */
export default function PrintSettingsPanel({ layout, onChange, scope, templates, onReset, readOnly = false, reportFields = [], reportFieldsTitle = 'بيانات الصندوق' }) {
    const [columnSearch, setColumnSearch] = useState('');
    const [confirming, setConfirming] = useState(null);
    const rows = <Section icon="list" title="الصفوف" open>
        <fieldset disabled={scope.loading}>
        {scope.allRowsOnly ? <p className="text-sm font-semibold text-(--ma-ink)">كل الصفوف المطابقة للتصفية ({scope.total})</p> : <ChoiceChips
            options={[
                { value: 'all', label: `كل النتائج${!scope.selected && typeof scope.total === 'number' ? ` (${scope.total.toLocaleString('en')})` : ''}`, icon: 'list' },
                { value: 'page', label: 'الصفحة المعروضة فقط', icon: 'table' },
                ...(scope.hasSelection ? [{ value: 'selected', label: 'العناصر المحددة', icon: 'check' }] : []),
            ]}
            value={scope.selected ? 'selected' : scope.allRows ? 'all' : 'page'}
            onChange={(value) => scope.onChange(value === 'selected' ? 'selected' : value === 'all')}
            label="الصفوف المطبوعة"
        />}
        </fieldset>
        <p className="text-xs text-(--ma-muted)">بنفس البحث والترتيب والفلاتر التي كانت على الشاشة.</p>
    </Section>;

    if (readOnly) {
        return <div>
            <Notice role="note" className="m-6" title="تطبع بقوالب الشركة المحفوظة.">
                اختر القالب من أعلى الصفحة. تغيير الأعمدة والترتيب والشكل يحتاج صلاحية «تخصيص الطباعة».
            </Notice>
            {rows}
        </div>;
    }

    function set(key, value) {
        onChange({ ...layout, [key]: value });
    }

    function setIn(group, key, value) {
        onChange({ ...layout, [group]: { ...layout[group], [key]: value } });
    }

    function setColumn(index, changes) {
        set(
            'columns',
            layout.columns.map((column, position) => (position === index ? { ...column, ...changes } : column)),
        );
    }

    function setSignature(index, label) {
        setIn(
            'footer',
            'signatures',
            layout.footer.signatures.map((item, position) => (position === index ? label : item)),
        );
    }

    function setSortLevel(index, changes) {
        set(
            'sort',
            layout.sort.map((level, position) => (position === index ? { ...level, ...changes } : level)),
        );
    }

    const shownCount = layout.columns.filter((column) => column.visible).length;
    const fieldOptions = layout.columns.filter((column) => !column.key.startsWith('blank:')).map((column) => (
        <option key={column.key} value={column.key}>
            {column.label}
        </option>
    ));

    return (
        <div>
            <TemplatesSection templates={templates} onReset={() => setConfirming('reset')} onPreset={(id) => {
                onChange(applyPrintPreset(layout, id));
                templates.actions.startNew?.();
            }} />

            {rows}

            {reportFields.length > 0 && <Section icon="wallet" title={reportFieldsTitle}>
                {reportFields.map((field) => <Switch key={field.key} label={field.label} checked={!layout.header.reportFields || layout.header.reportFields.includes(field.key)} onChange={(visible) => {
                    const selected = layout.header.reportFields ?? reportFields.map((item) => item.key);
                    setIn('header', 'reportFields', visible ? [...selected, field.key] : selected.filter((key) => key !== field.key));
                }} />)}
            </Section>}

            <Section icon="document" title="الورق">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="حجم الورق">
                        {(id) => (
                            <ChoiceSelect id={id} value={layout.paper} onChange={(e) => set('paper', e.target.value)} className="block w-full text-sm">
                                {Object.entries(PAPER_SIZES).map(([value, paper]) => (
                                    <option key={value} value={value}>
                                        {paper.label} ({paper.width}×{paper.height} مم)
                                    </option>
                                ))}
                            </ChoiceSelect>
                        )}
                    </Field>
                    <Field label="الهوامش (مم)">
                        {(id) => (
                            <Input
                                id={id}
                                type="number"
                                min="0"
                                max="40"
                                value={layout.margin}
                                onChange={(e) => set('margin', Number(e.target.value))}
                                className="block w-full text-sm"
                            />
                        )}
                    </Field>
                </div>
                <Group label="اتجاه الورقة">
                    <ChoiceChips options={ORIENTATIONS} value={layout.orientation} onChange={(value) => set('orientation', value)} label="اتجاه الورقة" />
                </Group>
                <FontField label="خط محتوى التقرير" value={layout.fontFamily} onChange={(value) => set('fontFamily', value)} />
                <NumberField label="تباعد أسطر التقرير" value={layout.lineHeight ?? 1.5} min={1} max={2.5} step={0.1} onChange={(value) => set('lineHeight', value)} />
                <Field label={`حجم الخط: ${layout.fontSize} بكسل`}>
                    {(id) => (
                        <input
                            id={id}
                            type="range"
                            min="8"
                            max="18"
                            value={layout.fontSize}
                            onChange={(e) => set('fontSize', Number(e.target.value))}
                            className="w-full accent-(--ma-brand)"
                        />
                    )}
                </Field>
                <Group label="المسافة بين الصفوف">
                    <ChoiceChips options={DENSITIES} value={layout.density} onChange={(value) => set('density', value)} label="المسافة بين الصفوف" />
                </Group>
            </Section>

            <PrintHeaderSection layout={layout} setIn={setIn} />

            <PrintColumnsSection
                columnSearch={columnSearch}
                layout={layout}
                set={set}
                setColumn={setColumn}
                setColumnSearch={setColumnSearch}
                shownCount={shownCount}
            />

            <PrintSortSection fieldOptions={fieldOptions} layout={layout} onChange={onChange} set={set} setIn={setIn} setSortLevel={setSortLevel} />

            <Section icon="swatch" title="شكل الجدول">
                <Group label="خطوط الجدول">
                    <ChoiceChips options={BORDERS} value={layout.table.borders} onChange={(value) => setIn('table', 'borders', value)} label="خطوط الجدول" />
                </Group>
                <Group label="اللون الأساسي (العنوان ورأس الجدول)">
                    <div className="flex flex-wrap items-center gap-2">
                        <ToggleButtonGroup aria-label="اللون الأساسي" selectionMode="single" selectedKeys={ACCENTS.filter((accent) => accent.value.toLowerCase() === layout.table.accent.toLowerCase()).map((accent) => accent.value)} onSelectionChange={(keys) => { const [next] = keys; if (next !== undefined) { setIn('table', 'accent', String(next)); } }} className="flex flex-wrap items-center gap-2">
                        {ACCENTS.map((accent) => (
                            <ToggleButton
                                key={accent.value}
                                id={accent.value}
                                aria-label={accent.label}
                                className={`h-8 w-8 rounded-full border-2 ${
                                    layout.table.accent.toLowerCase() === accent.value.toLowerCase() ? 'border-(--ma-ink) ring-2 ring-(--ma-solid) ring-offset-2 ring-offset-(--ma-ink)' : 'border-(--ma-solid) shadow-sm'
                                } ${FOCUS_RING}`}
                                style={{ backgroundColor: accent.value }}
                            />
                        ))}
                        </ToggleButtonGroup>
                        <label className="flex items-center gap-2 text-xs text-(--ma-muted)">
                            لون آخر
                            <input
                                type="color"
                                value={layout.table.accent}
                                onChange={(e) => setIn('table', 'accent', e.target.value)}
                                className="h-8 w-10 cursor-pointer rounded border border-(--ma-line) p-1"
                            />
                        </label>
                    </div>
                </Group>
                <div className="grid grid-cols-1 gap-3">
                    <Switch checked={layout.table.headerShade} onChange={(value) => setIn('table', 'headerShade', value)} label="تظليل رأس الجدول" />
                    <Switch checked={layout.table.zebra} onChange={(value) => setIn('table', 'zebra', value)} label="تلوين الصفوف بالتناوب" />
                    <Switch checked={layout.table.rowNumbers} onChange={(value) => setIn('table', 'rowNumbers', value)} label="ترقيم الصفوف (#)" />
                    <Switch checked={layout.table.wrap} onChange={(value) => setIn('table', 'wrap', value)} label="التفاف النص الطويل في الخلايا" />
                </div>
                <Highlights rules={layout.table.highlights ?? []} columns={layout.columns.filter((column) => !column.key.startsWith('blank:'))} onChange={(rules) => setIn('table', 'highlights', rules)} />
            </Section>

            <PrintFooterSection layout={layout} setIn={setIn} setSignature={setSignature} />

            <Section icon="layers" title="العلامة المائية">
                <p className="text-xs text-(--ma-muted)">نص أو شعار خفيف خلف الجدول يتكرر على كل صفحة، مثل «نسخة القارئ» أو «مسودة».</p>
                <Switch checked={Boolean(layout.watermark?.enabled)} onChange={(value) => setIn('watermark', 'enabled', value)} label="إظهار العلامة المائية" />
                {layout.watermark?.enabled && <>
                    <Field label="نص العلامة المائية">
                        {(id) => <Input id={id} type="text" maxLength={60} value={layout.watermark.text ?? ''} onChange={(event) => setIn('watermark', 'text', event.target.value)} placeholder="مثلًا: نسخة القارئ" className="block w-full text-sm" />}
                    </Field>
                    <Switch checked={Boolean(layout.watermark.logo)} onChange={(value) => setIn('watermark', 'logo', value)} label="إظهار شعار الشركة في العلامة المائية" />
                    <Field label={`وضوح العلامة المائية: ${Math.round((layout.watermark.opacity ?? 0.08) * 100)}%`}>
                        {(id) => <input id={id} type="range" min="0.02" max="0.3" step="0.01" value={layout.watermark.opacity ?? 0.08} onChange={(event) => setIn('watermark', 'opacity', Number(event.target.value))} className="w-full accent-(--ma-brand)" />}
                    </Field>
                </>}
            </Section>

            <ConfirmDialog
                show={confirming === 'reset'}
                onConfirm={() => {
                    onReset();
                    setConfirming(null);
                }}
                onCancel={() => setConfirming(null)}
                title="إرجاع الإعدادات إلى الأصل؟"
                message="ستعود كل الأعمدة والترويسة والشكل كما كانت أول مرة. القوالب المحفوظة تبقى كما هي."
                confirmLabel="نعم، أرجعها"
                icon="undo"
                tone="danger"
            />
        </div>
    );
}
