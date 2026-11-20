import { Input, TextArea } from '@heroui/react';
import ChoiceChips from '@/Components/ChoiceChips';
import Switch from '@/Components/Switch';
import { Section, Field, Group, NumberField, HeaderTypography } from './PrintSettingsFields';

/** The printout's heading: the logo, the company's lines, the title and its typography. */
export default function PrintHeaderSection({ layout, setIn }) {
    return (
        <Section icon="page-header" title="الترويسة">
            <Group label="ترتيب الترويسة">
                <ChoiceChips
                    options={[
                        { value: 'standard', label: 'الترويسة المعتادة' },
                        { value: 'letterhead', label: 'نص على جانبي الشعار' },
                    ]}
                    value={layout.header.layout}
                    onChange={(value) => setIn('header', 'layout', value)}
                    label="ترتيب الترويسة"
                />
            </Group>
            <Field label="اسم الشركة">
                {(id) => (
                    <Input
                        id={id}
                        type="text"
                        value={layout.header.company}
                        onChange={(e) => setIn('header', 'company', e.target.value)}
                        className="block w-full text-sm"
                    />
                )}
            </Field>
            <Field label="تفاصيل الشركة بالعربية">
                {(id) => (
                    <TextArea
                        id={id}
                        rows={2}
                        value={layout.header.companyDetails}
                        onChange={(event) => setIn('header', 'companyDetails', event.target.value)}
                        placeholder="الإدارة، العنوان أو أرقام التواصل"
                        className="block w-full text-sm"
                    />
                )}
            </Field>
            <Field label="اسم الشركة والتفاصيل بالإنجليزية">
                {(id) => (
                    <TextArea
                        id={id}
                        dir="ltr"
                        rows={3}
                        value={layout.header.companyEnglish}
                        onChange={(event) => setIn('header', 'companyEnglish', event.target.value)}
                        placeholder={'Company for General Trade\nFares Abu Zayed Sons'}
                        className="block w-full text-sm"
                    />
                )}
            </Field>
            <Field label="عنوان الطباعة">
                {(id) => (
                    <Input
                        id={id}
                        type="text"
                        value={layout.header.title}
                        onChange={(e) => setIn('header', 'title', e.target.value)}
                        className="block w-full text-sm"
                    />
                )}
            </Field>
            <Field label="سطر إضافي تحت العنوان">
                {(id) => (
                    <TextArea
                        id={id}
                        rows={2}
                        value={layout.header.subtitle}
                        onChange={(e) => setIn('header', 'subtitle', e.target.value)}
                        placeholder="مثلًا: عن شهر أكتوبر"
                        className="block w-full text-sm"
                    />
                )}
            </Field>
            <div className="grid grid-cols-1 gap-3">
                <Switch checked={layout.header.logo} onChange={(value) => setIn('header', 'logo', value)} label="إظهار الشعار" />
                <Switch checked={layout.header.branch} onChange={(value) => setIn('header', 'branch', value)} label="إظهار اسم الفرع" />
                <Switch checked={layout.header.date} onChange={(value) => setIn('header', 'date', value)} label="إظهار تاريخ ووقت الطباعة" />
                <Switch checked={layout.header.user} onChange={(value) => setIn('header', 'user', value)} label="إظهار اسم من طبع" />
                <Switch checked={layout.header.count} onChange={(value) => setIn('header', 'count', value)} label="إظهار عدد الصفوف" />
                {layout.header.layout === 'standard' && (
                    <Switch checked={layout.header.centered} onChange={(value) => setIn('header', 'centered', value)} label="ترويسة في المنتصف" />
                )}
                <Switch
                    checked={layout.header.repeatTitle}
                    onChange={(value) => setIn('header', 'repeatTitle', value)}
                    label="تكرار العنوان أعلى كل صفحة"
                />
                <Switch
                    checked={Boolean(layout.header.repeatCompany)}
                    onChange={(value) => setIn('header', 'repeatCompany', value)}
                    label="تكرار اسم الشركة أعلى كل صفحة"
                />
                <Switch
                    checked={Boolean(layout.header.repeatDate)}
                    onChange={(value) => setIn('header', 'repeatDate', value)}
                    label="تكرار تاريخ الطباعة أعلى كل صفحة"
                />
            </div>
            {layout.header.layout === 'letterhead' && (
                <>
                    <Field label="موضع الشعار">
                        {(id) => (
                            <select
                                id={id}
                                value={layout.header.logoPosition}
                                onChange={(event) => setIn('header', 'logoPosition', event.target.value)}
                                className="block w-full text-sm"
                            >
                                <option value="right">يمين</option>
                                <option value="center">وسط بين النصين</option>
                                <option value="left">يسار</option>
                            </select>
                        )}
                    </Field>
                    <Field label="المحاذاة العمودية للترويسة">
                        {(id) => (
                            <select
                                id={id}
                                value={layout.header.verticalAlign}
                                onChange={(event) => setIn('header', 'verticalAlign', event.target.value)}
                                className="block w-full text-sm"
                            >
                                <option value="top">أعلى</option>
                                <option value="center">وسط</option>
                                <option value="bottom">أسفل</option>
                            </select>
                        )}
                    </Field>
                    <NumberField
                        label="المسافة بين الشعار والنص (مم)"
                        value={layout.header.gap}
                        min={0}
                        max={15}
                        onChange={(value) => setIn('header', 'gap', value)}
                    />
                </>
            )}
            <div className="grid grid-cols-2 gap-3">
                <NumberField
                    label="عرض الشعار (مم)"
                    value={layout.header.logoWidth}
                    min={10}
                    max={80}
                    onChange={(value) => setIn('header', 'logoWidth', value)}
                />
                <NumberField
                    label="ارتفاع الشعار (مم)"
                    value={layout.header.logoHeight}
                    min={8}
                    max={60}
                    onChange={(value) => setIn('header', 'logoHeight', value)}
                />
            </div>
            <HeaderTypography
                label="النص العربي"
                header={layout.header}
                onChange={(key, value) => setIn('header', key, value)}
                font="companyFont"
                size="companySize"
                bold="companyBold"
                align="companyAlign"
            />
            <HeaderTypography
                label="النص الإنجليزي"
                header={layout.header}
                onChange={(key, value) => setIn('header', key, value)}
                font="englishFont"
                size="englishSize"
                bold="englishBold"
                align="englishAlign"
            />
            <HeaderTypography
                label="عنوان التقرير"
                header={layout.header}
                onChange={(key, value) => setIn('header', key, value)}
                font="titleFont"
                size="titleSize"
                bold="titleBold"
                align="titleAlign"
            />
            <NumberField
                label="حجم السطر الإضافي (بكسل)"
                value={layout.header.subtitleSize}
                min={8}
                max={36}
                onChange={(value) => setIn('header', 'subtitleSize', value)}
            />
            <Field label="الفاصل أسفل الترويسة">
                {(id) => (
                    <select
                        id={id}
                        value={layout.header.ruleStyle}
                        onChange={(event) => setIn('header', 'ruleStyle', event.target.value)}
                        className="block w-full text-sm"
                    >
                        <option value="none">بدون فاصل</option>
                        <option value="single">خط واحد</option>
                        <option value="double">خطان بلونين</option>
                    </select>
                )}
            </Field>
            {layout.header.ruleStyle !== 'none' && (
                <NumberField
                    label="سماكة الفاصل (بكسل)"
                    value={layout.header.ruleWidth}
                    min={0.5}
                    max={4}
                    step={0.5}
                    onChange={(value) => setIn('header', 'ruleWidth', value)}
                />
            )}
            {layout.header.ruleStyle === 'double' && (
                <Field label="لون الخط الثاني">
                    {(id) => (
                        <input
                            id={id}
                            type="color"
                            value={layout.header.ruleColor}
                            onChange={(event) => setIn('header', 'ruleColor', event.target.value)}
                            className="h-9 w-full"
                        />
                    )}
                </Field>
            )}
        </Section>
    );
}
