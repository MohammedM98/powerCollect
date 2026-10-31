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

/**
 * A corner that follows the company's corner style (`--radius-scale`, set by
 * `data-ui-radius` on <html>, see the design section of app.css).
 */
const corner = (size) => `calc(${size} * var(--radius-scale, 1))`;

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
                // The company's text and heading faces (`data-ui-body-font`, `data-ui-heading-font`).
                sans: ['var(--font-body, "IBM Plex Sans Arabic")', '"IBM Plex Sans Arabic"', ...defaultTheme.fontFamily.sans],
                luxe: ['var(--font-heading, "El Messiri")', '"IBM Plex Sans Arabic"', ...defaultTheme.fontFamily.serif],
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
                sm: corner('0.125rem'),
                DEFAULT: corner('0.25rem'),
                md: corner('0.375rem'),
                lg: corner('0.5rem'),
                xl: corner('0.75rem'),
                '2xl': corner('1rem'),
                '3xl': corner('1.5rem'),
                control: corner('12px'),
                row: corner('18px'),
                card: corner('24px'),
                panel: corner('28px'),
                hero: corner('32px'),
            },
            // Cards, raised panels and the main action's glow follow the company's card and button styles.
            boxShadow: {
                card: 'var(--shadow-card)',
                lift: 'var(--shadow-lift)',
                glow: 'var(--shadow-glow)',
            },
            backgroundImage: {
                spectrum: 'var(--spectrum)',
                'brand-gradient': 'var(--brand-fill)',
                'graphite-gradient': 'linear-gradient(135deg, rgb(var(--graphite-700)), rgb(var(--graphite-800)) 60%, rgb(var(--graphite-900)))',
            },
        },
    },

    plugins: [forms],
};
