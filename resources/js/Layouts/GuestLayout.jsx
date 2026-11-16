import { useEffect, useRef } from 'react';
import AnimatedLogo from '@/Components/AnimatedLogo';
import { motionOff } from '@/Components/CountUp';
import ThemeToggle from '@/Components/ThemeToggle';
import { useBrandDocument } from '@/hooks/useBrand';

/** Faint grid lines over the page with pulses of current running along them, in the company's colour. */
function EnergyField() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        let width;
        let height;
        let frame;
        let lines = [];
        let pulses = [];

        function setup() {
            // The field fills the brand panel it sits in.
            const box = canvas.parentElement.getBoundingClientRect();
            width = canvas.width = box.width * ratio;
            height = canvas.height = box.height * ratio;
            const gap = 64 * ratio;
            lines = [];

            for (let y = gap / 2; y < height; y += gap) {
                lines.push({ horizontal: true, at: y });
            }

            for (let x = gap / 2; x < width; x += gap) {
                lines.push({ horizontal: false, at: x });
            }

            pulses = Array.from({ length: 9 }, () => ({ line: lines[Math.floor(Math.random() * lines.length)], t: Math.random(), speed: 0.0015 + Math.random() * 0.003 }));
        }

        function draw() {
            const rgb = getComputedStyle(document.documentElement).getPropertyValue('--brand-soft').trim() || '96 146 255';
            context.clearRect(0, 0, width, height);
            context.lineWidth = ratio;
            context.strokeStyle = `rgb(${rgb} / 0.09)`;

            lines.forEach((line) => {
                context.beginPath();
                line.horizontal ? (context.moveTo(0, line.at), context.lineTo(width, line.at)) : (context.moveTo(line.at, 0), context.lineTo(line.at, height));
                context.stroke();
            });

            pulses.forEach((pulse) => {
                pulse.t += pulse.speed;

                if (pulse.t > 1) {
                    pulse.t = 0;
                    pulse.line = lines[Math.floor(Math.random() * lines.length)];
                }

                const position = pulse.t * (pulse.line.horizontal ? width : height);
                const tail = 140 * ratio;
                const gradient = pulse.line.horizontal ? context.createLinearGradient(position - tail, 0, position, 0) : context.createLinearGradient(0, position - tail, 0, position);
                gradient.addColorStop(0, `rgb(${rgb} / 0)`);
                gradient.addColorStop(1, `rgb(${rgb} / 0.7)`);
                context.strokeStyle = gradient;
                context.lineWidth = 2 * ratio;
                context.beginPath();
                pulse.line.horizontal
                    ? (context.moveTo(position - tail, pulse.line.at), context.lineTo(position, pulse.line.at))
                    : (context.moveTo(pulse.line.at, position - tail), context.lineTo(pulse.line.at, position));
                context.stroke();
            });

            if (!motionOff()) {
                frame = requestAnimationFrame(draw);
            }
        }

        setup();
        draw();
        window.addEventListener('resize', setup);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', setup);
        };
    }, []);

    return <canvas ref={canvasRef} className="gl-auth-field" aria-hidden="true" />;
}

/** One wheel of the meter: the digits 0–9 in a column, turned to `digit`. */
function MeterWheel({ digit, delay }) {
    return (
        <span className="gl-meter-wheel" aria-hidden="true">
            <span className="gl-meter-strip" style={{ '--digit': digit, animationDelay: `${delay}ms` }}>
                {Array.from({ length: 10 }, (_, value) => (
                    <span key={value}>{value}</span>
                ))}
            </span>
        </span>
    );
}

/**
 * Today's date as a meter shows a reading: day, month and year on digit
 * wheels that turn into place once as the page opens.
 */
function MeterDate() {
    const today = new Date();
    const groups = [
        { name: 'اليوم', value: String(today.getDate()).padStart(2, '0') },
        { name: 'الشهر', value: String(today.getMonth() + 1).padStart(2, '0') },
        { name: 'السنة', value: String(today.getFullYear()) },
    ];
    let wheel = 0;

    return (
        <figure className="gl-meter" aria-label={`تاريخ اليوم ${today.toLocaleDateString('ar-PS-u-nu-latn')}`}>
            <div className="gl-meter-face" dir="ltr">
                {groups.map((group, index) => (
                    <span key={group.name} className="gl-meter-group">
                        {index > 0 && <span className="gl-meter-dot" aria-hidden="true" />}
                        {[...group.value].map((digit) => {
                            wheel += 1;
                            return <MeterWheel key={wheel} digit={Number(digit)} delay={200 + wheel * 90} />;
                        })}
                    </span>
                ))}
            </div>
            <figcaption>قراءة اليوم</figcaption>
        </figure>
    );
}

/**
 * The sign-in screen, in two halves: the company's panel (its mark over a
 * field of current, and today's date on a meter's wheels) and the form
 * (`children`) under a plain heading. `title` and `subtitle` head the form;
 * a page with its own heading (the error page) passes `title={null}`.
 * On a phone the panel becomes a strip above the form.
 */
export default function GuestLayout({ title = 'تسجيل الدخول', subtitle = 'ادخل باسم المستخدم الذي أعطاك إياه مدير النظام.', children }) {
    const brand = useBrandDocument();

    return (
        <div className="gl-auth">
            <aside className="gl-auth-panel">
                <EnergyField />
                <div className="gl-auth-brand">
                    <AnimatedLogo />
                    <div>
                        <b>{brand.name}</b>
                        {brand.nameEnglish && <span dir="ltr">{brand.nameEnglish}</span>}
                    </div>
                </div>
                <MeterDate />
                <p className="gl-auth-line">القراءات والدفعات وصناديق الفروع في مكان واحد.</p>
            </aside>

            <main className="gl-auth-main">
                <ThemeToggle className="gl-auth-corner" />
                <div className="gl-auth-card">
                    {title && (
                        <header className="gl-auth-head">
                            <h1>{title}</h1>
                            <p>{subtitle}</p>
                        </header>
                    )}

                    {children}
                </div>

                <footer className="gl-auth-foot">
                    <span>© <span dir="ltr">{new Date().getFullYear()}</span> {brand.name}</span>
                    <span>الاتصال مشفّر</span>
                </footer>
            </main>
        </div>
    );
}
