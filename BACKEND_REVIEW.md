# PowerCollect Backend and Database Review and Fix Guide

Scope: the Laravel application under `app/`, `routes/`, `database/`, `config/` and `tests/`, and the MySQL schema. The React front end has its own guide (`FRONTEND_REVIEW.md`); the Flutter app is not covered.
Snapshot: commit `81ed955`, 11 Nov 2026. Numbers were measured on that snapshot; the schema was produced by running all 92 migrations.

| Measure | Value |
| --- | --- |
| PHP lines under `app/` | 38,210 |
| Controllers / Form Requests / Policies | 86 / 82 / 29 |
| Models / Enums / Support services | 62 / 30 / 34 |
| Routes | 246 (218 web, 28 mobile API) |
| Tables | 75 (69 application, 6 framework), 178 foreign keys, 56 unique, 40 extra indexes |
| Money columns | 45 `decimal` (10,2 / 12,2 / 12,4 / 14,2 / 14,4) |
| JSON columns | 26 |
| Tests | 128 feature test files, 2,245 tests, 202,727 assertions, all passing (8 min on SQLite) |
| Static analysis | none (no PHPStan/Larastan); Pint configured |

---

## Part 1. What is best about the backend (keep it)

### 1. The ledger is append-only and self-describing
`subscription_transactions` is the single source of truth for every balance. `amount` is the signed effect in shekels, `balance_after` is stored, `delete()` throws, a cancellation adds a reversal line (`reverses_id`), a correction adds the replacement line (`corrects_id`), and `ensureMutable()` refuses changes once a line sits in a closed box or an audited closing. `ImmutableLedgerDeletionTest` and `TransactionHistoryInvariantsTest` guard this. Do not weaken it.

### 2. Exact money
Every amount is a `decimal` column; arithmetic goes through `app/Support/Money.php` on `brick/math` with explicit rounding; foreign-currency payments keep `currency`, `currency_amount` and `exchange_rate` so the shekel value is reproducible.

### 3. Idempotent writes and explicit concurrency control
`web_payment_operations` (token + fingerprint) makes a web payment safe to retry; `mobile_operation_id` and `reading_submissions.operation_id` do the same for the app; `FieldReadingSync` replays the first decision. Money writes run inside `BranchClosingWorkflow::locked($branchId)` (cache lock + transaction, 53 `DB::transaction` uses overall); `ReadingAllocation` uses a `version` column and reports conflicts.

### 4. Authorisation is fine-grained and tested
98 `PermissionKey` cases, 29 policies, `#[Fillable]` attributes on every model (Laravel 13 style, so mass assignment is guarded), company-wide keys only a Super Admin may grant, delegation, an audit-only mode with branch and action scope, device limits, login rate limiting, password rules, hashed mobile tokens with expiry, a 426 upgrade response for old apps, CSP with nonce and HSTS. `ActionPermissionIsolationTest` and `AuditorPermissionsTest` prove the boundaries.

### 5. Branch isolation lives in the model layer
`BelongsToBranch::visibleTo()` scopes every list; `BranchDomainScope` narrows models when the request arrives on a branch host; nested route bindings are scoped. `DefaultBranchScopeTest` and `BranchDomainsTest` cover it.

### 6. History is protected, not cascaded
Only 18 of 178 foreign keys cascade; 97 restrict and 50 set null. `DeletionBlocker` and model `booted()` guards explain in Arabic what still references a record. Subscriptions with money are archived (`archived_at`, `archive_history`), never deleted. Audit tables exist for profiles, amendments, deletions, assignments, closings, disconnections, bulk changes and tariff prices.

### 7. Reports are deterministic by design
`BranchReport` counts a line on the business day it was recorded (per-branch cut-off from `ClosingPeriods`), reversals on their own day, so a closed day's figures never change. This also makes those days safe to cache.

### 8. Operations are covered
Verified nightly backups with retention (`backup:run`), the closing scheduler, the weekly distribution command, a legacy import command, brand import/export, Arabic error pages, a health endpoint, CI on PHP 8.3/8.4/8.5, and a very large behaviour-level suite with whole-company journey tests.

---

## Part 2. What to fix, in priority order

Each item has: the problem, the evidence, the steps, and a "done when" check.

### Fix 1. Break up the two god models
**Problem.** `app/Models/SubscriptionTransaction.php` is 1,926 lines with 11 static entry points (record payment, charge, clearing, discount, voucher numbering, corrections, statement helpers). `app/Models/MeterReading.php` is 723 lines with 12 static methods (record, approve, reopen, re-price, charge). Every money rule change touches one file; the tests that protect it are slow to find.
**Evidence.** `wc -l app/Models/SubscriptionTransaction.php app/Models/MeterReading.php`; `grep -c "public static function" app/Models/SubscriptionTransaction.php`.
**Steps.**
1. Create `app/Actions/Ledger/` (ask before adding a base folder, or use `app/Support/Ledger/`) with one class per operation: `RecordPayment`, `RecordCharge`, `RecordClearing`, `RecordDiscount`, `CancelLine`, `CorrectLine`, `RefundPayment`, `ClaimVoucherNumber`.
2. Move each static method's body into the matching class unchanged; keep the static method as a one-line delegate for now so the 2,245 tests stay green.
3. Move statement building (`BuildsSubscriptionStatement` concern and the model helpers it calls) into `app/Support/Ledger/StatementBuilder.php`.
4. Repeat for `MeterReading`: `RecordReading`, `ApproveReading`, `ReopenReading`, `RepriceReading`, `AdjustLastReading`.
5. Once every caller uses the classes, delete the static delegates.
**Done when.** Both models are under 400 lines and contain only relations, casts, scopes and invariants.

### Fix 2. Decide one layering rule and apply it to controllers
**Problem.** Business logic is spread over models, controllers (five over 440 lines: `ReportController` 539, `MeterReadingController` 514, `LedgerController` 508, `SubscriptionController` 463, `DisconnectionListController` 449) and 34 loosely related `Support` classes. Twelve controller concerns (`FiltersSubscriptionList`, `BuildsSubscriptionStatement`, `PresentsCashBoxes`…) hold domain logic that other entry points (mobile, commands) cannot reuse.
**Evidence.** `wc -l app/Http/Controllers/*.php | sort -n | tail`; `ls app/Http/Concerns`.
**Steps.**
1. Write the rule in `.ai/rules` (use the Boost `record-rule` tool): controller = validate, authorise, call one action/service, return a response. No queries beyond simple `findOrFail` in controllers.
2. Convert each concern in `app/Http/Concerns` into a class under `app/Support` (query builders become `app/Support/Queries/SubscriptionListQuery.php` and similar).
3. Group `app/Support` into subfolders by domain (`Ledger`, `Readings`, `Closing`, `Reports`, `Branding`, `Messaging`) so the folder stops being a grab bag.
4. Trim the five big controllers by moving their private methods into the new classes.
**Done when.** No controller exceeds 250 lines and `app/Http/Concerns` is empty.

### Fix 3. Move Arabic copy out of PHP
**Problem.** 162 PHP files under `app/` contain Arabic literals: validation messages, deletion-blocker labels, notification texts, enum labels, column headers for exports. `lang/ar.json` exists but is barely used, so wording changes are code changes and tests assert on sentences.
**Evidence.** `grep -rl $'[\xd8-\xd9]' app | wc -l` (162; 23 of them models). Examples: `Subscription.php` lines 79 and 326-340, `SubscriptionTransaction.php` lines 234 and 249.
**Steps.**
1. Start with messages thrown through `ValidationException::withMessages` (grep `withMessages`): give each a key in `lang/ar.json` and call `__('key')`.
2. Move `DeletionBlocker` labels to `lang/ar.json` keyed by model and relation.
3. Move enum `label()` strings to `lang/ar/enums.php`.
4. Change tests that assert on sentences to assert on `__('key')` or on the response status and the error key.
**Done when.** `grep -rl $'[\xd8-\xd9]' app/Models app/Support | wc -l` returns 0.

### Fix 4. Schema cleanup release
**Problem.** The schema still carries an earlier, counting-based closing model: `safe_counts`, `closing_versions`, `closing_adjustments`, `cash_box_syncs`, `debt_repayments`, `closing_payments`, `collector_debts`, and columns such as `closings.counted_cash`, `closings.denominations`, `cash_boxes.collector_counts`, `head_counts`, `expected_counts`. `RemovedFinancialFeaturesTest` asserts the old endpoints are gone while the rows stay. Several migrations add then drop or move data (`collector_returns` added 12 Oct and dropped 13 Oct; direct payments moved back 14 Oct), so a fresh install runs data-moving code on empty tables.
**Evidence.** `grep -rl "\bSafeCount\b" app | grep -v Models` (1 file); `ls database/migrations | wc -l` (92).
**Steps.**
1. For each suspect table, confirm it is unused: grep the model name in `app/` outside `app/Models`, and run `select count(*)` on production.
2. Write one migration that drops the unused tables and columns, guarded by a row-count check so it refuses on a database that still has data.
3. Delete the matching models and factories; keep the enum cases only if stored values still exist.
4. Run `php artisan schema:dump --prune` to collapse the 92 migrations into `database/schema/mysql-schema.sql` plus any later migrations. Keep the SQLite dump too for tests (`schema:dump` with `--database=sqlite`).
5. Add a short `docs` note (or a comment in `BranchClosingWorkflow`) stating which closing model is current.
**Done when.** No model exists without a non-model reference, and a fresh `migrate` runs the schema dump instead of 92 files.

### Fix 5. Reduce JSON columns that hold queryable history
**Problem.** 26 JSON columns store repeated records: `meter_readings.adjustment_history`, `subscriptions.archive_history`, `reading_entry_settings.reading_day_history`, `cash_boxes.decisions`, `closings.submitted_snapshot`, `users.audit_settings`, `subscription_bulk_change_items.side_effects`. They cannot be indexed, joined or summed, and SQLite (tests) and MySQL (production) treat JSON differently.
**Evidence.** `grep -rhoE "\->json\('[a-z_]+'" database/migrations | sort -u`.
**Steps.**
1. Classify each column: snapshot (keep as JSON: `submitted_snapshot`, `workflow_settings`, `denominations`) or history (move).
2. For each history column, create a child table (`meter_reading_adjustments`, `subscription_archive_events`, `reading_day_changes`) with a migration that copies existing JSON rows.
3. Replace model casts and the code that appends to the array with `->create()` on the relation.
4. `users.audit_settings` (scope, branch ids, actions) becomes `user_audit_scopes` rows so an auditor's branches can be joined.
**Done when.** Only true snapshots remain JSON and every history has a table and a factory.

### Fix 6. Contain the global-scope escape hatches
**Problem.** `withoutGlobalScope(BranchDomainScope::class)` appears 26 times (`SplitTransferAuditing` 5, `SplitPayment` 4, `SubscriptionTransaction` 4, `UserDeviceAccess` 4, `Subscription` 2, middleware and controllers). Each is a place where a branch host could read another branch's rows after a careless edit.
**Evidence.** `grep -rn withoutGlobalScope app`.
**Steps.**
1. Add named query methods for the legitimate cross-branch reads, e.g. `Subscription::acrossBranches()`, `SubscriptionTransaction::acrossBranches()`, with a doc block saying why.
2. Replace each raw call with the named method.
3. Add a test that scans `app/` and fails if `withoutGlobalScope(` appears outside the allowed list of files.
**Done when.** The allow-list test passes with at most the model files on it.

### Fix 7. Run the suite on MySQL as well as SQLite
**Problem.** `phpunit.xml` uses in-memory SQLite; production is MySQL. Date arithmetic, JSON functions, decimal precision, collation for Arabic search (`ArabicSearch`), `VACUUM INTO` versus `mysqldump` in `RunBackup`, and FK index behaviour differ.
**Evidence.** `phpunit.xml`; `app/Console/Commands/RunBackup.php` lines 103 and 120.
**Steps.**
1. Add a `tests-mysql` job to `.github/workflows/tests.yml` with a `mysql:8` service, `DB_CONNECTION=mysql` env, and run only the financial and report folders first (`tests/Feature/Lifecycle`, `Ledger`, `BranchReportTest`, `CashBox*`, `Closing*`, `Backup*`).
2. Fix the differences it reveals; then widen to the full suite nightly.
**Done when.** CI has a green MySQL job covering money and reports.

### Fix 8. Add indexes for the queries reports actually run
**Problem.** `subscription_transactions` has indexes for lookups by subscription, reference, voucher and dates, but reports and the dashboard filter by branch, business day, type and status (`BranchReport`, `DashboardOverview`, `LedgerController`), and `cash_box_payments` is read by box and `occurred_at`. In MySQL every FK column gets an index automatically, but composite indexes for these filters do not exist.
**Evidence.** Indexes on `subscription_transactions`: `(subscription_id, created_at, id)`, `paid_on`, `bank_received_on`, `active_reference`; no `(branch_id, created_at)` or `(branch_id, type, status)`.
**Steps.**
1. Enable the MySQL slow query log on a staging copy with real volume, or run `EXPLAIN` on the queries built by `BranchReport::for()`, `LedgerController@index` and `DashboardOverview`.
2. Add composite indexes where `EXPLAIN` shows a full scan: likely `subscription_transactions (branch_id, created_at)`, `(branch_id, type, status)`, `cash_box_payments (cash_box_id, occurred_at)`, `subscription_messages (status, created_at)`.
3. Keep the migration small and reversible.
**Done when.** The report and ledger queries use an index in `EXPLAIN` on a table with at least a year of data.

### Fix 9. Cache the closed business days and move infrastructure off the database
**Problem.** Sessions, cache, cache locks and the queue all use MySQL, and every report request re-sums the ledger. `Cache::remember` is used 0 times. Fine for a few branches; slow with growth, and the per-branch money lock is a database cache lock.
**Evidence.** `.env.example` (`SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION` = database); `grep -rn "Cache::remember" app | wc -l` (0).
**Steps.**
1. Cache per-branch, per-day report aggregates once the day is closed (`ClosingPeriods` knows the cut-off): key `report:{branch}:{day}`, no expiry, invalidated only by a reversal recorded against that day (reversals count on their own day by design, so invalidation is rare).
2. Cache the dashboard overview for 60 seconds per user scope.
3. When a second web server or Horizon-style queue visibility is needed, switch `CACHE_STORE`, `QUEUE_CONNECTION` and `SESSION_DRIVER` to Redis; the code needs no change.
**Done when.** A report for a past month returns from cache, and the dashboard query count per request is measured and lower.

### Fix 10. Version the mobile API and describe its contract
**Problem.** `/api/mobile/*` is unversioned; compatibility relies on `MOBILE_APP_MIN_BUILD`; responses are hand-built arrays in 10 controllers (`app/Http/Resources` does not exist) and duplicated in `mobile/lib/api_client.dart`.
**Evidence.** `routes/api.php`; `ls app/Http/Resources` (missing).
**Steps.**
1. Create API Resources (`php artisan make:resource Mobile/SubscriptionResource` and so on) for assignments, subscriptions, transactions, cash boxes and session.
2. Move the routes under `/api/mobile/v1` and keep `/api/mobile` as an alias until `MOBILE_APP_MIN_BUILD` passes the build that uses v1.
3. Write `docs/mobile-api.yaml` (OpenAPI) by hand from the resources and add a test that every route in `api.php` has an entry.
**Done when.** Every mobile response goes through a Resource and the OpenAPI test passes.

### Fix 11. Finish the Form Request convention
**Problem.** 82 Form Requests exist, yet 33 controllers still call `$request->validate()` inline and 19 controllers take a plain `Request` with no Form Request at all, so the same fields (reference numbers, amounts, dates) are validated with slightly different rules in different places.
**Evidence.** `grep -l "request->validate(" app/Http/Controllers/*.php | wc -l` (33).
**Steps.**
1. For each inline block, `php artisan make:request <Name>Request --no-interaction`, move rules and the `authorize()` call, and type-hint the controller method.
2. Share repeated rule sets through small rule classes (`app/Rules/MoneyAmount.php`, `BankReference.php`).
3. Add a test that fails if `->validate(` appears in `app/Http/Controllers`.
**Done when.** The guard test passes.

### Fix 12. Resolve role versus permission
**Problem.** `users.role` still drives behavioural checks (`isCollector`, `isDataEntry`, `isFinancialAuditor`, `isBranchAdmin`) after the 20 Oct migration that converted roles to individual permissions, so two authorisation models must stay consistent.
**Evidence.** `app/Models/User.php` lines 137-230; `database/migrations/2026_10_20_071427_convert_user_roles_to_individual_permissions.php`.
**Steps.**
1. List every call to the `is*()` role helpers and decide for each whether a permission key already expresses it.
2. Replace those calls with `hasPermission()`; keep `isSuperAdmin()` and the role as a starter-set label only.
3. Rename the column to `starter_role` (or document that it is informational) so nobody adds new checks on it.
**Done when.** Only `isSuperAdmin()` reads `role`.

### Fix 13. Add static analysis and keep Pint green
**Problem.** No PHPStan/Larastan, so wrong return types, impossible conditions and unknown properties are found only at runtime. Pint currently fails on one file.
**Evidence.** `composer.json` has no `larastan`; `vendor/bin/pint --test` reports `database/factories/SubscriptionFactory.php` (ordered imports).
**Steps.**
1. `composer require --dev larastan/larastan`; add `phpstan.neon` at level 5 with `paths: [app, database, routes]`; raise the level one step at a time.
2. Add `vendor/bin/phpstan analyse --memory-limit=1G` and `vendor/bin/pint --test` to the PHP job in CI.
3. Run `vendor/bin/pint` once to fix the current file.
**Done when.** CI fails on a PHPStan error or a Pint violation.

### Fix 14. Observability and failure alerts
**Problem.** Logging goes to files only; backup failures reach `report()` and the log; the single queue job has no `failed()` handler; there is no error tracker or metric.
**Evidence.** `config/logging.php`; `routes/console.php`; `app/Jobs/SendSubscriptionMessage.php` has no `failed()` method.
**Steps.**
1. Add an error tracker (Sentry or Flare) through `withExceptions()->report()` in `bootstrap/app.php`.
2. Implement `failed()` on `SendSubscriptionMessage` to mark the row failed with the exception message and notify the batch creator.
3. Use `Schedule::...->emailOutputOnFailure()` or a notification for `backup:run` and `closings:process`.
4. Expose `php artisan queue:monitor database:default --max=100` in the scheduler so a stuck worker is reported.
**Done when.** A failed backup, a failed SMS and an uncaught exception each produce an alert outside the log file.

### Fix 15. Keep real branch data out of seeders
**Problem.** `database/seeders/CampTwo*` and `database/seeders/data` carry a named branch's subscribers and users; `TeamTestingSeeder` and `FinancialFlowSeeder` are useful for demos but blur demo and production data.
**Steps.**
1. Move real imports to files consumed by `subscriptions:import` and stored outside the repository.
2. Keep seeders synthetic (Faker with the Arabic locale) and keep the production guard in `DatabaseSeeder` (it already refuses a default Super Admin password).
**Done when.** No seeder contains real names, phones or national ids.

---

## Part 3. Database reference notes

- **Keys and rules.** 178 foreign keys: 97 `restrict`, 50 `set null`, 18 `cascade`, 6 `no action`. Cascades are limited to pivot and child-event tables; keep it that way.
- **Uniqueness that encodes business rules.** `subscriptions.account_number`, `legacy_number`; `meter_readings (subscription_id, week_start)` (one reading per week); `subscription_transactions.voucher_number`, `source_key`, `mobile_operation_id`, `late_payment_token`; `cash_boxes.number`, `open_key` (one open box per person, type and period); `closings (branch_id, coverage_from, book)`; `reading_submissions.operation_id`.
- **Time zones.** `app.timezone` is UTC; business days use `app.business_timezone` through `ClosingPeriods` and `DailySeries`. Always go through those helpers when comparing dates.
- **Money precision.** 24 columns at (12,2), 15 at (10,2), 3 at (14,2); rates at (12,4)/(14,4). When adding a column, use (12,2) for amounts and (12,4) for rates.
- **Settings pattern.** `closing_settings`, `reading_entry_settings` and `sms_settings` have a company-wide row (`branch_id` null) and optional per-branch override rows through `OverridableByBranch`.

## Part 4. Commands to measure progress

```bash
# god classes
wc -l app/Models/SubscriptionTransaction.php app/Models/MeterReading.php
wc -l app/Http/Controllers/*.php | sort -n | tail -6

# Arabic literals left in PHP
grep -rl $'[\xd8-\xd9]' app | wc -l

# global scope escapes
grep -rn withoutGlobalScope app | wc -l

# inline validation left
grep -l "request->validate(" app/Http/Controllers/*.php | wc -l

# unused models (name not referenced outside app/Models)
for m in app/Models/*.php; do n=$(basename $m .php); c=$(grep -rl "\b$n\b" app --include=*.php | grep -v "app/Models/$n.php" | wc -l); [ "$c" -le 1 ] && echo "$n $c"; done

# style and analysis
vendor/bin/pint --test
vendor/bin/phpstan analyse

# tests
php artisan test --compact
```
