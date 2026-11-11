import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/Components/Icon';
import ThemeSegments from './ThemeSegments';
import { usePersonalLook } from '@/hooks/usePersonalLook';
import { BLUR_RANGE, GLASS_RANGE, LOOK_BACKGROUNDS, LOOK_COLORS, isCustomLook } from '@/lib/personalLook';

/** A token's value as the company draws it, read from the page, for a slider left on the company's choice. */
function companyToken(name, fallback) {
    const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));

    return Number.isFinite(value) ? value : fallback;
}

/** One row of the panel: its name, then its control. */
function Row({ label, value = null, children }) {
    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2 text-[13px] font-semibold !text-[color:var(--gl-muted)]">
                <span>{label}</span>
                {value !== null && (
                    <b className="gl-num !text-[color:var(--gl-ink)]">
                        {value}
                    </b>
                )}
            </div>
            {children}
        </div>
    );
}

/** A row of choices, one of them pressed. */
function Choices({ label, options, value, onChange }) {
    return (
        <div role="group" aria-label={label} className="tn-segments grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-gray-100 p-1">
            {options.map(([option, text]) => (
                <button key={option ?? 'company'} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>
                    {text}
                </button>
            ))}
        </div>
    );
}

/**
 * The look studio's panel, loaded the first time it opens:
 * light or dark, the dark background, how see-through and blurred the
 * glass is, the main colour (a ready one or any other) and motion. Every
 * change shows at once and is kept in this browser for this person only;
 * "شكل الشركة" puts the company's look back.
 */
export default function LookStudioPanel({ popoverRef, onShown }) {
    const { look, change, reset } = usePersonalLook();
    const [company, setCompany] = useState({ glass: 0.6, blur: 18 });

    // The company's own glass, for the sliders while this person keeps it.
    useEffect(() => {
        if (look.glass === null && look.blur === null) {
            setCompany({ glass: companyToken('--glass-alpha', 0.6), blur: companyToken('--glass-blur', 18) });
        }
    }, [look.glass, look.blur]);

    const glass = look.glass ?? company.glass;
    const blur = look.blur ?? company.blur;

    // Drawn after the bar's menu opened: placed under its button and focused now.
    useLayoutEffect(() => onShown(), [onShown]);

    return createPortal(
        <div ref={popoverRef} dir="rtl" className="tn-popover w-[360px] max-w-[calc(100vw-24px)] text-gray-900" role="dialog" aria-label="المظهر">
            <div className="grid gap-4 p-4">
                <div>
                    <h3 className="text-base font-bold !font-[family-name:var(--gl-head)]">
                        المظهر
                    </h3>
                    <p className="gl-sub !text-[12.5px]">يظهر التغيير فورًا ويُحفظ في هذا المتصفح لك وحدك.</p>
                </div>

                <Row label="الوضع">
                    <ThemeSegments />
                </Row>

                <Row label="الخلفية في الوضع الداكن">
                    <Choices
                        label="الخلفية في الوضع الداكن"
                        options={[[null, 'الشركة'], ...LOOK_BACKGROUNDS]}
                        value={look.background}
                        onChange={(background) => change({ background })}
                    />
                </Row>

                <Row label="شفافية الزجاج" value={`${Math.round(glass * 100)}%`}>
                    <input
                        type="range"
                        aria-label="شفافية الزجاج"
                        min={GLASS_RANGE.min}
                        max={GLASS_RANGE.max}
                        step={GLASS_RANGE.step}
                        value={glass}
                        onChange={(event) => change({ glass: Number(event.target.value) })}
                        className="w-full !accent-[rgb(var(--brand-solid))]"
                       
                    />
                </Row>

                <Row label="قوة التمويه" value={`${blur}px`}>
                    <input
                        type="range"
                        aria-label="قوة التمويه"
                        min={BLUR_RANGE.min}
                        max={BLUR_RANGE.max}
                        step={BLUR_RANGE.step}
                        value={blur}
                        onChange={(event) => change({ blur: Number(event.target.value) })}
                        className="w-full !accent-[rgb(var(--brand-solid))]"
                       
                    />
                </Row>

                <Row label="اللون الرئيسي">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            className="gl-chip gl-chip-sm"
                            aria-pressed={look.color === null}
                            onClick={() => change({ color: null })}
                        >
                            الشركة
                        </button>
                        {LOOK_COLORS.map((color) => (
                            <button
                                key={color.key}
                                type="button"
                                className="gl-swatch"
                                aria-pressed={look.color === color.hex}
                                aria-label={color.label}
                                title={color.label}
                                style={{ background: color.hex }}
                                onClick={() => change({ color: color.hex })}
                            />
                        ))}
                        <label
                            className="gl-swatch gl-swatch-custom"
                            title="لون من اختيارك"
                            aria-pressed={look.color !== null && !LOOK_COLORS.some((color) => color.hex === look.color)}
                        >
                            <input
                                type="color"
                                aria-label="لون من اختيارك"
                                value={look.color ?? '#7C3AED'}
                                onChange={(event) => change({ color: event.target.value })}
                            />
                            <Icon name="plus" className="h-4 w-4" />
                        </label>
                    </div>
                </Row>

                <Row label="الحركة">
                    <Choices
                        label="الحركة"
                        options={[
                            [null, 'حسب الشركة'],
                            ['off', 'بدون حركة'],
                        ]}
                        value={look.motion}
                        onChange={(motion) => change({ motion })}
                    />
                </Row>

                <button type="button" className="gl-btn gl-sec" disabled={!isCustomLook(look)} onClick={reset}>
                    <Icon name="repeat" className="h-4 w-4" />
                    شكل الشركة
                </button>
            </div>
        </div>,
        document.body,
    );
}
