part of 'subscriber_page.dart';

/// The balance card, the personal and subscription facts, and the services the subscriber can be given.
extension _SubscriberDetails on _SubscriberPageState {
  Widget balanceCard() {
    return AppHero(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('الرصيد الحالي',
                    style:
                        AppIdentity.body(12.5, color: AppIdentity.heroFaint)),
                Text(balanceText(balance),
                    key: const ValueKey('subscriber-balance'),
                    style: AppIdentity.number(25,
                        weight: FontWeight.w800,
                        color: balanceColor(balance, onHero: true))),
              ])),
        ]));
  }

  String? text(Object? value) =>
      value == null || '$value'.trim().isEmpty ? null : '$value'.trim();

  Widget detailIcon(String icon, {bool muted = false}) {
    final (color, tint) = muted
        ? (AppIdentity.faint, AppIdentity.sunken)
        : switch (icon) {
            'phone' || 'cash' || 'check' => (
                AppIdentity.good,
                AppIdentity.goodTint
              ),
            'meter' || 'bolt' || 'breaker' || 'clock' => (
                AppIdentity.warning,
                AppIdentity.warningTint
              ),
            'home' || 'pin' || 'tag' => (
                AppIdentity.brand,
                AppIdentity.brandTint
              ),
            'err' => (AppIdentity.bad, AppIdentity.badTint),
            _ => (AppIdentity.info, AppIdentity.infoTint),
          };
    return AppIconTile(icon, color, tint, size: 38, iconSize: 18);
  }

  Widget factRows(List<(String, String, String)> facts) => AppRows(children: [
        for (final (icon, label, value) in facts)
          AppRow(
              key: icon == 'phone' ? ValueKey('subscriber-phone-$value') : null,
              onLongPress: icon == 'phone'
                  ? () async {
                      try {
                        await Clipboard.setData(ClipboardData(text: value));
                        if (mounted) {
                          showAppToast(context, 'تم نسخ رقم الهاتف.');
                        }
                      } on PlatformException {
                        if (mounted) {
                          showAppToast(
                              context, 'تعذر نسخ رقم الهاتف. أعد المحاولة.',
                              icon: 'err');
                        }
                      }
                    }
                  : null,
              leading: detailIcon(icon),
              title: Text(label,
                  style: AppIdentity.body(12.5, color: AppIdentity.faint)),
              subtitle: Text(value,
                  textDirection: icon == 'phone' ? TextDirection.ltr : null,
                  style: AppIdentity.body(15, weight: FontWeight.w700))),
      ]);

  List<(String, String, String)> personalFacts() => [
        if (text(subscriber['subscriber_name']) ?? text(subscriber['full_name'])
            case final name?)
          ('user', 'اسم المشترك', name),
        if (text(subscriber['national_id']) case final nationalId?)
          ('tag', 'رقم الهوية', nationalId),
        if (text(subscriber['personal_phone']) ?? text(subscriber['phone'])
            case final phone?)
          ('phone', 'رقم الهاتف', phone),
        if (text(subscriber['personal_phone']) != null &&
            text(subscriber['phone']) != null &&
            text(subscriber['personal_phone']) != text(subscriber['phone']))
          ('phone', 'هاتف التواصل', text(subscriber['phone'])!),
        if (text(subscriber['address']) case final address?)
          ('home', 'العنوان', address),
      ];

  List<(String, String, String)> subscriptionFacts() {
    final boxName = text(subscriber['meter_box_name']);
    final boxNumber = text(subscriber['meter_box_number']);
    final box = [boxName, if (boxNumber != null) '($boxNumber)']
        .whereType<String>()
        .join(' ');
    final previousReading =
        lastReading?['previous_reading'] ?? subscriber['initial_reading'];
    final currentReading = lastReading?['current_reading'];
    final previousValue = double.tryParse('$previousReading');
    final currentValue = double.tryParse('$currentReading');
    final difference = previousValue != null && currentValue != null
        ? currentValue - previousValue
        : null;
    return [
      if (text(subscriber['status_label']) case final status?)
        (
          switch (subscriber['status']) {
            'active' => 'check',
            'disconnected' => 'err',
            _ => 'clock',
          },
          'حالة الاشتراك',
          status
        ),
      if ((switch (
              '${subscriber['accounting_type'] ?? subscriber['accounting_type_label'] ?? ''}'
                  .toLowerCase()) {
        'weekly' => 'أسبوعي',
        'monthly' => 'شهري',
        _ => text(subscriber['accounting_type_label']),
      })
          case final type?)
        ('sync', 'نوع المحاسبة', type),
      if (text(subscriber['subscription_date']) case final date?)
        ('calendar', 'تاريخ الاشتراك', date),
      if (text(subscriber['tariff_name']) case final tariff?)
        ('tag', 'نوع الاشتراك', tariff),
      if (text(subscriber['kilowatt_price']) case final price?)
        ('bolt', 'سعر الكيلوواط', '${AppIdentity.grouped(price)} ₪ / ك.و.س'),
      if (text(subscriber['minimum_payment']) case final minimum?)
        ('cash', 'الحد الأدنى الأسبوعي', '${AppIdentity.grouped(minimum)} ₪'),
      if (text(subscriber['circuit_breaker_ampere']) case final ampere?)
        ('breaker', 'القاطع', '${AppIdentity.reading(ampere)} أمبير'),
      if (text(subscriber['sub_area_name']) case final area?)
        ('pin', 'المنطقة 2', area),
      if (box.isNotEmpty) ('meter', 'الطبلون', box),
      if (text(subscriber['meter_box_location']) case final location?)
        ('pin', 'موقع الطبلون', location),
      if (details != null)
        (
          'meter',
          'القراءة السابقة',
          previousReading == null
              ? 'غير متوفرة'
              : AppIdentity.reading(previousReading)
        ),
      if (details != null)
        (
          'meter',
          'القراءة الحالية',
          currentReading == null
              ? 'غير متوفرة'
              : AppIdentity.reading(currentReading)
        ),
      if (details != null)
        (
          'bolt',
          'الفرق (كيلوواط)',
          difference == null ? 'غير متوفر' : AppIdentity.reading(difference)
        ),
    ];
  }

  Widget subscriberActions() {
    final canViewHistory = permissions['view_history'] == true;
    final messaging = details?['messaging'] as Map?;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AppRows(children: [
        AppRow(
            key: const ValueKey('subscriber-split-payment'),
            leading: detailIcon('cash', muted: !canRecordSplitPayment),
            title: const AppRowTitle('تسجيل دفعة مقسّمة'),
            subtitle: AppRowNote(canRecordSplitPayment
                ? 'حوالة واحدة توزّع على عدة اشتراكات'
                : 'تحتاج صلاحية تسجيل دفعة بتحويل بنكي'),
            trailing: AppIcon(canRecordSplitPayment ? 'chev' : 'lock',
                size: 18, color: AppIdentity.faint),
            onTap: canRecordSplitPayment ? recordSplitPayment : null),
        AppRow(
            key: const ValueKey('subscriber-financial-history'),
            leading: detailIcon('hist'),
            title: const AppRowTitle('السجل المالي'),
            subtitle: AppRowNote(canViewHistory
                ? 'جميع الدفعات والقراءات والحركات'
                : 'تحتاج صلاحية عرض بيانات المشترك من الإدارة'),
            trailing: AppIcon(canViewHistory ? 'chev' : 'lock',
                size: 18, color: AppIdentity.faint),
            onTap: canViewHistory
                ? () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => SubscriberHistoryPage(
                        api: widget.api, subscriber: subscriber)))
                : null),
      ]),
      const SizedBox(height: 12),
      SubscriberMessageActions(
          api: widget.api,
          subscriber: subscriber,
          messaging: messaging ?? const {})
    ]);
  }
}
