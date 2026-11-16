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

const SEGMENTS = 17;

/** A segmented gauge with a readable percentage and caption. */
export function GoalRing({ percent = 0, caption }) {
    const clamped = Math.min(100, Math.max(0, Number(percent) || 0));

    return (
        <div className="gl-goal-gauge">
            <svg viewBox="0 0 176 100" width="176" height="100" aria-hidden="true">
                {Array.from({ length: SEGMENTS }, (_, index) => (
                    <rect key={index} x="84" y="10" width="8" height="18" rx="4" transform={'rotate(' + (90 - index * 180 / (SEGMENTS - 1)) + ' 88 90)'}
                        data-filled={index < Math.round(clamped * SEGMENTS / 100) || undefined} style={{ '--i': index }} />
                ))}
            </svg>
            <b><span className="gl-num" dir="ltr">{Math.round(clamped)}%</span><small>{caption}</small></b>
        </div>
    );
}
