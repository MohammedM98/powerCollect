import ChoiceSelect from '@/Components/ChoiceSelect';
import { Input } from '@heroui/react';
import Icon from '@/Components/Icon';
import ChoiceChips from '@/Components/ChoiceChips';
import Switch from '@/Components/Switch';
import SecondaryButton from '@/Components/SecondaryButton';
import { DIRECTIONS, GROUP_HEADINGS, GROUP_ALIGNMENTS } from './printSettingsOptions';
import { Section, Field, Group, NumberField, HeadingStyles, IconButton } from './PrintSettingsFields';

/** How the printed rows are ordered and grouped: the sort levels, the group headings and their totals. */
export default function PrintSortSection({ fieldOptions, layout, onChange, set, setIn, setSortLevel }) {
    return (
        <Section icon="sort" title="الترتيب والتجميع" open>
            <p className="text-xs text-gray-500">رتّب الصفوف بأي حقل ولو كان مخفيًا، وجمّعها مثلًا حسب الطبلون. بدون ترتيب تبقى بترتيب الجدول.</p>
            <Field label="تجميع الصفوف حسب">
                {(id) => (
                    <ChoiceSelect
                        id={id}
                        value={layout.group.key}
                        onChange={(event) =>
                            set('group', {
                                ...layout.group,
                                key: event.target.value,
                                then: (layout.group.then ?? []).filter((key) => key !== event.target.value),
                            })
                        }
                        className="block w-full text-sm"
                    >
                        <option value="">بدون تجميع</option>
                        {fieldOptions}
                    </ChoiceSelect>
                )}
            </Field>
            {layout.group.key !== '' && (
                <div className="grid grid-cols-1 gap-3">
                    {(layout.group.then ?? []).map((key, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">ثم حسب</span>
                            <ChoiceSelect
                                aria-label={`التجميع الإضافي ${index + 1}`}
                                value={key}
                                onChange={(event) =>
                                    setIn(
                                        'group',
                                        'then',
                                        layout.group.then.map((value, position) => (position === index ? event.target.value : value)),
                                    )
                                }
                                className="min-w-0 flex-1 text-sm"
                            >
                                {layout.columns
                                    .filter(
                                        (column) =>
                                            column.key !== layout.group.key &&
                                            !(layout.group.then ?? []).some((value, position) => value === column.key && position !== index) &&
                                            !column.key.startsWith('blank:'),
                                    )
                                    .map((column) => (
                                        <option key={column.key} value={column.key}>
                                            {column.label}
                                        </option>
                                    ))}
                            </ChoiceSelect>
                            <IconButton
                                icon="trash"
                                label={`حذف التجميع ${index + 1}`}
                                onClick={() =>
                                    setIn(
                                        'group',
                                        'then',
                                        layout.group.then.filter((_, position) => position !== index),
                                    )
                                }
                            />
                        </div>
                    ))}
                    {(layout.group.then ?? []).length < 2 && (
                        <SecondaryButton
                            onClick={() => {
                                const next = layout.columns.find(
                                    (column) =>
                                        column.key !== layout.group.key &&
                                        !(layout.group.then ?? []).includes(column.key) &&
                                        !column.key.startsWith('blank:'),
                                );
                                if (next) setIn('group', 'then', [...(layout.group.then ?? []), next.key]);
                            }}
                        >
                            إضافة مستوى تجميع
                        </SecondaryButton>
                    )}
                    <Field
                        label="عناوين المجموعات"
                        hint={
                            (layout.group.then ?? []).length > 0
                                ? 'سطر لكل مستوى: يُكتب كل مستوى في سطر خاص عند تغيّره، مثل المنطقة ثم الطبلون تحتها.'
                                : undefined
                        }
                    >
                        {(id) => (
                            <ChoiceChips
                                id={id}
                                options={GROUP_HEADINGS}
                                value={layout.group.headings ?? 'inline'}
                                onChange={(value) => setIn('group', 'headings', value)}
                                label="عناوين المجموعات"
                            />
                        )}
                    </Field>
                    <Field label="محاذاة عناوين المجموعات">
                        {(id) => (
                            <ChoiceChips
                                id={id}
                                options={GROUP_ALIGNMENTS}
                                value={layout.group.align ?? 'start'}
                                onChange={(value) => setIn('group', 'align', value)}
                                label="محاذاة عناوين المجموعات"
                            />
                        )}
                    </Field>
                    <Switch
                        checked={layout.group.labels !== false}
                        onChange={(value) => setIn('group', 'labels', value)}
                        label="كتابة اسم الحقل قبل القيمة (مثل «الطبلون:»)"
                    />
                    <Switch
                        checked={Boolean(layout.group.repeatHeader)}
                        onChange={(value) => setIn('group', 'repeatHeader', value)}
                        label="تكرار عناوين الأعمدة تحت عنوان كل مجموعة (مثل كل طبلون)"
                    />
                    <Field label="كلمة بعد عدد الصفوف في العنوان" hint="مثل «مشترك» لتظهر «(12 مشترك)». اتركها فارغة ليظهر العدد وحده.">
                        {(id) => (
                            <Input
                                id={id}
                                type="text"
                                maxLength={30}
                                value={layout.group.unit ?? ''}
                                onChange={(e) => setIn('group', 'unit', e.target.value)}
                                className="block w-full text-sm"
                            />
                        )}
                    </Field>
                    <Switch
                        checked={Boolean(layout.group.restartNumbers)}
                        onChange={(value) =>
                            onChange({
                                ...layout,
                                group: { ...layout.group, restartNumbers: value },
                                table: value ? { ...layout.table, rowNumbers: true } : layout.table,
                            })
                        }
                        label="بدء ترقيم الصفوف (#) من 1 في كل مجموعة"
                    />
                    <Switch
                        checked={layout.group.showCount !== false}
                        onChange={(value) => setIn('group', 'showCount', value)}
                        label="إظهار العدد في عناوين المجموعات"
                    />
                    <Switch
                        checked={Boolean(layout.group.keepTogether)}
                        onChange={(value) => setIn('group', 'keepTogether', value)}
                        label="إبقاء المجموعة كاملة في صفحة واحدة إن اتسعت لها"
                    />
                    <NumberField
                        label="أسطر فارغة بعد كل مجموعة (للكتابة باليد)"
                        value={layout.group.blankRows ?? 0}
                        min={0}
                        max={10}
                        onChange={(value) => setIn('group', 'blankRows', value)}
                    />
                    <Switch checked={layout.group.newPage} onChange={(value) => setIn('group', 'newPage', value)} label="كل مجموعة في صفحة جديدة" />
                    {layout.group.newPage && (layout.group.then ?? []).length > 0 && (
                        <Group label="متى تبدأ صفحة جديدة">
                            <ChoiceChips
                                options={[
                                    {
                                        value: 'top',
                                        label: `عند تغيّر ${layout.columns.find((column) => column.key === layout.group.key)?.label ?? 'المستوى الأول'}`,
                                    },
                                    { value: 'every', label: 'لكل مجموعة' },
                                ]}
                                value={layout.group.newPageAt ?? 'top'}
                                onChange={(value) => setIn('group', 'newPageAt', value)}
                                label="متى تبدأ صفحة جديدة"
                            />
                        </Group>
                    )}
                    <HeadingStyles
                        levels={[layout.group.key, ...(layout.group.then ?? [])].map(
                            (key) => layout.columns.find((column) => column.key === key)?.label ?? key,
                        )}
                        styles={layout.group.styles ?? []}
                        onChange={(styles) => setIn('group', 'styles', styles)}
                    />
                    <Switch
                        checked={layout.group.subtotals}
                        onChange={(value) => setIn('group', 'subtotals', value)}
                        label="مجموع فرعي لكل مجموعة (للأعمدة ذات المجموع)"
                    />
                </div>
            )}
            <Group label={layout.group.key !== '' ? 'ترتيب الصفوف داخل كل مجموعة' : 'ترتيب الصفوف'}>
                <ol className="space-y-2">
                    {layout.sort.map((level, index) => (
                        <li key={index} className="rounded-control border border-gray-200 p-3">
                            <div className="flex items-center gap-2">
                                <span className="w-14 shrink-0 text-xs font-semibold text-gray-600">{index === 0 ? 'حسب' : 'ثم حسب'}</span>
                                <ChoiceSelect
                                    value={level.key}
                                    onChange={(e) => setSortLevel(index, { key: e.target.value })}
                                    aria-label={`حقل الترتيب ${index + 1}`}
                                    className="block min-w-0 flex-1 py-1! text-sm"
                                >
                                    {fieldOptions}
                                </ChoiceSelect>
                                <IconButton
                                    icon="trash"
                                    tone="danger"
                                    label={`حذف مستوى الترتيب ${index + 1}`}
                                    onClick={() =>
                                        set(
                                            'sort',
                                            layout.sort.filter((_, position) => position !== index),
                                        )
                                    }
                                />
                            </div>
                            <div className="mt-2 flex gap-2">
                                {/* Lines up under the field, past the «حسب» label's column. */}
                                <span className="w-14 shrink-0" aria-hidden="true" />
                                <ChoiceChips
                                    options={DIRECTIONS}
                                    value={level.direction}
                                    onChange={(value) => setSortLevel(index, { direction: value })}
                                    label={`اتجاه الترتيب ${index + 1}`}
                                />
                            </div>
                        </li>
                    ))}
                </ol>
                {layout.sort.length < 3 && (
                    <SecondaryButton
                        onClick={() => set('sort', [...layout.sort, { key: layout.columns[0]?.key ?? '', direction: 'asc' }])}
                        className="mt-2 w-full"
                    >
                        <Icon name="plus" className="h-4 w-4" />
                        {layout.sort.length === 0 ? 'إضافة ترتيب' : 'إضافة مستوى ترتيب آخر'}
                    </SecondaryButton>
                )}
            </Group>
        </Section>
    );
}
