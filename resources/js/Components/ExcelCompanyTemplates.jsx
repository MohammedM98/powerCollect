import CheckBox from '@/Components/CheckBox';
import { Button } from '@heroui/react';
import Icon from '@/Components/Icon';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { Section } from './ExcelStudioParts';

/** The company's shared Excel templates: applying one, and, for whoever manages them, saving the current settings as one or making one the default. */
export default function ExcelCompanyTemplates({
    saveCompanyTemplate,
    sendCompany,
    applyTemplate,
    company,
    companyDefault,
    companyName,
    layout,
    saveHttp,
    setCompanyDefault,
    setCompanyName,
}) {
    return (
        <Section title="قوالب الشركة" hint="مشتركة بين جميع المستخدمين">
            {company.templates.length === 0 ? (
                <p className="mb-3 text-xs leading-5 text-gray-500">
                    لا قوالب للشركة بعد.{!company.canManage && ' يضيفها من يملك صلاحية إدارة قوالب الطباعة.'}
                </p>
            ) : (
                <ul className="mb-3 overflow-hidden rounded-control border border-gray-100">
                    {company.templates.map((template) => (
                        <li key={template.id} className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2 last:border-b-0">
                            <Button data-raw="" variant="ghost"
                                className="min-w-0 flex-1 text-start text-sm"
                                onClick={() => applyTemplate(template.settings)}
                                title="تطبيق القالب"
                            >
                                <b className="block truncate font-semibold text-gray-900">{template.name}</b>
                                {template.updatedBy && (
                                    <small className="block truncate text-xs text-gray-500">آخر تعديل: {template.updatedBy}</small>
                                )}
                            </Button>
                            {template.isDefault && (
                                <span className="shrink-0 rounded-full bg-excel-500/10 px-2 py-0.5 text-[11px] font-bold text-excel-700">
                                    الافتراضي
                                </span>
                            )}
                            {company.canManage && (
                                <>
                                    <Button data-raw="" variant="ghost"
                                        isDisabled={saveHttp.processing}
                                        onClick={() => sendCompany('put', `/excel-templates/${template.id}`, { settings: layout() })}
                                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
                                        aria-label={`حفظ الإعداد الحالي في ${template.name}`}
                                        title="حفظ الإعداد الحالي فيه"
                                    >
                                        <Icon name="check" className="h-4 w-4" />
                                    </Button>
                                    <Button data-raw="" variant="ghost"
                                        isDisabled={saveHttp.processing}
                                        onClick={() => sendCompany('put', `/excel-templates/${template.id}`, { is_default: !template.isDefault })}
                                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
                                        aria-label={
                                            template.isDefault ? `إلغاء ${template.name} كقالب افتراضي` : `جعل ${template.name} القالب الافتراضي`
                                        }
                                        title={template.isDefault ? 'إلغاء الافتراضي' : 'جعله الافتراضي'}
                                    >
                                        <Icon name="pin" className="h-4 w-4" />
                                    </Button>
                                    <Button data-raw="" variant="ghost"
                                        isDisabled={saveHttp.processing}
                                        onClick={() =>
                                            window.confirm(`حذف القالب «${template.name}» لجميع المستخدمين؟`) &&
                                            sendCompany('delete', `/excel-templates/${template.id}`, {})
                                        }
                                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                        aria-label={`حذف القالب ${template.name}`}
                                        title="حذف"
                                    >
                                        <Icon name="trash" className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {company.canManage && (
                <>
                    <div className="flex gap-2">
                        <TextInput
                            className="min-w-0 flex-1 text-sm"
                            placeholder="اسم قالب الشركة، مثلاً: تقرير الإدارة"
                            value={companyName}
                            onChange={(event) => setCompanyName(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && saveCompanyTemplate()}
                            aria-label="اسم قالب الشركة"
                            maxLength={60}
                        />
                        <SecondaryButton onClick={saveCompanyTemplate} disabled={!companyName.trim() || saveHttp.processing}>
                            حفظ للشركة
                        </SecondaryButton>
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
                        <CheckBox
                            checked={companyDefault}
                            onChange={(event) => setCompanyDefault(event.target.checked)}
                        />
                        القالب الافتراضي لكل من يصدّر هذا التقرير
                    </label>
                    {Object.values(saveHttp.errors ?? {})[0] && (
                        <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
                            {Object.values(saveHttp.errors)[0]}
                        </p>
                    )}
                </>
            )}
        </Section>
    );
}
