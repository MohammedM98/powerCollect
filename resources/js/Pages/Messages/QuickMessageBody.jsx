import { Button } from '@heroui/react';
import Icon from '@/Components/UI/Icon';
import InputError from '@/Components/UI/InputError';
import { smsParts } from '@/lib/disconnections';
import { MessageText } from './MessageParts';
import { FOCUS_RING, Section } from './MessageFormParts';
import { ChoiceSelect, TextArea } from '@/Components/UI';

/** The quick message's text: the kind's templates, the fields to insert, and the preview for one recipient. */
export default function QuickMessageBody({
    body,
    bodyRef,
    channel,
    errors,
    id,
    insertPlaceholder,
    kind,
    kindTemplates,
    pickTemplate,
    previewRow,
    previewText,
    setBody,
    setup,
    templateId,
}) {
    return (
        <Section title="نص الرسالة" hint="اضغط على أي معلومة لإضافتها، وتُكتب لكل مشترك بقيمته.">
            {kindTemplates.length > 0 && (
                <div>
                    <label htmlFor={`${id}-template`} className="mb-2 block text-sm font-semibold text-(--ma-ink)">
                        القالب
                    </label>
                    <ChoiceSelect id={`${id}-template`} value={templateId} onChange={(e) => pickTemplate(e.target.value)} className="block w-full text-sm">
                        <option value="">— بدون قالب —</option>
                        {kindTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                            </option>
                        ))}
                    </ChoiceSelect>
                </div>
            )}
            <div role="group" aria-label="أضف معلومة من بيانات المشترك إلى النص" className="flex flex-wrap gap-2">
                {setup.placeholders[kind].map((name) => (
                    <Button data-raw="" variant="ghost"
                        key={name}
                        onClick={() => insertPlaceholder(name)}
                        aria-label={`أضف «${name.replaceAll('_', ' ')}» إلى نص الرسالة`}
                        className={`inline-flex items-center gap-1 rounded-full border border-(--ma-line) bg-(--ma-tile) px-3 py-1 text-xs font-semibold text-(--ma-ink) transition hover:border-(--ma-brand) hover:text-(--ma-brand) ${FOCUS_RING}`}
                    >
                        <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
                        {name.replaceAll('_', ' ')}
                    </Button>
                ))}
            </div>
            <label htmlFor={`${id}-body`} className="sr-only">
                نص الرسالة
            </label>
            <TextArea
                ref={bodyRef}
                id={`${id}-body`}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                className="block w-full text-sm leading-7"
                placeholder="اكتب الرسالة هنا..."
                aria-describedby={`${id}-body-length`}
                aria-invalid={errors.body ? true : undefined}
            />
            <InputError message={errors.body} />
            {previewRow && body.trim() !== '' && (
                <div>
                    <p className="mb-2 text-xs font-semibold text-(--ma-muted)">كما تصل إلى {previewRow.name}:</p>
                    <div className="whitespace-pre-line rounded-2xl rounded-ss-sm bg-(--ma-pay-s) px-4 py-3 text-sm leading-7 text-(--ma-ink)">
                        <MessageText text={previewText} />
                    </div>
                </div>
            )}
            <p id={`${id}-body-length`} className="text-xs text-(--ma-muted)">
                {previewText.length} حرفًا
                {channel === 'sms' && <> — نحو {smsParts(previewText)} رسالة SMS لكل مشترك</>}
            </p>
        </Section>
    );
}
