import ChoiceSelect from '@/Components/UI/ChoiceSelect';
import CheckBox from '@/Components/UI/CheckBox';
import { Input } from '@heroui/react';
import Icon from '@/Components/UI/Icon';
import SecondaryButton from '@/Components/UI/SecondaryButton';
import { moveColumn } from '@/lib/printLayout';
import { ALIGNMENTS } from './printSettingsOptions';
import { Section, IconButton } from './PrintSettingsFields';

/** The printed columns: which show, in what order, their widths, alignment and headings, and blank columns to fill by hand. */
export default function PrintColumnsSection({ columnSearch, layout, set, setColumn, setColumnSearch, shownCount }) {
    return (
        <Section icon="columns" title={`الأعمدة (${shownCount} من ${layout.columns.length})`} open>
            <p className="text-xs text-gray-500">
                أظهر أو أخفِ، غيّر الاسم، رتّب بالأسهم، واختر المحاذاة أو المجموع. «الحقول الإضافية» تفاصيل منفصلة (مثل رقم الجوال أو اسم الطبلون)
                مخفية في البداية — فعّلها لتبني طباعتك كما تريد.
            </p>
            <div className="flex gap-2">
                <SecondaryButton
                    onClick={() =>
                        set(
                            'columns',
                            layout.columns.map((column) => ({ ...column, visible: true })),
                        )
                    }
                    className="flex-1 px-2! py-2! text-xs"
                >
                    إظهار الكل
                </SecondaryButton>
                <SecondaryButton
                    onClick={() =>
                        set(
                            'columns',
                            layout.columns.map((column) => ({ ...column, visible: false })),
                        )
                    }
                    className="flex-1 px-2! py-2! text-xs"
                >
                    إخفاء الكل
                </SecondaryButton>
            </div>
            <Input
                type="search"
                aria-label="البحث في أعمدة الطباعة"
                placeholder="ابحث عن عمود أو حقل إضافي..."
                value={columnSearch}
                onChange={(event) => setColumnSearch(event.target.value)}
                className="mb-3 block w-full text-sm"
            />
            <ol className="space-y-2">
                {layout.columns
                    .map((column, index) => ({ column, index }))
                    .filter(({ column }) => column.label.includes(columnSearch.trim()))
                    .map(({ column, index }) => (
                        <li
                            key={column.key}
                            className={`rounded-control border p-3 ${column.visible ? 'border-gray-200 bg-surface' : 'border-dashed border-gray-200 bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-2">
                                <CheckBox
                                    checked={column.visible}
                                    onChange={(e) => setColumn(index, { visible: e.target.checked })}
                                    aria-label={`طباعة عمود «${column.label}»`}
                                    title="إظهار العمود في الطباعة"
                                />
                                <Input
                                    type="text"
                                    value={column.label}
                                    onChange={(e) => setColumn(index, { label: e.target.value })}
                                    aria-label={`اسم العمود «${column.key}» في الطباعة`}
                                    className={`block min-w-0 flex-1 py-1! text-sm ${column.visible ? '' : 'text-gray-400'}`}
                                />
                                {column.extra && (
                                    <span className="shrink-0 rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-800">
                                        حقل إضافي
                                    </span>
                                )}
                                <IconButton
                                    icon="arrow-up"
                                    label={`تحريك «${column.label}» قبل العمود السابق`}
                                    disabled={index === 0}
                                    onClick={() => set('columns', moveColumn(layout.columns, index, -1))}
                                />
                                <IconButton
                                    icon="arrow-down"
                                    label={`تحريك «${column.label}» بعد العمود التالي`}
                                    disabled={index === layout.columns.length - 1}
                                    onClick={() => set('columns', moveColumn(layout.columns, index, 1))}
                                />
                                {column.key.startsWith('blank:') && (
                                    <IconButton
                                        icon="trash"
                                        label={`حذف «${column.label}»`}
                                        tone="danger"
                                        onClick={() =>
                                            set(
                                                'columns',
                                                layout.columns.filter((item) => item.key !== column.key),
                                            )
                                        }
                                    />
                                )}
                            </div>
                            {column.visible && (
                                <div className="mt-2 flex flex-wrap items-center gap-3 ps-6 text-xs">
                                    <label className="flex items-center gap-2 text-gray-600">
                                        العرض (مم)
                                        <Input
                                            type="number"
                                            min="0"
                                            max="120"
                                            step="1"
                                            value={column.width ?? 0}
                                            onChange={(event) => setColumn(index, { width: Math.max(0, Math.min(120, Number(event.target.value))) })}
                                            className="w-20 py-1! text-xs"
                                            aria-label={`عرض عمود ${column.label}`}
                                        />
                                        <span>0 تلقائي</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-gray-600">
                                        <CheckBox
                                            checked={Boolean(column.blank)}
                                            onChange={(event) => setColumn(index, { blank: event.target.checked, total: false })}
                                        />
                                        خانة فارغة للكتابة
                                    </label>
                                    {!column.blank && (
                                        <label className="flex items-center gap-2 text-gray-600">
                                            سطر إضافي تحته
                                            <ChoiceSelect
                                                aria-label={`السطر الإضافي لعمود ${column.label}`}
                                                value={column.secondaryKey ?? ''}
                                                onChange={(event) => setColumn(index, { secondaryKey: event.target.value })}
                                                className="max-w-44 py-1! text-xs"
                                            >
                                                <option value="">بدون</option>
                                                {layout.columns
                                                    .filter((item) => item.key !== column.key && !item.key.startsWith('blank:'))
                                                    .map((item) => (
                                                        <option key={item.key} value={item.key}>
                                                            {item.label}
                                                        </option>
                                                    ))}
                                            </ChoiceSelect>
                                        </label>
                                    )}
                                    <label className="flex items-center gap-2 text-gray-600">
                                        المحاذاة
                                        <ChoiceSelect
                                            value={column.align}
                                            onChange={(e) => setColumn(index, { align: e.target.value })}
                                            className="py-1! text-xs"
                                        >
                                            {ALIGNMENTS.map((alignment) => (
                                                <option key={alignment.value} value={alignment.value}>
                                                    {alignment.label}
                                                </option>
                                            ))}
                                        </ChoiceSelect>
                                    </label>
                                    <label className="flex items-center gap-2 text-gray-600">
                                        <CheckBox
                                            checked={column.total}
                                            onChange={(e) => setColumn(index, { total: e.target.checked })}
                                        />
                                        مجموع في الأسفل
                                    </label>
                                </div>
                            )}
                        </li>
                    ))}
            </ol>
            <SecondaryButton
                className="mt-3 w-full"
                disabled={layout.columns.filter((column) => column.key.startsWith('blank:')).length >= 10}
                onClick={() =>
                    set('columns', [
                        ...layout.columns,
                        {
                            key: `blank:${crypto.randomUUID()}`,
                            label: 'ملاحظات',
                            blank: true,
                            extra: true,
                            visible: true,
                            align: 'start',
                            total: false,
                            width: 25,
                        },
                    ])
                }
            >
                <Icon name="plus" className="h-4 w-4" />
                إضافة عمود فارغ
            </SecondaryButton>
        </Section>
    );
}
