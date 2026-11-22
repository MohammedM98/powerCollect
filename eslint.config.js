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
 * The pages and windows already moved onto the MA parts. On these, colour
 * comes from the `--ma-*` tokens only and windows from the kit's frames.
 * Add a file here once it is migrated; never take one out.
 */
const MA_MIGRATED = [
    'resources/js/Pages/Settings/Permission*.jsx',
    'resources/js/Pages/Settings/AuditAccessCard.jsx',
    'resources/js/Pages/Branches/BranchForm.jsx',
    'resources/js/Pages/Subscriptions/{PersonalDetailsModal,ArchiveSubscriptionModal,BulkChangeModal,BulkChanges}.jsx',
    'resources/js/Pages/MeterReadings/MeterReadingModal.jsx',
    'resources/js/Pages/Disconnections/{ActionModal,HistoryModal}.jsx',
    'resources/js/Pages/Messages/{QuickMessageModal,QuickMessageFooter,SubscriptionMessageHistoryModal}.jsx',
    'resources/js/Pages/CompanyForms/IssueModal.jsx',
    'resources/js/Pages/ReadingCycles/{DistributionDialog,CycleParts}.jsx',
    'resources/js/Pages/Settings/PrintTemplates.jsx',
    'resources/js/Components/UI/SelectionBar.jsx',
    'resources/js/Pages/Subscriptions/BulkActionBar.jsx',
    'resources/js/Pages/Disconnections/{Show,Candidates,ResultReport}.jsx',
    'resources/js/Pages/Payments/CloseBoxesByType.jsx',
    'resources/js/Pages/Messages/QuickMessage{Kind,Recipients,Body,Channel}.jsx',
    'resources/js/Components/UI/{TextArea,ChoiceChips,HoldToConfirm}.jsx',
    'resources/js/Pages/Payments/{CashBoxShow,AuditApprovalDialog,Summary,BranchCashBoxes,Entries}.jsx',
    'resources/js/Pages/Reports/{ReportParts,Index}.jsx',
    'resources/js/Pages/Settings/Appearance.jsx',
    'resources/js/Pages/CompanyForms/{Index,Editor}.jsx',
    'resources/js/Components/Print/{PrintTemplatesSection,PrintSettingsPanel}.jsx',
    'resources/js/Components/Settings/SettingsKit.jsx',
    'resources/js/Pages/ReadingCycles/{Submissions,Show,DistributionSummaryModal,DistributionActionModal,DistributionAreas,DistributionAreaBreakdown}.jsx',
    'resources/js/Pages/MeterReadings/{ReadingApprovalDialog,EntryWindowNotice}.jsx',
    'resources/js/Pages/MeterBoxes/MeterBoxSubscriptions.jsx',
    'resources/js/Components/LastReadingConfirmDialog.jsx',
    'resources/js/Pages/Messages/{Show,MessageRecipientList,MessageRecipientCriteria,MessageBodyCard}.jsx',
    'resources/js/Pages/Governorates/HierarchyColumn.jsx',
    'resources/js/Pages/Branches/{Access,Index}.jsx',
    'resources/js/Pages/Profile/**/*.jsx',
    'resources/js/Components/UI/PasswordInput.jsx',
    'resources/js/Components/DataTable/{DataTableToolbar,DensityToggle,DataTableFilterMenu}.jsx',
    'resources/js/Components/Layout/NavigationMenu.jsx',
];
const RAW_COLOUR = /^(?:\S*?:)*!?(?:(?:bg|text|border|ring|divide|outline|decoration|placeholder|fill|stroke|from|via|to)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand|danger|success|warning|info)-\d{2,3}|(?:bg|border)-(?:white|black|surface))(?:\/\S+)?!?$/;

/** A migrated file names no raw colour class (`bg-gray-50`, `text-red-600`…): its colours are the `--ma-*` tokens. */
const maColours = {
    meta: { type: 'problem', schema: [] },
    create(context) {
        function checkClasses(node, text) {
            for (const token of text.split(/\s+/)) {
                if (RAW_COLOUR.test(token)) {
                    context.report({ node, message: `«${token}»: use an --ma-* token (for example text-(--ma-muted), bg-(--ma-tile)) or a kit part.` });
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
            local: { rules: { 'spacing-scale': spacingScale, 'ma-colours': maColours } },
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
    {
        files: MA_MIGRATED,
        rules: {
            'local/ma-colours': 'error',
            // A window is a DialogFrame, FormModal or ConfirmDialog, not a head and foot built by hand over the raw Modal.
            'no-restricted-imports': ['error', { paths: [{ name: '@/Components/UI/Modal', message: 'Build the window on DialogFrame, FormModal or ConfirmDialog.' }] }],
        },
    },
    prettier,
];
