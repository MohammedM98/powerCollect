# توحيد النماذج والنوافذ مع ثيم MA — ملف التعديلات والتعليمات

ملف واحد يجمع: كل ما عُدّل، المشاكل المفتوحة مع تعليمات إصلاحها خطوة بخطوة، وما بقي من الخطة.
الفرع: `claude/admiring-heisenberg-q7ruxl`. قواعد التصميم المعتمدة في `CLAUDE.md` (قسم PowerCollect design system).

**قيد ثابت من المالك:** نوافذ المال (الدفع، الرسوم، الخصم، المقاصة، التقسيم) وكشف الحساب ممتازة ولا تُعدَّل.

## الفهرس
1. [المشاكل المفتوحة وتعليمات إصلاحها](#1-المشاكل-المفتوحة-وتعليمات-إصلاحها)
2. [كل التعديلات التي أُنجزت](#2-كل-التعديلات-التي-أنجزت)
3. [كيف تبني نموذجًا جديدًا أو تعدّل نموذجًا](#3-كيف-تبني-نموذجًا-جديدًا-أو-تعدّل-نموذجًا)
4. [ما بقي من الخطة](#4-ما-بقي-من-الخطة)
5. [تشغيل الموقع والفحوص](#5-تشغيل-الموقع-والفحوص)

---

## 1. المشاكل المفتوحة وتعليمات إصلاحها

### 1.4 و1.5 (أُغلقا بقرار المالك)

- **1.4:** حقول صفحات النماذج بيضاء (`--ma-solid`) فوق البطاقة؛ حقول النوافذ تبقى بلون البلاطة. القاعدة في آخر `ma-forms.css` (`.ma-form-page …`). الفرق في الوضع الفاتح الزجاجي صغير لأن البطاقة نفسها شبه بيضاء.
- **1.5:** يبقى الترتيب الجديد لقسم «معلومات الاشتراك» (المفتاح، الرسوم، القراءة السابقة، التاريخ).

### 1.6 ما بقي خارج الكِت عمدًا

- **نوافذ المال وكشف الحساب** وما تشاركه معها لم يُمَس: `Components/Finance/Banks.jsx`، `Components/UI/AsyncState.jsx`، `Subscriptions/{PaymentModalParts,DiscountKindStep,AmendTransactionModal,DeleteTransactionModal,ForceDeleteTransactionModal,AccountSummary,ReadingPricingField}.jsx`، `Payments/{SplitTransferDetails,EditSplitPaymentModal,SplitRecipientsSection}.jsx`. فيها آخر الصناديق اليدوية.
- **أجزاء الجداول المشتركة** رُحّلت بقرار المالك إلى رموز `--ma-*` (`DataTable/{DataTableToolbar,DensityToggle,DataTableFilterMenu}.jsx`، `Layout/NavigationMenu.jsx`، `Excel/ExcelStudio.jsx`، `UI/SearchableSelect.jsx`)، مع مقارنة قبل/بعد لكشف الحساب والجداول دون فرق ظاهر. بقي في `SearchableSelect` شكله فوق الخلفيات الداكنة (`bg-white/10` وما شابه) فلم يُدرج في قاعدة ESLint، و`ExcelStudio` نافذة بملء الشاشة على `Modal` الخام. نافذة Excel لم تُعاين بالعين بعد الترحيل.
- نافذتان بملء الشاشة بقيتا على بنيتهما (ألوانهما رموز): `Subscriptions/ReadingHistoryModal.jsx` و`Payments/BoxDetails.jsx`.
- حقول `file` / `color` / `range` الخام في `Settings/Appearance.jsx`، `CompanyForms/Editor.jsx`، `Print/PrintSettingsPanel.jsx`: لا جزء لها في الكِت.
- بطاقة رأس الملف الشخصي واختيار الثيم فيه بقيا بأنماط `pp-*` (البطاقة داكنة في الوضعين).
- نحو 15 ملفًا تستورد `TextArea` من HeroUI مباشرة (منها نوافذ المال)؛ الجديد يستخدم `TextArea` من الكِت.

### 1.7 تغييرات سلوك تحتاج نظرة المالك

- نوافذ التوزيع صارت بالعرض القياسي 820px بدل 880px (عُدّل الفحص في `tests/Browser/reading-distribution.cjs`).
- إدخال القراءة: «اعتماد القراءة المصحّحة الآن» مفتاح بدل خانة اختيار، وحقلا القراءة بشكل الحقل الموحّد.
- إغلاق الصناديق: صف الخطوات يتحرك مع المحتوى، وعلى الهاتف يعرض الأرقام فقط.
- إعادة تسمية القالب لا تُغلق أثناء الحفظ. زر الإغلاق في النوافذ المرحّلة اسمه «إغلاق النافذة».
- شاشة المظهر تعرض «شعار الخلفيات الداكنة» الافتراضي؛ رفع شعار رئيسي خاص يزيله تلقائيًا.
- الملف الشخصي: اسم المستخدم `readOnly` (يمكن تحديده ونسخه)، والمسمى والفرع حقلان مغلقان، وعناوين الأقسام فوق البطاقات.
- شريط التحديد الجماعي صار سطحًا فاتحًا عائمًا بدل الشريط الداكن؛ «تأكيد القطع» مفتاح خطر.
- التأكيد بكتابة العدد في القطع واعتماد التدقيق: مفتاح خطر ناعم بدل الأحمر المصمت.
- تواريخ نافذة «يوم القراءة» بصيغة `19/11/2026`.

### 1.8 ملاحظة عن بيئة الفحص (ليست خطأ في الموقع)

نسخة Playwright في `node_modules` تطلب متصفحًا غير المثبّت في البيئة السحابية؛ اختبارات المتصفح تفشل ما لم يُضبط `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (انظر القسم 5). وخادم MCP «laravel-boost» لم يتصل. و`composer install` في البيئة السحابية ينزّل الحزم بالاستنساخ من git فيستغرق نحو 15 دقيقة؛ شغّله في الخلفية أولًا.

**فُحص ولم يكن مشكلة:** تجاوز العرض الأفقي في `/users/create` و`/profile` الذي بدا في لقطات الصفحة الكاملة — القياس عند 1440 و1280 و390 أظهر أنه لا يوجد تجاوز.

---

## 2. كل التعديلات التي أُنجزت

### 2.1 الأنماط

| الملف | التعديل |
|---|---|
| `resources/css/app/ma-forms.css` (جديد) | كل أنماط النماذج برموز `--ma-*`: الحقل المفتوح والمغلق، القوائم، وحدة الحقل، سطر العنوان، الشارة، التنبيه، عناوين الأقسام، بطاقات الصفحة، رصيف الحفظ، النموذج المضمّن، اختيار الملف |
| `resources/css/app.css` | استيراد `ma-forms.css` آخرًا |
| `resources/css/app/window-sheets.css` | حُذفت قواعد الحقول (انتقلت إلى `ma-forms.css`) |

**النطاق:** كل نافذة غير مالية، وكل نموذج يحمل الصنف `ma-form` (يضعه `FormModal` و`FormPage`؛ الصفحة تضيف `ma-form-page`). الاستثناء المحفوظ: `.gl-sheet[data-ledger-tone]`, `.gl-co`, `.account-statement`.

**حالات الحقل:**
- مفتوح: بلاطة `--ma-tile` بخط `--ma-line`، ارتفاع 48px (`--ma-field-h`)، زاوية 14px.
- أثناء الكتابة: `--ma-solid` بحلقة `--ma-brand`.
- خطأ: حلقة `--ma-owe`.
- مغلق (`disabled` أو `readOnly`): مخطّط (`--ma-hatch`)، حدّ متقطع (`--ma-dash`)، حبر `--ma-muted`، وقفل (`--ma-lock`).

### 2.2 الكِت (`@/Components/UI`)

| المكوّن | الملف | الوصف |
|---|---|---|
| `Notice` (جديد) | `UI/Notice.jsx` | تنبيه بنغمات `neutral / info / brand / success / warn / danger` |
| `FieldAction` (جديد) | `UI/FieldAction.jsx` | المفتاح الصغير في نهاية سطر عنوان الحقل («تعديل يدوي») |
| `Affix` | `UI/Affix.jsx` | صار مُصدَّرًا من الكِت؛ يمرّر خصائص الحقل ويعرض قفلًا بجانب الوحدة عند الإغلاق |
| `Switch` | `UI/Switch.jsx` | يقبل `id` |
| `FormField` | `Form/FormField.jsx` | خاصيتان جديدتان: `lock` (`'locked'` / `'open'` → شارة «مغلق/مفتوح») و`action` |
| `FormSelect` | `Form/FormSelect.jsx` | أُزيلت أصناف الألوان الخام |
| `FormModal` | `Form/FormModal.jsx` | يضع الصنف `ma-form` |
| `FormPage` | `Form/FormPage.jsx` | `ma-form ma-form-page`، ورصيف حفظ `ma-form-dock` مع «تغييرات غير محفوظة» |

### 2.3 النماذج

| النموذج | الملفات | التعديل |
|---|---|---|
| المشترك | `Subscriptions/SubscriptionForm.jsx`, `SubscriptionTariffSection.jsx`, `SubscriptionLocationSection.jsx` | ثلاثة أعمدة في كل الأقسام؛ حالات مغلق/مفتوح لرسوم الاشتراك، سعر الكيلو، الحد الأدنى، القراءة السابقة، المنطقة؛ المفتاح فوق حقل الرسوم؛ التنبيهات بـ`Notice` |
| الفرع | `Branches/BranchForm.jsx` | الاسم والهاتف في عمودين، أوصاف للأقسام |
| رابط الفرع | `Branches/DomainModal.jsx` | `SettingRow` + `Switch`، وملاحظة بـ`Notice` |
| المستخدم | `Users/UserForm.jsx` | «حساب نشط» و«إنهاء الجلسات» صفّا إعداد بمفتاح؛ أوصاف للأقسام؛ إزالة `h-11` |
| نوع المستخدم | `Users/UserTypeSelect.jsx` | نموذج الإضافة المضمّن بـ`ma-inline-add` ومفاتيح الكِت |
| القاطع | `CircuitBreakers/CircuitBreakerForm.jsx` | وحدتا «أمبير» و«₪» داخل الحقلين، وصف وتلميح |
| التعرفة | `Tariffs/TariffForm.jsx` | أعيد بناؤه بـ`FormSection` + `FormField` + `Affix` بدل `InsetList` |
| المنطقة / منطقة 2 / المحافظة | `Areas/AreaForm.jsx`, `SubAreas/SubAreaForm.jsx`, `Governorates/GovernorateForm.jsx` | أوصاف للأقسام ومسافات موحّدة |
| الطبلون | `MeterBoxes/MeterBoxForm.jsx`, `MeterBoxSubAreaSelect.jsx` | الاسم بعرض كامل ثم اللاحقة والرقم جنبًا إلى جنب؛ `Notice`؛ نموذج الإضافة المضمّن بمفاتيح الكِت |
| البنك أو المحفظة | `Settings/BanksSection.jsx` | ثلاثة صفوف إعداد بمفاتيح؛ اختيار الشعار بـ`ma-file-pick` |

### 2.4 الجولة الثانية (الشعار، الصلاحيات، النوافذ)

| البند | الملفات | التعديل |
|---|---|---|
| الشعار | `public/images/logo-ma-light.svg` (جديد)، `resources/brand/default.json`، `hooks/useBrand.js`، `Components/Auth/DrawnMark.jsx`، `BrandSettingController.php` | M أسود في الفاتح وأبيض في الداكن، A برتقالي ثابت. شاشة الدخول ما زالت ترسم الشعار المتحرك. شعار خاص مرفوع لا يرث النسخة الداكنة الافتراضية |
| قفل القائمة المغلقة | `ma-forms.css` | القائمة المعطّلة تعرض القفل مكان السهم |
| «فرع نشط» | `Branches/BranchForm.jsx` | الصف داخل بطاقة «الموقع» |
| تنظيف | `components/forms.css` | حُذفت قواعد `gl-inset*` |
| `Notice` | `UI/Notice.jsx`، `ma-forms.css` | العنوان بصنف `ma-notice-title` (سطر مستقل)؛ `<b>`/`<strong>` داخل النص يبقى في السطر |
| صفحة الصلاحيات | `Settings/PermissionGuide.jsx`، `PermissionReview.jsx`، `Permissions.jsx`، `PermissionDesign.css`، وبقية `Permission*.jsx` و`AuditAccessCard.jsx` | الدليل والشرح والمراجعة على `DialogFrame`؛ التنبيهات `Notice`؛ شريط «تغييرات لم تُحفظ» وإشعار «حُفظت» سطحان عائمان بمفاتيح الكِت؛ كل الألوان رموز `--ma-*` |
| نماذج 4.1 | `Subscriptions/PersonalDetailsModal.jsx`، `ArchiveSubscriptionModal.jsx`، `BulkChangeModal.jsx`، `MeterReadings/MeterReadingModal.jsx`، `Messages/Create.jsx`، `Profile/Edit.jsx` (نافذة الأجهزة) | `FormSection`/`FormField`/`Notice`/`SettingRow`؛ القراءة السابقة مغلقة بسببها؛ `BulkChangeModal` على `DialogFrame` |
| نوافذ 4.2 | `Disconnections/ActionModal.jsx`، `HistoryModal.jsx`، `Candidates.jsx`، `Messages/QuickMessageModal.jsx`، `QuickMessageFooter.jsx`، `SubscriptionMessageHistoryModal.jsx`، `CompanyForms/IssueModal.jsx`، `ReadingCycles/DistributionDialog.jsx`، `CycleParts.jsx`، `Payments/CloseBoxesByType.jsx`، `Settings/PrintTemplates.jsx`، `Subscriptions/BulkChanges.jsx` | كلها على `DialogFrame`؛ النماذج داخلها بـ`<form id>` ومفاتيح التذييل تشير إليها بـ`form=` |
| الحماية | `eslint.config.js` | القاعدة `local/ma-colours` ومنع استيراد `Modal` الخام على قائمة `MA_MIGRATED`؛ أضف كل ملف يُرحَّل إلى القائمة |

صفحات التعديل (Edit) تستخدم مكوّن النموذج نفسه الذي تستخدمه صفحات الإنشاء، وليس فيها ألوان خام.

### 2.5 الجولة الثالثة (ما بقي)

| البند | الملفات | التعديل |
|---|---|---|
| شريط التحديد | `UI/SelectionBar.jsx` (جديد: `SelectionBar`, `SelectionBarKey`)، `ma-forms.css` (`.ma-selection*`)، `Subscriptions/BulkActionBar.jsx`، `Disconnections/{Show,Candidates,ResultReport}.jsx` | جزء واحد في الكِت بسطح عائم ومفاتيح الكِت |
| الملف الشخصي | `Profile/Edit.jsx`، `Profile/Partials/*`، `Profile.css`، `UI/PasswordInput.jsx` | `FormSection` + `FormField` ومفاتيح الكِت؛ حُذفت قواعد `pp-field`/`pp-button`/`pp-dialog` |
| `TextArea` | `UI/TextArea.jsx` (جديد) | مستخدم في القطع، نموذج الشركة، القراءة، الأرشفة، الرسالة السريعة، «إضافة إلى القائمة» |
| `ChoiceChips` | `UI/ChoiceChips.jsx` | خاصية `showLabel` تُظهر العنوان فوق الخيارات (مفعّلة في «سبب القطع») |
| `HoldToConfirm` | `UI/HoldToConfirm.jsx` | رموز `--ma-*` |
| `SettingSwitch` | `Components/Settings/SettingsKit.jsx` | صار `SettingRow` + `Switch` |
| التنبيهات والألوان | 17 ملفًا في القراءات والتوزيع والرسائل والطبلونات والمحافظات والفروع، و13 ملفًا في الصناديق والتقارير والمظهر ونماذج الشركة والطباعة، وأجزاء الرسالة السريعة الأربعة | الصناديق اليدوية `Notice`، والألوان رموز |
| ملاحظات المعاينة | `Payments/CloseBoxesByType.jsx`، `ReadingCycles/CycleParts.jsx`، `Disconnections/HistoryModal.jsx` | خطوات الهاتف بالأرقام، صيغة التواريخ، حالة فارغة للسجل |
| الحماية | `eslint.config.js` | قائمة `MA_MIGRATED` تشمل كل ما سبق |

### 2.6 الفحوص والمعاينة

**نجحت:** `npm run lint`، `npm test` (433)، `npx vitest run` (81)، `php artisan test --compact` كاملة (2466 ناجحًا، 5 متخطّاة)، `vendor/bin/pint --dirty`، ومجموعات المتصفح الإحدى عشرة كلها: الأساسية، `--a11y`، `--access`، `--branches`، `--meter-boxes`، `--subscriber-navigation`، `--distribution`، `--print`، `--readings`، `--reports`، `--statement-actions`.

**عُوين بالعين (فاتح وداكن، مكتب وهاتف، زجاجي):** الشعار؛ صفحة الصلاحيات ونوافذها؛ كل النوافذ المرحّلة (البيانات الشخصية، القراءة، سجل الرسائل، الرسالة السريعة، التغيير الجماعي وتفاصيله، الأرشفة والاستعادة، الأجهزة، نوافذ القطع الخمس مع مفتاح الضغط المطوّل، إغلاق الصناديق، قوالب الطباعة، نماذج الشركة، يوم القراءة وملخّص التوزيع، سجل القراءات، رابط الفرع)؛ صفحات التعديل والإنشاء؛ الملف الشخصي؛ شريط التحديد في المشتركين وقوائم القطع والمرشحين؛ ومقارنة قبل/بعد لصفحات: الصناديق والحركات، ملخّص التحصيل، التقارير، توزيع القراءات والقراءات الميدانية، نماذج الشركة ومحرّرها، الفروع، المحافظات، الرسائل، القراءات الأسبوعية، الطبلونات، قوالب الطباعة، إعدادات الدفعات.

**رسائل الخطأ داخل النوافذ:** الأجهزة، إعادة التسمية، البيانات الشخصية.

**السطح المصمت:** النوافذ على المكتب، و16 نافذة وصفحة على الهاتف.

**لم يُعاين بالعين:** صفحة المظهر (الحساب التجريبي لا يملك صلاحيتها في بيئة المعاينة)، نافذة تفاصيل الصندوق، حوار اعتماد التدقيق، مصمّم الطباعة، حالات التحميل، وحالات لا تظهر إلا ببيانات خاصة (تنبيه الإدخال المغلق، قراءة غير اعتيادية، رسائل واتساب معلّقة).

---

## 3. كيف تبني نموذجًا جديدًا أو تعدّل نموذجًا

```jsx
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import SettingRow from '@/Components/Form/SettingRow';
import { Affix, FieldAction, Notice, Switch, TextInput } from '@/Components/UI';

<FormSection icon="bolt" title="عنوان القسم" description="سطر يصف محتواه" columns={2}>
    {/* حقل عادي */}
    <FormField id="name" label="الاسم" required error={errors.name} hint="تلميح اختياري">
        <TextInput className="block w-full" value={data.name} onChange={(e) => setData('name', e.target.value)} />
    </FormField>

    {/* حقل بوحدة، قابل للإغلاق والفتح */}
    <FormField
        id="amount"
        label="المبلغ"
        error={errors.amount}
        lock={locked ? 'locked' : 'open'}
        hint={locked ? 'اشرح كيف يُفتح.' : undefined}
        action={locked ? <FieldAction icon="pencil" onClick={unlock}>تعديل يدوي</FieldAction> : null}
    >
        <Affix unit="₪">
            <TextInput type="number" disabled={locked} className="block w-full" value={data.amount} onChange={(e) => setData('amount', e.target.value)} />
        </Affix>
    </FormField>

    {/* مفتاح تشغيل/إيقاف */}
    <div className="sm:col-span-2">
        <SettingRow title="اسم الإعداد" description={data.on ? 'مفعّل: ...' : 'متوقف: ...'}>
            <Switch checked={data.on} onChange={(v) => setData('on', v)} ariaLabel="اسم الإعداد" />
        </SettingRow>
    </div>

    {/* تنبيه */}
    <Notice tone="warn" className="sm:col-span-2">نص التنبيه.</Notice>
</FormSection>
```

**قواعد:**
- لا أصناف ألوان خام (`bg-gray-50`, `text-red-600`...) ولا `<button>`/`<input>` خام؛ كل شيء من الكِت.
- الإغلاق يكون بـ`disabled` أو `readOnly` على الحقل نفسه؛ المظهر يأتي تلقائيًا. لا تضف أصناف خلفية يدوية.
- حقل يُعرض ولا يُعدَّل أبدًا: `readOnly` + `lock="locked"` + تلميح يذكر السبب.
- القسم في نافذة عريضة: 3 أعمدة؛ في نافذة متوسطة: عمودان؛ حقل وحيد: `columns={1}`.
- الأرقام والمبالغ داخل `<bdi dir="ltr">`.
- مسافات CSS من السلّم 0/4/8/12/16/24/32 فقط وباتجاهات منطقية (يفرضه `tests/Unit/spacingScale.test.js`)؛ ما سواها يُعرَّف كرمز `--room-*`.
- النموذج نفسه يُستخدم في الصفحة (`FormPage`) والنافذة (`FormModal`)؛ لا تكرّر الحقول.

---

## 4. ما بقي من الخطة

### 4.1 المعاينة الباقية
ما ورد في «لم يُعاين بالعين» (القسم 2.6).

### 4.2 قرارات المالك
كلها أُغلقت: 1.4 حقول الصفحات بيضاء، 1.5 الترتيب الجديد يبقى، أجزاء الجداول المشتركة رُحّلت، ونوافذ المال نفسها لا تُمَس.

### 4.3 التنظيف
- حذف قواعد `gl-*` و`--panel-*` الخاصة بالنماذج (`resources/css/components/forms.css`, `form-windows.css`) والقواعد القديمة برموز `--gray-*` في `Settings/PermissionDesign.css` التي تغطيها كتلة MA في آخره، بعد التأكد بالبحث من كل صنف.
- توسيع `MA_MIGRATED` في `eslint.config.js` مع أي ملف يُرحَّل لاحقًا.

---

## 5. تشغيل الموقع والفحوص

```bash
composer install --no-interaction
```

```bash
npm ci
```

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npx vitest run
```

اختبارات المتصفح في البيئة السحابية (تحتاج المتصفح المثبّت و Playwright العام):

```bash
NODE_PATH=$(npm root --global) PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium node tests/Browser/run.mjs
```

```bash
NODE_PATH=$(npm root --global) PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium node tests/Browser/run.mjs --a11y
```

الأعلام الأخرى: `--subscriber-navigation`، `--meter-boxes`، `--branches`، `--access`، `--statement-actions`، `--reports`، `--print`، `--readings`، `--distribution`.

قبل اعتبار أي تعديل منتهيًا: معاينة فاتح وداكن، زجاجي ومصمت، وعرض الهاتف.
