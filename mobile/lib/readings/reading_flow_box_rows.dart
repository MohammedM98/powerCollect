part of 'reading_flow.dart';

/// A box's row in the list, its badge and the subscriber search results.
extension _BoxRows on _ReadingFlowState {
  Widget _boxRow(String key, List<Map<String, dynamic>> subscribers) {
    final first = subscribers.first;
    final done = subscribers.where(_done).length;
    final complete = done == subscribers.length;
    final drafted = subscribers
        .where((subscriber) => _editable(subscriber) && _hasDraft(subscriber))
        .length;
    final number = _boxNumber(first);
    final location = '${first['meter_box_location'] ?? ''}';
    return AppRow(
      key: ValueKey('box-$number'),
      onTap: () => _openBox(key),
      leading: _boxBadge(number, complete: complete),
      title: Text.rich(
          TextSpan(children: [
            TextSpan(text: '${first['meter_box_name'] ?? 'طبلون $number'} '),
            TextSpan(
                text: '($number)',
                style: _number(12.5, color: _faint)
                    .copyWith(fontWeight: FontWeight.w600)),
          ]),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: _body(15, weight: FontWeight.w700)),
      subtitle: Row(children: [
        Flexible(
          child: Text(
              [
                if (first['sub_area_name'] != null) '${first['sub_area_name']}',
                if (location.isNotEmpty) location,
                '${subscribers.length} مشترك'
              ].join(' · '),
              style: _body(12.5, color: _faint),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ),
        if (drafted > 0) ...[
          const SizedBox(width: 4),
          AppTag('مسودة $drafted', AppTone.brand),
        ],
      ]),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        if (!_entryOpen)
          const AppTag('عرض فقط', AppTone.muted)
        else if (complete)
          const AppTag('مكتمل', AppTone.good)
        else
          SizedBox(
            width: 74,
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('$done من ${subscribers.length}',
                      style: AppIdentity.number(13.5)),
                  const SizedBox(height: 5),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: done / subscribers.length,
                      minHeight: 6,
                      backgroundColor: _sunken,
                      color: _good,
                    ),
                  ),
                ]),
          ),
        const SizedBox(width: 12),
        AppIcon('chev', size: 18, color: _faint),
      ]),
    );
  }

  Widget _boxBadge(String number, {bool complete = false}) => Container(
        width: 50,
        height: 50,
        alignment: Alignment.center,
        decoration: BoxDecoration(
            color: complete ? _good : const Color(0xFF262C34),
            borderRadius: BorderRadius.circular(16)),
        child: complete
            ? const AppIcon('check', color: Colors.white)
            : Padding(
                padding: const EdgeInsets.all(4),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                      number.replaceFirst(
                          RegExp(r'^(BOX|N)-', caseSensitive: false), ''),
                      maxLines: 1,
                      softWrap: false,
                      style: _number(14, color: Colors.white)),
                ),
              ),
      );

  Widget _subscriberResult(Map<String, dynamic> subscriber) => AppRow(
        onTap: () =>
            _openBox(_boxKey(subscriber), focusId: subscriber['id'] as int),
        leading: AppAvatar('${subscriber['full_name']}'),
        title: AppRowTitle('${subscriber['full_name']}'),
        subtitle: AppRowNote(
            'طبلون ${_boxNumber(subscriber)} · السابقة ${AppIdentity.reading(subscriber['previous_reading'])}'),
        trailing: _statusTag(subscriber),
      );

  Widget _statusTag(Map<String, dynamic> subscriber) {
    final queued = _queued(subscriber);
    if (queued != null) {
      return queued['sync_error'] == null
          ? const AppTag('على الجهاز', AppTone.warning)
          : const AppTag('تعذر الإرسال', AppTone.bad);
    }
    return switch (subscriber['reading_status']) {
      'approved' => const AppTag('معتمدة', AppTone.good),
      'pending' => const AppTag('قيد المراجعة', AppTone.warning),
      'needs_review' => const AppTag('تحتاج مراجعة', AppTone.warning),
      _ => _hasDraft(subscriber)
          ? const AppTag('مسودة', AppTone.brand)
          : const AppTag('لم تُقرأ', AppTone.muted),
    };
  }
}
