import { Button } from '@heroui/react';
import { useEffect, useId, useRef, useState } from 'react';
import Modal from '@/Components/Modal';
import ConfirmDialog, { SaveConfirmDialog } from '@/Components/ConfirmDialog';
import { DialogHeader } from '@/Components/DialogFrame';
import Icon from '@/Components/Icon';
import PrimaryButton from '@/Components/PrimaryButton';
import { FormAsideContext, FormProgress, FormSideIndex, useSectionProgress } from '@/Components/Form/FormAside';
import { clearErrorOnInput, submitOnCtrlEnter, validateFormFields } from '@/lib/formValidation';

/**
 * The create/edit modal every resource uses: a header with an icon, the
 * title and a line under it (`description`), the form fields as children,
 * and a save bar with the large save button and a quiet Cancel.
 *
 * `form` comes from useResourceForm(). Saving asks for confirmation first
 * (unless `confirmBeforeSave` is false; `saveConfirmMessage` replaces the
 * question's explanation), and closing with unsaved input
 * asks whether to discard it. Closing clears the form, and a successful
 * save closes the modal. `visitOptions` are passed on to the save request.
 * Fields are checked in the page first, with their errors shown under
 * them rather than in the browser's pop-ups. Ctrl + Enter (⌘ + Enter on a
 * Mac) saves from any field (listed with the other keyboard shortcuts). `action` renames what saving does — its
 * button, and the question before it: `{ submitLabel, title,
 * confirmLabel, icon, tone }`.
 *
 * A long form passes `outline` ([{ id, title, icon, description, fields }]):
 * the window then has the redesign's two panels: the form (its sections
 * scrolling under the header, a footer counting the complete ones) and a
 * side panel with the record's card (FormAsideCard), the sections as an
 * index (the one being read lit, a click scrolling to it, a tick once
 * complete) and `asideNote` under them.
 * An edited record with unsaved changes says so beside the save button.
 */
export default function FormModal({
    show,
    onClose,
    form,
    title,
    description = null,
    icon,
    headerTone = 'brand',
    maxWidth = 'lg',
    visitOptions = {},
    bodyClassName = '',
    confirmBeforeSave = true,
    saveConfirmMessage = null,
    action = null,
    outline = null,
    asideNote = null,
    children,
}) {
    const id = useId();
    // The question shown over the form: 'save' before sending it, 'discard' before throwing away unsaved input.
    const [pendingConfirmation, setPendingConfirmation] = useState(null);
    const [readingSection, setReadingSection] = useState(outline?.[0]?.id ?? null);
    const bodyRef = useRef(null);
    const [asideSlot, setAsideSlot] = useState(null);
    const done = useSectionProgress(outline, form.data);

    // The index lights the section being read as the form scrolls.
    useEffect(() => {
        const body = bodyRef.current;
        if (!outline || !body) {
            return undefined;
        }
        function onScroll() {
            const top = body.getBoundingClientRect().top;
            let current = outline[0].id;
            for (const section of outline) {
                const element = document.getElementById(section.id);
                if (element && element.getBoundingClientRect().top - top < 120) {
                    current = section.id;
                }
            }
            if (body.scrollTop + body.clientHeight >= body.scrollHeight - 4) {
                current = outline.at(-1).id;
            }
            setReadingSection(current);
        }
        body.addEventListener('scroll', onScroll, { passive: true });
        return () => body.removeEventListener('scroll', onScroll);
    }, [outline, show]);

    function goToSection(sectionId) {
        const element = document.getElementById(sectionId);
        const body = bodyRef.current;
        if (element && body) {
            body.scrollTo({ top: element.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 16, behavior: 'smooth' });
            setReadingSection(sectionId);
        }
    }

    function close() {
        setPendingConfirmation(null);
        form.resetAndClearErrors();
        onClose();
    }

    function requestClose() {
        if (form.isDirty) {
            setPendingConfirmation('discard');
        } else {
            close();
        }
    }

    function save() {
        setPendingConfirmation(null);
        form.save({ preserveScroll: true, onSuccess: close, ...visitOptions });
    }

    function submit(e) {
        e.preventDefault();

        if (!validateFormFields(e.currentTarget, form)) {
            return;
        }

        if (confirmBeforeSave) {
            setPendingConfirmation('save');
        } else {
            save();
        }
    }

    return (
        <>
            <Modal show={show} onClose={requestClose} maxWidth={maxWidth} panelClassName={outline ? 'gl-fm-panel' : ''}>
                <form
                    aria-labelledby={`${id}-title`}
                    noValidate
                    onSubmit={submit}
                    onInput={(e) => clearErrorOnInput(e, form)}
                    onKeyDown={submitOnCtrlEnter}
                    className={outline ? 'gl-fm' : 'flex max-h-[90vh] flex-col'}
                >
                    {outline ? (
                        <FormAsideContext value={{ slot: asideSlot }}>
                            <div className="gl-fm-main">
                                <DialogHeader titleId={`${id}-title`} title={title} description={description} icon={icon} tone={headerTone} onClose={requestClose} />
                                <div ref={bodyRef} className={`gl-fm-body ${bodyClassName}`}>{children}</div>
                                <div className="gl-fm-foot">
                                    <FormProgress sections={outline} done={done} />
                                    <span className="flex-1" />
                                    {form.isEdit && form.isDirty && <span className="gl-unsaved" role="status">تغييرات غير محفوظة</span>}
                                    <Button data-raw="" variant="ghost" onClick={requestClose} className="gl-btn gl-sec">إلغاء</Button>
                                    <PrimaryButton disabled={form.processing} className="min-w-[120px]">
                                        <Icon name="check" className="h-[18px] w-[18px]" />
                                        {form.processing ? 'جارٍ الحفظ...' : (action?.submitLabel ?? 'حفظ')}
                                    </PrimaryButton>
                                </div>
                            </div>
                            <aside className="gl-fm-side" aria-label="ملخص النموذج">
                                <div ref={setAsideSlot} className="gl-fm-card" />
                                <FormSideIndex sections={outline} current={readingSection} done={done} errors={form.errors} onPick={goToSection} />
                                {asideNote && <p className="gl-fm-note"><Icon name="info" className="h-4 w-4 shrink-0" />{asideNote}</p>}
                            </aside>
                        </FormAsideContext>
                    ) : (
                        <>
                            <DialogHeader titleId={`${id}-title`} title={title} description={description} icon={icon} tone={headerTone} onClose={requestClose} />
                            <div ref={bodyRef} className={`min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-2 pt-4 sm:px-6 ${bodyClassName}`}>{children}</div>
                            <div className="gl-dialog-foot flex shrink-0 flex-wrap items-center gap-3 px-5 sm:px-6">
                                <span className="gl-sheet-keys"><span className="kbd" dir="ltr">Esc</span> إغلاق</span>
                                <span className="flex-1" />
                                {form.isEdit && form.isDirty && <span className="gl-unsaved" role="status">تغييرات غير محفوظة</span>}
                                <Button data-raw="" variant="ghost" onClick={requestClose} className="gl-btn gl-sec gl-lg">إلغاء</Button>
                                <PrimaryButton disabled={form.processing} className="gl-lg min-w-[148px]">
                                    <Icon name="check" className="h-[18px] w-[18px]" />
                                    {form.processing ? 'جارٍ الحفظ...' : (action?.submitLabel ?? 'حفظ')}
                                </PrimaryButton>
                            </div>
                        </>
                    )}
                </form>
            </Modal>

            <SaveConfirmDialog
                show={show && pendingConfirmation === 'save'}
                isEdit={form.isEdit}
                message={saveConfirmMessage}
                action={action}
                onConfirm={save}
                onCancel={() => setPendingConfirmation(null)}
            />

            <ConfirmDialog
                show={show && pendingConfirmation === 'discard'}
                onConfirm={close}
                onCancel={() => setPendingConfirmation(null)}
                title="تجاهل التغييرات؟"
                message="أدخلت بيانات لم تُحفظ بعد. إذا أغلقت النافذة الآن فستفقدها."
                confirmLabel="تجاهل التغييرات"
                cancelLabel="البقاء ومتابعة التعديل"
                icon="alert"
                tone="danger"
            />
        </>
    );
}
