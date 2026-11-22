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

### 1.6 أشرطة التحديد الجماعي ما زالت بألوان خام

**الوصف:** الشريط العائم عند تحديد صفوف (`Subscriptions/BulkActionBar.jsx`، `Disconnections/Show.jsx`، `Disconnections/Candidates.jsx`) يستخدم `bg-brand-gradient` و`bg-white` و`text-white`.

**الإصلاح:** اصنع جزءًا واحدًا في الكِت (`UI/SelectionBar.jsx`) بنفس سطح شريط الحفظ في الصلاحيات (`.pm-savebar` في `Settings/PermissionDesign.css`: `--ma-pop` + `--ma-float`)، بمفاتيح `SecondaryKey`/`DangerKey`، ثم استعمله في الملفات الثلاثة.

### 1.7 صفحة الملف الشخصي على نظام أصناف خاص

**الوصف:** `Profile/Edit.jsx` و`Profile/Partials/*` تعمل بأصناف `pp-*` (`Profile.css`: `pp-field`، `pp-button`) لا بـ`FormField` ومفاتيح الكِت. نافذة «تسجيل الخروج من الأجهزة» فقط نُقلت إلى `DialogFrame`.

**الإصلاح:** أعد بناء الأقسام بـ`FormSection` + `FormField` + مفاتيح الكِت، ثم احذف قواعد `pp-field`/`pp-button` و`.profile-page.pp-dialog` (أسطر ~162–164 من `Profile.css`، لم تعد مستخدمة).

### 1.8 أجزاء صغيرة بقيت خارج الكِت

- لا يوجد `TextArea` في الكِت؛ النوافذ تستخدم `TextArea` من HeroUI مباشرة (`Disconnections/ActionModal.jsx`، `CompanyForms/IssueModal.jsx`). أضف `UI/TextArea.jsx` وصدّره من `UI/index.js`.
- `UI/PasswordInput.jsx`: زر الإظهار يحمل `text-gray-400 hover:text-gray-900`؛ بدّلهما بـ`text-(--ma-faint) hover:text-(--ma-ink)`.
- `Messages/QuickMessage{Kind,Recipients,Body,Channel}.jsx` و`Disconnections/ResultReport.jsx` لم تُراجع ألوانها.
- `Subscriptions/ReadingHistoryModal.jsx` بقي على بنيته (نافذة بملء الشاشة بورقة أنماطها ورأس طباعة)؛ نُظّفت ألوانه فقط.
- `Payments/CloseBoxesByType.jsx`: `text-white`/`bg-white` باقية في `CloseSteps` و`StepHeading` فوق `--ma-act` و`--ma-pay-btn` (داكنان في الوضعين)؛ لذلك الملف غير مدرج في قاعدة ESLint.

### 1.9 تغييرات سلوك صغيرة تحتاج نظرة المالك

- نوافذ التوزيع (`ReadingCycles/DistributionDialog.jsx`) صارت بالعرض القياسي 820px بدل 880px؛ عُدّل الفحص في `tests/Browser/reading-distribution.cjs`.
- في `MeterReadings/MeterReadingModal.jsx`: «اعتماد القراءة المصحّحة الآن» صار مفتاحًا (`SettingRow` + `Switch`) بدل خانة اختيار، وحقلا القراءة أخذا شكل الحقل الموحّد بدل الشكل الكبير المتوسّط.
- في `Payments/CloseBoxesByType.jsx`: صف الخطوات صار في أعلى الجسم المتحرك لا ثابتًا في الرأس.
- في `Settings/PrintTemplates.jsx`: نافذة إعادة التسمية لا تُغلق أثناء الحفظ.
- زر الإغلاق في كل النوافذ المرحّلة صار اسمه «إغلاق النافذة».
- شاشة المظهر تعرض الآن «شعار الخلفيات الداكنة» الافتراضي كشعار قابل للإزالة؛ ورفع شعار رئيسي خاص يزيل النسخة الافتراضية الداكنة تلقائيًا (`BrandSettingController@update`).

### 1.10 ملاحظة عن بيئة الفحص (ليست خطأ في الموقع)

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

### 2.5 الفحوص التي نجحت

`npm run lint`، `npm test` (433)، `npx vitest run` (81)، `php artisan test --compact --filter=Brand` (42)، `vendor/bin/pint --dirty`، واختبارات المتصفح: الأساسية، `--a11y`، `--access`، `--branches`، `--meter-boxes`، `--subscriber-navigation`، `--distribution`، `--print`، `--readings`. لم تُشغَّل: مجموعة PHP الكاملة، `--reports`، `--statement-actions`.

**عُوين بالعين (فاتح وداكن، وعرض الهاتف):** الشعار؛ صفحة الصلاحيات ونوافذها وشريط الحفظ وإشعار الحفظ؛ صفحة الفرع؛ البيانات الشخصية، إدخال قراءة، سجل الرسائل، الرسالة السريعة، التغيير الجماعي وتفاصيله؛ أرشفة الاشتراك؛ نافذة الأجهزة في الملف الشخصي؛ إنذار وتأكيد وتمديد القطع، سجل المشترك في القائمة، «إضافة إلى القائمة»؛ إغلاق الصناديق حسب النوع (مع صندوق محدّد)؛ قالب طباعة جديد وإعادة التسمية؛ أرشفة طلب ورقي وإصدار نموذج معبّأ؛ يوم القراءة وملخّص التوزيع؛ سجل القراءات؛ رابط الفرع؛ صفحات تعديل الفرع والمستخدم والمشترك والتعرفة والقاطع والطبلون والمنطقة، وإنشاء منطقة 2 والمحافظة.

**السطح المصمت (فاتح وداكن، سطح المكتب):** كل النوافذ أعلاه عدا رابط الفرع، وصفحتا تعديل المشترك والمستخدم.

**لم يُعاين بالعين:** استعادة اشتراك مؤرشف، خطوة التأكيد بالضغط المطوّل في القطع، رسائل الخطأ داخل النوافذ، حالات التحميل، وصفحات التعديل على السطح المصمت في الهاتف.

**أُصلح أثناء المعاينة:**
- مظهر «مغلق» (التخطيط والقفل) كان يصيب مفاتيح الإجراءات المعطّلة (Excel وطباعة في سجل القراءات)؛ صار محصورًا بمفاتيح القوائم (`[aria-expanded]`) في `ma-forms.css`.
- صفحة قوالب الطباعة كانت تتجاوز عرض الهاتف بـ32px بسبب تلميحات `.gl-pt-tip` المخفية؛ صارت خارج التخطيط حتى تظهر (`components/mobile-app.css`).
- مسافة بين اختيار «نموذج فارغ / نسخة معبأة» وأول حقل في `CompanyForms/IssueModal.jsx`.

**ملاحظات قديمة ظهرت في المعاينة (لم تُعدَّل):**
- إغلاق الصناديق على الهاتف: أسماء الخطوات الثلاث مقطوعة («نوع الـ…»)؛ الإصلاح: إخفاء النص وإبقاء الرقم تحت `sm` في `CloseSteps`.
- «إضافة إلى القائمة»: خيارات السبب (`ChoiceChips`) بلا عنوان ظاهر فوقها.
- نافذة «يوم القراءة»: التواريخ في النص بصيغة `2026-11-19` وخارج `<bdi dir="ltr">`.
- سجل المشترك في القائمة: بلا حالة فارغة إن لم توجد أحداث (لا يحدث في بيانات حقيقية).

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
ما ورد في «لم يُعاين بالعين» و«ملاحظات قديمة» (القسم 2.5).

### 4.2 رسائل التنبيه اليدوية
بقي نحو 90 صندوقًا يدويًا خارج الملفات المرحّلة. للبحث عنها:

```bash
grep -rnE "className=\"[^\"]*rounded-(control|card|xl|lg)[^\"]*bg-(gray-50|amber|red|blue|emerald|yellow)" resources/js --include=*.jsx
```

لتبديل أصناف الألوان الخام آليًا ثم مراجعة الباقي يدويًا، التحويل المعتمد: `text-gray-700..900` → `text-(--ma-ink)`، `text-gray-500/600` → `text-(--ma-muted)`، `text-gray-300/400` → `text-(--ma-faint)`، `bg-gray-50/100` → `bg-(--ma-tile)`، `bg-surface`/`bg-white` → `bg-(--ma-solid)`، `border-gray-*` → `border-(--ma-line)`، الأحمر → `--ma-owe`/`-s`، الكهرماني → `--ma-warn`/`-s`، الأخضر → `--ma-pay`/`-s`، الأزرق → `--ma-clr`/`-s`، مع حذف أصناف `dark:` المقابلة.

### 4.3 التنظيف والحماية
- حذف قواعد `gl-*` و`--panel-*` الخاصة بالنماذج بعد اكتمال الترحيل (`resources/css/components/forms.css`, `form-windows.css`)، والقواعد القديمة برموز `--gray-*` في `Settings/PermissionDesign.css` التي تغطيها كتلة MA في آخره.
- توحيد `SettingSwitch` (في `Components/Settings/SettingsKit.jsx`) مع `SettingRow` + `Switch`.
- توسيع قائمة `MA_MIGRATED` في `eslint.config.js` مع كل ملف يُرحَّل، حتى تشمل `resources/js/Pages/**`.
- البنود 1.6 إلى 1.8.

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
