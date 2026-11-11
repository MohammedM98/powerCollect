import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

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
            // Leaving a key out with rest destructuring, or naming a value _unused, is deliberate.
            'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
            // Dialogs and inline editors put the cursor in their first field when they open (the WAI-ARIA dialog pattern).
            'jsx-a11y/no-autofocus': 'off',
            // The app's own inputs are controls too, and option labels carry their text a few elements deep.
            'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['TextInput', 'SearchableSelect', 'DateInput', 'MoneyInput', 'NumberInput'], assert: 'either', depth: 5 }],
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
