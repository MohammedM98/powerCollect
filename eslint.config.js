import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/** The agreed spacing scale: 0 and 4/8/12/16/24/32px. */
const SPACING_STEPS = new Set(['0', '1', '2', '3', '4', '6', '8']);
const SPACING_UTILITY = /^(?:\S*?:)*!?-?(px|py|pt|pb|ps|pe|p|mx|my|mt|mb|ms|me|m|gap-x|gap-y|gap|space-x|space-y)-(\S+?)!?$/;
const PHYSICAL_UTILITY = /^(?:\S*?:)*!?-?(pl-\S+|pr-\S+|ml-\S+|mr-\S+|text-left|text-right|float-left|float-right|rounded-(?:[lr]|[tb][lr])(?:-\S+)?|border-[lr](?:-\S+)?|left-\S+|right-\S+)!?$/;
const LOGICAL_EQUIVALENT = { pl: 'ps', pr: 'pe', ml: 'ms', mr: 'me', 'text-left': 'text-start', 'text-right': 'text-end', left: 'start', right: 'end' };

/**
 * Tailwind spacing (padding, margin, gap, space) uses only the scale's steps,
 * with no arbitrary values, and every direction is logical (start/end), so the
 * RTL layout mirrors itself. Centring with left-1/2 is direction-neutral.
 */
const spacingScale = {
    meta: { type: 'problem', schema: [] },
    create(context) {
        function checkClasses(node, text) {
            for (const token of text.split(/\s+/)) {
                const spacing = token.match(SPACING_UTILITY);
                if (spacing) {
                    const [, utility, value] = spacing;
                    const allowed = SPACING_STEPS.has(value) || /^\(--[\w-]+\)$/.test(value) || (value === 'auto' && utility.startsWith('m')) || (value === 'reverse' && utility.startsWith('space-'));
                    if (!allowed) {
                        context.report({ node, message: `«${token}»: spacing uses only the steps 0 1 2 3 4 6 8 (4–32px), with no arbitrary values.` });
                    }
                    continue;
                }
                const physical = token.match(PHYSICAL_UTILITY);
                if (physical && !/^-?(left|right)-1\/2$/.test(physical[1])) {
                    const name = physical[1].replace(/-.*$/, '');
                    const logical = LOGICAL_EQUIVALENT[physical[1]] ?? LOGICAL_EQUIVALENT[name];
                    context.report({ node, message: `«${token}»: use the logical direction${logical ? ` (${logical})` : ' (start/end)'} so the layout mirrors in RTL.` });
                }
            }
        }

        return {
            Literal(node) {
                if (typeof node.value === 'string') {
                    checkClasses(node, node.value);
                }
            },
            TemplateElement(node) {
                checkClasses(node, node.value.cooked ?? node.value.raw);
            },
        };
    },
};

/**
 * Lint for the website's React code: the recommended JavaScript, React,
 * hooks and accessibility rules, with Prettier owning the formatting.
 */
export default [
    { ignores: ['public/**', 'vendor/**', 'node_modules/**', 'mobile/**', 'storage/**', 'bootstrap/ssr/**'] },
    {
        files: ['resources/js/**/*.{js,jsx}'],
        ...js.configs.recommended,
        ...react.configs.flat.recommended,
        ...react.configs.flat['jsx-runtime'],
        ...jsxA11y.flatConfigs.recommended,
        plugins: {
            ...react.configs.flat.recommended.plugins,
            ...jsxA11y.flatConfigs.recommended.plugins,
            'react-hooks': reactHooks,
            local: { rules: { 'spacing-scale': spacingScale } },
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: { ...globals.browser },
        },
        settings: { react: { version: 'detect' } },
        rules: {
            ...js.configs.recommended.rules,
            ...react.configs.flat.recommended.rules,
            ...react.configs.flat['jsx-runtime'].rules,
            ...jsxA11y.flatConfigs.recommended.rules,
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            // Props come from the Laravel controllers, not from PropTypes.
            'react/prop-types': 'off',
            // The owner's spacing scale and logical directions (see spacingScale above).
            'local/spacing-scale': 'error',
            // Leaving a key out with rest destructuring, or naming a value _unused, is deliberate.
            'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
            // Dialogs and inline editors put the cursor in their first field when they open (the WAI-ARIA dialog pattern).
            'jsx-a11y/no-autofocus': 'off',
            // The app's own inputs are controls too, and option labels carry their text a few elements deep.
            'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['TextInput', 'SearchableSelect', 'DateInput', 'MoneyInput', 'NumberInput', 'Input', 'TextArea', 'CheckBox', 'ChoiceSelect'], assert: 'either', depth: 5 }],
            // A form may take Ctrl+Enter to submit; a dialog handles its own keys.
            'jsx-a11y/no-noninteractive-element-interactions': ['error', {
                handlers: ['onClick', 'onError', 'onLoad', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'],
                form: ['onKeyDown', 'onInput', 'onSubmit', 'onReset'],
                dialog: ['onKeyDown', 'onKeyUp', 'onKeyPress'],
                alert: ['onKeyUp', 'onKeyDown', 'onKeyPress'],
                body: ['onError', 'onLoad'],
                iframe: ['onError', 'onLoad'],
                img: ['onError', 'onLoad'],
            }],
            // Scrolling regions, tables, grids and charts take focus so the keyboard can reach and scroll them.
            'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region', 'table', 'grid', 'img'], allowExpressionValues: true }],
        },
    },
    prettier,
];
