import { useRef } from 'react';
import DrawnMark from '@/Components/Auth/DrawnMark';
import Icon from '@/Components/UI/Icon';
import { useBrandDocument } from '@/hooks/useBrand';

/**
 * The sign-in screen: a dark stage lit by a spotlight from above, over a grid
 * floor running toward the viewer. The company's mark draws itself over a
 * frosted card that holds the form (`children`), and the card's edge glows
 * where the pointer is. `title` and `subtitle` head the card; a page with its
 * own heading (the error page) passes `title={null}`.
 *
 * The stage is dark in either theme (`dark` on its root, so HeroUI and the
 * MA tokens inside take their dark values).
 */
export default function GuestLayout({ title = 'سجّل الدخول إلى المنصّة', subtitle = 'استخدم اسم المستخدم وكلمة المرور اللذين أعطاك إياهما مدير النظام.', children }) {
    const brand = useBrandDocument();
    const cardRef = useRef(null);

    function followPointer(event) {
        const card = cardRef.current;

        if (!card || event.pointerType === 'touch') {
            return;
        }

        const box = card.getBoundingClientRect();
        card.style.setProperty('--auth-x', `${event.clientX - box.left}px`);
        card.style.setProperty('--auth-y', `${event.clientY - box.top}px`);
    }

    return (
        <div className="gl-auth dark" onPointerMove={followPointer}>
            <div className="gl-auth-floor" aria-hidden="true" />
            <div className="gl-auth-beam" aria-hidden="true" />

            <header className="gl-auth-top">
                <div className="gl-auth-brand">
                    <b>{brand.name}</b>
                    {brand.nameEnglish && <small><bdi dir="ltr">{brand.nameEnglish}</bdi></small>}
                </div>
            </header>

            <main className="gl-auth-main">
                <div className="gl-auth-mark">
                    <DrawnMark />
                </div>

                <div className="gl-auth-card" ref={cardRef}>
                    {title && (
                        <header className="gl-auth-head">
                            <h1>{title}</h1>
                            {subtitle && <p>{subtitle}</p>}
                        </header>
                    )}

                    {children}
                </div>
            </main>

            <footer className="gl-auth-foot">
                <span>© <bdi dir="ltr">{new Date().getFullYear()}</bdi> {brand.name}</span>
                <span className="gl-auth-secure">
                    <Icon name="lock" className="h-3.5 w-3.5" />
                    الاتصال مشفّر
                </span>
            </footer>
        </div>
    );
}
