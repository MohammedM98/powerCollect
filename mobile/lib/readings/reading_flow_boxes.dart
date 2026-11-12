part of 'reading_flow.dart';

/// The list of boxes: the header, progress, the resume card and the boxes still to download.
extension _BoxesView on _ReadingFlowState {
  Widget _header() {
    final subscribers =
        boxKey == null ? <Map<String, dynamic>>[] : _inBox(boxKey!);
    final preview = _previewBox;
    final first = preview == null
        ? subscribers.firstOrNull
        : {
            'meter_box_number': preview['number'],
            'meter_box_name': preview['name'],
            'sub_area_name': preview['sub_area_name'],
            'meter_box_location': preview['location'],
          };
    final weekStart = widget.store.state['week_start'];
    final weekEnd = widget.store.state['week_end'];
    final boxView = view == 'box' || view == 'preview';
    return AppHeader(
        title: boxView
            ? 'طبلون ${first == null ? '—' : _boxNumber(first)}'
            : 'إدخال القراءات',
        subtitle: boxView
            ? [
                '${first?['meter_box_name'] ?? 'الطبلون'}',
                if (first?['sub_area_name'] != null)
                  '${first?['sub_area_name']}',
                if ('${first?['meter_box_location'] ?? ''}'.isNotEmpty)
                  '${first?['meter_box_location']}',
              ].join(' · ')
            : weekStart == null
                ? 'اختر طبلونًا أو ابحث'
                : 'أسبوع ${AppIdentity.shortDate(weekStart)} – ${AppIdentity.shortDate(weekEnd)}',
        onBack: view == 'boxes' ? null : _back,
        onSync: widget.onSync,
        online: widget.online,
        syncing: widget.syncing,
        pending: widget.store.queuedReadings.length);
  }

  Widget _refreshable(Widget list) => widget.onRefresh == null
      ? list
      : RefreshIndicator(
          color: _brand, onRefresh: widget.onRefresh!, child: list);

  Widget _boxesView() {
    final groups = _groups();
    final previews =
        ((widget.store.state['next_reading'] as Map?)?['boxes'] as List? ?? [])
            .map((item) => Map<String, dynamic>.from(item as Map))
            .where((box) => !groups.containsKey('${box['id']}'))
            .toList();
    final query = search.text.trim();
    final areas = <String, String>{
      for (final box in previews)
        '${box['sub_area_id'] ?? 'none'}':
            '${box['sub_area_name'] ?? 'بدون منطقة 2'}',
      for (final subscriber in widget.store.subscribers)
        '${subscriber['sub_area_id'] ?? 'none'}':
            '${subscriber['sub_area_name'] ?? 'بدون منطقة 2'}'
    };
    bool inArea(Map<String, dynamic> subscriber) =>
        subArea == null || '${subscriber['sub_area_id'] ?? 'none'}' == subArea;
    bool complete(List<Map<String, dynamic>> subscribers) =>
        subscribers.where(_done).length == subscribers.length;
    final matchingPreviews = previews
        .where((box) =>
            inArea(box) &&
            (query.isNotEmpty || filter != 'done') &&
            matchesSearch(query, [
              box['number'],
              box['name'],
              box['location'],
              box['sub_area_name']
            ]))
        .toList();
    final matchingBoxes = groups.entries.where((entry) {
      if (!inArea(entry.value.first)) return false;
      if (query.isEmpty && filter == 'remaining' && complete(entry.value)) {
        return false;
      }
      if (query.isEmpty && filter == 'done' && !complete(entry.value)) {
        return false;
      }
      final first = entry.value.first;
      return matchesSearch(query, [
        _boxNumber(first),
        first['meter_box_name'],
        first['meter_box_location'],
        first['sub_area_name'],
      ]);
    }).toList();
    final matchingSubscribers = widget.store.subscribers.where((subscriber) {
      if (query.isEmpty || !inArea(subscriber)) return false;
      return matchesSearch(
          query, [subscriber['full_name'], subscriber['account_number']]);
    }).toList();
    final total = widget.store.subscribers.length;
    final done = widget.store.subscribers.where(_done).length;
    final draftBox = groups.entries
        .where((entry) => entry.value.any(
            (subscriber) => _editable(subscriber) && _hasDraft(subscriber)))
        .firstOrNull;
    int countFor(String value) =>
        groups.values
            .where((subscribers) =>
                value == 'all' ||
                (value == 'done'
                    ? complete(subscribers)
                    : !complete(subscribers)))
            .length +
        (value == 'done' ? 0 : previews.length);
    return _refreshable(ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        children: [
          if (TrustedClock.isOff)
            Padding(
                key: const ValueKey('reading-clock-warning'),
                padding: const EdgeInsets.only(bottom: 12),
                child: AppNotice(
                    'ساعة الهاتف تختلف عن وقت الخادم بنحو ${TrustedClock.describeOffset()}. صحّح التاريخ والوقت في إعدادات الهاتف؛ تُسجَّل القراءات بوقت الخادم.',
                    warning: true,
                    icon: 'err')),
          if (readingScheduleMessage(widget.store.state, TrustedClock.now()) !=
              null)
            Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AppNotice(
                    readingScheduleMessage(widget.store.state, TrustedClock.now())!,
                    warning: !_entryOpen)),
          if (query.isEmpty && total > 0) _progressCard(done, total),
          if (query.isEmpty && draftBox != null)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child: _resumeCard(draftBox.key, draftBox.value)),
          const SizedBox(height: 12),
          AppSearchField(
              key: const ValueKey('reading-box-search'),
              controller: search,
              hint: 'منطقة 2 أو الطبلون أو المشترك',
              onChanged: (_) => change(() {}),
              onClear: () => change(search.clear)),
          if (areas.isNotEmpty)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Wrap(spacing: 6, runSpacing: 6, children: [
                  AppChip('كل المناطق',
                      selected: subArea == null,
                      onTap: () => change(() => subArea = null)),
                  for (final area in areas.entries)
                    AppChip(area.value,
                        selected: subArea == area.key,
                        onTap: () => change(() => subArea = area.key)),
                ])),
          AppSection(query.isEmpty ? 'الطبلونات الموزعة إليك' : 'نتائج البحث',
              note: query.isEmpty
                  ? null
                  : '${matchingBoxes.length + matchingSubscribers.length + matchingPreviews.length} نتيجة'),
          if (query.isEmpty && (total > 0 || previews.isNotEmpty))
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Wrap(spacing: 6, runSpacing: 6, children: [
                for (final (value, label) in [
                  ('all', 'الكل'),
                  ('remaining', 'المتبقية'),
                  ('done', 'المكتملة'),
                ])
                  AppChip(label,
                      count: countFor(value),
                      selected: filter == value,
                      onTap: () => change(() => filter = value)),
              ]),
            ),
          if (total == 0 && previews.isEmpty)
            AppRows(children: const [
              AppEmpty('down', 'لا توجد طبلونات موزعة إليك حاليًا',
                  'تظهر الطبلونات بعد اعتماد توزيعها. اسحب للتحديث.')
            ]),
          if ((total > 0 || previews.isNotEmpty) &&
              matchingBoxes.isEmpty &&
              matchingSubscribers.isEmpty &&
              matchingPreviews.isEmpty)
            AppRows(children: [
              query.isEmpty
                  ? AppEmpty(
                      filter == 'remaining' ? 'check' : 'bolt',
                      filter == 'remaining'
                          ? 'قُرئت كل الطبلونات'
                          : 'لا توجد طبلونات مكتملة بعد',
                      filter == 'remaining'
                          ? 'أحسنت! لا يوجد ما تبقّى لهذا الأسبوع.'
                          : 'تظهر هنا الطبلونات بعد قراءة كل مشتركيها.',
                      good: filter == 'remaining')
                  : AppEmpty(
                      'search',
                      'لا توجد نتائج لـ «${search.text.trim()}»',
                      'جرّب رقم الطبلون أو جزءًا من الاسم.'),
            ]),
          if (matchingBoxes.isNotEmpty ||
              matchingSubscribers.isNotEmpty ||
              matchingPreviews.isNotEmpty)
            AppRows(children: [
              for (final box in matchingPreviews) _previewBoxRow(box),
              for (final entry in matchingBoxes)
                _boxRow(entry.key, entry.value),
              for (final subscriber in matchingSubscribers)
                _subscriberResult(subscriber),
            ]),
          if (!_entryOpen &&
              readingScheduleMessage(widget.store.state, TrustedClock.now()) ==
                  null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: const AppNotice(
                  'إدخال قراءات هذا الأسبوع غير متاح حاليًا.',
                  warning: true),
            ),
        ]));
  }

  Widget _progressCard(int done, int total) {
    final pending = widget.store.queuedReadings.length;
    final ratio = total == 0 ? 0.0 : done / total;
    return AppHero(
      padding: const EdgeInsets.all(16),
      child: Row(children: [
        AppRing(ratio),
        const SizedBox(width: 16),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('قُرئت هذا الأسبوع',
                style: _body(12.5, color: AppIdentity.heroFaint)),
            Padding(
                padding: const EdgeInsets.only(top: 2, bottom: 4),
                child: Text('$done من $total',
                    style: _number(23, color: Colors.white))),
            Text(
                pending == 0
                    ? 'كل القراءات أُرسلت'
                    : '${AppIdentity.readingsCount(pending)} بانتظار الإرسال',
                style: _body(12.5,
                    weight: FontWeight.w600,
                    color: pending == 0
                        ? AppIdentity.heroGood
                        : AppIdentity.heroWarn)),
          ]),
        ),
      ]),
    );
  }

  Widget _resumeCard(String key, List<Map<String, dynamic>> subscribers) {
    final count = subscribers
        .where((subscriber) => _editable(subscriber) && _hasDraft(subscriber))
        .length;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Material(
        color: AppIdentity.brandSoft,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          key: const ValueKey('resume-drafts'),
          borderRadius: BorderRadius.circular(20),
          onTap: () => _openBox(key),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              AppIcon('note', size: 26, color: _brand),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('أكمل من حيث توقفت',
                          style: _body(15, weight: FontWeight.w700)),
                      Text(
                          '${AppIdentity.readingsCount(count)} لم تُحفظ بعد في طبلون ${_boxNumber(subscribers.first)}',
                          style: _body(12.5, color: _muted)),
                    ]),
              ),
              AppIcon('chev', size: 20, color: _brand),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _previewBoxRow(Map<String, dynamic> box) => AppRow(
      key: ValueKey('preview-box-${box['id']}'),
      leading: _boxBadge('${box['number']}', complete: false),
      title: AppRowTitle('${box['name']} (${box['number']})'),
      subtitle: AppRowNote([
        '${box['sub_area_name'] ?? 'بدون منطقة 2'}',
        '${box['subscribers']} مشترك',
      ].join(' · ')),
      trailing: const AppTag('عرض فقط', AppTone.muted),
      onTap: () {
        previewBoxId = '${box['id']}';
        _setView('preview');
      });

  Map<String, dynamic>? get _previewBox =>
      ((widget.store.state['next_reading'] as Map?)?['boxes'] as List? ?? [])
          .map((box) => Map<String, dynamic>.from(box as Map))
          .where((box) => '${box['id']}' == previewBoxId)
          .firstOrNull;

  Widget _previewBoxView() {
    final subscriptions =
        (_previewBox?['subscriptions'] as List? ?? []).cast<Map>();
    return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          AppNotice(readingScheduleMessage(
                  widget.store.state, TrustedClock.now()) ??
              'المشتركون للعرض فقط. الإدخال متاح يوم القراءة بعد تحديث الطبلونات.'),
          const SizedBox(height: 12),
          AppRows(children: [
            if (subscriptions.isEmpty)
              const AppEmpty('bolt', 'بيانات المشتركين غير متاحة حاليًا',
                  'اتصل بالإنترنت واسحب للتحديث.'),
            for (final subscription in subscriptions)
              AppRow(
                key: ValueKey('preview-subscriber-${subscription['id']}'),
                title: AppRowTitle('${subscription['name']}'),
                subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppRowNote('حساب ${subscription['account_number']}'),
                      if (subscription['phone'] != null)
                        AppRowNote('${subscription['phone']}'),
                    ]),
                trailing: const AppTag('عرض فقط', AppTone.muted),
              ),
          ]),
        ]);
  }
}
