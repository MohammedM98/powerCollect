import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/**
 * A color whose value lives in resources/css/theme.css as an RGB triple
 * (e.g. `--brand-500: 165 29 38`), so opacity modifiers such as
 * `bg-brand-500/10` keep working.
 */
const variable = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const scale = (name, steps) => Object.fromEntries(steps.map((step) => [step, variable(`${name}-${step}`)]));

const fullScale = (name) => scale(name, [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',

    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['"IBM Plex Sans Arabic"', ...defaultTheme.fontFamily.sans],
                luxe: ['"El Messiri"', '"IBM Plex Sans Arabic"', ...defaultTheme.fontFamily.serif],
                display: ['Alexandria', '"IBM Plex Sans Arabic"', ...defaultTheme.fontFamily.sans],
            },
            /*
             * Arabic needs more room than Latin text to read comfortably, so
             * every size sits two pixels above Tailwind's default (xs 14,
             * sm 16, base 17, lg 20…) with looser lines, all in step so the
             * proportions hold. The smallest text anywhere is 12px.
             */
            fontSize: {
                xs: ['0.875rem', { lineHeight: '1.6' }],
                sm: ['1rem', { lineHeight: '1.6' }],
                base: ['1.0625rem', { lineHeight: '1.7' }],
                lg: ['1.25rem', { lineHeight: '1.6' }],
                xl: ['1.375rem', { lineHeight: '1.5' }],
                '2xl': ['1.625rem', { lineHeight: '1.4' }],
                '3xl': ['2rem', { lineHeight: '1.3' }],
            },
            colors: {
                brand: scale('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
                gray: scale('gray', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
                graphite: scale('graphite', [400, 500, 600, 700, 800, 900, 950]),
                silver: scale('silver', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
                blue: fullScale('blue'),
                print: scale('print', [300, 500, 600, 700]),
                excel: scale('excel', [300, 500, 600, 700]),
                surface: variable('surface'),
                /*
                 * Status colours, by purpose and by Tailwind's own names, so
                 * `text-success-700` and `text-emerald-700` both read the
                 * success colour set in theme.css.
                 */
                success: fullScale('success'),
                warning: fullScale('warning'),
                danger: fullScale('danger'),
                info: fullScale('info'),
                emerald: fullScale('success'),
                green: fullScale('success'),
                amber: fullScale('warning'),
                yellow: fullScale('warning'),
                red: fullScale('danger'),
                rose: fullScale('danger'),
                sky: fullScale('info'),
                cyan: fullScale('info'),
                violet: fullScale('violet'),
                purple: fullScale('violet'),
                teal: fullScale('teal'),
                indigo: fullScale('indigo'),
                orange: fullScale('orange'),
            },
            borderRadius: {
                control: '12px',
                row: '18px',
                card: '24px',
                panel: '28px',
                hero: '32px',
            },
            boxShadow: {
                card: '0 1px 2px rgb(var(--shadow-ink) / 0.04), 0 14px 34px -18px rgb(var(--shadow-ink) / 0.18)',
                lift: '0 2px 6px rgb(var(--shadow-ink) / 0.06), 0 24px 44px -20px rgb(var(--shadow-ink) / 0.32)',
                glow: '0 10px 24px -12px rgb(var(--brand-solid) / 0.9)',
            },
            backgroundImage: {
                spectrum: 'var(--spectrum)',
                'brand-gradient': 'linear-gradient(180deg, rgb(var(--brand-hi)), rgb(var(--brand-lo)))',
                'graphite-gradient': 'linear-gradient(135deg, rgb(var(--graphite-700)), rgb(var(--graphite-800)) 60%, rgb(var(--graphite-900)))',
            },
        },
    },

    plugins: [forms],
};
