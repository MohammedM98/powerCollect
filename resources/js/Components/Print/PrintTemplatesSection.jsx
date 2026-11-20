import { Input } from '@heroui/react';
import { useState } from 'react';
import Icon from '@/Components/Icon';
import Switch from '@/Components/Switch';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import ConfirmDialog from '@/Components/ConfirmDialog';
import { PRINT_PRESETS } from '@/lib/printLayout';
import { FOCUS_RING } from './printSettingsOptions';
import { Section, Field, IconButton } from './PrintSettingsFields';

/**
 * The company's print templates for this list: open one, save the design
 * into the one in use or as a new one, make one the list's default, or
 * delete it. Without the permission to manage them they can only be
 * opened. A list that can't keep templates says so.
 */
export function TemplatesSection({ templates, onReset, onPreset }) {
    const { list, active, isChanged, supported, canManage, errors, actions } = templates;
    const [selected, setSelected] = useState('');
    const [newName, setNewName] = useState('');
    const [newIsDefault, setNewIsDefault] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    return (
        <Section id="print-template-settings" icon="folder" title="قوالب الطباعة" open>
            <Field label="البدء من تصميم جاهز" hint="اختر المظهر ثم عدّله واحفظه بالاسم الذي تريده. بيانات التقرير تبقى من القائمة الحالية.">
                {(id) => (
                    <select
                        id={id}
                        value=""
                        onChange={(event) => {
                            const preset = PRINT_PRESETS.find((item) => item.id === event.target.value);
                            if (!preset) return;
                            onPreset(preset.id);
                            setNewName(preset.name);
                            setNewIsDefault(false);
                        }}
                        className="block w-full text-sm"
                    >
                        <option value="">— اختر تصميمًا —</option>
                        {PRINT_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                                {preset.name} — {preset.description}
                            </option>
                        ))}
                    </select>
                )}
            </Field>
            {!supported ? (
                <p className="text-xs text-gray-500">هذه الصفحة لا تحفظ قوالب. يُحفظ آخر تصميم لها في هذا المتصفح.</p>
            ) : (
                <>
                    <div className="rounded-control border border-gray-200 bg-gray-50 px-3 py-2 text-sm" aria-live="polite">
                        {active ? (
                            <span className="flex flex-wrap items-center gap-2">
                                <Icon name="folder" className="h-4 w-4 text-gray-500" />
                                القالب: <b>{active.name}</b>
                                {active.isDefault && (
                                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                        افتراضي
                                    </span>
                                )}
                                {isChanged && (
                                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                        تعديلات غير محفوظة
                                    </span>
                                )}
                            </span>
                        ) : (
                            <span className="text-gray-600">تصميم غير محفوظ في قالب</span>
                        )}
                    </div>

                    {active && canManage && isChanged && (
                        <PrimaryButton type="button" onClick={actions.saveChanges} className="w-full">
                            <Icon name="check" className="h-4 w-4" />
                            حفظ التعديلات في «{active.name}»
                        </PrimaryButton>
                    )}

                    {list.length > 0 ? (
                        <Field label="فتح قالب">
                            {(id) => (
                                <div className="flex gap-2">
                                    <select
                                        id={id}
                                        value={selected}
                                        onChange={(e) => setSelected(e.target.value)}
                                        className="block min-w-0 flex-1 text-sm"
                                    >
                                        <option value="">— اختر قالبًا —</option>
                                        {list.map((template) => (
                                            <option key={template.id} value={template.id}>
                                                {template.name}
                                                {template.isDefault ? ' (افتراضي)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <SecondaryButton onClick={() => actions.apply(selected)} disabled={selected === ''}>
                                        <Icon name="check" className="h-4 w-4" />
                                        فتح
                                    </SecondaryButton>
                                </div>
                            )}
                        </Field>
                    ) : (
                        <p className="text-xs text-gray-500">لا توجد قوالب محفوظة لهذه القائمة بعد.</p>
                    )}

                    {canManage && (
                        <>
                            {active && (
                                <div className="flex gap-2">
                                    <SecondaryButton
                                        onClick={() => actions.setDefault(active.id, !active.isDefault)}
                                        className="flex-1 px-2! text-xs"
                                    >
                                        <Icon name={active.isDefault ? 'close' : 'check'} className="h-4 w-4" />
                                        {active.isDefault ? 'إلغاء كونه الافتراضي' : 'جعله الافتراضي لهذه القائمة'}
                                    </SecondaryButton>
                                    <IconButton
                                        icon="trash"
                                        tone="danger"
                                        label={`حذف القالب «${active.name}»`}
                                        onClick={() => setConfirmingDelete(true)}
                                    />
                                </div>
                            )}
                            <Field label="حفظ التصميم كقالب جديد">
                                {(id) => (
                                    <form
                                        className="space-y-2"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            actions.saveNew(newName.trim(), newIsDefault, () => {
                                                setNewName('');
                                                setNewIsDefault(false);
                                            });
                                        }}
                                    >
                                        <div className="flex gap-2">
                                            <Input
                                                id={id}
                                                type="text"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                placeholder="مثلًا: ورقة مقاصة — فرع مخيم 2"
                                                aria-invalid={errors.name ? true : undefined}
                                                className="block min-w-0 flex-1 text-sm"
                                            />
                                            <PrimaryButton type="submit" disabled={newName.trim() === ''}>
                                                <Icon name="plus" className="h-4 w-4" />
                                                حفظ
                                            </PrimaryButton>
                                        </div>
                                        {errors.name && <p className="text-xs text-brand-600">{errors.name}</p>}
                                        <Switch checked={newIsDefault} onChange={setNewIsDefault} label="اجعله الافتراضي لهذه القائمة" />
                                    </form>
                                )}
                            </Field>
                            <a
                                href="/settings/print-templates"
                                target="_blank"
                                rel="noopener"
                                className={`flex items-center gap-1.5 rounded text-xs font-semibold text-brand-600 hover:underline ${FOCUS_RING}`}
                            >
                                <Icon name="external" className="h-4 w-4" />
                                كل قوالب الطباعة (صفحة القوالب)
                            </a>
                        </>
                    )}
                    {!canManage && <p className="text-xs text-gray-500">حفظ القوالب يحتاج صلاحية «إدارة قوالب الطباعة».</p>}
                </>
            )}

            <SecondaryButton onClick={onReset} className="w-full">
                <Icon name="undo" className="h-4 w-4" />
                إرجاع كل الإعدادات إلى الأصل
            </SecondaryButton>

            <ConfirmDialog
                show={confirmingDelete}
                onConfirm={() => {
                    actions.remove(active.id);
                    setConfirmingDelete(false);
                }}
                onCancel={() => setConfirmingDelete(false)}
                title="حذف القالب؟"
                message={`سيُحذف القالب «${active?.name ?? ''}» من قوالب الشركة، لكل المستخدمين.`}
                confirmLabel="نعم، احذف"
                icon="trash"
                tone="danger"
            />
        </Section>
    );
}
