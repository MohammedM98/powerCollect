import { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/Components/Icon';

/**
 * A long form's side panel, as in the redesign (docs/redesign): the record
 * being filled in on a card at the top, then the form's sections as an
 * index (each with its icon, a line on what it holds, and a tick once its
 * required fields are filled), and a note under them. FormModal and
 * FormPage draw it when given `outline`; the form puts its card in it with
 * <FormAsideCard>, and keeps it in its own flow when there is no panel.
 */
export const FormAsideContext = createContext(null);

/** Shows `children` in the side panel's card slot, or `fallback` in place when the form has no side panel. */
export function FormAsideCard({ children, fallback = null }) {
    const panel = useContext(FormAsideContext);

    if (!panel) {
        return fallback;
    }

    return panel.slot ? createPortal(children, panel.slot) : null;
}

/**
 * Which of the form's sections are complete (no required field empty or
 * invalid), read from the fields themselves after each change, and which
 * one is being read.
 */
export function useSectionProgress(sections, watch) {
    const [done, setDone] = useState({});

    useEffect(() => {
        if (!sections) {
            return;
        }

        const frame = requestAnimationFrame(() => {
            const next = {};

            for (const section of sections) {
                const element = document.getElementById(section.id);
                const fields = element ? [...element.querySelectorAll('input, select, textarea')].filter((field) => field.willValidate) : [];
                next[section.id] = Boolean(element) && fields.every((field) => field.checkValidity());
            }

            setDone(next);
        });

        return () => cancelAnimationFrame(frame);
    }, [sections, watch]);

    return done;
}

/** The form's sections down the side: icon, name, what it holds, and a tick once complete; the one being read on a card. */
export function FormSideIndex({ sections, current, done, errors = {}, onPick }) {
    return (
        <nav className="gl-fm-index" aria-label="أقسام النموذج">
            {sections.map((section) => {
                const bad = (section.fields ?? []).some((field) => errors[field]);
                const complete = done[section.id] && !bad;

                return (
                    <a
                        key={section.id}
                        href={`#${section.id}`}
                        aria-current={section.id === current ? 'true' : undefined}
                        onClick={(event) => {
                            event.preventDefault();
                            onPick(section.id);
                        }}
                    >
                        <span className="gl-fm-index-icon"><Icon name={section.icon} className="h-[18px] w-[18px]" /></span>
                        <span className="min-w-0">
                            <b>{section.title}</b>
                            {section.description && <small>{section.description}</small>}
                        </span>
                        <span className={`gl-fm-index-state ${bad ? 'is-bad' : complete ? 'is-done' : ''}`} aria-label={bad ? 'فيه خطأ' : complete ? 'مكتمل' : 'غير مكتمل'}>
                            {complete && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
                        </span>
                    </a>
                );
            })}
        </nav>
    );
}

/** How many of the form's sections are complete, as a bar and a count. */
export function FormProgress({ sections, done }) {
    const total = sections.length;
    const count = sections.filter((section) => done[section.id]).length;

    return (
        <div className="gl-fm-progress" role="status">
            <i aria-hidden="true"><span style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></i>
            <span><b className="gl-num">{count}</b> من {total} أقسام مكتملة</span>
        </div>
    );
}
