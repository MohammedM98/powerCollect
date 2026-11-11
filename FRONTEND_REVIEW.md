# PowerCollect Frontend Review and Fix Guide

Scope: the website front end under `resources/js` and `resources/css` (React 19, Inertia 3, Vite 8, Tailwind 3). The Flutter app is not covered here.
Snapshot: commit `81ed955`, 11 Nov 2026. Numbers below were measured on that snapshot.

| Measure | Value |
| --- | --- |
| JS/JSX lines | 44,427 in 370 files |
| Pages | 194 files under `resources/js/Pages` (24 folders) |
| Shared components | 102 under `resources/js/Components` |
| Hooks / pure modules | 15 in `hooks/`, 58 in `lib/` |
| CSS | 11,111 lines (`glass.css` 2,399; `top-bar.css` 1,379; `theme.css` 484; 14 page-level `.css` files) |
| Files over 400 lines | 18 (largest: `Settings/Permissions.jsx` 1,010; `Subscriptions/AccountStatement.jsx` 947; `Print/PrintSettingsPanel.jsx` 909) |
| Node unit tests | 66 files, 306 checks, all on `lib/` modules and server-rendered components |
| TypeScript, ESLint | none |

---

## Part 1. What is best about the front end (keep it)

### 1. One token system drives every colour, both themes and the company brand
`resources/css/theme.css` defines colours as RGB triples, `glass.css` builds `--gl-*` tokens from them, Tailwind reads them through `tailwind.config.js`, and `app/Support/Brand.php` injects the company palette at runtime. Light and dark modes, the brand colour and the printouts all follow from one place. Keep adding colours only as tokens.

### 2. Real code splitting and smart prefetching
`resources/js/app.jsx` resolves `Pages/{Name}.jsx` lazily (one chunk per page) and deliberately excludes `*Modal.jsx` and `*Form.jsx` from route-level splitting. Links prefetch on hover (32 `prefetch` uses) and the client calls `router.flushAll()` after any non-GET visit so stale prefetched pages are discarded. `exceljs` and `pdfjs-dist` are already loaded with dynamic `import()` only when used (`lib/excelWorkbook.js`, `Pages/CompanyForms/useCompanySource.js`).

### 3. Modern Inertia 3 patterns
The dashboard uses `Inertia::defer` for the debts panel and `Inertia::optional` for form options that load only when a modal opens. `useHttp` is used in 22 files for JSON helpers (reference checks, previews) instead of ad-hoc fetch. Flash status becomes a toast through `FlashNotifications`; navigation has its own progress line.

### 4. A reusable data-table kit
`Components/DataTable/*` (sortable headers, filter menu, toolbar, pagination, density toggle, row actions, status pills, export actions) plus `hooks/useDataTable.js` (debounced search, immediate sort and filter requests, filters echoed back from `FiltersDataTable` on the server) give every list page the same behaviour. `useResponsiveTables` turns rows into labelled cards on phones.

### 5. Pure logic lives in `lib/` and is unit-tested
Statement maths, balances, currency conversion, overpayment checks, report lines, Excel sheet building, print layout and the permission ladder are plain modules with no React, covered by 66 Node tests. This is the right split; expand it.

### 6. Form and dialog building blocks
`Components/Form/*`, `FormModal`, `FormPage`, `DialogFrame`, `ConfirmDialog`, `HoldToConfirm` and `hooks/useResourceForm.js` are used by 55 files, so create/edit flows look and behave alike. Dangerous actions (disconnect, force delete) require hold-to-confirm.

### 7. Accessibility groundwork is present
455 `aria-label` attributes, 105 keyboard handlers, a command palette, keyboard shortcuts (`TopBar/shortcuts.js`), 14 of 16 images have `alt`. Arabic RTL layout is handled in the layout, not per page.

### 8. Documented intent
Hooks, lib modules and CSS files open with a comment that explains what they do and why (see `useDataTable.js`, `glass.css`, `useResponsiveTables.js`). Keep this habit.

---

## Part 2. What to fix, in priority order

Each item has: the problem, the evidence, the steps, and a "done when" check you can verify yourself.

### Fix 1. Add ESLint and Prettier checks and run them in CI
**Problem.** There is a `.prettierrc.json` but no ESLint config and no lint script, so unused imports, missing hook dependencies and accidental globals are never caught.
**Evidence.** `package.json` has no `lint` script; no `eslint.config.*` file exists.
**Steps.**
1. `npm i -D eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y eslint-config-prettier globals`
2. Create `eslint.config.js` (flat config) enabling `react/recommended`, `react-hooks/recommended`, `jsx-a11y/recommended`, and `eslint-config-prettier` last. Set `react.version: 'detect'` and `files: ['resources/js/**/*.{js,jsx}']`.
3. Add scripts: `"lint": "eslint resources/js"`, `"format": "prettier --write resources/js resources/css"`.
4. Run `npm run lint`; fix or explicitly disable each rule with a reason. Expect many `react-hooks/exhaustive-deps` warnings across the 148 `useEffect` calls; treat each one on its own.
5. Add `npm run lint` to the `frontend` job in `.github/workflows/tests.yml` before `npm test`.
**Done when.** `npm run lint` exits 0 and CI fails on new lint errors.

### Fix 2. Split the giant page files
**Problem.** 18 files exceed 400 lines; `Settings/Permissions.jsx` is 1,010 lines, `Subscriptions/AccountStatement.jsx` 947, `Print/PrintSettingsPanel.jsx` 909, `MeterReadings/Index.jsx` 777, `Reports/Index.jsx` 752. They mix data fetching, local state, derived calculations and markup, so a change in one part risks the rest and they cannot be tested.
**Evidence.** `find resources/js -name '*.jsx' | xargs wc -l | sort -n | tail -20`.
**Steps.** For each file over 400 lines:
1. Move every calculation that does not touch React into `resources/js/lib/<area>.js` and add a Node test for it (follow `tests/Unit/accountStatement.test.js`).
2. Move each self-contained section of markup into its own component next to the page (the `Pages/Payments/*` folder already does this well; copy that layout).
3. Move stateful behaviour (selection, filters, dialogs) into a hook in `resources/js/hooks` or next to the page (`useXxx.js`).
4. Keep the page file as composition only: read props, call hooks, render sections.
**Done when.** No file under `Pages/` or `Components/` is over 400 lines, and the extracted `lib/` functions have tests.

### Fix 3. Replace hard-coded URLs with named routes
**Problem.** Paths are typed by hand in JSX (`href="/subscriptions..."`, `router.post('/meter-readings...')`, 30 literal `href="/..."` and 30 literal router calls, plus 24 `window.location` reads). A route rename on the server breaks pages silently.
**Evidence.** `grep -rn "href=\"/" resources/js`; `grep -rn "router\.\(visit\|post\|get\|put\)('/" resources/js`.
**Steps.**
1. Install Laravel Wayfinder (`composer require laravel/wayfinder` and `npm i -D @laravel/vite-plugin-wayfinder`) or Ziggy; Wayfinder generates typed route functions from `php artisan wayfinder:generate`.
2. Replace each literal with the generated function, starting with the 30 `router.*` calls (they carry data and are the riskiest), then the `href`s.
3. For URLs that read the current query (`useStatementWindow`, `BranchCashBoxes.jsx`), use `usePage().url` from Inertia instead of `window.location`.
**Done when.** `grep -rn "href=\"/\|router\.[a-z]*('/" resources/js` returns only external links.

### Fix 4. Finish the move to Inertia `<Form>` and remove duplicated form state
**Problem.** Three ways to submit exist side by side: `<Form>` (59 files), `useForm` (34 files) and raw `fetch` (4 places). Error handling, disabled states and progress differ between them.
**Evidence.** `grep -rl "useForm(" resources/js | wc -l`; `grep -rn "fetch(" resources/js`.
**Steps.**
1. Keep `<Form>` as the standard for page and modal submissions; keep `useForm` only where the form value is needed by other UI before submit (live totals in `PaymentModal`, `SplitPaymentForm`).
2. Replace the 4 raw `fetch` calls (`BankTransferAuditForm.jsx`, `useCompanySource.js`, `lib/sessionStatus.js`) with `useHttp` so CSRF, JSON headers, cancellation and errors are handled once.
3. Document the rule in `.ai/rules` (forms: `<Form>` by default, `useForm` for live-computed forms, `useHttp` for JSON helpers).
**Done when.** No `fetch(` in `resources/js` and every `useForm` has a comment saying why `<Form>` was not enough.

### Fix 5. Introduce TypeScript gradually
**Problem.** 44k lines with no types and no PropTypes. Props passed from PHP controllers (dozens of fields per page) are undocumented; renames on the server are found only at runtime.
**Evidence.** `grep -rl PropTypes resources/js | wc -l` returns 0; no `tsconfig.json`.
**Steps.**
1. `npm i -D typescript @types/react @types/react-dom` and add `tsconfig.json` with `allowJs: true`, `checkJs: false`, `jsx: react-jsx`, `paths: {"@/*": ["resources/js/*"]}`, `strict: true`.
2. Convert `resources/js/lib/*.js` first (pure functions, already tested) by renaming to `.ts` and adding parameter and return types. Rename tests to `.test.ts` or keep `.js` and import the built output.
3. Define page prop types in `resources/js/types/pages.d.ts` for the five most-used pages (Dashboard, Subscriptions/Index, Subscriptions/Statement, Payments/CashBoxes, MeterReadings/Index) using the controllers' `Inertia::render` arrays as the source.
4. Add `"typecheck": "tsc --noEmit"` and run it in CI.
5. Convert shared `Components/` next; leave pages last.
**Done when.** `lib/` and `Components/` are TypeScript and `tsc --noEmit` runs in CI.

### Fix 6. Add component tests for the money-handling dialogs
**Problem.** The 66 tests cover `lib/` maths and a few server-rendered components, but no test exercises `PaymentModal`, `SplitPaymentForm`, `DiscountModal`, `ChargeModal` or `AmendTransactionModal` as a user does (type an amount, pick a currency, see the converted total, submit).
**Evidence.** `tests/Unit/*.test.js` import `renderToStaticMarkup` only; no `@testing-library/react`.
**Steps.**
1. `npm i -D vitest @testing-library/react @testing-library/user-event jsdom`. Add `vitest.config.js` with `environment: 'jsdom'` and the `@` alias. Keep the existing `node --test` suite running as is.
2. Mock `@inertiajs/react` (`useForm`, `usePage`, `router`) with a small helper in `tests/js/inertia.js`.
3. Write one test per dialog: render with realistic props (copy from a feature test fixture), interact, assert the computed total and the submitted payload.
4. Add `"test:components": "vitest run"` and call it from CI.
**Done when.** Each of the five dialogs has at least one interaction test.

### Fix 7. Consolidate CSS and remove the page-level `.css` files where Tailwind or `gl-` classes suffice
**Problem.** 11,111 lines of CSS. `glass.css` (2,399 lines) and `top-bar.css` (1,379 lines) are hand-written design systems beside Tailwind, and 14 pages ship their own `.css` file with page-specific selectors. Styles for one element can come from four places (Tailwind utility, `gl-` class, page CSS, inline `style={{}}` in 171 places).
**Evidence.** `find resources/css resources/js -name '*.css' | xargs wc -l`; `grep -rho "style={{" resources/js | wc -l`.
**Steps.**
1. Decide the rule: Tailwind utilities for layout and spacing, `gl-` components for surfaces (panels, fields, tables), page CSS only for print or animation that Tailwind cannot express. Write it in `.ai/rules`.
2. For each page `.css` file (start with the small ones: `CompanyForms.css`, `SubscriptionSwitcher.css`, `SmsSettings.css`), move rules into Tailwind classes or into an existing `gl-` component; delete the file.
3. Replace inline `style={{}}` that sets static values with classes; keep inline style only for values computed at runtime (widths, brand colours, chart geometry).
4. Remove the 10 `gl-` classes defined in `glass.css` but never used (`comm -23 <(grep -oE "^\.gl-[a-z0-9-]+" resources/css/glass.css | tr -d . | sort -u) <(grep -rhoE "\bgl-[a-z0-9-]+" resources/js | sort -u)`).
5. `top-bar.css` at 1,379 lines for one component is a sign the top bar does too much (see Fix 8).
**Done when.** No page-level `.css` files remain except print sheets, and inline styles are only for computed values.

### Fix 8. Slim the top bar and the authenticated layout
**Problem.** `Components/TopBar/TopBar.jsx` (635 lines, 9 `useState`) plus 13 sibling files and 1,379 lines of CSS, and `AuthenticatedLayout.jsx` (297 lines, 14 state/effect hooks) run on every page. They hold navigation, mega menu, drawer, page trail, account menu, theme segments, look studio, keyboard shortcuts and a quick tour. Every page pays for all of it on first render.
**Evidence.** `wc -l resources/js/Components/TopBar/*`.
**Steps.**
1. Lazy-load the rarely used parts with `React.lazy` + `Suspense`: `LookStudio`, `QuickTour`, `KeyboardShortcuts` help, `MegaMenu` content.
2. Move navigation data (menu items, permissions to show them) into `lib/navigation.js` (already exists) and make `TopBar`/`SideNavigation` pure consumers.
3. Move layout-level state (theme, density, personal look) into one `useAppearance` hook built from the existing `useTheme`, `useTableDensity`, `usePersonalLook`.
**Done when.** `TopBar.jsx` is under 250 lines and the initial JS for the dashboard is smaller (compare `npm run build` output before and after).

### Fix 9. Review every `useEffect` for derived state and fetch-in-effect
**Problem.** 148 `useEffect` calls versus 41 `useMemo`/`useCallback`/`memo`. Several effects copy props into state (`useDataTable` does `setFilterValues(filters.filter)` in an effect) or react to a URL change by reading `window.location`. These cause double renders and stale UI after Inertia partial reloads.
**Evidence.** `grep -rn "useEffect(" resources/js | wc -l`.
**Steps.**
1. For each effect that only mirrors a prop into state, remove the state and derive the value during render (or use the `key` prop to reset a component when the prop changes).
2. For data that depends on the URL, read `usePage().url` or props rather than `window.location`.
3. For effects that fetch, move to Inertia props (`defer`, `optional`, partial reloads with `only`) or `useHttp` with cancellation.
4. Enable `react-hooks/exhaustive-deps` from Fix 1 and clear its warnings.
**Done when.** No effect sets state from a prop it received, and the lint rule passes.

### Fix 10. Accessibility pass on forms and tables
**Problem.** 45 `<TextInput>` uses but only 32 `<InputLabel>`, 2 images without `alt`, 157 `onClick` handlers on elements that are not buttons or links (rows, cards, chips) without a keyboard equivalent in some cases, and focus-visible styles are inconsistent across the `gl-` components.
**Evidence.** `grep -rho "<TextInput" resources/js | wc -l`; `grep -rn "onClick" resources/js --include=*.jsx | grep -v "button\|Button\|<a \|Link"`.
**Steps.**
1. Enable `jsx-a11y` from Fix 1; it will list the missing labels, `alt`s and click handlers on non-interactive elements.
2. Give every `TextInput` an `id` and a matching `InputLabel` (or `aria-label` when the label is visual only).
3. Clickable rows: keep the row click as a convenience but put the real action in the row menu button (already in `RowActionsMenu`); add `tabIndex={0}` and `onKeyDown` for Enter/Space where the row itself must be focusable (`useRowClick` can own this once).
4. Add one shared `:focus-visible` rule in `theme.css` for `gl-field`, `gl-btn` and table rows.
5. Test with keyboard only on the five main pages and with a screen reader on the payment modal.
**Done when.** `jsx-a11y` reports 0 errors and every form control has a label.

### Fix 11. Error and empty states for deferred data
**Problem.** Pages that use `Inertia::defer` (dashboard debts) show a skeleton, but there is no uniform empty state or error state for failed JSON helpers (`useHttp` calls for reference checks, previews). Users see a silent nothing when the request fails.
**Steps.**
1. Create `Components/AsyncState.jsx` with `loading`, `empty`, `error` variants (skeleton, message, retry button).
2. Wrap each `useHttp` usage's result in it; show the server's validation message when present.
3. Use the Inertia `httpException` and `networkError` events in `app.jsx` to show a toast through `notify.js` for global failures.
**Done when.** Every JSON helper shows an error with a retry, and a network failure shows a toast.

### Fix 12. Clean the dependency list
**Problem.** `package.json` lists `tailwindcss ^3.1` and `@tailwindcss/vite ^4.0` together; the v4 plugin is not used anywhere (`vite.config.js` does not import it). `alpinejs` and `autoprefixer`/`postcss` are listed; Alpine is not imported in `resources/js`. Unused packages slow installs and confuse upgrades.
**Evidence.** `grep -rn "tailwindcss/vite\|alpinejs" vite.config.js resources/js` returns nothing.
**Steps.**
1. Remove `@tailwindcss/vite` and `alpinejs` from `package.json`; run `npm install` and `npm run build`.
2. Decide on the Tailwind 4 upgrade separately (it changes `tailwind.config.js` into CSS `@theme`; the token system in `theme.css` makes this feasible but it is its own task).
3. Pin `pdfjs-dist` upgrades to the `pdfAssets()` plugin in `vite.config.js` (it copies `cmaps`, `standard_fonts`, `wasm`); add a comment there that the version must be checked when upgrading.
**Done when.** `npm ls` shows no unused direct dependencies and the build passes.

### Fix 13. Page titles and document structure
**Problem.** Only 53 of the 194 page files set `<Head title>`; several `Index.jsx` pages rely on the layout's default title, so browser history and tabs read the same for different pages.
**Evidence.** `grep -rl "<Head " resources/js/Pages | wc -l`.
**Steps.**
1. Give every route-level page (`Index.jsx`, `Show.jsx`, `Create.jsx`, `Edit.jsx`, `Dashboard.jsx`, `Error.jsx`) a `<Head title="…">` using the same Arabic names as the side navigation.
2. Ensure one `<h1>` per page (the `PageHeader` component should render it).
**Done when.** Every page file that is resolved from a route sets a title.

---

## Part 3. Suggested order of work

| Week | Work | Why first |
| --- | --- | --- |
| 1 | Fix 1 (lint), Fix 12 (dependencies), Fix 13 (titles) | Cheap, mechanical, and the lint output guides the rest. |
| 2–3 | Fix 3 (named routes), Fix 4 (one form pattern), Fix 11 (error states) | Removes silent runtime breakage. |
| 4–6 | Fix 2 (split large pages) together with Fix 9 (effects) and Fix 6 (dialog tests) | Do them per page: split, remove effects, add the test. |
| 7–8 | Fix 7 (CSS) and Fix 8 (top bar) | Easier once pages are smaller. |
| ongoing | Fix 5 (TypeScript) and Fix 10 (accessibility) | Convert files as you touch them. |

## Part 4. Commands to measure progress

```bash
# largest files
find resources/js -name '*.jsx' -o -name '*.js' | xargs wc -l | sort -n | tail -20

# hard-coded routes left
grep -rn "href=\"/\|router\.[a-z]*('/" resources/js | wc -l

# raw fetch left
grep -rn "fetch(" resources/js | wc -l

# effects vs memo
grep -rho "useEffect(" resources/js | wc -l; grep -rho "useMemo(\|useCallback(\|memo(" resources/js | wc -l

# inline styles
grep -rho "style={{" resources/js | wc -l

# page-level css files
find resources/js -name '*.css' | wc -l

# build size (after npm run build)
du -sh public/build/assets
```
