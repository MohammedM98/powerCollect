import ChoiceSelect from '@/Components/ChoiceSelect';
import { Button, Input } from '@heroui/react';
import { useId } from 'react';
import Icon from '@/Components/Icon';
import ChoiceChips from '@/Components/ChoiceChips';
import Switch from '@/Components/Switch';
import SecondaryButton from '@/Components/SecondaryButton';
import { HIGHLIGHT_OPERATORS, PRINT_FONTS } from '@/lib/printLayout';
import { FOCUS_RING, HEADING_SIZES, HIGHLIGHT_COLORS } from './printSettingsOptions';

/** One part of the settings, opened or folded by its title. */
export function Section({ icon, title, children, open = false, id }) {
    return (
        <details id={id} open={open} className="group border-b border-gray-100">
            <summary
                className={`flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 ${FOCUS_RING} [&::-webkit-details-marker]:hidden`}
            >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                    <Icon name={icon} className="h-4 w-4" />
                </span>
                <span className="flex-1">{title}</span>
                <Icon name="chevron-down" className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 px-4 pb-4 pt-1">{children}</div>
        </details>
    );
}

export function Field({ label, children, hint }) {
    const id = useId();

    return (
        <div>
            <label htmlFor={id} className="mb-2 block text-xs font-semibold text-gray-700">
                {label}
            </label>
            {children(id)}
            {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </div>
    );
}

export function Group({ label, children }) {
    return (
        <div>
            <span className="mb-2 block text-xs font-semibold text-gray-700">{label}</span>
            {children}
        </div>
    );
}

export function FontField({ label, value, onChange }) {
    return (
        <Field label={label}>
            {(id) => (
                <ChoiceSelect id={id} value={value ?? 'plex'} onChange={(event) => onChange(event.target.value)} className="block w-full text-sm">
                    {Object.entries(PRINT_FONTS).map(([key, font]) => (
                        <option key={key} value={key}>
                            {font.label}
                        </option>
                    ))}
                </ChoiceSelect>
            )}
        </Field>
    );
}

export function NumberField({ label, value, onChange, min, max, step = 1 }) {
    return (
        <Field label={label}>
            {(id) => (
                <Input
                    id={id}
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value))))}
                    className="block w-full text-sm"
                />
            )}
        </Field>
    );
}

export function HeaderTypography({ label, header, onChange, font, size, bold, align }) {
    return (
        <fieldset className="space-y-3 border-t border-gray-100 pt-3">
            <legend className="px-1 text-xs font-bold text-gray-900">{label}</legend>
            <div className="grid grid-cols-2 gap-3">
                <FontField label={`خط ${label}`} value={header[font]} onChange={(value) => onChange(font, value)} />
                <NumberField label={`حجم ${label} (بكسل)`} value={header[size]} min={8} max={48} onChange={(value) => onChange(size, value)} />
            </div>
            <Field label={`محاذاة ${label}`}>
                {(id) => (
                    <ChoiceSelect id={id} value={header[align]} onChange={(event) => onChange(align, event.target.value)} className="block w-full text-sm">
                        <option value="right">يمين</option>
                        <option value="center">وسط</option>
                        <option value="left">يسار</option>
                    </ChoiceSelect>
                )}
            </Field>
            <Switch label={`${label} بخط عريض`} checked={header[bold]} onChange={(value) => onChange(bold, value)} />
        </fieldset>
    );
}

/** The look of each grouping level's heading: its size, background and text colour. */
export function HeadingStyles({ levels, styles, onChange }) {
    const setLevel = (index, changes) =>
        onChange(levels.map((_, position) => ({ ...(styles[position] ?? {}), ...(position === index ? changes : {}) })));

    return (
        <fieldset className="space-y-3 border-t border-gray-100 pt-3">
            <legend className="px-1 text-xs font-bold text-gray-900">شكل عناوين المجموعات</legend>
            {levels.map((label, index) => {
                const look = styles[index] ?? {};

                return (
                    <div key={index} className="space-y-2 rounded-control border border-gray-200 p-3">
                        <p className="text-xs font-semibold text-gray-700">عنوان «{label}»</p>
                        <Field label={`حجم خط عنوان «${label}»`}>
                            {(id) => (
                                <ChoiceSelect
                                    id={id}
                                    value={look.size ? String(look.size) : ''}
                                    onChange={(event) => setLevel(index, { size: event.target.value === '' ? null : Number(event.target.value) })}
                                    className="block w-full text-sm"
                                >
                                    {HEADING_SIZES.map((size) => (
                                        <option key={size.value} value={size.value}>
                                            {size.label}
                                        </option>
                                    ))}
                                </ChoiceSelect>
                            )}
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={`لون خلفية «${label}»`}>
                                {(id) => (
                                    <input
                                        id={id}
                                        type="color"
                                        value={look.background || '#f3f4f6'}
                                        onChange={(event) => setLevel(index, { background: event.target.value })}
                                        className="h-9 w-full"
                                    />
                                )}
                            </Field>
                            <Field label={`لون نص «${label}»`}>
                                {(id) => (
                                    <input
                                        id={id}
                                        type="color"
                                        value={look.color || '#111827'}
                                        onChange={(event) => setLevel(index, { color: event.target.value })}
                                        className="h-9 w-full"
                                    />
                                )}
                            </Field>
                        </div>
                        {(look.size || look.background || look.color) && (
                            <SecondaryButton
                                className="w-full py-1! text-xs"
                                onClick={() => setLevel(index, { size: null, background: null, color: null })}
                            >
                                إرجاع الشكل الافتراضي
                            </SecondaryButton>
                        )}
                    </div>
                );
            })}
        </fieldset>
    );
}

/** Rules that colour a row, or one of its cells, by the values it holds. */
export function Highlights({ rules, columns, onChange }) {
    const setRule = (index, changes) => onChange(rules.map((rule, position) => (position === index ? { ...rule, ...changes } : rule)));

    return (
        <fieldset className="space-y-3 border-t border-gray-100 pt-3">
            <legend className="px-1 text-xs font-bold text-gray-900">تلوين الصفوف حسب قيمها</legend>
            <p className="text-xs text-gray-500">مثلًا: الحالة «لم تُدخل» بالأحمر، أو المطلوب دفعه أكبر من 500. أول قاعدة تنطبق هي التي تُلوّن.</p>
            {rules.map((rule, index) => (
                <div key={index} className="space-y-2 rounded-control border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                        <ChoiceSelect
                            aria-label={`عمود القاعدة ${index + 1}`}
                            value={rule.key}
                            onChange={(event) => setRule(index, { key: event.target.value })}
                            className="block min-w-0 flex-1 py-1! text-sm"
                        >
                            {columns.map((column) => (
                                <option key={column.key} value={column.key}>
                                    {column.label}
                                </option>
                            ))}
                        </ChoiceSelect>
                        <IconButton
                            icon="trash"
                            tone="danger"
                            label={`حذف القاعدة ${index + 1}`}
                            onClick={() => onChange(rules.filter((_, position) => position !== index))}
                        />
                    </div>
                    <div className="flex gap-2">
                        <ChoiceSelect
                            aria-label={`شرط القاعدة ${index + 1}`}
                            value={rule.operator}
                            onChange={(event) => setRule(index, { operator: event.target.value })}
                            className="block w-32 shrink-0 py-1! text-sm"
                        >
                            {Object.entries(HIGHLIGHT_OPERATORS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </ChoiceSelect>
                        {!['empty', 'notEmpty'].includes(rule.operator) && (
                            <Input
                                aria-label={`قيمة القاعدة ${index + 1}`}
                                type="text"
                                maxLength={100}
                                value={rule.value ?? ''}
                                onChange={(event) => setRule(index, { value: event.target.value })}
                                className="block min-w-0 flex-1 py-1! text-sm"
                            />
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {HIGHLIGHT_COLORS.map((color) => (
                            <Button data-raw="" variant="ghost"
                                key={color.value}
                                aria-label={color.label}
                                aria-pressed={rule.color === color.value}
                                title={color.label}
                                onClick={() => setRule(index, { color: color.value })}
                                className={`h-7 w-7 rounded-full border-2 ${rule.color === color.value ? 'border-gray-900' : 'border-white shadow-sm'} ${FOCUS_RING}`}
                                style={{ backgroundColor: color.value }}
                            />
                        ))}
                        <input
                            aria-label={`لون آخر للقاعدة ${index + 1}`}
                            type="color"
                            value={rule.color}
                            onChange={(event) => setRule(index, { color: event.target.value })}
                            className="h-7 w-9 cursor-pointer rounded border border-gray-200 p-1"
                        />
                    </div>
                    <ChoiceChips
                        options={[
                            { value: 'row', label: 'الصف كاملًا' },
                            { value: 'cell', label: 'الخلية فقط' },
                        ]}
                        value={rule.target ?? 'row'}
                        onChange={(value) => setRule(index, { target: value })}
                        label={`ما يُلوَّن في القاعدة ${index + 1}`}
                    />
                </div>
            ))}
            {rules.length < 10 && columns.length > 0 && (
                <SecondaryButton
                    className="w-full"
                    onClick={() =>
                        onChange([
                            ...rules,
                            { key: columns[0].key, operator: 'contains', value: '', color: HIGHLIGHT_COLORS[0].value, target: 'row' },
                        ])
                    }
                >
                    <Icon name="plus" className="h-4 w-4" />
                    إضافة قاعدة تلوين
                </SecondaryButton>
            )}
        </fieldset>
    );
}

/** A small icon-only button, named for screen readers and in its tooltip. */
export function IconButton({ icon, label, onClick, disabled = false, tone = 'gray' }) {
    return (
        <Button data-raw="" variant="ghost"
            onClick={onClick}
            isDisabled={disabled}
            aria-label={label}
            title={label}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-surface transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-30 ${
                tone === 'danger' ? 'text-brand-600' : 'text-gray-600 hover:text-gray-900'
            } ${FOCUS_RING}`}
        >
            <Icon name={icon} className="h-4 w-4" />
        </Button>
    );
}
