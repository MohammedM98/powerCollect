import { Button, Input, TextArea } from '@heroui/react';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import { Card, Field, FOCUS_RING } from './MessageFormParts';
import { smsParts } from '@/lib/disconnections';
import { ChoiceSelect, PrimaryKey, SecondaryKey } from '@/Components/UI';

/** Arabic text goes out as Unicode SMS: 70 letters in one message, 67 in each part of a longer one. */

/** The message text: the kind's templates, the fields to insert, and saving or deleting a template. */
export default function MessageBodyCard({
    body,
    bodyRef,
    channel,
    errors,
    insertPlaceholder,
    kind,
    kindTemplates,
    pickTemplate,
    placeholders,
    previewText,
    saveTemplate,
    selectedTemplate,
    setBody,
    setConfirmingTemplateDelete,
    setTemplateName,
    templateId,
    templateName,
    updateTemplate,
    canManageTemplates,
}) {
    return (
        <Card icon="note" title="نص الرسالة" description="اضغط على أي معلومة لإضافتها، وتُكتب لكل مشترك بقيمته.">
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <Field label="القالب" htmlFor="template" className="min-w-[200px] flex-1">
                    <ChoiceSelect id="template" value={templateId} onChange={(e) => pickTemplate(e.target.value)} className="block w-full text-sm">
                        <option value="">— بدون قالب —</option>
                        {kindTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                            </option>
                        ))}
                    </ChoiceSelect>
                </Field>
                {canManageTemplates && selectedTemplate && selectedTemplate.body !== body && (
                    <SecondaryKey onClick={updateTemplate}>
                        <Icon name="check" className="h-4 w-4" />
                        حفظ التعديل على القالب
                    </SecondaryKey>
                )}
                {canManageTemplates && selectedTemplate && (
                    <SecondaryKey
                        onClick={() => setConfirmingTemplateDelete(true)}
                        aria-label={`حذف القالب «${selectedTemplate.name}»`}
                        title="حذف القالب"
                        className="text-brand-600 hover:border-brand-500/40!"
                    >
                        <Icon name="trash" className="h-4 w-4" />
                        <span className="hidden sm:inline">حذف</span>
                    </SecondaryKey>
                )}
                {canManageTemplates && templateName === null && (
                    <SecondaryKey onClick={() => setTemplateName('')} disabled={body.trim() === ''}>
                        <Icon name="plus" className="h-4 w-4" />
                        حفظ كقالب جديد
                    </SecondaryKey>
                )}
            </div>

            {templateName !== null && (
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-control bg-gray-50 p-3">
                    <Field label="اسم القالب" htmlFor="template_name" className="min-w-[200px] flex-1">
                        <Input
                            id="template_name"
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            className="block w-full text-sm"
                            autoFocus
                        />
                        <InputError message={errors.name} className="mt-1" />
                    </Field>
                    <PrimaryKey type="button" onClick={saveTemplate} disabled={templateName.trim() === ''}>
                        <Icon name="check" className="h-4 w-4" />
                        حفظ القالب
                    </PrimaryKey>
                    <SecondaryKey onClick={() => setTemplateName(null)}>إلغاء</SecondaryKey>
                </div>
            )}

            <p id="placeholders-hint" className="mb-2 text-xs font-semibold text-gray-600">
                أضف معلومة من بيانات المشترك إلى النص:
            </p>
            <div role="group" aria-labelledby="placeholders-hint" className="mb-3 flex flex-wrap gap-2">
                {placeholders[kind].map((name) => (
                    <Button data-raw="" variant="ghost"
                        key={name}
                        onClick={() => insertPlaceholder(name)}
                        aria-label={`أضف «${name.replaceAll('_', ' ')}» إلى نص الرسالة`}
                        title={`أضف ${name.replaceAll('_', ' ')} مكان المؤشر`}
                        className={`inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-brand-500/40 hover:text-brand-600 ${FOCUS_RING}`}
                    >
                        <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
                        {name.replaceAll('_', ' ')}
                    </Button>
                ))}
            </div>

            <label htmlFor="body" className="sr-only">
                نص الرسالة
            </label>
            <TextArea
                ref={bodyRef}
                id="body"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                className="block w-full text-sm leading-7"
                placeholder="اكتب الرسالة هنا..."
                aria-describedby="body-length"
                aria-invalid={errors.body ? true : undefined}
            />
            <InputError message={errors.body} className="mt-1" />
            <div id="body-length" className="mt-1 text-xs text-gray-500">
                {previewText.length} حرفًا
                {channel === 'sms' && <> — نحو {smsParts(previewText)} رسالة SMS لكل مشترك</>}
            </div>
        </Card>
    );
}
