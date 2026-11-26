import { Button } from '@heroui/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** The tour's stops: an element of the bar (by its data-tour name), a title and a line about it. */
export function tourSteps(searchesSubscribers) {
    return [
        ['brand', 'الصفحة الرئيسية', 'اضغط هنا للعودة إلى الصفحة الرئيسية.'],
        ['sections', 'الأقسام في الشريط الجانبي', 'اضغط أي قسم لتظهر صفحاته تحته، وزرّ الشريط يصغّره إلى أيقونات أو يوسّعه.', 'الاختصار Alt + رقم القسم'],
        ['current', 'أين أنت الآن', 'القسم الحالي بلون الهوية، والصفحة المفتوحة مرفوعة.'],
        ['search', 'بحث وأوامر', searchesSubscribers
            ? 'Ctrl K أو / من أي صفحة: صفحة، أو مشترك بالاسم أو رقم الحساب، أو أمر مثل «تسجيل دفعة».'
            : 'Ctrl K أو / من أي صفحة: صفحة، أو أمر مثل تبديل الوضع الداكن.'],
        ['bell', 'الإشعارات', 'آخر ما حفظته والتنبيهات الموجّهة إليك، والعدد يختفي حين تقرؤها.'],
        ['appearance', 'المظهر', 'الوضع الفاتح والداكن والتلقائي، والأسطح الزجاجية أو المصمتة، والاختصارات.'],
        ['menu', 'على الجوال', 'زر القائمة في الشريط العلوي يفتح أقسام النظام.'],
        ['subnav', 'صفحات القسم بنقرة', 'صفحات القسم في الشريط العلوي، وتظهر علامة تحت الصفحة الحالية.'],
    ];
}

/** The element a stop points at, when it is on screen. */
function targetOf(name) {
    const element = document.querySelector(`[data-tour="${name}"]`);

    return element?.offsetParent ? element : null;
}

/**
 * A short guided tour of the bar: a spotlight on each part in turn and a dark
 * card that explains it. Arrows or the buttons move, Esc ends it.
 */
export default function QuickTour({ open, onClose, searchesSubscribers }) {
    const [steps, setSteps] = useState([]);
    const [index, setIndex] = useState(0);
    const [box, setBox] = useState(null);
    const cardRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const returnTo = document.activeElement;
        window.scrollTo({ top: 0, behavior: 'instant' });
        setSteps(tourSteps(searchesSubscribers).filter(([name]) => targetOf(name)));
        setIndex(0);
        document.documentElement.classList.add('tn-locked');

        return () => {
            document.documentElement.classList.remove('tn-locked');

            (returnTo?.isConnected && returnTo !== document.body ? returnTo : document.getElementById('main-content'))?.focus({ preventScroll: true });
        };
    }, [open, searchesSubscribers]);

    const step = steps[index];

    useLayoutEffect(() => {
        if (!open || !step) {
            return undefined;
        }

        function place() {
            const element = targetOf(step[0]);
            setBox(element ? element.getBoundingClientRect() : null);
        }

        place();
        window.addEventListener('resize', place);

        return () => window.removeEventListener('resize', place);
    }, [open, step]);

    // The card sits under its part, or above it when there is no room below.
    useLayoutEffect(() => {
        const card = cardRef.current;

        if (!card || !box) {
            return;
        }

        const viewport = document.documentElement.clientWidth;
        let top = box.bottom + 16;

        if (top + card.offsetHeight > window.innerHeight - 12) {
            top = Math.max(12, box.top - card.offsetHeight - 16);
        }

        card.style.top = `${top}px`;
        card.style.left = `${Math.max(16, Math.min(viewport - card.offsetWidth - 16, box.left + box.width / 2 - card.offsetWidth / 2))}px`;
        card.querySelector('[data-next]')?.focus();
    }, [box]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                onClose();
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                move(event.key === 'ArrowLeft' ? 1 : -1);
            } else if (event.key === 'Tab' && cardRef.current) {
                const buttons = [...cardRef.current.querySelectorAll('button')];

                if (event.shiftKey && document.activeElement === buttons[0]) {
                    event.preventDefault();
                    buttons.at(-1).focus();
                } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
                    event.preventDefault();
                    buttons[0].focus();
                } else if (!cardRef.current.contains(document.activeElement)) {
                    event.preventDefault();
                    buttons[0].focus();
                }
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    });

    if (!open || !step || !box) {
        return null;
    }

    function move(by) {
        const next = index + by;

        if (next >= steps.length) {
            onClose();
        } else {
            setIndex(Math.max(0, next));
        }
    }

    const [, title, text, hint] = step;
    const pad = 6;

    return (
        <div dir="rtl">
            <div key={`spot-${index}`} className="tn-spot" style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
            <div className="fixed inset-0 z-89" role="presentation" onClick={onClose} />
            <div key={`card-${index}`} ref={cardRef} className="tn-tour-card tn-lift rounded-[22px] bg-graphite-gradient p-4 text-white ring-1 ring-white/10" role="dialog" aria-label="جولة سريعة">
                <div className="mb-1 text-[12px] font-bold text-[rgb(var(--brand-tint))]">{index + 1} من {steps.length}</div>
                <b className="block text-[17px]">{title}</b>
                <p className="mt-1 text-[14px] leading-7 text-[rgb(var(--silver-200))]">{text}</p>
                {hint && <p className="mt-2 text-[12.5px] text-[rgb(var(--violet-300))]">{hint}</p>}
                <div className="mt-4 flex items-center gap-2">
                    <div className="flex gap-1">
                        {steps.map(([name], dot) => <i key={name} className={`h-1.5 rounded-full ${dot === index ? 'w-5 bg-white' : 'w-1.5 bg-white/30'}`} />)}
                    </div>
                    <Button data-raw="" variant="ghost" onClick={onClose} className="ms-auto h-9 rounded-xl px-3 text-[13.5px] font-semibold text-[rgb(var(--silver-200))] hover:bg-white/10">إنهاء</Button>
                    {index > 0 && <Button data-raw="" variant="ghost" onClick={() => move(-1)} className="h-9 rounded-xl px-3 text-[13.5px] font-semibold hover:bg-white/10">السابق</Button>}
                    <Button data-raw="" variant="ghost" data-next onClick={() => move(1)} className="h-9 rounded-xl bg-white px-4 text-[13.5px] font-bold text-gray-900 dark:text-[rgb(var(--graphite-900))]">
                        {index === steps.length - 1 ? 'تم' : 'التالي'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
