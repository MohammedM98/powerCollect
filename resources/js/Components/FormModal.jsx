import { useEffect, useId, useRef, useState } from 'react';
import Modal from '@/Components/Modal';
import ConfirmDialog, { SaveConfirmDialog } from '@/Components/ConfirmDialog';
import { DialogHeader } from '@/Components/DialogFrame';
import Icon from '@/Components/Icon';
import PrimaryButton from '@/Components/PrimaryButton';
import FormOutline from '@/Components/Form/FormOutline';
import { clearErrorOnInput, focusInvalidControl, submitOnCtrlEnter, validateFieldOnBlur, validateFormFields } from '@/lib/formValidation';

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
 * A long form passes `outline` ([{ id, title, icon }]): an index of its
 * sections down the side, the one being read lit, a click scrolling to it.
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
    className = '',
    confirmBeforeSave = true,
    validateOnBlur = false,
    saveConfirmMessage = null,
    action = null,
    outline = null,
    onSaveAnother,
    children,
}) {
    const id = useId();
    // A confirmation can keep either submit action pending, or discard unsaved input.
    const [pendingConfirmation, setPendingConfirmation] = useState(null);
    const [readingSection, setReadingSection] = useState(outline?.[0]?.id ?? null);
    const bodyRef = useRef(null);
    const formRef = useRef(null);

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
        if (form.processing) return;
        if (form.isDirty) {
            setPendingConfirmation('discard');
        } else {
            close();
        }
    }

    function save(another = false) {
        setPendingConfirmation(null);
        form.save({
            preserveScroll: true,
            ...visitOptions,
            onSuccess: another ? onSaveAnother : (visitOptions.onSuccess ?? close),
            onError: (errors) => {
                if (validateOnBlur && formRef.current) {
                    focusInvalidControl([...formRef.current.elements].find((field) => field.willValidate && errors[field.name || field.id]));
                }
                visitOptions.onError?.(errors);
            },
        });
    }

    function submitForm(element, another = false) {
        if (form.processing || !validateFormFields(element, form)) {
            return;
        }

        if (confirmBeforeSave) {
            setPendingConfirmation(another ? 'save-another' : 'save');
        } else {
            save(another);
        }
    }

    return (
        <>
            <Modal show={show} onClose={requestClose} maxWidth={maxWidth}>
                <form
                    ref={formRef}
                    aria-labelledby={`${id}-title`}
                    noValidate
                    onSubmit={(e) => {
                        e.preventDefault();
                        submitForm(e.currentTarget);
                    }}
                    onInput={(e) => clearErrorOnInput(e, form)}
                    onBlur={validateOnBlur ? (e) => validateFieldOnBlur(e, form) : undefined}
                    onKeyDown={submitOnCtrlEnter}
                    className={`flex max-h-[var(--gl-modal-height)] min-h-0 flex-col ${className}`}
                >
                    <DialogHeader
                        titleId={`${id}-title`}
                        title={title}
                        description={description}
                        icon={icon}
                        tone={headerTone}
                        onClose={requestClose}
                        closeDisabled={form.processing}
                    />
                    {outline ? (
                            <div className="gl-outline-layout">
                                <FormOutline sections={outline} current={readingSection} onPick={goToSection} />
                                <div ref={bodyRef} className={`min-h-0 space-y-8 overflow-y-auto px-5 pb-4 pt-5 sm:px-6 ${bodyClassName}`}>{children}</div>
                            </div>
                        ) : (
                            <div ref={bodyRef} className={`min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-2 pt-4 sm:px-6 ${bodyClassName}`}>{children}</div>
                    )}

                    <div className={`gl-dialog-foot flex shrink-0 flex-wrap items-center gap-3 px-5 sm:px-6 ${outline ? 'border-t border-[color:var(--gl-line)]' : ''}`}>
                        <kbd className="tn-kbd hidden sm:inline-flex" dir="ltr">Ctrl + Enter</kbd>
                        <span className="flex-1" />
                        <button type="button" onClick={requestClose} disabled={form.processing} className="gl-btn gl-ghost">إلغاء</button>
                        {form.isEdit && form.isDirty && <span className="gl-unsaved" role="status">تغييرات غير محفوظة</span>}
                        {onSaveAnother && (
                            <button type="button" disabled={form.processing} className="gl-btn gl-sec" onClick={() => submitForm(formRef.current, true)}>
                                حفظ وإضافة آخر
                            </button>
                        )}
                        <PrimaryButton type="submit" disabled={form.processing} className="gl-lg min-w-[148px]">
                            <Icon name="check" className="h-[18px] w-[18px]" />
                            {form.processing ? 'جارٍ الحفظ...' : (action?.submitLabel ?? 'حفظ')}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            <SaveConfirmDialog
                show={show && (pendingConfirmation === 'save' || pendingConfirmation === 'save-another')}
                isEdit={form.isEdit}
                message={saveConfirmMessage}
                action={action}
                onConfirm={() => save(pendingConfirmation === 'save-another')}
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
