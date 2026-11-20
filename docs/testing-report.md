# تقرير الاختبار — PowerCollect

يُملأ خطوة بخطوة وفق `docs/testing-plan.md`. كل جلسة تبدأ من هذا الجدول.

## حالة التنفيذ

| # | الخطوة | الحالة | التاريخ | ملاحظة |
|---|---|---|---|---|
| 0 | تجهيز البيئة | انتهت | 2026-11-20 | كل الطبقات قابلة للتشغيل |
| 1 | خط الأساس | انتهت | 2026-11-20 | كل الطبقات ناجحة |
| 2 | جرد الثغرات | قيد التنفيذ — الدفعة أ انتهت، ب بانتظار الإذن | 2026-11-20 | أ: المصادقة، الصلاحيات، عزل الفروع |
| 3 | التقرير الأول وقرار المالك | لم تبدأ | | |
| 4 | كتابة الاختبارات الناقصة | لم تبدأ | | |
| 5 | إعادة التشغيل الكامل | لم تبدأ | | |
| 6 | الفحص البصري | لم تبدأ | | |
| 7 | التثبيت الدائم | لم تبدأ | | |
| 8 | التسليم | لم تبدأ | | |

## الخطوة 0 — تجهيز البيئة

| البند | النتيجة |
|---|---|
| `composer install` | نجح (Laravel 13.33.0). الأرشيفات الجاهزة تعذّر تنزيلها فجُلبت الحزم من المصدر؛ يستغرق نحو 10 دقائق |
| `.env` ومفتاح التطبيق | أُنشئا |
| `npm ci` | نجح |
| `npm run build` | نجح، مع تحذير أن بعض الحزم أكبر من 500 كيلوبايت |
| Flutter 3.47.5 و`flutter pub get` | نجحا |
| MySQL 8.4.13 | يعمل في حاوية Docker. Docker Hub رفض التنزيل (429)، فسُحبت الصورة من `mirror.gcr.io/library/mysql:8.4` |
| المتصفح | Playwright 1.64.1 المحلي لا يجد متصفحه؛ يعمل مع `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium` |
| مهارة `unslop` | ثُبّتت على مستوى المشروع؛ أُضيف سطران إلى `.claude/settings.json` والخطافات لم تتغير |

البيئة لا تبقى بين الجلسات؛ تُجهَّز من جديد في كل جلسة.

تنبيه: الفحص الآلي للمشروع (خطاف الإيقاف) عمل مرة قبل تثبيت `node_modules` وسجّل 22 فشلًا من 334 في `npm test`. بعد التثبيت أُعيد `npm test`: 431 من 431 ناجحة. الفشل كان من غياب الاعتماديات لا من الكود.

## الخطوة 1 — خط الأساس

شُغّل كل شيء كما هو، دون أي تغيير في الكود أو الاختبارات.

| الطبقة | الأمر | النتيجة | العدد |
|---|---|---|---|
| أسلوب PHP | `vendor/bin/pint --test` | ناجح | — |
| إعداد Composer | `composer validate` | ناجح | — |
| ESLint | `npm run lint` | ناجح | 0 تحذيرات |
| الأنواع | `npm run typecheck` | ناجح | — |
| الباك إند (SQLite) | `php artisan test` (عبر `npm run check`) | ناجح | 2294 / 2294 اختبار، 203041 تأكيد |
| منطق الواجهة | `npm test` | ناجح | 431 / 431 |
| المكوّنات | `npm run test:components` | ناجح | 39 / 39 في 12 ملف |
| البناء | `npm run build` | ناجح | تحذير: حزم أكبر من 500 كيلوبايت |
| المال والتقارير (MySQL 8.4) | `phpunit --filter` نفس تعبير CI | ناجح بعد تصحيح البيئة | 352 / 352 |
| Flutter: التحليل | `flutter analyze` | ناجح | لا مشكلات |
| Flutter: الاختبارات | `flutter test` | ناجح | 202 / 202 |
| المتصفح | `node tests/Browser/run.mjs` بالرايات التسع | ناجح | 9 / 9 مجموعات |

**مجموعات المتصفح**

| المجموعة | الزمن | النتيجة |
|---|---|---|
| الافتراضية (رحلة الشركة كاملة) | 157 ث | 20 / 20 خطوة |
| `--reports` | 29 ث | ناجح |
| `--print` | 15 ث | ناجح |
| `--distribution` | 35 ث | ناجح |
| `--readings` | 48 ث | ناجح |
| `--branches` | 27 ث | ناجح |
| `--meter-boxes` | 73 ث | ناجح |
| `--subscriber-navigation` | 18 ث | ناجح |
| `--statement-actions` | 12 ث | ناجح |

**ملاحظات**
- **MySQL**: التشغيل الأول نجح فيه 343 من 352. الفاشلة التسعة كلها في `BackupCommandTest`، لأن أمر النسخ الاحتياطي يستدعي `mysqldump` ولم يكن مثبتًا في الحاوية. بعد تثبيت `mysql-client` نجحت الثلاثة عشر في ذلك الملف. خلل في البيئة لا في الكود. أُضيف `mysql-client` إلى الخطوة 0 في الخطة.
- **عدد اختبارات PHP** الفعلي 2294، أكبر من تقدير التخطيط (نحو 1807) لأن مزوّدي البيانات (`TestWith`) يضاعفون الحالات.
- رسالة 403 في سجل المجموعة الافتراضية متوقعة: الخطوة 20 تختبر منع الموظفين من عمل غيرهم.
- سجل الفحص الآلي للمشروع (`npm run check`) صار ناجحًا: 6 / 6 (`storage/logs/automation/latest.json`).
- **خلاصة**: لا يوجد اختبار فاشل في المشروع. كل ما سيأتي في الخطوة 2 هو بحث عن **ما ليس له اختبار**، لا إصلاح لما يفشل.

## الخطوة 2 — جرد الثغرات

الجرد بالقراءة فقط: لم يُكتب اختبار ولم يُعدَّل كود. الخطوة مقسمة إلى أربع دفعات:

| الدفعة | الجوانب | الحالة |
|---|---|---|
| أ | 1–3: المصادقة، الصلاحيات، عزل الفروع | انتهت |
| ب | 4–7، 13–14، 18–20: المال، القراءات، التقارير، الرسائل، قاعدة البيانات، التزامن، النسخ الاحتياطي، المجدول، سجل التدقيق | بانتظار الإذن |
| ج | 8–10، 21–22: الواجهة سلوكًا وتصميمًا، الرحلات، سهولة الوصول، النصوص | لم تبدأ |
| د | 11–12، 15–17، 23–24: الموبايل، جودة الكود والأمان، الأداء، المدخلات، الأخطاء، الاعتماديات، النشر | لم تبدأ |

### الدفعة أ — المصادقة، الصلاحيات، عزل الفروع

**المسارات**: 276 (`php artisan route:list --except-vendor`). كلها خلف المصادقة إلا 8 عامة بطبيعتها: `/`، الدخول (GET و POST)، شعار الموبايل ودخوله بنسختيهما، وصفحة الخطأ.

| المجموعة | العدد | مغطاة بالكامل | بلا اختبار «ممنوع» (403) | بلا اختبار «فرع آخر» | بلا اختبار «مسموح» | بلا فحص صلاحية |
|---|---|---|---|---|---|---|
| الويب | 216 | 120 | 68 | 33 | 23 | 14 (13 مقصودة) |
| الموبايل (بعد دمج النسختين) | 28 | 20 | 4 | 3 | 2 | 3 |

«مغطى بالكامل» = يوجد فحص صلاحية، واختبار ينجح فيه المسموح، واختبار يُمنع فيه غير المسموح، واختبار من فرع آخر (أو لا ينطبق).

#### النتائج مرتبة بالخطورة

| # | الخطورة | النتيجة | الموضع |
|---|---|---|---|
| 1 | **عالية — قرار المالك** | **قوالب الرسائل**: أي موظف يملك صلاحية «إرسال الرسائل» في أي فرع يستطيع تعديل كل قوالب الشركة أو حذفها. الجدول بلا عمود فرع، والمسارات `message-templates.*` غير موجودة في قائمة البيانات المشتركة التي تُمنع من مواقع الفروع. المسارات الثلاثة بلا أي اختبار. | `app/Policies/MessageTemplatePolicy.php:34-45`، `app/Http/Middleware/EnsureBranchDomainAccess.php:50` |
| 2 | عالية | **لا اختبار شامل للمصادقة**: مسار جديد يُضاف خارج مجموعة `auth` أو `mobile.auth` لن يكشفه أي اختبار. أقرب اختبار يستعمل قائمة يدوية من 25 صفحة. | `routes/web.php:87`، `routes/api.php:27` |
| 3 | عالية | **الحماية من التخمين شبه غير مختبرة**: 429 في دخول الموبايل، حدث `Lockout` ورسالته، تصفير العدّاد بعد الدخول الناجح، ومفتاح «اسم المستخدم + IP». المختبَر فقط أن المحاولة السادسة تُرفض. | `MobileSessionController.php:24`، `LoginRequest.php:92,106` |
| 4 | متوسطة | **حماية التحويل إلى موقع آخر بعد الدخول** موجودة لكن بلا اختبار؛ حذفها لن يُلاحظ. | `AuthenticatedSessionController.php:31-34` |
| 5 | متوسطة | **الجلسة**: تجديد معرّف الجلسة عند الدخول، وإبطالها وتجديد رمز CSRF عند الخروج، غير مُتحقق منها. CSRF معطّل تلقائيًا في الاختبارات ولا اختبار لـ419؛ مجموعات المتصفح وحدها تمرّ بالنموذج الحقيقي. | `LoginRequest.php:77`، `AuthenticatedSessionController.php:47-49` |
| 6 | متوسطة | **حذف السجلات الأساسية** (مناطق، فروع، قواطع، محافظات، مناطق فرعية، تعرفات، شرائح، صناديق عدادات): الفحص موجود لكن لا اختبار 403 لأيٍّ منها. | `app/Support/RecordDeletion.php:26` |
| 7 | متوسطة | **القراءات وقطع الخدمة**: أغلب 16 مسار قراءات/دورات و8 مسارات قطع خدمة بلا اختبار 403 أو فرع آخر. `reading-cycles.submissions.index` و`disconnection-lists.candidates` بلا أي اختبار. | انظر الملحق |
| 8 | متوسطة | **الموبايل**: ردّ ملاحظة التدقيق بلا فحص صلاحية وبلا أي اختبار؛ يبدو مقصودًا لأنه يقبل فقط ملاحظة مسندة للمستخدم في فرعه، ونظيره في الويب مختبَر. `diagnostics` و`cash-boxes/sync` بلا صلاحية (حدّ 6 في الدقيقة، وحفظ خاص بالمستخدم). ثلاثة فحوص 403 لم تُختبر قط. | `MobileCashBoxController.php:64,76`، `MobileCollectionController.php:107`، `CheckMobileReferenceRequest.php:16`، `SyncMobileReadingsRequest.php:17` |
| 9 | منخفضة | **مدخلات سلبية بلا اختبار**: اسم مستخدم غير موجود، حقول دخول فارغة، رمز موبايل عشوائي، ومستخدم مسجّل يفتح `/login`. | `routes/auth.php` |
| 10 | منخفضة | **مفاتيح `can.*`**: 21 من 34 مفتاحًا تُرسل للواجهة بلا تأكيد في الاختبارات (منها `viewUsers`، `viewBranches`، `viewMeterBoxes`). | `HandleInertiaRequests.php:90-133` |
| 11 | منخفضة | **`excel-templates.index`**: أي مستخدم مسجّل يقرأ كل قوالب Excel للشركة، بينما قوالب الطباعة تتطلب صلاحية. قراءة فقط، لكن غير متسق. | `ExcelTemplateController.php:20` |
| 12 | منخفضة | **الموبايل بنسختين**: 23 مسارًا مختبرة بالنسخة غير المرقّمة فقط، و`brand` و`diagnostics` بالمرقّمة فقط. اختبار التطابق يقارن الوسطاء لا السلوك. | `MobileApiTest.php:274` |
| 13 | ملاحظة | فحوص إجراءات الحركات المالية تُرجع 422 (خطأ تحقق) بدل 403 حين تُرفض الصلاحية. تعمل ومختبرة. | `app/Support/Ledger/TransactionActions.php:38,63,214` |
| 14 | ملاحظة | `BranchClosingActionRequest` يفحص `is_active` فقط والفحص الحقيقي في المتحكم؛ سليم ومختبر. فحص الفرع في تدقيق التحويلات البنكية (404) لا يُبلغ في أي اختبار. | `BranchClosingActionRequest.php:15`، `BankTransferAuditing.php:45` |

#### المسارات الـ14 بلا فحص صلاحية

13 مقصودة: `auth.session`، `branch-access.index`، `dashboard` (كل قسم فيه محمي داخليًا)، `logout`، `notifications.read`، `payments.entries` (تحويل فقط)، `profile.edit`، `profile.update`، `profile.devices.destroy` (حساب المستخدم نفسه)، `settings.banks.index` و`settings.currencies.index` (تحويلات)، `settings.mobile-app.index` و`.download` (كل الموظفين، وموثّق باختبار). الرابع عشر `excel-templates.index` (البند 11).

#### سلوكيات المصادقة

| السلوك | مختبر؟ |
|---|---|
| دخول صحيح، كلمة مرور خاطئة، حساب موقوف (بالنص)، إيقاف أثناء الجلسة، الخروج | نعم |
| «تذكّرني» وحدّ الأجهزة على الويب، تغيير كلمة المرور (وقاعدة المدير وحده، وكلمة خاطئة، وخروج الأجهزة الأخرى) | نعم |
| مستخدم غير موجود، حقول فارغة | لا |
| القفل: الرسالة، الحدث، تصفير العدّاد، المفتاح | جزئي (المحاولة السادسة تُرفض فقط) |
| حذف التحويل إلى نطاق آخر، والإبقاء على نفس النطاق | لا |
| تجديد معرّف الجلسة، إبطال الجلسة عند الخروج، CSRF/419 | لا |
| مستخدم مسجّل يفتح `/login` | لا |
| مسارات استعادة كلمة المرور | غير موجودة في المشروع (لا شيء لاختباره) |
| موبايل: دخول، كلمة خاطئة 422، موقوف 422، مدقق فقط 403، رمز مفقود/منتهٍ/ملغى 401، مستخدم موقوف برمز صالح 401، استبدال الجهاز، إصدار قديم 426، عمر الرمز 12 ساعة/30 يومًا | نعم |
| موبايل: 429 بعد 5 محاولات، رمز عشوائي | لا |

<details>
<summary>ملحق: مسارات الويب التي فيها ثغرة، بحسب المجال (96 مسارًا)</summary>

الرموز: **م** = بلا اختبار «ممنوع»، **ف** = بلا اختبار «فرع آخر»، **س** = بلا اختبار «مسموح».

- **الاشتراكات (11)**: `subscriptions.edit` م؛ `bulk-changes.index` م؛ `bulk-changes.undo` م؛ `payments.reference-status` م؛ `personal-details.update` م؛ `personal-details.history` م؛ `phone.update` م؛ `reading-baseline.preview` م ف؛ `standing-discount.update` ف؛ `transactions.update` م؛ `transactions.amend` ف.
- **المدفوعات والصناديق (4)**: `payments.audit-notes.reply` م ف؛ `payments.bank-audits.show` ف؛ `payments.entries` بلا فحص (تحويل)؛ `payments.money-flow` ف.
- **القراءات والدورات والأوراق (16)**: `meter-readings.adjustment-preview` م ف؛ `meter-readings.last-reading-preview` ف؛ `paper-sheets.index` س ف؛ `paper-sheets.show` ف؛ `paper-sheets.printed` م ف؛ `reading-cycles.index` ف؛ `reading-cycles.store` م ف؛ `reading-cycles.prepare` م؛ `reading-cycles.show` م؛ `reading-cycles.update` م ف؛ `reading-cycles.assignments.store` ف؛ `reading-cycles.assignments.approve` ف؛ `reading-cycles.copy-previous` م ف؛ `reading-cycles.paper-sheets.store` م ف؛ `reading-cycles.submissions.index` س م ف؛ `reading-submissions.review` م ف.
- **صناديق العدادات (5)**: `meter-boxes.store` م؛ `meter-boxes.create` م؛ `meter-boxes.update` م؛ `meter-boxes.destroy` م ف؛ `meter-boxes.edit` س م ف.
- **قطع الخدمة (8)**: `disconnection-lists.store` م؛ `.update` م ف؛ `.candidates` س م ف؛ `.items.store` م؛ `.items.preview` م ف؛ `.items.remove` م ف؛ `.items.reschedule` م ف؛ `.items.warn` ف.
- **الرسائل والقوالب (8)**: `messages.create` ف؛ `messages.quick` ف؛ `messages.show` م؛ `messages.sent` م؛ `messages.retry` م ف؛ `message-templates.store` س م؛ `message-templates.update` س م؛ `message-templates.destroy` س م.
- **النماذج والوثائق (8)**: `company-documents.show` م؛ `company-documents.source` م؛ `company-forms.subscriptions` م؛ `company-forms.create` س م؛ `company-forms.show` س م؛ `company-forms.update` م؛ `company-forms.destroy` م؛ `company-forms.source` م.
- **الأماكن والتعرفات (19)**: `areas.update` م؛ `areas.destroy` م؛ `areas.edit` س م؛ `branches.update` م؛ `branches.destroy` س م؛ `branches.edit` س م؛ `circuit-breakers.create` س م؛ `circuit-breakers.destroy` س م؛ `circuit-breakers.edit` س م؛ `governorates.update` م؛ `governorates.destroy` م؛ `governorates.edit` س م؛ `sub-areas.update` م؛ `sub-areas.destroy` س م ف؛ `sub-areas.edit` م؛ `tariffs.create` س م؛ `tariffs.destroy` م؛ `tariffs.edit` س م؛ `tariff-segments.destroy` م.
- **المستخدمون (1)**: `users.destroy` ف.
- **الإعدادات والقوالب (8)**: `print-templates.update` م؛ `print-templates.duplicate` م؛ `settings.appearance.import` م؛ و5 بلا فحص صلاحية مقصودة أو منخفضة الخطورة (`settings.banks.index`، `settings.currencies.index`، `settings.mobile-app.index`، `settings.mobile-app.download`، `excel-templates.index`).
- **الجلسة والحساب (8)**: بلا فحص صلاحية بطبيعتها (حساب المستخدم نفسه)، وكلها مختبرة في حالة «مسموح».

**الموبايل (8 مسارات بها ثغرة)**: `diagnostics` بلا فحص؛ `cash-boxes/sync` بلا فحص (خاص بالمستخدم)؛ `audit-notes/{note}/reply` بلا فحص وبلا أي اختبار؛ `cash-boxes/{action}/{record}` س ف (الإجراء الوحيد المسموح `confirm` لا ينجح في أي اختبار)؛ `collections` م؛ `collections/reference-status` م؛ `reading-assignments/sync` م ف؛ `reading-assignments` ف.

</details>

#### الاختبارات المقترحة لهذه الدفعة

تُكتب في الخطوة 4 فقط، بعد قرار المالك:

1. اختبار اصطلاحي يمرّ على كل المسارات: الزائر يُحوَّل للدخول (ويب) أو يأخذ 401 (موبايل)، مع قائمة صريحة بالمسارات العامة الثمانية.
2. اختبارات التخمين (ويب وموبايل)، الجلسة، والتحويل إلى نطاق آخر، والمدخلات السلبية.
3. اختبار 403 بمزوّد بيانات لكل مسار ويب بلا اختبار «ممنوع».
4. اختبارات «فرع آخر» للمسارات الـ33.
5. اختبارات قوالب الرسائل، بحسب قرار المالك في البند 1.
6. اختبارات الموبايل: ردّ ملاحظة التدقيق، فحوص 403 الثلاثة، ومفاتيح `can.*` الناقصة.

## ما عُرف قبل البدء (من قراءة المستودع، لم يُتحقق بالتشغيل بعد)

هذه ملاحظات من قراءة الكود أثناء التخطيط. تُؤكَّد أو تُنفى في الخطوتين 1 و2.

**التشغيل**
- `.github/workflows/tests.yml` يراقب الدفع إلى `master` وفرع قديم؛ فروع المستودع `main` و`claude/*`، فالدفع إلى `main` لا يشغّل الاختبارات.
- مجموعات المتصفح التسع لا تعمل في CI. `npm run check:release` يشغّل أربعًا منها فقط.
- `npm run check` لا يشغّل `lint` ولا `typecheck` ولا اختبارات المكوّنات ولا `pint`.

**الصلاحيات**
- لا `can:` في ملفات المسارات؛ كل فحص الصلاحية داخل المتحكمات وForm Requests، ولا اختبار يمرّ على كل المسارات ليثبت أن كلًّا منها محمي.
- مسارات بلا فحص صلاحية بعد المصادقة: `ExcelTemplateController@index` (`routes/web.php:196`)، `MobileCashBoxController@sync` و`@reply` (`routes/api.php:49,51`)، `MobileDiagnosticsController` (`routes/api.php:30`). يُحدَّد لكلٍّ: مقصود أم ثغرة.
- 21 من 34 مفتاح `can.*` في `HandleInertiaRequests` بلا تأكيد في الاختبارات.
- بلا أي اختبار: `MessageTemplateController`، و`company-forms.create/show`، `disconnection-lists.candidates`، `reading-cycles.submissions.index`، `audit-notes.reply` (موبايل).

**المصادقة** — بلا اختبار: رسالة القفل وحدث `Lockout` وتصفير العدّاد بعد النجاح، 429 في دخول الموبايل، حذف `url.intended` لنطاق آخر، نص `auth.inactive`، «تذكّرني» على الويب، رمز موبايل غير صالح.

**الواجهة**
- 15 مجلد صفحات بلا اختبار: Areas، Auth، BranchPerformance، Branches، CircuitBreakers، Disconnections، Governorates، Ledger، Print، Profile، Receivables، Reports، SubAreas، Tariffs، TransactionAudit.
- `DataTable` وعُدّة `UI` و`Layouts` و`hooks` بلا اختبار.
- لا مجموعة متصفح تختبر الزائر غير المسجَّل.
- سلّم المسافات: نحو 560 موضعًا بدرجات بينية (`1.5`: 228، `5`: 187، `2.5`: 79، `7`: 44، `3.5`: 23).

**الموبايل** — اختبار العقد يفحص مسارات `mobile.v1.*` بينما التطبيق يستعمل `/api/mobile/...`؛ ثلاثة موارد فقط مفحوصة البنية.
