import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import PageHeader from '@/Components/PageHeader';
import FormSection from '@/Components/Form/FormSection';
import FormField from '@/Components/Form/FormField';
import ChoiceChips from '@/Components/ChoiceChips';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import DangerButton from '@/Components/DangerButton';
import ConfirmDialog from '@/Components/ConfirmDialog';
import InputError from '@/Components/InputError';
import Icon from '@/Components/Icon';
import { brandPalette, contrastWithWhite, dominantColors, isHex, MIN_CONTRAST } from '@/lib/brandPalette';
import { setBrandPreview } from '@/lib/brandPreview';
import { BRAND_PALETTES } from '@/lib/brandPresets';
import './Appearance.css';

const LOGOS = [
    { key: 'main', label: 'الشعار الرئيسي', hint: 'يظهر في الشريط والقائمة والفوتر وشاشة الدخول.' },
    { key: 'light', label: 'شعار الخلفيات الداكنة', hint: 'يظهر في الوضع الغامق بدل الرئيسي. اختياري.' },
    { key: 'icon', label: 'أيقونة المتصفح', hint: 'صورة مربعة صغيرة تظهر في تبويب المتصفح. اختيارية.' },
    { key: 'print', label: 'شعار الطباعة', hint: 'للوصولات والكشوف؛ نسخة بالأبيض والأسود أوضح على الطابعات الحرارية. اختياري.' },
];

const SAMPLE_ROWS = [
    ['أحمد محمود', '1042', 'الرمال', '120.00', 'مسدّد'],
    ['سارة خليل', '1043', 'النصر', '75.50', 'عليه'],
    ['محمد يوسف', '1044', 'الشاطئ', '0.00', 'مسدّد'],
    ['ليلى حسن', '1045', 'الرمال', '210.00', 'عليه'],
];

/** The form's fields for the saved identity: no new logo files, none to remove. */
function formFields(profile, themePrimary) {
    return {
        company: { name: profile.company.name ?? '', nameEnglish: profile.company.nameEnglish ?? '', shortName: profile.company.shortName ?? '', tagline: profile.company.tagline ?? '' },
        colors: { ...profile.colors, primary: profile.colors.primary ?? themePrimary, print: profile.colors.print },
        design: profile.design,
        logos: { main: null, light: null, icon: null, print: null },
        remove_logos: [],
    };
}

/** A file chosen for a logo as an address the page can show, released when it changes. */
function useFileUrl(file) {
    const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

    useEffect(() => () => url && URL.revokeObjectURL(url), [url]);

    return url;
}

/** The colours a logo is drawn in, worked out in the browser once it loads. */
function useLogoColors(src) {
    const [colors, setColors] = useState([]);

    useEffect(() => {
        if (!src) {
            setColors([]);
            return undefined;
        }

        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 72;
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0, size, size);

            try {
                !cancelled && setColors(dominantColors(context.getImageData(0, 0, size, size).data));
            } catch {
                !cancelled && setColors([]);
            }
        };
        image.src = src;

        return () => {
            cancelled = true;
        };
    }, [src]);

    return colors;
}

/** One logo: what shows now, a new file to replace it, and (but the main one) removing it. */
function LogoSlot({ slot, current, own, file, removed, error, onFile, onRemove, onUndo }) {
    const preview = useFileUrl(file);
    const input = useRef(null);
    const shown = preview ?? (removed ? null : current);
    const usesMain = !preview && (removed || !own) && slot.key !== 'main';

    return (
        <div className="ap-logo">
            <div className={`ap-logo-frame ${slot.key === 'light' ? 'is-dark' : ''}`}>
                {shown && !usesMain ? <img src={shown} alt={slot.label} /> : <span className="ap-logo-empty"><Icon name="camera" className="h-6 w-6" />يُستخدم الشعار الرئيسي</span>}
            </div>
            <div className="min-w-0 flex-1">
                <b className="block text-[15px] text-gray-900">{slot.label}</b>
                <p className="mt-0.5 text-[13px] leading-6 text-gray-500">{slot.hint}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={`ملف ${slot.label}`} onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
                    <SecondaryButton className="!px-3 !py-1.5 text-[13px]" onClick={() => input.current?.click()}><Icon name="arrow-up" className="h-4 w-4" />{own || file ? 'تغيير' : 'رفع صورة'}</SecondaryButton>
                    {file && <SecondaryButton className="!px-3 !py-1.5 text-[13px]" onClick={() => { onFile(null); input.current.value = ''; }}>تراجع</SecondaryButton>}
                    {slot.key !== 'main' && own && !file && (removed
                        ? <SecondaryButton className="!px-3 !py-1.5 text-[13px]" onClick={onUndo}>إبقاء الشعار</SecondaryButton>
                        : <SecondaryButton className="!px-3 !py-1.5 text-[13px]" onClick={onRemove}>إزالة</SecondaryButton>)}
                </div>
                <InputError message={error} className="mt-1" />
            </div>
        </div>
    );
}

/** A colour: the picker, its hex code, how white text reads on it, and the colours suggested from the logo. */
function ColorField({ id, label, value, onChange, suggestions = [], allowEmpty = false, emptyLabel, error }) {
    const contrast = isHex(value) ? contrastWithWhite(value) : null;

    return (
        <div className="grid gap-2">
            <span className="text-sm font-semibold text-gray-800">{label}</span>
            <div className="flex flex-wrap items-center gap-2">
                <input type="color" className="ap-color" value={isHex(value) ? value : '#A51D26'} onChange={(event) => onChange(event.target.value.toUpperCase())} aria-label={`${label}: اختيار اللون`} />
                <input id={id} dir="ltr" className="w-32 font-mono text-sm uppercase" value={value ?? ''} placeholder={allowEmpty ? emptyLabel : '#A51D26'} maxLength={7}
                    onChange={(event) => onChange(event.target.value.trim() === '' && allowEmpty ? null : event.target.value.trim().toUpperCase())} />
                {allowEmpty && value && <button type="button" className="text-[13px] font-semibold text-gray-500 hover:text-gray-900" onClick={() => onChange(null)}>{emptyLabel}</button>}
            </div>
            {contrast !== null && contrast < MIN_CONTRAST && <p className="text-[13px] text-warning-700">النص الأبيض على هذا اللون غير مقروء ({contrast.toFixed(1)}:1)، فستستخدم الأزرار درجة أغمق منه.</p>}
            {suggestions.length > 0 && <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] text-gray-500">من الشعار:</span>
                {suggestions.map((color) => (
                    <button key={color} type="button" className="ap-suggestion" style={{ background: color }} aria-label={`استخدام ${color}`} title={color} aria-pressed={value === color} onClick={() => onChange(color)} />
                ))}
            </div>}
            <InputError message={error} />
        </div>
    );
}

/** A preset as a small drawing of its layout: where the sections sit, the corners, a button and a table. */
function PresetCard({ id, preset, active, onPick }) {
    const { design } = preset;

    return (
        <button type="button" className="ap-preset" aria-pressed={active} onClick={() => onPick(id)}>
            <span className={`ap-sketch nav-${design.navigation} radius-${design.radius} buttons-${design.buttons} tables-${design.tables}`} aria-hidden="true">
                <span className="ap-sketch-nav" />
                <span className="ap-sketch-page">
                    <span className="ap-sketch-button" />
                    <span className="ap-sketch-rows"><i /><i /><i /></span>
                </span>
            </span>
            <b>{preset.label}</b>
            <small>{preset.description}</small>
        </button>
    );
}

/** A table drawn in the look, wide enough to show its style (a narrow one turns its rows into cards, as on phones). */
function SampleTable() {
    return (
        <div className="data-table-container" data-excel-source="custom">
            <table className="data-table">
                <thead><tr><th>المشترك</th><th>رقم الاشتراك</th><th>المنطقة</th><th>الرصيد</th><th>الحالة</th></tr></thead>
                <tbody>
                    {SAMPLE_ROWS.map(([name, number, area, balance, state], index) => (
                        <tr key={number} className={index === 1 ? 'bg-brand-50' : undefined}>
                            <td className="font-semibold">{name}</td>
                            <td dir="ltr">{number}</td>
                            <td>{area}</td>
                            <td dir="ltr">{balance}</td>
                            <td><span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${state === 'عليه' ? 'bg-brand-50 text-brand-700' : 'bg-success-50 text-success-700'}`}>{state}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** The components the look changes, drawn with it: buttons, the colour's shades and a printout's heading. */
function Sample({ brand }) {
    const palette = isHex(brand.primaryColor) ? brandPalette(brand.primaryColor).light : null;

    return (
        <div className="grid gap-4">
            <div className="rounded-card border border-gray-100 bg-surface p-5 shadow-card">
                <b className="text-sm text-gray-500">الأزرار</b>
                <div className="mt-3 flex flex-wrap gap-2">
                    <PrimaryButton type="button"><Icon name="check" className="h-4 w-4" />حفظ الدفعة</PrimaryButton>
                    <SecondaryButton>إلغاء</SecondaryButton>
                    <DangerButton type="button">حذف</DangerButton>
                </div>
                {palette && <div className="ap-swatches mt-4" aria-label="درجات اللون الرئيسي">
                    {Object.entries(palette).map(([step, rgb]) => <span key={step} style={{ background: `rgb(${rgb})` }} title={step} />)}
                </div>}
            </div>


            <div className="ap-paper">
                <div className="flex items-center gap-3">
                    <img src={brand.logos.print} alt="" className="h-10 w-auto max-w-[96px] object-contain" />
                    <div className="min-w-0">
                        <b className="block truncate text-[15px]">{brand.name}</b>
                        {brand.nameEnglish && <small dir="ltr" className="block truncate text-[12px] text-gray-500">{brand.nameEnglish}</small>}
                    </div>
                    <b className="ms-auto text-[15px]" style={{ color: brand.printColor }}>وصل استلام</b>
                </div>
                <div className="mt-3 border-t-2" style={{ borderColor: brand.printColor }} />
                <p className="mt-2 text-[12px] text-gray-500">هكذا تبدأ الوصولات والكشوف المطبوعة.</p>
            </div>
        </div>
    );
}

/**
 * The company's identity and look (Super Admin): its names, logos and
 * colours, and the layout and components of the whole interface, from a
 * ready preset or one choice at a time. Every change is tried on the real
 * interface at once (lib/brandPreview.js) and kept only when saved; the
 * same identity can be downloaded as a file, uploaded or reset.
 */
export default function Appearance({ profile, isImported, options, presets, themePrimary }) {
    const { brand: shared, errors } = usePage().props;
    const form = useForm(formFields(profile, themePrimary));
    const { data } = form;

    // A save, upload or reset sends the identity back: start again from it.
    useEffect(() => {
        const fields = formFields(profile, themePrimary);
        form.setDefaults(fields);
        form.setData(fields);
    }, [profile]);
    const [confirmReset, setConfirmReset] = useState(false);
    const importInput = useRef(null);
    const fileUrls = {
        main: useFileUrl(data.logos.main),
        light: useFileUrl(data.logos.light),
        icon: useFileUrl(data.logos.icon),
        print: useFileUrl(data.logos.print),
    };
    const logoUrl = (key) => fileUrls[key] ?? (key !== 'main' && data.remove_logos.includes(key) ? null : profile.ownLogos.includes(key) ? shared.logos[key] : null);
    const mainLogo = logoUrl('main') ?? shared.logos.main;
    const suggestions = useLogoColors(mainLogo);

    // The identity being edited, as the interface draws it: tried on every part of the page until saved or left.
    const tried = useMemo(() => ({
        name: data.company.name || shared.name,
        nameEnglish: data.company.nameEnglish || null,
        shortName: data.company.shortName || data.company.name || shared.name,
        tagline: data.company.tagline || null,
        primaryColor: isHex(data.colors.primary) ? data.colors.primary : shared.primaryColor,
        colors: data.colors,
        printColor: isHex(data.colors.print) ? data.colors.print : isHex(data.colors.primary) ? data.colors.primary : shared.printColor,
        design: data.design,
        animatedLogo: !fileUrls.main && shared.animatedLogo,
        logos: {
            main: mainLogo,
            light: logoUrl('light') ?? mainLogo,
            icon: logoUrl('icon') ?? mainLogo,
            print: logoUrl('print') ?? mainLogo,
        },
    }), [data, shared, fileUrls.main, fileUrls.light, fileUrls.icon, fileUrls.print]);

    useEffect(() => setBrandPreview(tried), [tried]);
    useEffect(() => () => setBrandPreview(null), []);

    const preset = data.design.preset !== 'custom' ? data.design.preset : null;

    function setCompany(key, value) {
        form.setData('company', { ...data.company, [key]: value });
    }

    function setDesign(key, value) {
        form.setData('design', { ...data.design, [key]: value, preset: 'custom' });
    }

    function pickPreset(id) {
        form.setData('design', { ...presets[id].design, preset: id });
    }

    function save(event) {
        event.preventDefault();
        form.post('/settings/appearance', {
            forceFormData: true,
            preserveScroll: true,
        });
    }

    function importFile(file) {
        if (file) {
            router.post('/settings/appearance/import', { file }, { forceFormData: true, preserveScroll: true, onFinish: () => (importInput.current.value = '') });
        }
    }

    return (
        <SettingsLayout header={<PageHeader
            title="الهوية والمظهر"
            info="شعار الشركة واسمها وألوانها وشكل الواجهة كلها. كل تغيير يظهر مباشرة على الصفحة لتجربته، ولا يُعتمد إلا بعد الحفظ. هوية مطوّر البرنامج في الفوتر ثابتة ولا تتغير من هنا."
            meta={isImported ? 'هوية خاصة بهذه الشركة' : 'الهوية الافتراضية'}
            actions={<div className="flex flex-wrap gap-2">
                <a href="/settings/appearance/export" className="inline-flex items-center gap-2 rounded-control border border-gray-200 bg-surface px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"><Icon name="arrow-down-tray" className="h-4 w-4" />تنزيل ملف الهوية</a>
                <input ref={importInput} type="file" accept="application/json,.json" className="sr-only" aria-label="ملف هوية" onChange={(event) => importFile(event.target.files?.[0])} />
                <SecondaryButton onClick={() => importInput.current?.click()}><Icon name="arrow-up" className="h-4 w-4" />رفع ملف هوية</SecondaryButton>
                {isImported && <DangerButton type="button" onClick={() => setConfirmReset(true)}>الرجوع للأصل</DangerButton>}
            </div>}
        />}>
            <Head title="الهوية والمظهر" />
            <InputError message={errors?.file} className="mb-4" />

            <form onSubmit={save} className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="grid gap-6">
                    <FormSection icon="sparkles" title="قوالب جاهزة" columns={1} info="شكل كامل تبدأ منه؛ يمكنك بعدها تغيير أي خيار وحده من الأسفل.">
                        <div className="ap-presets">
                            {Object.entries(presets).map(([id, item]) => <PresetCard key={id} id={id} preset={item} active={preset === id} onPick={pickPreset} />)}
                        </div>
                    </FormSection>

                    <FormSection icon="building" title="الشركة" columns={2}>
                        <FormField id="brand-name" label="اسم الشركة" required error={form.errors['company.name']}>
                            <input id="brand-name" className="w-full" value={data.company.name} onChange={(event) => setCompany('name', event.target.value)} maxLength={150} required />
                        </FormField>
                        <FormField id="brand-name-en" label="الاسم بالإنجليزية" error={form.errors['company.nameEnglish']}>
                            <input id="brand-name-en" dir="ltr" className="w-full" value={data.company.nameEnglish} onChange={(event) => setCompany('nameEnglish', event.target.value)} maxLength={150} />
                        </FormField>
                        <FormField id="brand-short" label="الاسم المختصر" hint="للعلامة المائية والمساحات الضيقة. يُستخدم الاسم الكامل إن تُرك فارغاً." error={form.errors['company.shortName']}>
                            <input id="brand-short" className="w-full" value={data.company.shortName} onChange={(event) => setCompany('shortName', event.target.value)} maxLength={80} />
                        </FormField>
                        <FormField id="brand-tagline" label="العبارة التعريفية" hint="العنوان الكبير في شاشة الدخول وتحت الاسم في النماذج." error={form.errors['company.tagline']}>
                            <input id="brand-tagline" className="w-full" value={data.company.tagline} onChange={(event) => setCompany('tagline', event.target.value)} maxLength={150} />
                        </FormField>
                    </FormSection>

                    <FormSection icon="camera" title="الشعارات" columns={2} info="PNG أو JPEG أو WebP، حتى 2 ميغابايت لكل صورة.">
                        {LOGOS.map((slot) => (
                            <LogoSlot
                                key={slot.key}
                                slot={slot}
                                current={slot.key === 'main' ? shared.logos.main : shared.logos[slot.key]}
                                own={slot.key === 'main' || profile.ownLogos.includes(slot.key)}
                                file={data.logos[slot.key]}
                                removed={data.remove_logos.includes(slot.key)}
                                error={form.errors[`logos.${slot.key}`]}
                                onFile={(file) => form.setData('logos', { ...data.logos, [slot.key]: file })}
                                onRemove={() => form.setData('remove_logos', [...data.remove_logos, slot.key])}
                                onUndo={() => form.setData('remove_logos', data.remove_logos.filter((key) => key !== slot.key))}
                            />
                        ))}
                    </FormSection>

                    <FormSection icon="swatch" title="الألوان" columns={2} info="من اللون الرئيسي تتولد كل درجات الواجهة في الوضعين الفاتح والغامق. ألوان الأخطاء تبقى حمراء.">
                        <div className="col-span-full flex flex-wrap gap-3" role="group" aria-label="لوحات ألوان الشركة">
                            {BRAND_PALETTES.map((palette) => <button key={palette.id} type="button" className="rounded-xl border border-gray-200 bg-surface px-4 py-3 text-start text-sm font-semibold text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => form.setData('colors', { ...data.colors, ...palette.colors })}>
                                <span className="mb-2 flex gap-1" aria-hidden="true">{Object.values(palette.colors).filter(Boolean).map((color, index) => <span key={index} className="h-5 w-5 rounded-full border border-gray-200" style={{ backgroundColor: color }} />)}</span>
                                {palette.name}
                            </button>)}
                        </div>
                        <ColorField id="brand-primary" label="اللون الرئيسي" value={data.colors.primary} suggestions={suggestions} error={form.errors['colors.primary']}
                            onChange={(value) => form.setData('colors', { ...data.colors, primary: value })} />
                        {Object.entries({ secondary: 'اللون الثانوي', accent: 'لون الإبراز', background: 'خلفية الصفحة', surface: 'سطح البطاقات والنوافذ' }).map(([key, label]) => <ColorField key={key} id={`brand-${key}`} label={label} value={data.colors[key]} suggestions={suggestions} allowEmpty emptyLabel="تلقائي" error={form.errors[`colors.${key}`]} onChange={(value) => form.setData('colors', { ...data.colors, [key]: value })} />)}
                        <ColorField id="brand-print" label="لون الطباعة" value={data.colors.print} suggestions={suggestions} allowEmpty emptyLabel="مثل الرئيسي" error={form.errors['colors.print']}
                            onChange={(value) => form.setData('colors', { ...data.colors, print: value })} />
                    </FormSection>

                    <FormSection icon="columns" title="التخطيط والمكوّنات" columns={1} info="الجدول تحت الخيارات يتغير مع اختيارك، وكذلك الأزرار والقائمة والصفحة كلها.">
                        {Object.entries(options).map(([key, choice]) => (
                            <div key={key} className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
                                <span id={`design-${key}`} className="text-sm font-semibold text-gray-800">{choice.label}</span>
                                <ChoiceChips id={`design-${key}-choices`} label={choice.label} value={data.design[key]} onChange={(value) => setDesign(key, value)}
                                    options={Object.entries(choice.options).map(([value, label]) => ({ value, label }))} />
                            </div>
                        ))}
                        <SampleTable />
                    </FormSection>
                </div>

                <aside className="grid gap-4 2xl:sticky 2xl:top-24">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-600"><Icon name="eye" className="h-4 w-4" />معاينة مباشرة</div>
                    <Sample brand={tried} />
                </aside>

                <div className="ap-savebar 2xl:col-span-2">
                    <span className="text-sm text-gray-600">{form.isDirty ? 'تغييرات لم تُحفظ بعد: تراها الآن على الواجهة كلها.' : 'لا تغييرات غير محفوظة.'}</span>
                    <div className="flex gap-2">
                        {form.isDirty && <SecondaryButton onClick={() => form.reset()}>تجاهل التغييرات</SecondaryButton>}
                        <PrimaryButton disabled={form.processing || !form.isDirty}><Icon name="check" className="h-4 w-4" />حفظ الهوية والمظهر</PrimaryButton>
                    </div>
                </div>
            </form>

            <ConfirmDialog
                show={confirmReset}
                tone="danger"
                title="الرجوع للهوية الأصلية؟"
                message="تُحذف هوية هذه الشركة وشعاراتها، ويعود البرنامج للاسم والشعار والشكل الأصلي."
                confirmLabel="الرجوع للأصل"
                onCancel={() => setConfirmReset(false)}
                onConfirm={() => {
                    setConfirmReset(false);
                    router.post('/settings/appearance/reset', {}, { preserveScroll: true });
                }}
            />
        </SettingsLayout>
    );
}
