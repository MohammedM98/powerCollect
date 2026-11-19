import { useState } from 'react';
import CountUp from '@/Components/CountUp';
import { ChangePill } from '@/Components/StatStrip';

/** A round top for the axis: 1, 2 or 5 times a power of ten, at least the largest value. */
function niceMax(value) {
    if (value <= 0) {
        return 4;
    }

    const power = 10 ** Math.floor(Math.log10(value));

    return [1, 2, 2.5, 5, 10].map((step) => step * power).find((step) => step >= value) ?? 10 * power;
}

/** A number on the axis: 1.5k for thousands. */
function axisLabel(value) {
    return value >= 1000 ? `${Number((value / 1000).toFixed(value % 1000 === 0 ? 0 : 1))}k` : String(Math.round(value));
}

/** A smooth line through the points. */
function curve(points) {
    return points.reduce((path, point, index) => {
        if (index === 0) {
            return `M${point[0]},${point[1]}`;
        }

        const before = points[index - 1];
        const middle = (before[0] + point[0]) / 2;

        return `${path} C${middle},${before[1]} ${middle},${point[1]} ${point[0]},${point[1]}`;
    }, '');
}

/**
 * The area chart: a line in the company's colour that draws itself in over
 * a soft wash, a grid, and the period before as a dashed line (`previous`).
 * Drawn left to right, oldest first.
 */
export function AreaChart({ values, labels, previous = null, label }) {
    const left = 44;
    const right = 590;
    const base = 186;
    const height = 150;
    const count = values.length;
    const max = niceMax(Math.max(...values, ...(previous ?? [0])));
    const x = (index) => left + (count > 1 ? (index * (right - left)) / (count - 1) : (right - left) / 2);
    const points = values.map((value, index) => [x(index), base - (value / max) * height]);
    const line = curve(points);
    const last = points[count - 1];
    const step = Math.max(1, Math.ceil(count / 7));

    if (count === 0) {
        return null;
    }

    return (
        <svg className="gl-chart" viewBox="0 0 620 214" role="img" aria-label={label}>
            <defs>
                <linearGradient id="gl-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="rgb(var(--gl-brand))" stopOpacity=".5" />
                    <stop offset="1" stopColor="rgb(var(--gl-brand))" stopOpacity="0" />
                </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((tick) => {
                const y = base - (tick * height) / 4;

                return (
                    <g key={tick}>
                        <line x1={left} x2={right} y1={y} y2={y} stroke="var(--gl-line)" />
                        <text x={left - 8} y={y + 4} textAnchor="end">{axisLabel((max / 4) * tick)}</text>
                    </g>
                );
            })}
            {labels.map((text, index) => (index % step === 0 || index === count - 1) && (
                <text key={index} x={x(index)} y={206} textAnchor="middle">{text}</text>
            ))}
            {previous && <path d={curve(previous.map((value, index) => [x(index), base - (value / max) * height]))} fill="none" stroke="var(--gl-faint)" strokeWidth="1.6" strokeDasharray="4 5" />}
            {count > 1 && <path className="gl-area-in" d={`${line} L${right},${base} L${left},${base}Z`} fill="url(#gl-area)" />}
            {count > 1 && <path className="gl-draw" pathLength="1" d={line} fill="none" stroke="rgb(var(--gl-brand))" strokeWidth="2.6" strokeLinecap="round" />}
            <circle className="gl-area-in" cx={last[0]} cy={last[1]} r="5" fill="var(--gl-ink)" stroke="rgb(var(--gl-brand))" strokeWidth="3" />
        </svg>
    );
}

/**
 * The chart studio: its name, the period's total and its change against the
 * period before, a switch for the period before's dashed line, the period
 * tabs (`periods`, `period`, `onPeriodChange`), then the chart. `series` is
 * `[{ date, value, previous }]`, oldest first; `dayLabel` writes a day.
 */
export default function ChartStudio({ title, total, change, unit = '₪', formatTotal, series, dayLabel, periods = [], period, onPeriodChange, bare = false }) {
    const [comparing, setComparing] = useState(true);

    // Bare: only the chart and the previous-period switch, for a card that already says what and how much (the dashboard's hero).
    if (bare) {
        return (
            <div className="gl-chart-bare">
                <button type="button" className="gl-tog" aria-pressed={comparing} onClick={() => setComparing(!comparing)}>الفترة السابقة</button>
                <AreaChart
                    key={`${period}-${series.length}`}
                    values={series.map((day) => Number(day.value) || 0)}
                    labels={series.map((day) => dayLabel(day.date))}
                    previous={comparing ? series.map((day) => Number(day.previous) || 0) : null}
                    label={`${title}: ${unit} ${total}`}
                />
            </div>
        );
    }

    return (
        <>
            <div className="gl-chart-h">
                <div>
                    <h2>{title}</h2>
                    <span className="gl-meta gl-num">
                        {unit} <CountUp value={total} format={formatTotal} /> في هذه الفترة
                        {change !== null && change !== undefined && <>، <ChangePill change={change} /> عن الفترة السابقة</>}
                    </span>
                </div>
                <div className="gl-sp" />
                <button type="button" className="gl-tog" aria-pressed={comparing} onClick={() => setComparing(!comparing)}>الفترة السابقة</button>
                {periods.length > 0 && (
                    <div className="gl-seg" role="group" aria-label="الفترة">
                        {periods.map((option) => (
                            <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => onPeriodChange(option.value)}>{option.label}</button>
                        ))}
                    </div>
                )}
            </div>
            <AreaChart
                key={`${period}-${series.length}`}
                values={series.map((day) => Number(day.value) || 0)}
                labels={series.map((day) => dayLabel(day.date))}
                previous={comparing ? series.map((day) => Number(day.previous) || 0) : null}
                label={`${title}: ${unit} ${total}`}
            />
        </>
    );
}
