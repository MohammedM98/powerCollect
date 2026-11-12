import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../design/app_identity.dart';
import '../cash_boxes/cash_boxes_page.dart';
import 'development_credits.dart';
import '../collection/collection_view.dart';
import '../collection/payment_page.dart';
import '../collection/subscriber_page.dart';
import '../core/field_store.dart';
import '../readings/queued_readings.dart';
import '../readings/reading_flow.dart';
import '../readings/weekly_readings_page.dart';
import '../readings/reading_distribution_page.dart';
import '../readings/reading_assignments.dart';
import '../messages/message_subscribers_page.dart';
import '../core/trusted_clock.dart';
import '../core/diagnostics.dart';

part 'field_shell_sync.dart';
part 'field_shell_collections.dart';
part 'field_shell_home.dart';
part 'field_shell_account.dart';

enum FieldSection { home, readings, collections, sync, account }

class FieldShell extends StatefulWidget {
  const FieldShell(
      {required this.api,
      required this.store,
      required this.user,
      required this.onLogout,
      required this.onReauthenticate,
      this.appearance = ThemeMode.system,
      this.onAppearanceChanged,
      super.key});
  final ApiClient api;
  final FieldStore store;
  final Map<String, dynamic> user;
  final Future<void> Function() onLogout;
  final VoidCallback onReauthenticate;
  final ThemeMode appearance;
  final Future<void> Function(ThemeMode)? onAppearanceChanged;
  @override
  State<FieldShell> createState() => _FieldShellState();
}

class _FieldShellState extends State<FieldShell> with WidgetsBindingObserver {
  /// Redraw after [update], for the parts of this library.
  void change(VoidCallback update) => setState(update);

  late Map<String, dynamic> currentUser = widget.user;
  FieldSection section = FieldSection.home;
  bool online = false;
  bool syncing = false;
  bool uploadingReadings = false;
  Future<void>? synchronization;
  bool rosterRefreshRequested = false;
  String? message;
  Timer? timer;
  final collectionSearch = TextEditingController();
  List<Map<String, dynamic>> collectionResults = [];
  List<Map<String, dynamic>> today = [];
  bool collectionBusy = false;
  Timer? collectionDebounce;
  int collectionRequest = 0;
  int collectionPage = 0;
  int collectionLastPage = 1;
  String? collectionError;
  bool requiresLogin = false;
  bool readingFocus = false;
  int? focusSubscriberId;

  bool get canRead => currentUser['can_record_readings'] == true;
  bool get canCollect => currentUser['can_record_collections'] == true;
  List<String> get paymentMethods => currentUser['payment_methods'] is List
      ? List<String>.from(currentUser['payment_methods'] as List)
      : const [];
  String get collectionIcon =>
      paymentMethods.contains('cash') ? 'cash' : 'bank';
  bool get canViewSubscriptions =>
      currentUser['can_view_subscriptions'] == true;
  bool get canBrowseSubscribers =>
      canCollect ||
      canViewSubscriptions ||
      currentUser['can_adjust_balances'] == true;
  bool get canRecordSplitPayments =>
      canCollect && currentUser['can_record_split_payments'] == true;

  /// The box types the user's payments go into: cash, bank transfers and
  /// clearings, each by its own permission.
  Set<String> get ownBoxTypes => {
        if (canCollect && paymentMethods.contains('cash')) 'cash',
        if (canCollect && paymentMethods.contains('bank_transfer'))
          'bank_transfer',
        if (currentUser['can_add_clearings'] == true) 'clearing',
      };
  bool get canViewOwnBoxes => ownBoxTypes.isNotEmpty;
  bool get canUseReadingSync =>
      canRead || widget.store.queuedReadings.isNotEmpty;
  bool collectionShowToday = false;
  bool collectionFocusSearch = false;
  bool get canViewReadings => currentUser['can_view_readings'] == true;
  bool get canDistributeReadings =>
      currentUser['can_distribute_readings'] == true ||
      currentUser['can_approve_reading_assignments'] == true;
  bool get canSendMessages => currentUser['can_send_messages'] == true;
  bool get canViewMessages => currentUser['can_view_messages'] == true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.store.state['assignment_roster_version'] != 1) {
      widget.store.state.remove('subscribers');
      widget.store.state.remove('roster_updated_at');
    }
    scheduleSync();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => synchronize(forceRoster: true));
  }

  /// Checks in a row that found no connection; each one doubles the wait.
  int offlineChecks = 0;

  /// The next check with the server: 30 seconds after the last, doubling
  /// while offline up to four minutes. None runs while the app is in the
  /// background; coming back checks at once and starts the clock again.
  void scheduleSync() {
    timer?.cancel();
    timer = Timer(Duration(seconds: 30 << offlineChecks.clamp(0, 3)), checkIn);
  }

  Future<void> checkIn() async {
    if (!mounted) return;
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    if (lifecycle != null && lifecycle != AppLifecycleState.resumed) return;
    if (ModalRoute.of(context)?.isCurrent == true) {
      await synchronize(forceRoster: section == FieldSection.readings);
    } else {
      final sessionToken = widget.api.token;
      try {
        await widget.api.me();
      } on ApiException catch (error) {
        if (error.statusCode == 401 &&
            mounted &&
            widget.api.token == sessionToken) {
          widget.onReauthenticate();
        }
      } catch (error, stack) {
        unawaited(Diagnostics.record(error, stack, where: 'field_shell'));
      }
    }
    if (!mounted) return;
    offlineChecks = online ? 0 : offlineChecks + 1;
    scheduleSync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      offlineChecks = 0;
      synchronize(forceRoster: true);
      scheduleSync();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      timer?.cancel();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer?.cancel();
    collectionDebounce?.cancel();
    collectionSearch.dispose();
    super.dispose();
  }

  Future<void> synchronize({bool forceRoster = false}) {
    if (!mounted || uploadingReadings) return Future<void>.value();
    rosterRefreshRequested = rosterRefreshRequested || forceRoster;
    return synchronization ??=
        refreshSession().whenComplete(() => synchronization = null);
  }

  /// Send the app's error log to the server for support, then start it afresh.
  Future<void> sendDiagnostics() async {
    final log = await Diagnostics.read();
    if (!mounted) return;
    if (log.trim().isEmpty) {
      showAppToast(context, 'لا توجد أخطاء مسجلة في التطبيق.');
      return;
    }
    try {
      await widget.api.sendDiagnostics(log);
      await Diagnostics.clear();
      if (mounted) showAppToast(context, 'أُرسل سجل الأخطاء إلى الدعم.');
    } on ApiException catch (exception) {
      if (mounted) showAppToast(context, exception.message, icon: 'err');
    }
  }

  Future<void> signOut() async {
    if (widget.store.queuedReadings.isNotEmpty) {
      showAppToast(context, 'زامن القراءات غير المرسلة قبل تسجيل الخروج.',
          icon: 'err');
      return;
    }
    final confirmed = await showAppSheet<bool>(context,
        title: 'تسجيل الخروج؟',
        message:
            'ستحتاج إلى الإنترنت لتسجيل الدخول مرة أخرى، حتى لو خرجت دون اتصال.',
        children: [_confirmButtons('تسجيل الخروج')]);
    if (confirmed != true) return;
    try {
      await widget.onLogout();
    } on ApiException catch (error) {
      if (mounted) setState(() => message = error.message);
    }
  }

  Widget _confirmButtons(String confirm) => Builder(
      builder: (context) => Row(children: [
            Expanded(
                child: AppAction(
                    label: 'إلغاء',
                    primary: false,
                    onPressed: () => Navigator.pop(context, false))),
            const SizedBox(width: 8),
            Expanded(
                child: AppAction(
                    label: confirm,
                    onPressed: () => Navigator.pop(context, true))),
          ]));

  Future<void> discardRejectedReading(Map<String, dynamic> reading) async {
    if (uploadingReadings || reading['upload_uncertain'] == true) return;
    final confirmed = await showAppSheet<bool>(context,
        title: 'حذف القراءة المحلية؟',
        message: 'رفض الخادم هذه القراءة: ${reading['sync_error']}\n'
            'سيُحذف الإدخال من هذا الجهاز ويمكنك إدخاله من جديد.',
        children: [_confirmButtons('حذف')]);
    if (confirmed != true) return;
    await widget.store.removeReading(reading['mobile_operation_id'] as String);
    if (mounted) {
      setState(() {});
      showAppToast(context, 'حُذفت القراءة من الجهاز', icon: 'trash');
    }
  }

  void resetCollectionSearch() {
    collectionDebounce?.cancel();
    collectionRequest++;
    collectionSearch.clear();
    collectionResults = [];
    collectionPage = 0;
    collectionLastPage = 1;
    collectionBusy = false;
    collectionError = null;
  }

  void navigate(FieldSection destination,
      {bool showToday = false, bool focusSearch = false}) {
    FocusScope.of(context).unfocus();
    setState(() {
      if (section != destination &&
          (section == FieldSection.collections ||
              destination == FieldSection.collections)) {
        resetCollectionSearch();
      }
      section = destination;
      collectionShowToday = showToday;
      collectionFocusSearch = focusSearch;
      message = null;
      if (destination != FieldSection.readings) {
        readingFocus = false;
        focusSubscriberId = null;
      }
    });
    if (destination == FieldSection.collections && canBrowseSubscribers) {
      unawaited(searchCollections());
    }
    if (destination == FieldSection.readings && canRead) {
      unawaited(synchronize(forceRoster: true));
    }
  }

  /// Take a saved reading back off the queue and open it on the keypad.
  Future<void> reenterReading(Map<String, dynamic> reading) async {
    if (syncing || uploadingReadings || reading['upload_uncertain'] == true) {
      showAppToast(context, 'جارٍ الإرسال الآن. أعد المحاولة بعد لحظات.',
          icon: 'clock');
      return;
    }
    if (!canRead ||
        !readingEntryIsOpen(widget.store.state, TrustedClock.now()) ||
        reading['week_start'] != widget.store.state['week_start'] ||
        !widget.store.subscribers.any(
            (subscriber) => subscriber['id'] == reading['subscription_id'])) {
      return;
    }
    await widget.store.reopenReading(reading['mobile_operation_id'] as String);
    if (!mounted) return;
    setState(() {
      section = FieldSection.readings;
      message = null;
      focusSubscriberId = reading['subscription_id'] as int;
    });
  }

  void openWeeklyReadings() {
    if (!canViewReadings) return;
    Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => WeeklyReadingsPage(api: widget.api)));
  }

  List<AppNavItem> get destinations => [
        const AppNavItem('home', 'الرئيسية', 'home'),
        if (canRead) const AppNavItem('readings', 'القراءات', 'bolt'),
        if (canBrowseSubscribers)
          AppNavItem('collections', canCollect ? 'التحصيل' : 'كشوف الحساب',
              canCollect ? collectionIcon : 'hist'),
        if (canUseReadingSync)
          AppNavItem('sync', 'الإرسال', 'cloud',
              badge: widget.store.queuedReadings.length),
        const AppNavItem('account', 'حسابي', 'user'),
      ];

  @override
  Widget build(BuildContext context) {
    final inReadings = section == FieldSection.readings && canRead;
    return AppKeyboardBackScope(
      canPop: section == FieldSection.home,
      onBack: inReadings ? null : () => navigate(FieldSection.home),
      child: Scaffold(
        body: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          switchInCurve: Curves.easeOutCubic,
          transitionBuilder: (child, animation) =>
              FadeTransition(opacity: animation, child: child),
          child: KeyedSubtree(
            key: ValueKey(inReadings ? FieldSection.readings : section),
            child: inReadings
                ? ReadingFlow(
                    key: ValueKey('readings-$focusSubscriberId'),
                    store: widget.store,
                    online: online,
                    syncing: syncing || uploadingReadings,
                    message: message,
                    requiresLogin: requiresLogin,
                    focusSubscriberId: focusSubscriberId,
                    onSync: () => navigate(FieldSection.sync),
                    onRefresh: () => synchronize(forceRoster: true),
                    onSave: saveReadings,
                    onExit: () => navigate(FieldSection.home),
                    onReauthenticate: widget.onReauthenticate,
                    onFocusChanged: (focused) =>
                        setState(() => readingFocus = focused),
                  )
                : SafeArea(bottom: false, child: sectionBody()),
          ),
        ),
        bottomNavigationBar: inReadings && readingFocus
            ? null
            : AppNavBar(
                items: destinations,
                selected: section.name,
                onSelect: (id) => navigate(FieldSection.values.byName(id))),
      ),
    );
  }

  String get offlineText => switch (section) {
        FieldSection.collections =>
          'لا يوجد اتصال. اتصل بالإنترنت لعرض حسابات المشتركين.',
        FieldSection.sync =>
          'لا يوجد اتصال. القراءات محفوظة على الجهاز؛ راجعها وأكّد رفعها عند الاتصال.',
        _ => canRead
            ? 'لا يوجد اتصال. تُحفظ القراءات على الجهاز حتى تراجعها وتؤكد رفعها. التحصيل يحتاج إلى الإنترنت.'
            : 'لا يوجد اتصال. اتصل بالإنترنت لتسجيل الدفعات.',
      };

  Widget sectionBody() {
    final firstName = '${widget.user['name'] ?? ''}'.trim().split(' ').first;
    final title = switch (section) {
      FieldSection.collections =>
        canCollect ? 'التحصيل' : 'كشوف حساب المشتركين',
      FieldSection.sync => 'حالة الإرسال',
      FieldSection.account => 'حسابي',
      _ => 'مرحبًا، $firstName',
    };
    return Column(children: [
      AppHeader(
          title: title,
          subtitle: switch (section) {
            FieldSection.home =>
              '${widget.user['branch_name'] ?? 'جميع الفروع'}',
            FieldSection.collections => canCollect
                ? 'ابحث عن مشترك لتسجيل دفعة'
                : 'ابحث عن مشترك لعرض كشف حسابه',
            FieldSection.sync => 'القراءات المحفوظة على الجهاز',
            _ => null,
          },
          onSync: section == FieldSection.sync
              ? null
              : canUseReadingSync
                  ? () => navigate(FieldSection.sync)
                  : synchronize,
          syncLabel: canUseReadingSync ? 'حالة الإرسال' : 'تحديث البيانات',
          online: online,
          syncing: syncing,
          pending: widget.store.queuedReadings.length),
      if (!online && !syncing && section != FieldSection.account)
        ConstrainedBox(
            constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * .25),
            child: SingleChildScrollView(
                child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                    child: AppNotice(offlineText,
                        warning: true, icon: 'cloudoff')))),
      if (message != null && (online || requiresLogin))
        ConstrainedBox(
            constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * .25),
            child: SingleChildScrollView(
                child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                    child: AppNotice(message!, warning: true)))),
      if (requiresLogin)
        TextButton(
            onPressed: widget.onReauthenticate,
            child: const Text('تسجيل الدخول مجددًا')),
      if (section == FieldSection.collections || section == FieldSection.home)
        for (final pending in widget.store.pendingCollections)
          Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: InkWell(
                  key: ValueKey(
                      'unconfirmed-${Map<String, dynamic>.from(pending['submission'] as Map)['mobile_operation_id']}'),
                  onTap: () => unawaited(openSubscriber(
                      Map<String, dynamic>.from(pending['subscriber'] as Map))),
                  child: AppNotice(
                      '${pending['summary']}: لم يُؤكَّد تسجيلها. افتح المشترك لإعادة إرسالها بنفس البيانات، أو تجاهلها بعد التحقق من دفعات اليوم.',
                      warning: true,
                      icon: 'err'))),
      Expanded(
          child: switch (section) {
        FieldSection.collections when canBrowseSubscribers => CollectionView(
            key: ValueKey(
                'collections-$collectionShowToday-$collectionFocusSearch'),
            initiallyShowingToday: collectionShowToday,
            focusSearch: collectionFocusSearch,
            canRecordPayments: canCollect,
            paymentMethods: paymentMethods,
            search: collectionSearch,
            results: collectionResults,
            today: today,
            busy: collectionBusy,
            online: online,
            error: collectionError,
            hasMore: collectionPage > 0 && collectionPage < collectionLastPage,
            onSearchChanged: collectionSearchChanged,
            onLoadMore: () => unawaited(searchCollections(loadMore: true)),
            onSearch: () => unawaited(searchCollections()),
            onRefresh: () async {
              await synchronize(forceRoster: true);
              await searchCollections();
            },
            onWeeklyReadings: canViewReadings ? openWeeklyReadings : null,
            onOpen: openSubscriber),
        FieldSection.sync when canUseReadingSync => syncView(),
        FieldSection.account => account(),
        _ => home(),
      }),
    ]);
  }

  Widget refreshable(Widget list) => RefreshIndicator(
      color: AppIdentity.brand,
      onRefresh: () => synchronize(forceRoster: true),
      child: list);

}
