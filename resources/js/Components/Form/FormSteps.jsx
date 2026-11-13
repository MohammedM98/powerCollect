import { createContext, useContext } from 'react';
import Icon from '@/Components/Icon';

/** The step a stepped form (FormModal `steps`) shows; null when the form has no steps. */
export const FormStepContext = createContext(null);

/**
 * One step of a stepped form: shown while it is the current step, kept in
 * the page (hidden) otherwise, so its values and checks stay. Outside a
 * stepped form it simply shows its fields.
 */
export function FormStep({ index, children }) {
    const current = useContext(FormStepContext);

    if (current === null) {
        return children;
    }

    return (
        <div data-form-step={index} hidden={current !== index} className="space-y-5">
            {children}
        </div>
    );
}

/** Where a stepped form is: a numbered dot per step on a line that fills as the steps are done. */
export function StepIndicator({ steps, current }) {
    return (
        <ol className="gl-steps" aria-label="خطوات النموذج" style={{ '--steps': steps.length }}>
            <span className="gl-steps-line" aria-hidden="true"><i style={{ width: `${(current / Math.max(1, steps.length - 1)) * 100}%` }} /></span>
            {steps.map((step, index) => (
                <li key={step.title} className="gl-step-item" data-state={index < current ? 'done' : index === current ? 'current' : 'next'} aria-current={index === current ? 'step' : undefined}>
                    <span className="gl-step-dot">{index < current ? <Icon name="check" className="h-[15px] w-[15px]" /> : index + 1}</span>
                    {step.title}
                </li>
            ))}
        </ol>
    );
}

/**
 * A long form's index: its sections down the side, the one being read lit,
 * a click scrolling to it. `sections`: [{ id, title, icon }].
 */
export function FormOutline({ sections, current, onPick }) {
    return (
        <nav className="gl-outline" aria-label="أقسام النموذج">
            {sections.map((section) => (
                <a
                    key={section.id}
                    href={`#${section.id}`}
                    aria-current={section.id === current ? 'true' : undefined}
                    onClick={(event) => {
                        event.preventDefault();
                        onPick(section.id);
                    }}
                >
                    <Icon name={section.icon} className="h-[17px] w-[17px]" />
                    {section.title}
                </a>
            ))}
        </nav>
    );
}
