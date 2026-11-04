import { useEffect, useState } from 'react';

/**
 * A number that counts up from 0 when it first shows (1.2s, easing out).
 * `decimals` keeps that many places; `format` writes the number (default:
 * grouped digits). People who ask their device, or whose company asks,
 * for less motion see the final number straight away.
 */
export default function CountUp({ value, duration = 1200, decimals = 0, format = null }) {
    const target = Number(value) || 0;
    const [shown, setShown] = useState(() => (motionOff() ? target : 0));

    useEffect(() => {
        if (motionOff()) {
            setShown(target);
            return;
        }

        let frame;
        const start = performance.now();

        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setShown(target * eased);

            if (progress < 1) {
                frame = requestAnimationFrame(tick);
            }
        }

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, duration]);

    const rounded = Number(shown.toFixed(decimals));

    return <span className="tabular-nums">{format ? format(rounded) : rounded.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

/** Whether motion is off: the device's setting, or the company's (BrandDesign `motion`, `motionStyle`). */
export function motionOff() {
    const root = document.documentElement.dataset;

    return root.uiMotion === 'reduced' || root.uiMotionStyle === 'none' || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}
