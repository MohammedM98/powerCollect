# توحيد النماذج والنوافذ مع ثيم MA — ملف المتابعة

ملف تسليم لجلسة لاحقة: ما أُنجز، الأخطاء المفتوحة، وما بقي من الخطة.
الفرع: `claude/admiring-heisenberg-q7ruxl`. القواعد المعتمدة في `CLAUDE.md` (قسم PowerCollect design system).

**قيد ثابت من المالك:** نوافذ المال (الدفع، الرسوم، الخصم، المقاصة، التقسيم) وكشف الحساب ممتازة ولا تُعدَّل.

---

## 1. أخطاء مفتوحة

### 1.1 الشعار: حرف M يبقى أسود في الوضع الداكن

**المطلوب:** M أسود على الخلفية الفاتحة، وأبيض في الوضع الداكن. حرف A البرتقالي لا يتغير.

**السبب (مؤكد من الكود):**
- `public/images/logo-ma.svg` يرسم M والخط بلون ثابت `fill="#2A2D34"` (مرتان)، و A بـ `#E2642A`.
- `resources/brand/default.json` فيه `"logos": { "main": "/images/logo-ma.svg", "light": null, ... }`، فلا يوجد شعار للخلفيات الداكنة.
- `app/Support/Branding/Brand.php` (`logoUrl`) يعيد `main` عندما يكون `light` فارغًا.
- `resources/js/Components/BrandLogo.jsx`: عند `light === main` يرسم الصورة نفسها في الثيمين، فلا يتبدل شيء.

**الإصلاح المقترح (الأصغر):**
1. إنشاء `public/images/logo-ma-light.svg`: نسخة من `logo-ma.svg` مع تبديل `#2A2D34` إلى `#FFFFFF` في الموضعين.
2. في `resources/brand/default.json` جعل `"light": "/images/logo-ma-light.svg"`.
3. التحقق من `DEFAULT_BRAND` في `resources/js/hooks/useBrand.js` (حاليًا `light: defaults.logos.main`) ليقرأ `defaults.logos.light ?? defaults.logos.main`.

بعدها يعمل التبديل الموجود أصلًا في `BrandLogo.jsx` و`resources/css/app/windows.css` (`.brand-logo-on-dark` / `.brand-logo-on-light`).

**أماكن الشعار للمعاينة بعد الإصلاح:**
- `Components/Layout/TopBar.jsx` (سطرا 92 و218) و`NavigationDrawer.jsx` (سطر 120): يتبعان الثيم.
- `Subscriptions/PaymentCheckout.jsx` (سطر 353): يتبع الثيم؛ معاينة فقط دون تعديل النافذة.
- `SubscriptionPreview.jsx`، `AccountStatement.jsx`، `Auth/DrawnMark.jsx`: `onDark` دائمًا (بطاقات داكنة)، وسيصير M فيها أبيض في الثيمين — وهو الصحيح.

**تنبيه:** شركة رفعت شعارها الخاص من شاشة المظهر دون شعار داكن ستبقى على الشعار نفسه؛ الحل لها رفع شعار للخلفيات الداكنة من الشاشة نفسها.

**اختبارات:** `tests/Unit/brandPalette.test.js` و`tests/Unit/BrandPaletteTest.php` قد يثبّتان قيم `default.json`؛ شغّل `npm test` و`php artisan test --compact --filter=Brand`.

### 1.2 شريط تبويبات الإعدادات يتجاوز عرض الصفحة (لوحظ، لم يُفحص)

في `/users/create` عند عرض 1440px ظهر شريط التبويبات (المستخدمون، الصلاحيات، التعرفات، … تحميل تطبيق الهاتف) أعرض من الصفحة في لقطة الصفحة الكاملة، وقُصّ أول مسار التنقل. موجود قبل هذا العمل. يحتاج تأكيدًا ثم معالجة (تمرير أفقي داخل الشريط فقط).

### 1.3 نقاط صغيرة في ما أُنجز

- قائمة منسدلة معطّلة (مثل «المنطقة» في نموذج الفرع قبل اختيار المحافظة) تظهر مخطّطة ومتقطعة لكن بلا أيقونة قفل؛ الحقول النصية المغلقة تحمل القفل.
- صف «فرع نشط» في صفحة الفرع المستقلة يقع خارج بطاقات الأقسام.
- تباين الحقل المفتوح مع بطاقة القسم الزجاجية منخفض قليلًا في الوضع الفاتح (يعتمد على الخط الرفيع).
- ترتيب قسم «معلومات الاشتراك» تغيّر: المفتاح، ثم الرسوم، ثم القراءة السابقة، ثم التاريخ. يُعاد إن رغب المالك.

---

## 2. ما أُنجز

**الأنماط:** ملف واحد `resources/css/app/ma-forms.css` (آخر استيراد في `app.css`) برموز `--ma-*` فقط. قواعد الحقول نُقلت إليه من `window-sheets.css`.

- النطاق: كل نافذة غير مالية + كل نموذج يحمل الصنف `ma-form` (يضعه `FormModal` و`FormPage`؛ الصفحة تضيف `ma-form-page`).
- الحقل المفتوح: بلاطة `--ma-tile` بخط `--ma-line`، ارتفاع 48px، زاوية 14px؛ أبيض بحلقة `--ma-brand` عند الكتابة.
- الحقل المغلق (`disabled` أو `readOnly`): مخطّط، حدّ متقطع، حبر `--ma-muted`، وقفل.
- القوائم (`ChoiceSelect`, `SearchableSelect`, `DateInput`) بعرض العمود وارتفاع الحقول.
- الصفحات المستقلة: بطاقات زجاجية ورصيف حفظ عائم `ma-form-dock`.

**الكِت (`@/Components/UI`):**
- جديد: `Notice` (نغمات neutral/info/brand/success/warn/danger)، `FieldAction`، وتصدير `Affix`.
- `FormField`: خاصيتا `lock` (`'locked'`/`'open'` → شارة «مغلق/مفتوح») و`action` (مفتاح في نهاية سطر العنوان).
- `Affix`: يمرّر خصائص الحقل ويعرض قفلًا بجانب الوحدة عند الإغلاق.
- `Switch`: يقبل `id`.

**النماذج:**
- المشترك: `SubscriptionForm.jsx`, `SubscriptionTariffSection.jsx`, `SubscriptionLocationSection.jsx` — ثلاثة أعمدة في كل الأقسام، حالات الإغلاق/الفتح لرسوم الاشتراك وسعر الكيلو والحد الأدنى والقراءة السابقة والمنطقة.
- الفرع: `BranchForm.jsx`, `DomainModal.jsx`.
- المستخدم: `UserForm.jsx`, `UserTypeSelect.jsx`.

**التحقق الذي نجح:** `npm run lint`، `npm test`، `npx vitest run`، واختبارات المتصفح (الأساسية، `--a11y`، `--subscriber-navigation`، `--meter-boxes`، `--branches`، `--access`). معاينة بالعين للمشترك والفرع والمستخدم: فاتح/داكن، زجاجي/مصمت، وهاتف. لم تُعاين نوافذ المال بالعين.

---

## 3. ما بقي من الخطة

### 3.1 نماذج تستخدم الهيكل المشترك (ورثت الشكل، لم تُعاين)
المناطق، المناطق الفرعية، المحافظات، التعرفة، علب العدادات، القواطع، البنوك (`Settings/BanksSection.jsx`)، الملف الشخصي (`Profile/Partials`)، `PersonalDetailsModal`, `ArchiveSubscriptionModal`, `BulkChangeModal`, `MeterReadingModal`.
العمل: معاينة كل واحد، إزالة أصناف الألوان الخام (`bg-gray-50`, `text-gray-500`...)، واستخدام `lock`/`Notice`/`SettingRow` حيث يلزم.

### 3.2 نوافذ تبني رأسها وتذييلها يدويًا فوق `Modal`
تُنقل إلى `DialogFrame` (رأس `DialogHeader`، تذييل `gl-dialog-foot`):
- الصلاحيات: `Settings/PermissionGuide.jsx` (`PermissionGuide` و`PermissionExplanation`)، `PermissionReview.jsx`.
- `Disconnections/ActionModal.jsx`, `HistoryModal.jsx`, `Candidates.jsx`.
- `Messages/QuickMessageModal.jsx`, `SubscriptionMessageHistoryModal.jsx`.
- `CompanyForms/IssueModal.jsx`, `ReadingCycles/DistributionDialog.jsx`, `CycleParts.jsx`.
- `Payments/CloseBoxesByType.jsx`, `Settings/PrintTemplates.jsx`, `Subscriptions/BulkChanges.jsx`, `ReadingHistoryModal.jsx`.

### 3.3 رسائل التنبيه والتحذير
- صفحة الصلاحيات: صناديق `amber`/`red` في `PermissionReview.jsx` (أسطر ~80، 91، 184، 202)، ألوان خام في `PermissionInsights.jsx`, `PermissionMatrix.jsx`, `PermissionPeople.jsx`, و`pm-toast` بألوان hex في `PermissionDesign.css`.
- عمومًا: نحو 98 صندوقًا يدويًا في المشروع يُستبدل بـ`Notice`.

### 3.4 التنظيف والحماية
- حذف أصناف `gl-*` و`--panel-*` الخاصة بالنماذج بعد اكتمال الترحيل (`components/forms.css`, `form-windows.css`).
- توحيد `SettingSwitch` (في `SettingsKit`) مع `SettingRow` + `Switch`.
- قاعدة ESLint: منع استيراد `Modal` الخام داخل `Pages/`، ومنع أصناف الألوان الخام في الملفات المرحّلة (موجودة اليوم في 195 ملفًا).

---

## 4. تشغيل الفحوص في جلسة سحابية

```bash
composer install --no-interaction
```

```bash
npm ci
```

```bash
npm run build
```

اختبارات المتصفح تحتاج متصفح البيئة المثبّت (نسخة Playwright في المشروع تطلب نسخة أخرى):

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium node tests/Browser/run.mjs --a11y
```

قاعدة يفرضها `tests/Unit/spacingScale.test.js`: قيم `padding`/`margin`/`gap` في CSS من السلّم 0/4/8/12/16/24/32 فقط، وبالاتجاهات المنطقية.
