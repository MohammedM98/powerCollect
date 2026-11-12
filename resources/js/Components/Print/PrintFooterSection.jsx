import Icon from '@/Components/Icon';
import ChoiceChips from '@/Components/ChoiceChips';
import Switch from '@/Components/Switch';
import SecondaryButton from '@/Components/SecondaryButton';
import { PAGE_NUMBER_POSITIONS } from './printSettingsOptions';
import { Section, Field, Group, IconButton } from './PrintSettingsFields';

/** The printout's footer settings: its text, page numbers and the signature lines. */
export default function PrintFooterSection({ layout, setIn, setSignature }) {
    return (
        <Section icon="page-footer" title="التذييل والتواقيع">
            <Field label="نص أسفل كل صفحة">
                {(id) => (
                    <input
                        id={id}
                        type="text"
                        value={layout.footer.text}
                        onChange={(e) => setIn('footer', 'text', e.target.value)}
                        placeholder="مثلًا: العنوان ورقم الهاتف"
                        className="block w-full text-sm"
                    />
                )}
            </Field>
            <div className="grid grid-cols-1 gap-3">
                <Switch
                    checked={layout.footer.pageNumbers}
                    onChange={(value) => setIn('footer', 'pageNumbers', value)}
                    label="ترقيم الصفحات (صفحة 1 من 3)"
                />
                {layout.footer.pageNumbers && (
                    <Group label="موضع رقم الصفحة">
                        <ChoiceChips
                            options={PAGE_NUMBER_POSITIONS}
                            value={layout.footer.pageNumberPosition ?? 'left'}
                            onChange={(value) => setIn('footer', 'pageNumberPosition', value)}
                            label="موضع رقم الصفحة"
                        />
                    </Group>
                )}
                <Switch
                    checked={layout.footer.summary}
                    onChange={(value) => setIn('footer', 'summary', value)}
                    label="إظهار ملخص الصفحة (المجاميع) إن وُجد"
                />
            </div>
            <Field label="ملاحظات في نهاية الطباعة">
                {(id) => (
                    <textarea
                        id={id}
                        rows={3}
                        value={layout.footer.notes}
                        onChange={(e) => setIn('footer', 'notes', e.target.value)}
                        className="block w-full text-sm"
                    />
                )}
            </Field>
            <Group label={`خانات التوقيع (${layout.footer.signatures.length})`}>
                <div className="space-y-2">
                    {layout.footer.signatures.map((label, index) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => setSignature(index, e.target.value)}
                                aria-label={`اسم خانة التوقيع ${index + 1}`}
                                placeholder="مثلًا: المحاسب"
                                className="block min-w-0 flex-1 text-sm"
                            />
                            <IconButton
                                icon="trash"
                                tone="danger"
                                label={`حذف خانة التوقيع ${label || index + 1}`}
                                onClick={() =>
                                    setIn(
                                        'footer',
                                        'signatures',
                                        layout.footer.signatures.filter((_, position) => position !== index),
                                    )
                                }
                            />
                        </div>
                    ))}
                    {layout.footer.signatures.length < 4 && (
                        <SecondaryButton onClick={() => setIn('footer', 'signatures', [...layout.footer.signatures, ''])} className="w-full">
                            <Icon name="plus" className="h-4 w-4" />
                            إضافة خانة توقيع
                        </SecondaryButton>
                    )}
                </div>
            </Group>
        </Section>
    );
}
