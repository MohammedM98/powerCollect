import { Button, Input } from '@heroui/react';
import { useRef } from 'react';
import InputError from '@/Components/InputError';
import Icon from '@/Components/Icon';
import { brandPalette, contrastWithWhite, isHex, MIN_CONTRAST } from '@/lib/brandPalette';
import { useFileUrl } from './useAppearanceFiles';
import { DangerKey, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, PrimaryKey, SecondaryKey } from '@/Components/UI';

export const LOGOS = [
    { key: 'main', label: 'الشعار الرئيسي', hint: 'يظهر في الشريط والقائمة والفوتر وشاشة الدخول.' },
    { key: 'light', label: 'شعار الخلفيات الداكنة', hint: 'يظهر في الوضع الغامق بدل الرئيسي. اختياري.' },
    { key: 'icon', label: 'أيقونة المتصفح', hint: 'صورة مربعة صغيرة تظهر في تبويب المتصفح. اختيارية.' },
    { key: 'print', label: 'شعار الطباعة', hint: 'للوصولات والكشوف؛ نسخة بالأبيض والأسود أوضح على الطابعات الحرارية. اختياري.' },
];

export const SAMPLE_ROWS = [
    ['أحمد محمود', '1042', 'الرمال', '120.00', 'مسدّد'],
    ['سارة خليل', '1043', 'النصر', '75.50', 'عليه'],
    ['محمد يوسف', '1044', 'الشاطئ', '0.00', 'مسدّد'],
    ['ليلى حسن', '1045', 'الرمال', '210.00', 'عليه'],
];

/** One logo: what shows now, a new file to replace it, and (but the main one) removing it. */
export function LogoSlot({ slot, current, own, file, removed, error, onFile, onRemove, onUndo }) {
    const preview = useFileUrl(file);
    const input = useRef(null);
    const shown = preview ?? (removed ? null : current);
    const usesMain = !preview && (removed || !own) && slot.key !== 'main';

    return (
        <div className="ap-logo">
            <div className={`ap-logo-frame ${slot.key === 'light' ? 'is-dark' : ''}`}>
                {shown && !usesMain ? (
                    <img src={shown} alt={slot.label} />
                ) : (
                    <span className="ap-logo-empty">
                        <Icon name="camera" className="h-6 w-6" />
                        يُستخدم الشعار الرئيسي
                    </span>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <b className="block text-[15px] text-gray-900">{slot.label}</b>
                <p className="mt-1 text-[13px] leading-6 text-gray-500">{slot.hint}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    <input
                        ref={input}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        aria-label={`ملف ${slot.label}`}
                        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
                    />
                    <SecondaryKey className="px-3! py-2! text-[13px]" onClick={() => input.current?.click()}>
                        <Icon name="arrow-up" className="h-4 w-4" />
                        {own || file ? 'تغيير' : 'رفع صورة'}
                    </SecondaryKey>
                    {file && (
                        <SecondaryKey
                            className="px-3! py-2! text-[13px]"
                            onClick={() => {
                                onFile(null);
                                input.current.value = '';
                            }}
                        >
                            تراجع
                        </SecondaryKey>
                    )}
                    {slot.key !== 'main' &&
                        own &&
                        !file &&
                        (removed ? (
                            <SecondaryKey className="px-3! py-2! text-[13px]" onClick={onUndo}>
                                إبقاء الشعار
                            </SecondaryKey>
                        ) : (
                            <SecondaryKey className="px-3! py-2! text-[13px]" onClick={onRemove}>
                                إزالة
                            </SecondaryKey>
                        ))}
                </div>
                <InputError message={error} className="mt-1" />
            </div>
        </div>
    );
}

/** A colour: the picker, its hex code, how white text reads on it, and the colours suggested from the logo. */
export function ColorField({ id, label, value, onChange, suggestions = [], allowEmpty = false, emptyLabel, error }) {
    const contrast = isHex(value) ? contrastWithWhite(value) : null;

    return (
        <div className="grid gap-2">
            <span className="text-sm font-semibold text-gray-800">{label}</span>
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="color"
                    className="ap-color"
                    value={isHex(value) ? value : '#20B2A0'}
                    onChange={(event) => onChange(event.target.value.toUpperCase())}
                    aria-label={`${label}: اختيار اللون`}
                />
                <Input
                    id={id}
                    dir="ltr"
                    className="w-32 font-mono text-sm uppercase"
                    value={value ?? ''}
                    placeholder={allowEmpty ? emptyLabel : '#20B2A0'}
                    maxLength={7}
                    onChange={(event) => onChange(event.target.value.trim() === '' && allowEmpty ? null : event.target.value.trim().toUpperCase())}
                />
                {allowEmpty && value && (
                    <Button data-raw="" variant="ghost" className="text-[13px] font-semibold text-gray-500 hover:text-gray-900" onClick={() => onChange(null)}>
                        {emptyLabel}
                    </Button>
                )}
            </div>
            {contrast !== null && contrast < MIN_CONTRAST && (
                <p className="text-[13px] text-warning-700">
                    النص الأبيض على هذا اللون غير مقروء ({contrast.toFixed(1)}:1)، فستستخدم الأزرار درجة أغمق منه.
                </p>
            )}
            {suggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-gray-500">من الشعار:</span>
                    {suggestions.map((color) => (
                        <Button data-raw="" variant="ghost"
                            key={color}
                            className="ap-suggestion"
                            style={{ background: color }}
                            aria-label={`استخدام ${color}`}
                            title={color}
                            aria-pressed={value === color}
                            onClick={() => onChange(color)}
                        />
                    ))}
                </div>
            )}
            <InputError message={error} />
        </div>
    );
}

/** A preset as a small drawing of its layout: where the sections sit, the corners, a button and a table. */
export function PresetCard({ id, preset, active, onPick }) {
    const { design } = preset;

    return (
        <Button data-raw="" variant="ghost" className="ap-preset" aria-pressed={active} onClick={() => onPick(id)}>
            <span
                className={`ap-sketch nav-${design.navigation} radius-${design.radius} buttons-${design.buttons} tables-${design.tables}`}
                aria-hidden="true"
            >
                <span className="ap-sketch-nav" />
                <span className="ap-sketch-page">
                    <span className="ap-sketch-button" />
                    <span className="ap-sketch-rows">
                        <i />
                        <i />
                        <i />
                    </span>
                </span>
            </span>
            <b>{preset.label}</b>
            <small>{preset.description}</small>
        </Button>
    );
}

/** A table drawn in the look, wide enough to show its style (a narrow one turns its rows into cards, as on phones). */
export function SampleTable() {
    return (
        <div className="data-table-container" data-excel-source="custom">
            <ListTable aria-label="معاينة الجدول" className="data-table">
                <ListHeader>
                    <ListColumn id="name" isRowHeader>المشترك</ListColumn>
                    <ListColumn id="number">رقم الاشتراك</ListColumn>
                    <ListColumn id="area">المنطقة</ListColumn>
                    <ListColumn id="balance">الرصيد</ListColumn>
                    <ListColumn id="state">الحالة</ListColumn>
                </ListHeader>
                <ListBody>
                    {SAMPLE_ROWS.map(([name, number, area, balance, state], index) => (
                        <ListRow key={number} id={number} className={index === 1 ? 'bg-brand-50' : undefined}>
                            <ListCell className="font-semibold">{name}</ListCell>
                            <ListCell dir="ltr">{number}</ListCell>
                            <ListCell>{area}</ListCell>
                            <ListCell dir="ltr">{balance}</ListCell>
                            <ListCell>
                                <span
                                    className={`rounded-full px-3 py-1 text-[13px] font-semibold ${state === 'عليه' ? 'bg-brand-50 text-brand-700' : 'bg-success-50 text-success-700'}`}
                                >
                                    {state}
                                </span>
                            </ListCell>
                        </ListRow>
                    ))}
                </ListBody>
            </ListTable>
        </div>
    );
}

/** The components the look changes, drawn with it: buttons, the colour's shades and a printout's heading. */
export function Sample({ brand }) {
    const palette = isHex(brand.primaryColor) ? brandPalette(brand.primaryColor).light : null;

    return (
        <div className="grid gap-4">
            <div className="rounded-card border border-gray-100 bg-surface p-4 shadow-card">
                <b className="text-sm text-gray-500">الأزرار</b>
                <div className="mt-3 flex flex-wrap gap-2">
                    <PrimaryKey type="button">
                        <Icon name="check" className="h-4 w-4" />
                        حفظ الدفعة
                    </PrimaryKey>
                    <SecondaryKey>إلغاء</SecondaryKey>
                    <DangerKey type="button">حذف</DangerKey>
                </div>
                {palette && (
                    <div className="ap-swatches mt-4" aria-label="درجات اللون الرئيسي">
                        {Object.entries(palette).map(([step, rgb]) => (
                            <span key={step} style={{ background: `rgb(${rgb})` }} title={step} />
                        ))}
                    </div>
                )}
            </div>

            <div className="ap-paper">
                <div className="flex items-center gap-3">
                    <img src={brand.logos.print} alt="" className="h-10 w-auto max-w-[96px] object-contain" />
                    <div className="min-w-0">
                        <b className="block truncate text-[15px]">{brand.name}</b>
                        {brand.nameEnglish && (
                            <small dir="ltr" className="block truncate text-[12px] text-gray-500">
                                {brand.nameEnglish}
                            </small>
                        )}
                    </div>
                    <b className="ms-auto text-[15px]" style={{ color: brand.printColor }}>
                        وصل استلام
                    </b>
                </div>
                <div className="mt-3 border-t-2" style={{ borderColor: brand.printColor }} />
                <p className="mt-2 text-[12px] text-gray-500">هكذا تبدأ الوصولات والكشوف المطبوعة.</p>
            </div>
        </div>
    );
}
