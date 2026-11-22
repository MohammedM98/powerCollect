import { useEffect, useState } from 'react';
import { FormAsideContext, FormProgress, FormSideIndex, useSectionProgress } from '@/Components/Form/FormAside';
import Icon from '@/Components/UI/Icon';
import { Head, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { SaveConfirmDialog } from '@/Components/UI/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import PrimaryButton from '@/Components/UI/PrimaryButton';
import { clearErrorOnInput, submitOnCtrlEnter, validateFormFields } from '@/lib/formValidation';

/**
 * The standalone Create/Edit page every resource uses: the form's sections
 * (children, each its own card) and, under them, a bar that stays in view
 * holding Cancel and Save on a floating dock (ma-forms.css `ma-form-dock`). Saving asks for
 * confirmation first; Ctrl + Enter saves from any field.
 *
 * `form` comes from useResourceForm(); `cancelHref` is where Cancel goes.
 * Pass `layout={SettingsLayout}` for pages under the Settings tabs.
 * A long form passes `outline` (as FormModal takes it): the page then has
 * the redesign's side panel beside the form, staying in view, with the
 * record's card, the sections as an index and `asideNote`.
 */
export default function FormPage({ title, form, cancelHref, layout: Layout = AuthenticatedLayout, widthClass = 'max-w-2xl', outline = null, asideNote = null, children }) {
    const [confirmingSave, setConfirmingSave] = useState(false);
    const [asideSlot, setAsideSlot] = useState(null);
    const [readingSection, setReadingSection] = useState(outline?.[0]?.id ?? null);
    const done = useSectionProgress(outline, form.data);

    // The index lights the section being read as the page scrolls.
    useEffect(() => {
        if (!outline) {
            return undefined;
        }

        function onScroll() {
            let current = outline[0].id;

            for (const section of outline) {
                const element = document.getElementById(section.id);

                if (element && element.getBoundingClientRect().top < 180) {
                    current = section.id;
                }
            }

            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
                current = outline.at(-1).id;
            }

            setReadingSection(current);
        }

        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
    }, [outline]);

    function goToSection(sectionId) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setReadingSection(sectionId);
    }

    function submit(e) {
        e.preventDefault();

        if (validateFormFields(e.currentTarget, form)) {
            setConfirmingSave(true);
        }
    }

    function save() {
        setConfirmingSave(false);
        form.save();
    }

    return (
        <Layout header={<PageHeader title={title} />}>
            <Head title={title} />

            <form noValidate onSubmit={submit} onInput={(e) => clearErrorOnInput(e, form)} onKeyDown={submitOnCtrlEnter} className={`ma-form ma-form-page rise-in ${outline ? 'gl-fp' : widthClass}`}>
                {outline ? (
                    <FormAsideContext value={{ slot: asideSlot }}>
                        <div className="gl-fp-main">{children}</div>
                        <aside className="gl-fp-side" aria-label="ملخص النموذج">
                            <div ref={setAsideSlot} className="gl-fm-card" />
                            <FormSideIndex sections={outline} current={readingSection} done={done} errors={form.errors} onPick={goToSection} />
                            {asideNote && <p className="gl-fm-note"><Icon name="info" className="h-4 w-4 shrink-0" />{asideNote}</p>}
                        </aside>
                    </FormAsideContext>
                ) : (
                    children
                )}

                <div className={`ma-form-dock ${outline ? 'gl-fp-foot' : ''}`}>
                    {outline && <FormProgress sections={outline} done={done} />}
                    <span className="flex-1" />
                    {form.isEdit && form.isDirty && <span className="gl-unsaved" role="status">تغييرات غير محفوظة</span>}
                    <Link href={cancelHref} prefetch className="ma-dock-cancel">
                        إلغاء
                    </Link>
                    <PrimaryButton disabled={form.processing}>
                        <Icon name="check" className="h-[18px] w-[18px]" />
                        {form.processing ? 'جارٍ الحفظ...' : 'حفظ'}
                    </PrimaryButton>
                </div>
            </form>

            <SaveConfirmDialog show={confirmingSave} isEdit={form.isEdit} onConfirm={save} onCancel={() => setConfirmingSave(false)} />
        </Layout>
    );
}
