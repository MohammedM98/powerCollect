import 'dart:async';

import 'package:flutter/material.dart';

import '../design/app_identity.dart';
import '../core/field_store.dart';
import 'reading_assignments.dart';
import '../core/search_text.dart';
import '../core/trusted_clock.dart';
import '../core/diagnostics.dart';

part 'reading_flow_data.dart';
part 'reading_flow_reentry.dart';
part 'reading_flow_boxes.dart';
part 'reading_flow_box_rows.dart';
part 'reading_flow_box.dart';

Color get _background => AppIdentity.background;
Color get _surface => AppIdentity.surface;
Color get _raised => AppIdentity.raised;
Color get _sunken => AppIdentity.sunken;
Color get _line => AppIdentity.line;
Color get _lineSoft => AppIdentity.lineSoft;
Color get _ink => AppIdentity.ink;
Color get _muted => AppIdentity.muted;
Color get _faint => AppIdentity.faint;
Color get _brand => AppIdentity.brand;
Color get _good => AppIdentity.good;
Color get _warning => AppIdentity.warning;
Color get _bad => AppIdentity.bad;
TextStyle _body(double size,
        {FontWeight weight = FontWeight.normal, Color? color}) =>
    AppIdentity.body(size, weight: weight, color: color);
TextStyle _number(double size, {Color? color}) =>
    AppIdentity.number(size, color: color, weight: FontWeight.w800);

/// How a typed reading compares with the meter's history.
typedef _Verdict = ({String text, Color color, String icon});

class ReadingFlow extends StatefulWidget {
  const ReadingFlow({
    required this.store,
    required this.online,
    required this.syncing,
    required this.message,
    required this.requiresLogin,
    required this.onSync,
    required this.onSave,
    required this.onExit,
    required this.onReauthenticate,
    this.onRefresh,
    this.onFocusChanged,
    this.focusSubscriberId,
    super.key,
  });

  final FieldStore store;
  final bool online;
  final bool syncing;
  final String? message;
  final bool requiresLogin;
  final VoidCallback onSync;
  final Future<void> Function(List<Map<String, dynamic>>) onSave;
  final VoidCallback onExit;
  final VoidCallback onReauthenticate;
  final Future<void> Function()? onRefresh;

  /// Told whether a box (or another inner page) is open, so the app can
  /// give the keypad the whole screen.
  final ValueChanged<bool>? onFocusChanged;

  /// A subscriber whose box opens straight away, with the keypad on them.
  final int? focusSubscriberId;

  @override
  State<ReadingFlow> createState() => _ReadingFlowState();
}

class _ReadingFlowState extends State<ReadingFlow> with WidgetsBindingObserver {
  /// Redraw after [update], for the parts of this library.
  void change(VoidCallback update) => setState(update);

  final search = TextEditingController();
  late final Map<int, String> drafts = widget.store.readingDrafts;
  final rowKeys = <int, GlobalKey>{};
  Timer? draftSave;
  Timer? reveal;
  String? boxKey;
  String? previewBoxId;
  int? selectedId;
  bool keypadOpen = false;
  String view = 'boxes';
  String filter = 'all';
  String? subArea;
  bool saving = false;
  String? saveError;
  int savedCount = 0;
  String savedBox = '';
  List<String> savedOperationIds = [];
  String? rosterWeek;

  @override
  void initState() {
    super.initState();
    rosterWeek = widget.store.state['week_start'] as String?;
    WidgetsBinding.instance.addObserver(this);
    final focus = widget.store.subscribers
        .where((subscriber) => subscriber['id'] == widget.focusSubscriberId)
        .firstOrNull;
    if (focus != null && _entryOpen) {
      boxKey = _boxKey(focus);
      selectedId = focus['id'] as int;
      keypadOpen = _editable(focus);
      view = 'box';
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onFocusChanged?.call(true);
        _revealSelected();
      });
    }
  }

  @override
  void didUpdateWidget(covariant ReadingFlow oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextWeek = widget.store.state['week_start'] as String?;
    final weekChanged = rosterWeek != nextWeek;
    if (weekChanged) {
      draftSave?.cancel();
      drafts
        ..clear()
        ..addAll(widget.store.readingDrafts);
      rosterWeek = nextWeek;
    }
    final subscribers = widget.store.subscribers;
    final areas = {
      for (final subscriber in subscribers)
        '${subscriber['sub_area_id'] ?? 'none'}',
      for (final box in ((widget.store.state['next_reading'] as Map?)?['boxes']
                  as List? ??
              [])
          .cast<Map>())
        '${box['sub_area_id'] ?? 'none'}',
    };
    if (subArea != null && !areas.contains(subArea)) subArea = null;
    if (weekChanged ||
        (boxKey != null && _inBox(boxKey!).isEmpty) ||
        (previewBoxId != null && _previewBox == null)) {
      final wasFocused = view != 'boxes';
      boxKey = null;
      previewBoxId = null;
      selectedId = null;
      keypadOpen = false;
      view = 'boxes';
      if (wasFocused) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) widget.onFocusChanged?.call(false);
        });
      }
    } else if (!_entryOpen ||
        !subscribers.any((subscriber) => subscriber['id'] == selectedId)) {
      selectedId = null;
      keypadOpen = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) _persistDrafts();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (draftSave?.isActive ?? false) _persistDrafts();
    draftSave?.cancel();
    reveal?.cancel();
    search.dispose();
    super.dispose();
  }

  void _draftsChanged() {
    draftSave?.cancel();
    draftSave = Timer(const Duration(milliseconds: 400), _persistDrafts);
  }

  void _persistDrafts() {
    draftSave?.cancel();
    unawaited(widget.store
        .saveReadingDrafts(Map.of(drafts), weekStart: rosterWeek)
        .catchError((Object _) {}));
  }

  void _setView(String next) {
    setState(() {
      view = next;
      if (next == 'boxes') previewBoxId = null;
    });
    widget.onFocusChanged?.call(next != 'boxes');
  }

  void _openBox(String key, {int? focusId}) {
    FocusScope.of(context).unfocus();
    final subscribers = _inBox(key);
    final first = focusId ??
        subscribers
            .where((subscriber) => _editable(subscriber) && !_ready(subscriber))
            .map((subscriber) => subscriber['id'] as int)
            .firstOrNull ??
        subscribers
            .where(_editable)
            .map((subscriber) => subscriber['id'] as int)
            .firstOrNull;
    final focus = subscribers
        .where((subscriber) => subscriber['id'] == first)
        .firstOrNull;
    setState(() {
      boxKey = key;
      selectedId = first;
      keypadOpen = focusId != null && focus != null && _editable(focus);
      saveError = null;
    });
    _setView('box');
    _revealSelected();
  }

  void _back() {
    if (saving) return;
    if (dismissAppKeyboard(context)) return;
    if (view == 'boxes') {
      widget.onExit();
    } else if (view == 'box' && keypadOpen) {
      setState(() => keypadOpen = false);
    } else {
      setState(() {
        boxKey = null;
        selectedId = null;
        keypadOpen = false;
      });
      _setView('boxes');
    }
  }

  void _select(Map<String, dynamic> subscriber) {
    if (_editable(subscriber)) {
      setState(() {
        selectedId = subscriber['id'] as int;
        keypadOpen = true;
      });
      _revealSelected();
      return;
    }
    final queued = _queued(subscriber);
    if (queued != null) {
      unawaited(_askToReenter(queued, subscriber));
      return;
    }
    showAppToast(
        context,
        _entryOpen
            ? 'وصلت قراءة ${subscriber['full_name']} إلى النظام. لتعديلها تواصل مع المدقق.'
            : 'إدخال قراءات هذا الأسبوع غير متاح حاليًا.',
        icon: 'info');
  }

  /// Scroll the chosen subscriber into view once the keypad has opened.
  void _revealSelected() {
    reveal?.cancel();
    reveal = Timer(const Duration(milliseconds: 240), () {
      final context = rowKeys[selectedId]?.currentContext;
      if (mounted && context != null && context.mounted) {
        Scrollable.ensureVisible(context,
            alignment: .3,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutCubic);
      }
    });
  }

  void _key(String key) {
    if (selectedId == null || boxKey == null || saving) return;
    final subscribers = _inBox(boxKey!);
    final current = subscribers
        .where((subscriber) => subscriber['id'] == selectedId)
        .firstOrNull;
    if (current == null || !_editable(current)) return;
    if (key == 'next') {
      final index = subscribers.indexOf(current);
      final following = [
        ...subscribers.skip(index + 1),
        ...subscribers.take(index),
      ]
          .where((subscriber) => _editable(subscriber) && !_ready(subscriber))
          .map((subscriber) => subscriber['id'] as int)
          .firstOrNull;
      setState(() {
        if (following == null) {
          keypadOpen = false;
        } else {
          selectedId = following;
        }
      });
      if (following != null) _revealSelected();
      return;
    }
    final value = drafts[selectedId] ?? '';
    if (key == 'clear') {
      setState(() => drafts.remove(selectedId));
    } else if (key == 'delete') {
      setState(() => drafts[selectedId!] =
          value.isEmpty ? '' : value.substring(0, value.length - 1));
    } else if (key == '.') {
      if (!value.contains('.')) {
        setState(() => drafts[selectedId!] = value.isEmpty ? '0.' : '$value.');
      }
    } else if (value.length < 9) {
      setState(() => drafts[selectedId!] = value == '0' ? key : '$value$key');
    }
    _draftsChanged();
  }

  Future<void> _save() async {
    if (boxKey == null || saving) return;
    final ready = _inBox(boxKey!).where(_ready).toList();
    if (ready.isEmpty) return;
    final readings = ready
        .map((subscriber) => <String, dynamic>{
              'mobile_operation_id': newOperationId(),
              'subscription_id': subscriber['id'],
              'week_start': widget.store.state['week_start'],
              'current_reading':
                  drafts[subscriber['id']]?.replaceFirst(RegExp(r'\.$'), ''),
              'review': {
                'name': subscriber['full_name'],
                'account_number': subscriber['account_number'],
                'meter_box_number': subscriber['meter_box_number'],
                'meter_box_name': subscriber['meter_box_name'],
                'sub_area_name': subscriber['sub_area_name'],
                'previous_reading': subscriber['previous_reading'],
                if (_verdict(subscriber,
                            double.tryParse(drafts[subscriber['id']] ?? ''))
                        ?.color ==
                    _warning)
                  'warning': _verdict(subscriber,
                          double.tryParse(drafts[subscriber['id']] ?? ''))
                      ?.text,
              },
              'notes': '',
              if (subscriber['assignment_id'] != null) ...{
                'assignment_id': subscriber['assignment_id'],
                'authorization': subscriber['authorization'],
                'captured_at': TrustedClock.now().toUtc().toIso8601String(),
              },
            })
        .toList();
    draftSave?.cancel();
    setState(() {
      saving = true;
      saveError = null;
    });
    try {
      await widget.onSave(readings);
      if (!mounted) return;
      setState(() {
        savedBox = _boxNumber(ready.first);
        savedCount = ready.length;
        savedOperationIds = readings
            .map((reading) => reading['mobile_operation_id'] as String)
            .toList();
        saving = false;
        for (final subscriber in ready) {
          drafts.remove(subscriber['id']);
        }
        selectedId = null;
        keypadOpen = false;
      });
      _setView('done');
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'reading_flow'));
      if (mounted) {
        setState(() {
          saving = false;
          saveError = 'تعذر حفظ القراءات على الجهاز. حاول مجددًا.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final content = switch (view) {
      'box' => _refreshable(_boxView()),
      'preview' => _refreshable(_previewBoxView()),
      'done' => _doneView(),
      _ => _boxesView(),
    };
    final selected = view != 'box' || boxKey == null
        ? null
        : _inBox(boxKey!)
            .where((subscriber) => subscriber['id'] == selectedId)
            .firstOrNull;
    final showKeypad = keypadOpen && selected != null && _editable(selected);
    // While typing, the keypad and comparison need the room; the header's
    // cloud icon still shows when the phone is offline.
    final showBanners = view != 'done' && !(view == 'box' && showKeypad);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: ColoredBox(
        color: _background,
        child: SafeArea(
          bottom: view != 'boxes',
          child: Column(children: [
            if (view != 'done') _header(),
            if (!widget.online && showBanners)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: const AppNotice(
                    'لا يوجد اتصال. تُحفظ القراءات على الجهاز حتى تراجعها وتؤكد رفعها.',
                    warning: true,
                    icon: 'cloudoff'),
              ),
            if (widget.message != null &&
                (widget.online || widget.requiresLogin) &&
                showBanners)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: AppNotice(widget.message!, warning: true),
              ),
            if (widget.requiresLogin && view != 'done')
              TextButton(
                  onPressed: widget.onReauthenticate,
                  child: const Text('تسجيل الدخول مجددًا')),
            Expanded(
                child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              switchInCurve: Curves.easeOutCubic,
              transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                      position:
                          Tween(begin: const Offset(0, .02), end: Offset.zero)
                              .animate(animation),
                      child: child)),
              child: KeyedSubtree(key: ValueKey(view), child: content),
            )),
            if (view == 'box') ...[
              AppReveal(
                  visible: showKeypad,
                  child: selected == null
                      ? const SizedBox(width: double.infinity)
                      : _comparePanel(selected)),
              _saveBar(),
              AppReveal(
                  visible: showKeypad,
                  child: AppKeypad(
                      onKey: _key,
                      withNext: true,
                      enabled: !saving,
                      nextLabel: _hasFollowing(selected) ? 'التالي' : 'تم',
                      onClose: () => setState(() => keypadOpen = false))),
            ],
          ]),
        ),
      ),
    );
  }

  bool _hasFollowing(Map<String, dynamic>? selected) {
    if (selected == null || boxKey == null) return false;
    return _inBox(boxKey!).any((subscriber) =>
        subscriber['id'] != selected['id'] &&
        _editable(subscriber) &&
        !_ready(subscriber));
  }

}
