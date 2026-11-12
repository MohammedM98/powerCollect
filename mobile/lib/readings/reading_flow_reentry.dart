part of 'reading_flow.dart';

/// Asking whether to enter a queued reading again, and doing it.
extension _ReadingReentry on _ReadingFlowState {
  Future<void> _askToReenter(
      Map<String, dynamic> reading, Map<String, dynamic> subscriber) async {
    if (!_entryOpen || reading['upload_uncertain'] == true) {
      showAppToast(
          context,
          reading['upload_uncertain'] == true
              ? 'نتيجة الرفع غير مؤكدة. أعد رفع نفس القراءة أولًا لتجنب التكرار.'
              : 'تعديل القراءة متاح يوم القراءة فقط.',
          icon: 'info');
      return;
    }
    final reenter = await showAppSheet<bool>(context,
        title: '${subscriber['full_name']}',
        message: reading['sync_error'] == null
            ? 'القراءة محفوظة على الجهاز ولم تُرسل بعد، ويمكنك تعديلها.'
            : 'رفض الخادم هذه القراءة: ${reading['sync_error']}',
        children: [
          AppReadingCompare(
              previous: AppIdentity.reading(subscriber['previous_reading']),
              current: AppIdentity.reading(reading['current_reading']),
              highlightCurrent: true,
              consumption: _consumptionText(subscriber,
                  double.tryParse('${reading['current_reading']}'))),
          const SizedBox(height: 16),
          Builder(
              builder: (context) => AppAction(
                  label: 'إعادة إدخال القراءة',
                  icon: 'edit',
                  onPressed: () => Navigator.pop(context, true))),
          const SizedBox(height: 8),
          Builder(
              builder: (context) => AppAction(
                  label: 'إبقاؤها كما هي',
                  primary: false,
                  onPressed: () => Navigator.pop(context, false))),
        ]);
    if (reenter == true) await _reenter(reading);
  }

  Future<void> _reenter(Map<String, dynamic> reading) async {
    if (widget.syncing || !_entryOpen || reading['upload_uncertain'] == true) {
      showAppToast(context, 'جارٍ الإرسال الآن. أعد المحاولة بعد لحظات.',
          icon: 'clock');
      return;
    }
    await widget.store.reopenReading(reading['mobile_operation_id'] as String);
    if (!mounted) return;
    final subscriber = widget.store.subscribers
        .where((item) => item['id'] == reading['subscription_id'])
        .firstOrNull;
    change(() {
      drafts[reading['subscription_id'] as int] =
          '${reading['current_reading']}';
      if (subscriber != null) {
        boxKey = _boxKey(subscriber);
        selectedId = subscriber['id'] as int;
        keypadOpen = _editable(subscriber);
      }
    });
    _setView(subscriber == null ? 'boxes' : 'box');
    _revealSelected();
  }
}
