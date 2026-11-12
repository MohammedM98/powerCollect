part of 'reading_flow.dart';

/// The roster as the flow reads it: boxes, readings saved or queued, history and what can be edited.
extension _ReadingData on _ReadingFlowState {
  String _boxKey(Map<String, dynamic> subscriber) =>
      '${subscriber['meter_box_id'] ?? subscriber['meter_box_number'] ?? 'none'}';

  String _boxNumber(Map<String, dynamic> subscriber) =>
      '${subscriber['meter_box_number'] ?? '—'}';

  List<Map<String, dynamic>> _inBox(String key) => widget.store.subscribers
      .where((subscriber) => _boxKey(subscriber) == key)
      .toList();

  Map<String, List<Map<String, dynamic>>> _groups() {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final subscriber in widget.store.subscribers) {
      groups.putIfAbsent(_boxKey(subscriber), () => []).add(subscriber);
    }
    return groups;
  }

  Map<String, dynamic>? _queued(Map<String, dynamic> subscriber) {
    for (final reading in widget.store.queuedReadings) {
      if (reading['subscription_id'] == subscriber['id'] &&
          reading['week_start'] == widget.store.state['week_start']) {
        return reading;
      }
    }
    return null;
  }

  bool _done(Map<String, dynamic> subscriber) =>
      subscriber['reading_status'] != null || _queued(subscriber) != null;

  bool get _entryOpen => readingEntryIsOpen(widget.store.state, TrustedClock.now());

  bool _editable(Map<String, dynamic> subscriber) =>
      _entryOpen && !_done(subscriber);

  bool _hasDraft(Map<String, dynamic> subscriber) =>
      (drafts[subscriber['id']] ?? '').isNotEmpty;

  double _previous(Map<String, dynamic> subscriber) =>
      double.tryParse('${subscriber['previous_reading'] ?? 0}') ?? 0;

  /// The subscriber's last weeks, newest first, as the server sent them.
  List<Map<String, dynamic>> _history(Map<String, dynamic> subscriber) =>
      (subscriber['recent_readings'] as List? ?? [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();

  /// Their usual weekly consumption, from the weeks the server sent.
  double? _usual(Map<String, dynamic> subscriber) {
    final weeks = _history(subscriber)
        .map((week) => double.tryParse('${week['consumption']}'))
        .whereType<double>()
        .toList();
    if (weeks.isEmpty) return null;
    return weeks.reduce((sum, week) => sum + week) / weeks.length;
  }

  _Verdict? _verdict(Map<String, dynamic> subscriber, double? value) {
    if (value == null) return null;
    final input = drafts[subscriber['id']] ?? '';
    if (input.contains('.') && input.split('.').last.length > 2) {
      return (
        text: 'القراءة تقبل منزلتين عشريتين كحد أقصى.',
        color: _bad,
        icon: 'err'
      );
    }
    final previous = _previous(subscriber);
    if (value < previous) {
      return (
        text: 'أقل من السابقة (${AppIdentity.reading(previous)})',
        color: _bad,
        icon: 'err',
      );
    }
    final usual = _usual(subscriber);
    if (usual == null || usual <= 0) return null;
    final consumption = value - previous;
    if (consumption > usual * 2 && consumption - usual >= 10) {
      return (
        text:
            'أعلى من المعتاد بكثير (${(consumption / usual).toStringAsFixed(1)}×)',
        color: _warning,
        icon: 'up',
      );
    }
    if (consumption == 0) {
      return (
        text: 'لا استهلاك هذا الأسبوع، تأكّد من العداد',
        color: _warning,
        icon: 'info',
      );
    }
    return (
      text: 'ضمن المعتاد',
      color: _good,
      icon: 'check',
    );
  }

  bool _ready(Map<String, dynamic> subscriber) {
    if (!_editable(subscriber)) return false;
    final input = drafts[subscriber['id']] ?? '';
    if (input.contains('.') && input.split('.').last.length > 2) return false;
    final value = double.tryParse(drafts[subscriber['id']] ?? '');
    return value != null && value >= _previous(subscriber);
  }
}
