import { useEffect, useState } from 'react';

/**
 * A percentage ring that draws itself in. `size` is in pixels; `trackClass`
 * colors the empty part of the ring.
 */
export default function StatRing({ percent = 0, color = 'text-brand-500', size = 64, trackClass = 'text-gray-100', labelClass = 'text-gray-700' }) {
    const clamped = Math.min(100, Math.max(0, percent));
    const [drawn, setDrawn] = useState(0);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setDrawn(clamped));
        return () => cancelAnimationFrame(frame);
    }, [clamped]);

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeWidth="3" className={trackClass} />
                <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${drawn} 100`}
                    className={`transition-[stroke-dasharray] duration-[1100ms] ease-out ${color}`}
                />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center font-display text-xs font-bold ${labelClass}`}>
                {Math.round(percent)}%
            </div>
        </div>
    );
}

/**
 * The goal ring of the glass look: a 104px ring that draws itself to
 * `percent`, the number in the middle with a line under it (`caption`).
 */
export function GoalRing({ percent = 0, caption }) {
    const clamped = Math.min(100, Math.max(0, Number(percent) || 0));

    return (
        <div className="gl-ringbox">
            <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
                <circle cx="52" cy="52" r="42" fill="none" stroke="var(--gl-fill-2)" strokeWidth="10" />
                <circle className="gl-ring-draw" pathLength="1" style={{ '--t': 1 - clamped / 100 }} cx="52" cy="52" r="42" fill="none" stroke="rgb(var(--gl-brand))" strokeWidth="10" strokeLinecap="round" transform="rotate(-90 52 52)" />
            </svg>
            <b>
                <span className="gl-num">{Math.round(clamped)}%</span>
                <small>{caption}</small>
            </b>
        </div>
    );
}
