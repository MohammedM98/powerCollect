part of 'reading_flow.dart';

/// One box: its readings, each row's cells and comparison, the save bar and the finished view.
extension _BoxView on _ReadingFlowState {
  Widget _boxView() {
    final subscribers =
        boxKey == null ? <Map<String, dynamic>>[] : _inBox(boxKey!);
    if (subscribers.isEmpty) {
      return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            AppRows(children: const [
              AppEmpty('bolt', 'الطبلون غير متاح', 'ارجع إلى قائمة الطبلونات.')
            ])
          ]);
    }
    final done = subscribers.where(_done).length;
    final ready = subscribers.where(_ready).length;
    return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        children: [
          AppPanel(
            child: Column(children: [
              Row(children: [
                Expanded(
                    child: Text('قُرئت $done من ${subscribers.length}',
                        style: _body(14, weight: FontWeight.w700))),
                if (ready > 0)
                  Flexible(
                    child: AppTag(
                        '${AppIdentity.readingsCount(ready)} جاهزة للحفظ',
                        AppTone.brand),
                  ),
              ]),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Row(children: [
                  if (done > 0)
                    Expanded(
                        flex: done, child: Container(height: 8, color: _good)),
                  if (ready > 0)
                    Expanded(
                        flex: ready,
                        child: Container(height: 8, color: _brand)),
                  Expanded(
                      flex: subscribers.length - done - ready == 0
                          ? 0
                          : subscribers.length - done - ready,
                      child: Container(height: 8, color: _sunken)),
                ]),
              ),
            ]),
          ),
          const SizedBox(height: 12),
          AppRows(children: [
            for (var index = 0; index < subscribers.length; index++)
              _readingRow(subscribers[index], index),
          ]),
          const SizedBox(height: 12),
          if (saveError != null)
            AppNotice(saveError!, error: true)
          else
            const AppNotice(
                'اضغط على المشترك لإدخال قراءته. بعد الحفظ راجع القراءات من صفحة الإرسال، ثم أكّد رفعها.'),
        ]);
  }

  String? _consumptionText(Map<String, dynamic> subscriber, double? value) {
    if (value == null || value < _previous(subscriber)) return null;
    return AppIdentity.reading(
        ((value - _previous(subscriber)) * 100).round() / 100);
  }

  Widget _readingRow(Map<String, dynamic> subscriber, int index) {
    final id = subscriber['id'] as int;
    final selected = selectedId == id && keypadOpen;
    final queued = _queued(subscriber);
    final finished = _done(subscriber);
    final draft = drafts[id];
    final value = double.tryParse(draft ?? '');
    final previous = _previous(subscriber);
    final low = value != null && value < previous;
    final lastWeek = _history(subscriber).firstOrNull;
    final shownReading =
        queued?['current_reading'] ?? subscriber['current_reading'];
    final rejected = queued?['sync_error'] != null;
    final verdict = _verdict(subscriber, value);
    final Widget? caret = selected ? const AppCaret() : null;

    Widget cell;
    if (!finished && draft != null && draft.isNotEmpty) {
      cell = _cell(
          top: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(draft, textDirection: TextDirection.ltr, style: _number(18)),
            if (caret != null) caret,
          ]),
          bottom: low
              ? 'أقل من السابقة'
              : '${_consumptionText(subscriber, value)} ك.و.س',
          bottomColor: verdict?.color ?? _good,
          background: selected ? _surface : _raised,
          border: low
              ? _bad
              : selected
                  ? _brand
                  : _line,
          glow: selected);
    } else if (finished) {
      cell = _cell(
          top: Text(AppIdentity.reading(shownReading),
              textDirection: TextDirection.ltr, style: _number(18)),
          bottom: queued == null
              ? subscriber['reading_status'] == 'approved'
                  ? 'معتمدة'
                  : 'قيد المراجعة'
              : rejected
                  ? 'تعذر الإرسال'
                  : 'على الجهاز',
          bottomColor: rejected ? _bad : _good,
          background: rejected ? AppIdentity.badTint : AppIdentity.goodTint,
          border: Colors.transparent);
    } else {
      cell = _cell(
          top: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(selected ? 'اكتب القراءة' : 'اضغط للإدخال',
                style: _body(13, color: selected ? _brand : _faint)),
            if (caret != null) caret,
          ]),
          background: selected ? _surface : _raised,
          border: selected ? _brand : _line,
          glow: selected);
    }
    return InkWell(
      key: rowKeys.putIfAbsent(id, GlobalKey.new),
      onTap: () => _select(subscriber),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppIdentity.brandSoft : Colors.transparent,
          border: BorderDirectional(
              start: selected
                  ? BorderSide(color: _brand, width: 3)
                  : BorderSide.none),
        ),
        child: Row(children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: selected
                    ? _brand
                    : finished
                        ? AppIdentity.goodTint
                        : _sunken,
                borderRadius: BorderRadius.circular(10)),
            child: finished && !selected
                ? AppIcon('check', size: 16, color: _good)
                : Text('${index + 1}',
                    style: _number(13, color: selected ? Colors.white : _ink)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${subscriber['full_name']}',
                  style: _body(15, weight: FontWeight.w700),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
              Text(
                  [
                    'السابقة ${AppIdentity.reading(subscriber['previous_reading'])}',
                    if (lastWeek?['consumption'] != null)
                      'الأسبوع الماضي ${AppIdentity.reading(lastWeek!['consumption'])}',
                  ].join(' · '),
                  style: _body(12, color: _faint),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
            ]),
          ),
          const SizedBox(width: 10),
          cell,
        ]),
      ),
    );
  }

  Widget _cell(
          {required Widget top,
          String? bottom,
          Color? bottomColor,
          required Color background,
          required Color border,
          bool glow = false}) =>
      Container(
        width: 116,
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: background,
          border: Border.all(color: border, width: 1.5),
          borderRadius: BorderRadius.circular(15),
          boxShadow: glow
              ? [
                  BoxShadow(
                      color: _brand.withValues(alpha: .12), spreadRadius: 3)
                ]
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child:
                Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              top,
              if (bottom != null)
                Text(bottom,
                    maxLines: 1,
                    style: _body(11,
                        weight: FontWeight.w700, color: bottomColor ?? _faint)),
            ]),
          ),
        ),
      );

  /// The chosen subscriber's previous and new reading side by side, shown
  /// above the keypad while typing.
  Widget _comparePanel(Map<String, dynamic> subscriber) {
    final draft = drafts[subscriber['id']];
    final value = double.tryParse(draft ?? '');
    final verdict = _verdict(subscriber, value);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      decoration: BoxDecoration(
          color: _surface,
          border: Border(top: BorderSide(color: _lineSoft)),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0D101828), blurRadius: 16, offset: Offset(0, -6))
          ]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Text('${subscriber['full_name']}',
                style: _body(15, weight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ),
          if (verdict != null) ...[
            const SizedBox(width: 8),
            AppIcon(verdict.icon, size: 15, color: verdict.color),
            const SizedBox(width: 4),
            Flexible(
              child: Text(verdict.text,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _body(12.5,
                      weight: FontWeight.w700, color: verdict.color)),
            ),
          ],
        ]),
        const SizedBox(height: 9),
        AppReadingCompare(
          previous: AppIdentity.reading(subscriber['previous_reading']),
          current: draft == null || draft.isEmpty ? null : draft,
          currentHint: 'اكتب',
          consumption: _consumptionText(subscriber, value),
          alert: verdict?.color == _good ? null : verdict?.color,
          highlightCurrent: true,
        ),
      ]),
    );
  }

  Widget _saveBar() {
    final count = boxKey == null ? 0 : _inBox(boxKey!).where(_ready).length;
    final label = count == 0
        ? 'اكتب القراءات أولًا'
        : count == 1
            ? 'حفظ قراءة واحدة على الجهاز'
            : count == 2
                ? 'حفظ قراءتين على الجهاز'
                : 'حفظ $count قراءات على الجهاز';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
          color: _background,
          border: Border(top: BorderSide(color: _lineSoft))),
      child: AppAction(
          label: label,
          onPressed: count == 0 || saving ? null : _save,
          busy: saving,
          icon: 'check'),
    );
  }

  MapEntry<String, List<Map<String, dynamic>>>? _nextUnfinishedBox() =>
      _groups()
          .entries
          .where((entry) => entry.value.any(_editable))
          .firstOrNull;

  Widget _doneView() {
    final pending = widget.store.queuedReadings
        .where((reading) =>
            savedOperationIds.contains(reading['mobile_operation_id']))
        .toList();
    final rejected = pending.any((reading) => reading['sync_error'] != null);
    final description = rejected
        ? 'حُفظت القراءات على الجهاز. تحقّق من حالة الإرسال لمعالجة القراءة المرفوضة.'
        : pending.isNotEmpty
            ? 'حُفظت على الجهاز. راجع القراءات واختر ما تريد رفعه، ثم أكّد الرفع أثناء الاتصال بالإنترنت.'
            : 'وصلت إلى النظام الأساسي بحالة «قيد المراجعة» بانتظار المدقق.';
    final next = _nextUnfinishedBox();
    return AppSuccess(
      title: 'تم حفظ القراءات',
      message: description,
      facts: [
        ('الطبلون', AppFact(savedBox, number: true)),
        ('عدد القراءات', AppFact('$savedCount', number: true)),
        (
          'الحالة',
          rejected
              ? const AppFact('تعذر الإرسال')
              : pending.isNotEmpty
                  ? const AppTag('بانتظار الإرسال', AppTone.warning)
                  : const AppTag('قيد المراجعة', AppTone.warning)
        ),
      ],
      actions: [
        if (pending.isNotEmpty)
          AppAction(
              label: 'مراجعة القراءات ورفعها',
              icon: 'cloud',
              onPressed: widget.onSync),
        if (next != null)
          AppAction(
              label: 'الطبلون التالي: ${_boxNumber(next.value.first)}',
              onPressed: () => _openBox(next.key),
              icon: 'arrow'),
        AppAction(
            label: 'العودة إلى الطبلونات',
            primary: next == null,
            onPressed: _back),
      ],
    );
  }
}
