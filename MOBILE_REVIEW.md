# PowerCollect Mobile App Review and Fix Guide

Scope: the Flutter field app under `mobile/` (Android only) and the server pieces it depends on (`routes/api.php`, `app/Http/Controllers/Mobile`). The website and the backend have their own guides (`FRONTEND_REVIEW.md`, `BACKEND_REVIEW.md`).
Snapshot: commit `81ed955`, 11 Nov 2026, app version `1.0.7+8`. Numbers were measured on that snapshot.

| Measure | Value |
| --- | --- |
| Dart lines in `mobile/lib` | 11,517 in 34 files (flat folder) |
| Largest files | `reading_flow.dart` 1,438; `field_shell.dart` 1,193; `payment_page.dart` 1,092 |
| Widgets | 21 `StatefulWidget`, 40 `StatelessWidget`, 178 `setState` calls |
| Data typing | 190 uses of `Map<String, dynamic>`, 110 inline `as` casts, 0 model classes |
| Native Kotlin | 452 lines (`MainActivity`, `SessionTokenStorage`, `ReceiptImageCapture`) |
| Dependencies | `flutter`, `flutter_localizations`, `google_mlkit_text_recognition` only |
| Tests | 26 files, 5,834 lines, 144 tests; CI runs `flutter analyze` and `flutter test` |
| Platforms | Android (minSdk 24); no iOS project |

---

## Part 1. What is best about the mobile app (keep it)

### 1. A hardened network layer in one file
`mobile/lib/api_client.dart` is the only place that talks to the server. A release build refuses to run without `API_BASE_URL`, refuses anything but `https`, refuses redirects, sets explicit timeouts (12 s connect, 18 s response), sends `X-App-Build` on every request, and turns every failure into an `ApiException` with an Arabic message. The Android manifest sets `usesCleartextTraffic="false"` and `allowBackup="false"`.

### 2. The session token is encrypted with the Android Keystore
`SessionTokenStorage.kt` stores the token with AES-256-GCM under a Keystore key; `field_store.dart` migrates a legacy plaintext token into it on first load and never writes the token into the JSON state file again. The server stores only the SHA-256 of the token and expires it after 12 hours, or 30 days with "remember".

### 3. Offline readings that cannot be lost or duplicated
`queued_readings.dart` and `field_store.dart` persist readings and drafts with an atomic write (temp file, flush, rename) and serialise writes through a future chain. Each reading carries a `mobile_operation_id`; the server (`FieldReadingSync`) answers a repeated upload with the first decision. Switching accounts with unsent readings is blocked (`PendingReadingsAccountSwitch`).

### 4. Payments are idempotent across retries
`payment_page.dart`, `split_payment_page.dart` and `adjustment_page.dart` build the submission once with a `mobile_operation_id` and reuse the same object when the user retries after a network error or a 5xx, so an uncertain result never becomes a double payment. The message shown tells the collector to retry from the same screen or check today's payments first.

### 5. A forced-update path instead of silent breakage
`appBuildNumber` must match `pubspec.yaml` (a test checks it). When the server's `MOBILE_APP_MIN_BUILD` is higher, the app receives HTTP 426 with the download link, and queued readings stay on the phone until the update.

### 6. Very few dependencies
Three packages. No state-management framework, no HTTP package, no storage plugin: `dart:io` `HttpClient` and two small method channels. Upgrades are cheap and the supply-chain surface is small.

### 7. Its own design system and good test habits
`app_controls.dart`, `app_surfaces.dart`, `app_visuals.dart`, `app_icons.dart`, `app_keypad.dart` and `app_identity.dart` give one look across screens, with light and dark themes and bundled Arabic fonts. Tests subclass `ApiClient` with fakes (`OfflineApi`, `CollectorApi`…) and cover collector workflow, permissions, session security, offline queue, receipt scan, responsive layout and keyboard navigation. `mounted` is checked 114 times after awaits.

---

## Part 2. What to fix, in priority order

Each item has: the problem, the evidence, the steps, and a "done when" check.

### Fix 1. Split the three giant state classes
**Problem.** `_ReadingFlowState` (1,438-line file, 33 private methods, `build()` starting at line 546), `_FieldShellState` (1,193 lines: tabs, 30-second sync timer, roster refresh, queue upload, collections search, session handling) and `_PaymentPageState` (1,092 lines) each hold networking, persistence, business rules and layout in one `State` object. Any change re-reads a thousand lines, and logic can only be tested through widget tests.
**Evidence.** `wc -l mobile/lib/*.dart | sort -n | tail -4`; each file contains exactly two classes.
**Steps.**
1. For each file, list the fields and group them: data loaded from the server, user input, UI flags.
2. Move the non-UI logic into a plain Dart controller that extends `ChangeNotifier` (no new package needed): `ReadingFlowController`, `FieldSyncController`, `PaymentFormController`. Give it the `ApiClient` and `FieldStore` through the constructor.
3. The widget keeps only `TextEditingController`s, focus nodes and `ListenableBuilder` around the controller.
4. Split each `build()` into small `StatelessWidget`s in the same folder (header, list, footer, dialogs).
5. Unit-test the controllers directly with the existing fake `ApiClient` subclasses.
**Done when.** No file in `mobile/lib` exceeds 500 lines and each controller has unit tests that do not pump a widget.

### Fix 2. Replace `Map<String, dynamic>` with typed models
**Problem.** Every server response and every stored record is a raw map: 190 `Map<String, dynamic>` uses and 110 inline casts such as `result['token'] as String`. A renamed or null field on the server becomes a runtime `TypeError` on a collector's phone, and the compiler cannot help.
**Evidence.** `grep -rho "Map<String, dynamic>" mobile/lib | wc -l`; `grep -rho "fromJson" mobile/lib | wc -l` returns 0.
**Steps.**
1. Create `mobile/lib/models/` with immutable classes and `factory X.fromJson(Map<String, dynamic>)` plus `toJson()`: `SessionUser`, `Subscriber`, `ReadingAssignment`, `QueuedReading`, `CollectionReceipt`, `CashBox`, `CashBoxEntry`, `LedgerLine`, `SubscriberMessage`.
2. Parse defensively in `fromJson` (accept `num` for amounts, tolerate missing optional keys) and throw one `FormatException` with the field name when a required key is missing.
3. Change `ApiClient` methods to return models; change `FieldStore` getters to return models while keeping the JSON file format unchanged.
4. Convert screen by screen, starting with `payment_page.dart` and `cash_boxes_page.dart` (money first).
**Done when.** `Map<String, dynamic>` appears only inside `models/`, `api_client.dart` and `field_store.dart`.

### Fix 3. Persist an in-flight payment so a killed app cannot lose the operation id
**Problem.** The payment submission (with its `mobile_operation_id`) lives only in the page's memory. If Android kills the app or the collector leaves the screen after an uncertain result, the id is gone; recording the payment again creates a new id and the server cannot tell it is the same payment.
**Evidence.** `mobile/lib/payment_page.dart` lines 262-310: `submission ??= {...}` is a field of `_PaymentPageState`; nothing writes it to `FieldStore`.
**Steps.**
1. Add `pending_collections` to `FieldStore`: save the submission before calling `sendCollection`, remove it on success or on a 4xx answer.
2. On app start and when the payments tab opens, show any pending submission ("unconfirmed payment of X for subscriber Y") with two actions: retry (same id) or discard after the collector checks today's payments.
3. Do the same for `split_payment_page.dart` and `adjustment_page.dart`.
4. Add a test: submit with a fake API that times out, recreate the widget tree from the store, retry, and assert the same `mobile_operation_id` is sent.
**Done when.** The new test passes and no money submission exists only in widget state.

### Fix 4. Turn on the standard lints
**Problem.** `analysis_options.yaml` raises only two rules to errors and does not include `flutter_lints`, so `flutter analyze` in CI misses the usual checks (unawaited futures, missing `const`, `use_build_context_synchronously`, braces on control flow).
**Evidence.** `mobile/analysis_options.yaml` has no `include:`; `pubspec.yaml` has no `flutter_lints`. `api_client.dart` contains an `if` without braces.
**Steps.**
1. Add `flutter_lints` to `dev_dependencies` and `include: package:flutter_lints/flutter.yaml` to `analysis_options.yaml`.
2. Enable in addition: `unawaited_futures`, `use_build_context_synchronously`, `curly_braces_in_flow_control_structures`, `prefer_final_locals`, `avoid_dynamic_calls`.
3. Run `dart fix --apply`, then fix the rest by hand.
**Done when.** `flutter analyze` is clean with the stricter set and CI keeps it so.

### Fix 5. Protect the subscriber roster stored on the phone
**Problem.** `field_state.json` holds the collector's subscriber list (names, phones, balances), the signed-in user and queued readings as plain JSON in the app's private files directory. The token is encrypted, the personal data is not. On a rooted or forensically imaged phone it is readable.
**Evidence.** `mobile/lib/field_store.dart`: `state['subscribers']`, `state['user']`, `state['queued_readings']` are written with `writeAsString(snapshot)`.
**Steps.**
1. Extend `SessionTokenStorage.kt` (or add a sibling class) with `encrypt(bytes)` / `decrypt(bytes)` using the same Keystore key type, exposed on the existing `powercollect.session` channel.
2. In `FieldStore.save()` encrypt the JSON before the atomic write; in `load()` decrypt, and migrate an existing plaintext file once.
3. Clear the roster on logout and when the token expires (queued readings must stay; they are the collector's unsent work).
**Done when.** `field_state.json` is not readable as text and the migration test passes.

### Fix 6. Organise `lib/` into folders
**Problem.** 34 files sit flat in `mobile/lib`: design system, pages, storage, API and helpers side by side, with `app_*` prefixes doing the job of folders.
**Steps.**
1. Create `core/` (`api_client.dart`, `field_store.dart`, `search_text.dart`), `models/` (Fix 2), `design/` (the `app_*` files), and one folder per feature: `readings/`, `collection/`, `cash_boxes/`, `messages/`, `auth/`.
2. Move files with the IDE's refactor so imports update; keep `main.dart` at the root.
3. Mirror the folders under `mobile/test`.
**Done when.** `ls mobile/lib` shows only `main.dart` and folders.

### Fix 7. Move Arabic strings to ARB files
**Problem.** 31 of the 34 Dart files contain Arabic literals. `flutter_localizations` is already a dependency but there is no `lib/l10n`, so wording changes are code changes, the same phrase is typed in several screens, and a second language is impossible.
**Evidence.** `grep -rl $'[\xd8-\xd9]' mobile/lib | wc -l` returns 31.
**Steps.**
1. Add `generate: true` under `flutter:` in `pubspec.yaml`, an `l10n.yaml`, and `lib/l10n/app_ar.arb`.
2. Move strings screen by screen and use `AppLocalizations.of(context)`; keep `ApiException` messages as keys resolved in the UI layer.
3. Keep tests on keys or on semantic finders rather than on Arabic sentences.
**Done when.** Only the ARB file and tests contain Arabic.

### Fix 8. Accessibility labels
**Problem.** Only 9 `Semantics`, `semanticLabel` or `tooltip:` uses across 61 widgets. The custom keypad (`app_keypad.dart`), icon-only buttons and custom-painted icons (`app_icons.dart`) are invisible to TalkBack.
**Steps.**
1. Give every icon-only button a `tooltip` (it doubles as the semantic label).
2. Wrap custom-painted controls in `Semantics(label: …, button: true)`; label each keypad key with its digit.
3. Add one widget test per main screen using `tester.ensureSemantics()` and `expect(tester, meetsGuideline(labeledTapTargetGuideline))` and `androidTapTargetGuideline`.
**Done when.** The guideline tests pass on login, readings, payment and cash boxes.

### Fix 9. A typed contract with the server
**Problem.** `/api/mobile/*` is unversioned and its shapes are hand-copied between ten PHP controllers and `api_client.dart`. The only safety net is the minimum build number.
**Steps.**
1. Do backend Fix 10 (`BACKEND_REVIEW.md`): API Resources, `/api/mobile/v1`, an OpenAPI file.
2. In the app, point `api_client.dart` at `/api/mobile/v1` in the release that raises `appBuildNumber`.
3. Add a contract test in `mobile/test` that parses fixture JSON files (saved from the PHP feature tests) with the models from Fix 2.
**Done when.** A field renamed on the server fails a test on both sides before release.

### Fix 10. Crash and sync visibility
**Problem.** No crash reporting and no `print`/`debugPrint` anywhere: when a collector reports "the app closed" or "my reading did not upload", there is nothing to look at. 11 `catch (_)` blocks swallow errors.
**Steps.**
1. Set `FlutterError.onError` and `PlatformDispatcher.instance.onError` in `main.dart` to append to a small rotating log file in the app directory (timestamp, error, stack, build number; never tokens or subscriber data).
2. Add a hidden "send diagnostics" action in the profile screen that posts the log to a new authenticated endpoint, or add Sentry if a third-party service is acceptable.
3. Replace each `catch (_)` with a logged catch.
**Done when.** A forced exception in a debug build appears in the log and can be sent.

### Fix 11. Build the release APK in CI and fix the code namespace
**Problem.** CI analyses and tests but never builds, so a broken Gradle or R8 configuration is found only at release time. The Kotlin namespace is still the template's `com.example.power_collect` while the application id is `com.abuzayed.powercollect`.
**Evidence.** `.github/workflows/tests.yml` mobile job has no `flutter build`; `mobile/android/app/build.gradle.kts` line 21.
**Steps.**
1. Add a CI step `flutter build apk --debug --dart-define=API_BASE_URL=https://example.invalid` (debug needs no keystore) and upload the APK as an artifact.
2. Rename the namespace and the Kotlin package folder to `com.abuzayed.powercollect` and update the method-channel class references.
3. Confirm `isMinifyEnabled` and `isShrinkResources` are set explicitly for `release` and that `proguard-rules.pro` keeps the ML Kit classes; install the release APK on a real device once per release.
**Done when.** Every push produces an installable APK artifact.

### Fix 12. Do not trust the phone's clock for business rules
**Problem.** `DateTime.now()` is used 15 times, including for `captured_at` on readings. The server already holds readings taken on an "untrusted clock" for review, but the app does not tell the reader before they work a whole route with a wrong date.
**Steps.**
1. Store the offset between the server's `Date` header and the device clock on each successful response in `ApiClient`.
2. If the offset exceeds a few minutes, show a banner on the reading screen and send the offset with each reading.
3. Use one `now()` helper (device time plus offset) instead of scattered `DateTime.now()` calls.
**Done when.** Setting the emulator clock a day ahead shows the banner.

### Fix 13. Smaller items
- **One sync timer for everything.** `field_shell.dart` polls every 30 seconds regardless of connectivity or app state; pause it in `didChangeAppLifecycleState` when the app is backgrounded and back off after failures.
- **Dispose audit.** 23 controllers and focus nodes are created against 15 `dispose()` methods; check each `State` class disposes what it creates.
- **Number formatting.** `toStringAsFixed` is used in 8 places; route all amounts through `app_balance.dart`.
- **iOS.** There is no `ios/` folder. If iPhones are ever needed, `SessionTokenStorage` and `ReceiptImageCapture` need Swift equivalents (Keychain, VisionKit); plan for it before promising it.

---

## Part 3. Suggested order of work

| Step | Work | Why |
| --- | --- | --- |
| 1 | Fix 4 (lints), Fix 11 (CI build, namespace) | Mechanical, and they catch mistakes in everything that follows. |
| 2 | Fix 3 (persist in-flight payments) | The only item that protects money; small and testable. |
| 3 | Fix 2 (models) then Fix 1 (controllers), one screen at a time, payment first | The largest maintainability gain. |
| 4 | Fix 6 (folders) | Easy once files are smaller. |
| 5 | Fix 5 (encrypt roster), Fix 10 (diagnostics), Fix 12 (clock) | Field reliability and privacy. |
| 6 | Fix 9 (contract), Fix 7 (ARB), Fix 8 (accessibility) | Convert as you touch each screen. |

## Part 4. Commands to measure progress

```bash
cd mobile

# largest files
wc -l lib/*.dart lib/**/*.dart 2>/dev/null | sort -n | tail -10

# untyped maps and casts
grep -rho "Map<String, dynamic>" lib | wc -l
grep -rhoE "\] as (String|int|num|bool|List|Map)" lib | wc -l

# setState calls (should fall as controllers take over)
grep -rho "setState(" lib | wc -l

# Arabic literals left in code
grep -rl $'[\xd8-\xd9]' lib | wc -l

# swallowed errors
grep -rhoE "catch \(_\)" lib | wc -l

# checks
flutter analyze
flutter test
```
