part of 'field_shell.dart';

/// The home screen: the day's figures and a card per service the user may use.
extension _ShellHome on _FieldShellState {
  Widget home() {
    final total = today.fold<double>(0, (sum, payment) {
      return sum +
          (double.tryParse(
                  '${payment['amount_in_shekels'] ?? payment['amount']}') ??
              0);
    });
    final subscribers = widget.store.subscribers;
    final queued = widget.store.queuedReadings;
    final done = subscribers
        .where((subscriber) =>
            subscriber['reading_status'] != null ||
            queued.any((reading) =>
                reading['subscription_id'] == subscriber['id'] &&
                reading['week_start'] == widget.store.state['week_start']))
        .length;
    final drafts = widget.store.readingDrafts.length;
    final weekStart = widget.store.state['week_start'];
    final rejected = queued.any((reading) => reading['sync_error'] != null);
    final ratio = subscribers.isEmpty ? 0.0 : done / subscribers.length;
    final hasTasks = canRead || canBrowseSubscribers || canViewOwnBoxes;

    // Weekly readings open from the collection screen and messages from the
    // subscriber screen, so home lists them only for staff without those.
    final tools = <Widget>[
      if (canViewReadings && !canBrowseSubscribers)
        AppServiceCard(
            title: 'القراءات الأسبوعية',
            subtitle: 'قراءات المشتركين والاستهلاك',
            summary: 'عرض فقط',
            icon: 'hist',
            color: AppIdentity.info,
            tint: AppIdentity.infoTint,
            onTap: openWeeklyReadings),
      if (canDistributeReadings)
        AppServiceCard(
            key: const ValueKey('reading-distribution-service'),
            title: 'توزيع القراءات',
            subtitle: 'المناطق والطبلونات وقارئو العدادات',
            summary: 'توزيع القراءة القادمة',
            icon: 'bolt',
            color: AppIdentity.brand,
            tint: AppIdentity.brandSoft,
            onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                    builder: (_) => ReadingDistributionPage(api: widget.api)))),
      if ((canSendMessages || canViewMessages) && !canBrowseSubscribers)
        AppServiceCard(
            title: canSendMessages ? 'إرسال الرسائل' : 'سجل رسائل المشتركين',
            subtitle: 'رسائل المشترك وسجل الإرسال',
            summary: canSendMessages ? 'رسائل نصية SMS' : 'عرض فقط',
            icon: 'message',
            color: AppIdentity.info,
            tint: AppIdentity.infoTint,
            onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                    builder: (_) => MessageSubscribersPage(api: widget.api)))),
    ];
    return refreshable(ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        children: [
          AppHero(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  height: 26,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                      color: const Color(0x18FFFFFF),
                      borderRadius: BorderRadius.circular(99)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                            color: syncing
                                ? const Color(0xFF93C5FD)
                                : online
                                    ? AppIdentity.heroGood
                                    : AppIdentity.heroWarn,
                            shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    Text(
                        syncing
                            ? 'جارٍ المزامنة'
                            : online
                                ? 'متصل'
                                : 'دون اتصال',
                        style: AppIdentity.body(12,
                            weight: FontWeight.w600, color: Colors.white)),
                  ]),
                ),
                const Spacer(),
                if (canRead && weekStart != null)
                  Flexible(
                      child: Text.rich(
                          TextSpan(children: [
                            const TextSpan(text: 'أسبوع '),
                            TextSpan(
                                text:
                                    '${AppIdentity.shortDate(weekStart)} – ${AppIdentity.shortDate(widget.store.state['week_end'])}',
                                style: AppIdentity.number(12.5,
                                    weight: FontWeight.w500,
                                    color: AppIdentity.heroFaint)),
                          ]),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppIdentity.body(12.5,
                              color: AppIdentity.heroFaint))),
              ]),
              const SizedBox(height: 16),
              Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                if (canRead)
                  Expanded(
                      child: Row(children: [
                    AppRing(ratio),
                    const SizedBox(width: 12),
                    Expanded(
                        child: heroStat(
                            'قراءات الأسبوع', '$done / ${subscribers.length}')),
                  ])),
                if (canRead && canCollect) const SizedBox(width: 12),
                if (canCollect)
                  Expanded(
                      child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                              key: const ValueKey('collector-today-payments'),
                              borderRadius: BorderRadius.circular(14),
                              onTap: () => navigate(FieldSection.collections,
                                  showToday: true),
                              child: heroStat('تحصيل اليوم',
                                  '${AppIdentity.grouped(total)} ₪',
                                  note: AppIdentity.paymentsCount(today.length),
                                  linked: true)))),
                if (!canRead && !canCollect)
                  Expanded(
                      child: heroStat('الفرع',
                          '${widget.user['branch_name'] ?? 'جميع الفروع'}',
                          size: 18)),
              ]),
            ]),
          ),
          if (canRead &&
              readingScheduleMessage(widget.store.state, TrustedClock.now()) !=
                  null)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child: AppNotice(
                    readingScheduleMessage(widget.store.state, TrustedClock.now())!,
                    warning: !readingEntryIsOpen(
                        widget.store.state, TrustedClock.now()))),
          if (queued.isNotEmpty)
            AppStrip(
                key: const ValueKey('home-pending'),
                icon: rejected ? 'err' : 'clock',
                tone: rejected ? AppTone.bad : AppTone.warning,
                text:
                    '${AppIdentity.readingsCount(queued.length)} بانتظار المزامنة',
                action: 'عرض',
                onTap: () => navigate(FieldSection.sync)),
          if (canRead && drafts > 0)
            AppStrip(
                icon: 'note',
                tone: AppTone.brand,
                text: '${AppIdentity.readingsCount(drafts)} مكتوبة ولم تُحفظ',
                action: 'متابعة',
                onTap: () => navigate(FieldSection.readings)),
          if (hasTasks) const AppSection('مهامك'),
          if (canRead)
            AppServiceCard(
                title: 'إدخال القراءات',
                subtitle: 'قراءات عدادات الطبلونات',
                summary: subscribers.isEmpty &&
                        widget.store.state['next_reading'] != null
                    ? '${((widget.store.state['next_reading'] as Map)['boxes'] as List? ?? []).length} طبلون موزع إليك'
                    : 'قُرئت $done من ${subscribers.length}',
                icon: 'bolt',
                color: AppIdentity.brand,
                tint: AppIdentity.brandSoft,
                onTap: () => navigate(FieldSection.readings)),
          if (canBrowseSubscribers) subscribersService(),
          if (canViewOwnBoxes)
            AppServiceCard(
                key: const ValueKey('collector-cash-boxes-service'),
                title: 'صندوقي',
                subtitle: ownBoxTypes.length == 1
                    ? 'صندوقك المفتوح ودفعاته'
                    : 'صناديقك المفتوحة ودفعاتها حسب النوع',
                summary: cashBoxTypesSummary(ownBoxTypes),
                icon: 'box',
                color: AppIdentity.info,
                tint: AppIdentity.infoTint,
                onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                        builder: (_) => CashBoxesPage(
                            api: widget.api, types: ownBoxTypes)))),
          if (tools.isNotEmpty) ...[
            AppSection(hasTasks ? 'أدوات أخرى' : 'خدماتك'),
            ...tools,
          ],
          if (!hasTasks && tools.isEmpty)
            const AppNotice(
                'لا توجد خدمات مفعّلة لحسابك. تواصل مع الإدارة لمنحك الصلاحيات.'),
        ]));
  }

  /// The subscribers card. Every payment, split transfer and statement starts
  /// from one subscriber, so its search box is the single way into them.
  Widget subscribersService() {
    final (title, subtitle, icon, color, tint) = canCollect
        ? (
            'تسجيل الدفعات',
            'ابحث عن المشترك ثم اختر العملية',
            collectionIcon,
            AppIdentity.good,
            AppIdentity.goodTint
          )
        : (
            canViewSubscriptions ? 'كشوف حساب المشتركين' : 'حركات المشتركين',
            'الدفعات والقراءات والحركات المالية',
            'hist',
            AppIdentity.info,
            AppIdentity.infoTint
          );
    final hint = !canCollect
        ? 'كشف الحساب من صفحة المشترك'
        : canRecordSplitPayments
            ? 'الدفعة والحوالة المقسّمة وكشف الحساب من صفحة المشترك'
            : 'الدفعة وكشف الحساب من صفحة المشترك';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        key: ValueKey(canCollect
            ? 'collector-collections-service'
            : 'subscriber-statements-service'),
        decoration: AppIdentity.card(),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(22),
            onTap: () => navigate(FieldSection.collections),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(children: [
                      AppIconTile(icon, color, tint, size: 52, iconSize: 24),
                      const SizedBox(width: 14),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(title,
                                style: AppIdentity.body(16,
                                    weight: FontWeight.w700)),
                            Text(subtitle,
                                style: AppIdentity.body(12.5,
                                    color: AppIdentity.faint)),
                          ])),
                      const SizedBox(width: 8),
                      AppIcon('chev', size: 18, color: AppIdentity.faint),
                    ]),
                    const SizedBox(height: 12),
                    InkWell(
                      key: const ValueKey('home-subscriber-search'),
                      borderRadius: BorderRadius.circular(15),
                      onTap: () =>
                          navigate(FieldSection.collections, focusSearch: true),
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 48),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                            color: AppIdentity.raised,
                            border:
                                Border.all(color: AppIdentity.line, width: 1.5),
                            borderRadius: BorderRadius.circular(15)),
                        child: Row(children: [
                          AppIcon('search', color: AppIdentity.faint),
                          const SizedBox(width: 8),
                          Expanded(
                              child: Text('الاسم أو رقم الحساب أو الطبلون',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppIdentity.body(14.5,
                                      color: AppIdentity.faint))),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(hint,
                        style: AppIdentity.body(12, color: AppIdentity.faint)),
                  ]),
            ),
          ),
        ),
      ),
    );
  }

  Widget heroStat(String label, String value,
          {String? note, double size = 23, bool linked = false}) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: AppIdentity.body(12.5, color: AppIdentity.heroFaint)),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(value,
                      textDirection: TextDirection.ltr,
                      style: AppIdentity.number(size,
                          weight: FontWeight.w800, color: Colors.white)))),
        ),
        if (note != null)
          Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(children: [
                Flexible(
                    child: Text(note,
                        style: AppIdentity.body(12.5,
                            color: linked
                                ? AppIdentity.heroGood
                                : AppIdentity.heroFaint))),
                if (linked) ...[
                  const SizedBox(width: 2),
                  AppIcon('chev', size: 14, color: AppIdentity.heroGood),
                ],
              ])),
      ]);
}
