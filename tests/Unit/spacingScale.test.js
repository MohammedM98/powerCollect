import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The owner's spacing scale for the style sheets, the twin of the
 * `local/spacing-scale` ESLint rule for class names: padding, margin and gap
 * take only 0 and 4/8/12/16/24/32px, and every direction is logical.
 *
 * Print sheets (inside `@media print`) keep their paper geometry. Room kept
 * for an overlay is a size, named once as a `--room-*` token (var() is not checked).
 *
 * Physical sides stay only where a logical one would be wrong:
 * - a table row's outer cells: a cell's own text may run left-to-right, and a
 *   logical side would then follow the cell, not the row;
 * - the page-trail line, placed by an x measured from the left;
 * - `left: 50%` with a translate, which centres in either direction.
 */
const PHYSICAL_ALLOWED = /(?:td|th):(?:first|last)-child|\.tn-subnav-line\b/;
const STEPS_PX = new Set([0, 4, 8, 12, 16, 24, 32]);
const TAILWIND_STEPS = new Set(['0', '1', '2', '3', '4', '6', '8']);
const SPACING_PROPERTY = /^(padding|margin|gap|row-gap|column-gap)(-(block|inline)(-(start|end))?|-(top|bottom))?$/;
const PHYSICAL_PROPERTY = /^(margin-(left|right)|padding-(left|right)|left|right|float|border-(left|right)(-[a-z]+)?|border-(top|bottom)-(left|right)-radius)$/;
const APPLY_SPACING = /^(?:\S*?:)*!?-?(px|py|pt|pb|ps|pe|p|mx|my|mt|mb|ms|me|m|gap-x|gap-y|gap|space-x|space-y)-(\S+?)!?$/;
const EXEMPT_RULE = /@media print/;

function styleSheets(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return styleSheets(file);
        }
        return entry.name.endsWith('.css') && entry.name !== 'fonts.css' ? [file] : [];
    });
}

/** Each declaration with its line and the chain of selectors and at-rules it sits in. */
function declarations(css) {
    const found = [];
    const stack = [];
    let buffer = '';
    let line = 1;
    let startLine = 1;
    const text = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
    for (const character of text) {
        if (character === '\n') {
            line++;
        }
        if (character === '{') {
            stack.push(buffer.trim());
            buffer = '';
            startLine = line;
        } else if (character === ';' || character === '}') {
            const declaration = buffer.trim();
            if (declaration) {
                found.push({ declaration, line: startLine, context: stack.join(' > ') });
            }
            buffer = '';
            startLine = line;
            if (character === '}') {
                stack.pop();
            }
        } else {
            if (!buffer.trim()) {
                startLine = line;
            }
            buffer += character;
        }
    }
    return found;
}

/** The px or rem lengths written directly in a value (inside max()/min() too, but not in var() or calc()). */
function offScaleLengths(value) {
    const plain = value.replace(/!important/, '').replace(/(var|calc|env)\([^()]*(\([^()]*\)[^()]*)*\)/g, ' ');
    return [...plain.matchAll(/-?(\d*\.?\d+)(px|rem|em)\b/g)]
        .filter(([, number, unit]) => !STEPS_PX.has(Number(number) * (unit === 'px' ? 1 : 16)))
        .map(([length]) => length);
}

/** Every break of the rules in one style sheet, as "file:line message". */
export function spacingViolations(file, css) {
    const problems = [];
    for (const { declaration, line, context } of declarations(css)) {
        if (EXEMPT_RULE.test(context)) {
            continue;
        }
        const where = `${path.relative(process.cwd(), file)}:${line}`;
        if (declaration.startsWith('@apply')) {
            for (const token of declaration.split(/\s+/).slice(1)) {
                const match = token.match(APPLY_SPACING);
                if (match && !TAILWIND_STEPS.has(match[2]) && match[2] !== 'auto') {
                    problems.push(`${where} @apply ${token}`);
                }
            }
            continue;
        }
        const colon = declaration.indexOf(':');
        if (colon < 0) {
            continue;
        }
        const property = declaration.slice(0, colon).trim();
        const value = declaration.slice(colon + 1).trim();
        if (SPACING_PROPERTY.test(property)) {
            for (const length of offScaleLengths(value)) {
                problems.push(`${where} ${property}: ${length}`);
            }
        }
        const centred = property === 'left' && value === '50%';
        const physical = PHYSICAL_PROPERTY.test(property) || (property === 'text-align' && /\b(left|right)\b/.test(value));
        if (physical && !centred && !PHYSICAL_ALLOWED.test(context)) {
            problems.push(`${where} ${property} (use the logical inline-start/end)`);
        }
    }
    return problems;
}

test('the style sheets keep to the spacing scale and logical directions', () => {
    const problems = ['resources/css', 'resources/js'].flatMap(styleSheets).flatMap((file) => spacingViolations(file, readFileSync(file, 'utf8')));

    assert.deepEqual(problems, []);
});

test('the check catches off-scale spacing and physical sides, and spares print and computed values', () => {
    const css = `
        .a { padding: 10px 16px; gap: 0.5rem; margin-inline-start: 6px; }
        .b { margin-left: 8px; text-align: right; @apply px-2.5 py-2; }
        .c { padding: calc(var(--spacing) * 3) max(8px, env(safe-area-inset-bottom)); inset-inline-end: 0; left: 50%; }
        .row td:first-child { border-right: 1px solid; }
        .tip { right: 0; }
        @media print { .d { padding: 10mm 7px; margin-right: 3px; } }
    `;

    assert.deepEqual(spacingViolations('x.css', css).map((problem) => problem.replace(/^x\.css:\d+ /, '')), [
        'padding: 10px',
        'margin-inline-start: 6px',
        'margin-left (use the logical inline-start/end)',
        'text-align (use the logical inline-start/end)',
        '@apply px-2.5',
        'right (use the logical inline-start/end)',
    ]);
});
