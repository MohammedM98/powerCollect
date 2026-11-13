import { useEffect, useId, useRef, useState } from 'react';
import Modal from '@/Components/Modal';
import ConfirmDialog, { SaveConfirmDialog } from '@/Components/ConfirmDialog';
import { DialogHeader } from '@/Components/DialogFrame';
import Icon from '@/Components/Icon';
import PrimaryButton from '@/Components/PrimaryButton';
import { FormOutline, FormStepContext, StepIndicator } from '@/Components/Form/FormSteps';
import { clearErrorOnInput, fieldsWithin, submitOnCtrlEnter, validateFields, validateFormFields } from '@/lib/formValidation';

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
 * Two layouts for long forms:
 * - `steps` ([{ title }]): the fields in steps (Components/Form/FormSteps
 *   `FormStep`), a numbered line under the title, "التالي" checking only the
 *   step's fields and "السابق" going back; saving on the last step. An error
 *   in another step (the browser's or the server's) opens that step.
 * - `outline` ([{ id, title, icon }]): an index of the form's sections down
 *   the side, the one being read lit, a click scrolling to it.
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
    steps = null,
    outline = null,
    children,
}) {
    const id = useId();
    // The question shown over the form: 'save' before sending it, 'discard' before throwing away unsaved input.
    const [pendingConfirmation, setPendingConfirmation] = useState(null);
    const [step, setStep] = useState(0);
    const [readingSection, setReadingSection] = useState(outline?.[0]?.id ?? null);
    const bodyRef = useRef(null);
    const lastStep = steps ? steps.length - 1 : 0;

    // An error the server found in another step opens that step.
    useEffect(() => {
        if (!steps || Object.keys(form.errors).length === 0) {
            return;
        }
        const invalid = bodyRef.current?.querySelector('[aria-invalid="true"], [data-input-error]');
        const stepOfError = invalid?.closest('[data-form-step]')?.dataset.formStep;
        if (stepOfError !== undefined && Number(stepOfError) !== step) {
            setStep(Number(stepOfError));
        }
    }, [form.errors]); // eslint-disable-line react-hooks/exhaustive-deps

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

    function showStep(next) {
        setStep(next);
        bodyRef.current?.scrollTo({ top: 0 });
    }

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
        setStep(0);
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

        // Before the last step, Enter or "التالي" checks this step's fields and moves on.
        if (steps && step < lastStep) {
            if (validateFields(fieldsWithin(bodyRef.current?.querySelector(`[data-form-step="${step}"]`)), form)) {
                showStep(step + 1);
            }
            return;
        }

        if (!validateFormFields(e.currentTarget, form)) {
            // A field that failed in an earlier step: open that step, then put the cursor in it.
            const invalid = [...e.currentTarget.elements].find((field) => field.willValidate && !field.checkValidity());
            const stepOfInvalid = invalid?.closest('[data-form-step]')?.dataset.formStep;
            if (steps && stepOfInvalid !== undefined) {
                showStep(Number(stepOfInvalid));
                requestAnimationFrame(() => invalid.focus());
            }
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
            <Modal show={show} onClose={requestClose} maxWidth={maxWidth}>
                <form
                    aria-labelledby={`${id}-title`}
                    noValidate
                    onSubmit={submit}
                    onInput={(e) => clearErrorOnInput(e, form)}
                    onKeyDown={submitOnCtrlEnter}
                    className="flex max-h-[90vh] flex-col"
                >
                    <DialogHeader
                        titleId={`${id}-title`}
                        title={title}
                        description={steps ? `الخطوة ${step + 1} من ${steps.length}: ${steps[step].title}` : description}
                        icon={icon}
                        tone={headerTone}
                        onClose={requestClose}
                    />
                    {steps && <StepIndicator steps={steps} current={step} />}

                    <FormStepContext.Provider value={steps ? step : null}>
                        {outline ? (
                            <div className="gl-outline-layout">
                                <FormOutline sections={outline} current={readingSection} onPick={goToSection} />
                                <div ref={bodyRef} className={`min-h-0 space-y-8 overflow-y-auto px-5 pb-4 pt-5 sm:px-6 ${bodyClassName}`}>{children}</div>
                            </div>
                        ) : (
                            <div ref={bodyRef} className={`min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-2 pt-4 sm:px-6 ${bodyClassName}`}>{children}</div>
                        )}
                    </FormStepContext.Provider>

                    <div className={`gl-dialog-foot flex shrink-0 flex-wrap items-center gap-3 px-5 sm:px-6 ${outline ? 'border-t border-[color:var(--gl-line)]' : ''}`}>
                        {steps && step > 0 ? (
                            <button type="button" onClick={() => showStep(step - 1)} className="gl-btn gl-ghost">
                                <Icon name="chevron-right" className="h-4 w-4" />
                                السابق
                            </button>
                        ) : (
                            <button type="button" onClick={requestClose} className="gl-btn gl-ghost">إلغاء</button>
                        )}
                        <span className="flex-1" />
                        {form.isEdit && form.isDirty && <span className="gl-unsaved" role="status">تغييرات غير محفوظة</span>}
                        <PrimaryButton disabled={form.processing} className="gl-lg min-w-[148px]">
                            {steps && step < lastStep ? (
                                <>
                                    التالي
                                    <Icon name="chevron-left" className="h-[18px] w-[18px]" />
                                </>
                            ) : (
                                <>
                                    <Icon name="check" className="h-[18px] w-[18px]" />
                                    {form.processing ? 'جارٍ الحفظ...' : (action?.submitLabel ?? 'حفظ')}
                                </>
                            )}
                        </PrimaryButton>
                    </div>
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
