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

### 1.1 الشعار: حرف M يبقى داكنًا في الوضع الداكن (لم يُصلح)

**المطلوب:** M أسود على الخلفية الفاتحة، وأبيض في الوضع الداكن. حرف A البرتقالي لا يتغير.

**السبب (مؤكد من الكود ومن اللقطات):**
- `public/images/logo-ma.svg` يرسم M والخط بلون ثابت `fill="#2A2D34"` (في موضعين)، و A بـ`#E2642A`.
- `resources/brand/default.json` فيه `"light": null`، أي لا يوجد شعار للخلفيات الداكنة.
- `app/Support/Branding/Brand.php` (الدالة `logoUrl`) تعيد الشعار الرئيسي عندما يكون `light` فارغًا.
- `resources/js/Components/BrandLogo.jsx`: عند `light === main` يرسم الصورة نفسها في الوضعين.

**خطوات الإصلاح:**

1. أنشئ نسخة الشعار للخلفيات الداكنة:

```bash
sed 's/#2A2D34/#FFFFFF/g' public/images/logo-ma.svg > public/images/logo-ma-light.svg
```

2. في `resources/brand/default.json` غيّر السطر:

```json
"light": null,
```

إلى:

```json
"light": "/images/logo-ma-light.svg",
```

3. في `resources/js/hooks/useBrand.js` داخل `DEFAULT_BRAND` غيّر `light: defaults.logos.main` إلى:

```js
light: defaults.logos.light ?? defaults.logos.main,
```

4. لا حاجة لتعديل `BrandLogo.jsx` ولا CSS: التبديل موجود أصلًا (`.brand-logo-on-dark` / `.brand-logo-on-light` في `resources/css/app/windows.css`).

**تحقق بعد الإصلاح:**
- الشريط العلوي والقائمة الجانبية (`Components/Layout/TopBar.jsx` سطرا 92 و218، `NavigationDrawer.jsx` سطر 120): بدّل بين الفاتح والداكن وتأكد أن M يتبدل فورًا.
- البطاقات الداكنة دائمًا (`Subscriptions/SubscriptionPreview.jsx`، `AccountStatement.jsx`، `Auth/DrawnMark.jsx`) تستخدم `onDark`، فسيصير M فيها أبيض في الوضعين — وهذا صحيح.
- `Subscriptions/PaymentCheckout.jsx` (سطر 353) يتبع الثيم: معاينة فقط، دون تعديل النافذة.
- شغّل:

```bash
npm test
```

```bash
php artisan test --compact --filter=Brand
```

(`tests/Unit/brandPalette.test.js` و`tests/Unit/BrandPaletteTest.php` قد يثبّتان قيم `default.json`.)

**تنبيه:** شركة رفعت شعارها الخاص من شاشة المظهر دون شعار للخلفيات الداكنة ستبقى على شعار واحد؛ حلّها رفع شعار داكن من الشاشة نفسها.

### 1.2 القائمة المنسدلة المغلقة بلا أيقونة قفل

**الوصف:** الحقل النصي المغلق يحمل قفلًا، أما القائمة المعطّلة (مثل «المنطقة» قبل اختيار المحافظة في الفرع والطبلون) فتظهر مخطّطة ومتقطعة مع سهمها فقط.

**الإصلاح:** في `resources/css/app/ma-forms.css` داخل الكتلة الرئيسية، أضف قاعدة تخفي سهم القائمة المعطّلة وترسم القفل مكانه:

```css
& :is(button.rounded-control.border, .gl-choice-trigger):is(:disabled, [aria-disabled='true'], [data-disabled]) {
    background-image: var(--ma-lock), var(--ma-hatch);
    background-repeat: no-repeat, repeat;
    background-size: 17px 17px, auto;
    background-position: left 16px center, 0 0;
}

& :is(button.rounded-control.border, .gl-choice-trigger):is(:disabled, [aria-disabled='true'], [data-disabled]) svg {
    visibility: hidden;
}
```

### 1.3 صف المفتاح خارج البطاقة في صفحة الفرع

**الوصف:** في `/branches/create` صف «فرع نشط» يقع تحت بطاقات الأقسام لا داخل إحداها.

**الإصلاح:** في `resources/js/Pages/Branches/BranchForm.jsx` انقل `<SettingRow title="فرع نشط">` وخطأه إلى داخل `<FormSection icon="pin" title="الموقع">` في `<div className="sm:col-span-2">`، كما في «حساب نشط» بنموذج المستخدم.

### 1.4 تباين الحقل المفتوح مع البطاقة الزجاجية

**الوصف:** في الوضع الفاتح الزجاجي، لون الحقل (`--ma-tile`) قريب من لون البطاقة، والتمييز يعتمد على الخط الرفيع.

**الإصلاح (إن أراده المالك):** في `ma-forms.css` اجعل حقول الصفحات بيضاء:

```css
.ma-form-page :is(input:not([type='checkbox'], [type='radio'], [type='hidden']), textarea):not(:disabled, [readonly]) {
    background-color: var(--ma-solid) !important;
}
```

يحتاج قرار المالك لأنه يغيّر شكل الحقل عن النوافذ.

### 1.5 ترتيب قسم «معلومات الاشتراك» تغيّر

صار: المفتاح «تحميل رسوم اشتراك»، ثم الرسوم، ثم القراءة السابقة، ثم التاريخ (كان: القراءة، الرسوم، التاريخ، ثم المفتاح). للرجوع: أعد ترتيب العناصر داخل `<FormSection icon="calendar">` في `resources/js/Pages/Subscriptions/SubscriptionForm.jsx`.

### 1.6 أنماط لم تعد مستخدمة

- حُذف `resources/js/Components/Form/InsetList.jsx` (كان يستخدمه نموذج التعرفة فقط). قواعده `gl-inset*` ما زالت في `resources/css/components/forms.css` (أسطر ~300–370) ويمكن حذفها.
- `FieldLock` و`ReadOnlyField` أُزيلا من `SubscriptionLocationSection.jsx`.

### 1.7 ملاحظة عن بيئة الفحص (ليست خطأ في الموقع)

نسخة Playwright في `node_modules` تطلب متصفحًا غير المثبّت في البيئة السحابية؛ اختبارات المتصفح تفشل ما لم يُضبط `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (انظر القسم 5). وخادم MCP «laravel-boost» لم يتصل في هذه الجلسة.

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

### 2.4 الفحوص التي نجحت

`npm run lint`، `npm test`، `npx vitest run`، واختبارات المتصفح: الأساسية، `--a11y`، `--subscriber-navigation`، `--meter-boxes`، `--branches`، `--access`.

معاينة بالعين: المشترك، الفرع، المستخدم، القاطع، التعرفة، المنطقة، الطبلون، البنك — فاتح/داكن، زجاجي/مصمت، وهاتف (ليست كل التركيبات لكل نموذج). **لم تُعاين بالعين:** نوافذ المال، نماذج التعديل (Edit)، منطقة 2، المحافظة، رابط الفرع.

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

### 4.1 نماذج ورثت الشكل ولم تُراجع
`Subscriptions/PersonalDetailsModal.jsx`, `ArchiveSubscriptionModal.jsx`, `BulkChangeModal.jsx`, `MeterReadings/MeterReadingModal.jsx`, `Profile/Partials/*`, صفحات التعديل (Edit) لكل الموارد.
العمل: معاينة، إزالة الألوان الخام، استخدام `lock` / `Notice` / `SettingRow`.

### 4.2 نوافذ تبني رأسها وتذييلها يدويًا فوق `Modal`
تُنقل إلى `DialogFrame` (`@/Components/UI/DialogFrame`):
- الصلاحيات: `Settings/PermissionGuide.jsx` (`PermissionGuide` و`PermissionExplanation`)، `PermissionReview.jsx`.
- `Disconnections/ActionModal.jsx`, `HistoryModal.jsx`, `Candidates.jsx`.
- `Messages/QuickMessageModal.jsx`, `SubscriptionMessageHistoryModal.jsx`.
- `CompanyForms/IssueModal.jsx`, `ReadingCycles/DistributionDialog.jsx`, `CycleParts.jsx`.
- `Payments/CloseBoxesByType.jsx`, `Settings/PrintTemplates.jsx`, `Subscriptions/BulkChanges.jsx`, `ReadingHistoryModal.jsx`.

### 4.3 رسائل التنبيه والتحذير
- صفحة الصلاحيات: صناديق `amber`/`red` في `PermissionReview.jsx` (أسطر ~80، 91، 184، 202)، ألوان خام في `PermissionInsights.jsx`, `PermissionMatrix.jsx`, `PermissionPeople.jsx`, و`pm-toast` بألوان hex في `PermissionDesign.css`. تُستبدل بـ`Notice` والرموز.
- عمومًا: نحو 98 صندوقًا يدويًا في المشروع. للبحث عنها:

```bash
grep -rnE "className=\"[^\"]*rounded-(control|card|xl|lg)[^\"]*bg-(gray-50|amber|red|blue|emerald|yellow)" resources/js --include=*.jsx
```

### 4.4 التنظيف والحماية
- حذف قواعد `gl-*` و`--panel-*` الخاصة بالنماذج بعد اكتمال الترحيل (`resources/css/components/forms.css`, `form-windows.css`).
- توحيد `SettingSwitch` (في `Components/Settings/SettingsKit.jsx`) مع `SettingRow` + `Switch`.
- قاعدة ESLint: منع استيراد `Modal` الخام داخل `Pages/`، ومنع أصناف الألوان الخام في الملفات المرحّلة (موجودة اليوم في 195 ملفًا).

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
