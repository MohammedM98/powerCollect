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
            width = canvas.width = window.innerWidth * ratio;
            height = canvas.height = window.innerHeight * ratio;
            const gap = 86 * ratio;
            lines = [];

            for (let y = gap / 2; y < height; y += gap) {
                lines.push({ horizontal: true, at: y });
            }

            for (let x = gap / 2; x < width; x += gap) {
                lines.push({ horizontal: false, at: x });
            }

            pulses = Array.from({ length: 14 }, () => ({ line: lines[Math.floor(Math.random() * lines.length)], t: Math.random(), speed: 0.0015 + Math.random() * 0.003 }));
        }

        function draw() {
            const rgb = getComputedStyle(document.documentElement).getPropertyValue('--brand-soft').trim() || '96 146 255';
            context.clearRect(0, 0, width, height);
            context.lineWidth = ratio;
            context.strokeStyle = `rgb(${rgb} / 0.07)`;

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

/**
 * The sign-in screen: one glass card in the middle of the page, over a field
 * of current, holding the mark, the product's name and the form (`children`).
 * `subtitle` is the line under the name.
 */
export default function GuestLayout({ subtitle = 'سجّل الدخول لمتابعة التحصيل والقراءات.', children }) {
    const brand = useBrandDocument();

    return (
        <div className="gl-auth">
            <EnergyField />
            <ThemeToggle className="gl-auth-corner" />

            <main className="gl-glass gl-auth-card">
                <div className="gl-auth-head">
                    <AnimatedLogo />
                    <div>
                        <h1>{brand.name}</h1>
                        {brand.nameEnglish && <div className="gl-en" dir="ltr">{brand.nameEnglish.toUpperCase()}</div>}
                    </div>
                    <p>{subtitle}</p>
                </div>

                {children}

                <div className="gl-auth-foot">
                    <span>© <span dir="ltr">{new Date().getFullYear()}</span> {brand.name}</span>
                    <span>اتصال مشفّر</span>
                </div>
            </main>
        </div>
    );
}
