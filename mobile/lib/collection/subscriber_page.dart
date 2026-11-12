import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/api_client.dart';
import 'adjustment_page.dart';
import '../design/app_balance.dart';
import '../design/app_identity.dart';
import '../core/field_store.dart';
import 'payment_page.dart';
import 'split_payment_page.dart';
import 'subscriber_history_page.dart';
import '../messages/subscriber_message_actions.dart';

part 'subscriber_page_details.dart';

/// A subscriber's account as the collector sees it before taking a payment:
/// personal and subscription details, the previous reading and access to their
/// financial history. Pops with whether any payment was recorded.
class SubscriberPage extends StatefulWidget {
  const SubscriberPage(
      {required this.api,
      required this.subscriber,
      this.transferBanks = defaultTransferBanks,
      this.senderBanks = const [],
      this.paymentMethods = const ['cash', 'bank_transfer'],
      this.exchangeRates = const {},
      this.store,
      super.key});
  final ApiClient api;

  /// Keeps money sent without a settling answer (see [FieldStore.pendingCollections]).
  final FieldStore? store;

  /// The subscriber as the search listed them, shown until their page loads.
  final Map<String, dynamic> subscriber;
  final List<String> transferBanks;
  final List<String> senderBanks;
  final List<String> paymentMethods;

  /// The company's exchange rates (see [exchangeRatesFrom]).
  final Map<String, double> exchangeRates;
  @override
  State<SubscriberPage> createState() => _SubscriberPageState();
}

class _SubscriberPageState extends State<SubscriberPage>
    with WidgetsBindingObserver {
  /// Redraw after [update], for the parts of this library.
  void change(VoidCallback update) => setState(update);

  Map<String, dynamic>? details;
  bool loading = true;
  String? error;
  bool recordedAny = false;
  Timer? permissionTimer;

  Map<String, dynamic> get subscriber => {
        ...widget.subscriber,
        if (details?['subscription'] is Map)
          ...Map<String, dynamic>.from(details!['subscription'] as Map),
      };
  double get balance => double.tryParse('${subscriber['balance']}') ?? 0;
  Map get permissions => details?['permissions'] as Map? ?? const {};
  List<String> get paymentMethods => permissions['payment_methods'] is List
      ? List<String>.from(permissions['payment_methods'] as List)
      : widget.paymentMethods;
  bool get canRecordPayment =>
      !loading && error == null && permissions['record_payment'] == true;
  bool get canRecordSplitPayment =>
      !loading && error == null && permissions['record_split_payment'] == true;
  Map<String, dynamic>? get lastReading => details?['last_reading'] is Map
      ? Map<String, dynamic>.from(details!['last_reading'] as Map)
      : null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    permissionTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted &&
          (WidgetsBinding.instance.lifecycleState == null ||
              WidgetsBinding.instance.lifecycleState ==
                  AppLifecycleState.resumed) &&
          ModalRoute.of(context)?.isCurrent == true &&
          !loading) {
        load();
      }
    });
    load();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        ModalRoute.of(context)?.isCurrent == true &&
        !loading) {
      load();
    }
  }

  @override
  void dispose() {
    permissionTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  bool get canAdjust =>
      !loading &&
      error == null &&
      (permissions['add_charge'] == true ||
          permissions['add_discount'] == true ||
          permissions['add_clearing'] == true ||
          canRecordSplitPayment);

  Future<void> openAdjustments() async {
    if (!canAdjust) return;
    final selected = await showAppSheet<Map<String, dynamic>>(context,
        title: 'إجراءات الحساب',
        children: [
          Builder(
              builder: (sheetContext) => Column(children: [
                    if (canRecordSplitPayment)
                      ListTile(
                          title: const Text('تسجيل دفعة مقسّمة'),
                          onTap: () =>
                              Navigator.pop(sheetContext, {'action': 'split'})),
                    if (permissions['add_charge'] == true)
                      for (final type
                          in (details?['charge_types'] as List? ?? const []).cast<Map>())
                        ListTile(
                            title: Text('تحميل ${type['label']}'),
                            onTap: () => Navigator.pop(sheetContext, {
                                  'action': 'charge',
                                  'title': 'تحميل ${type['label']}',
                                  'type': type
                                })),
                    if (permissions['add_discount'] == true)
                      ListTile(
                          title: const Text('إضافة خصم'),
                          onTap: () => Navigator.pop(sheetContext,
                              {'action': 'discount', 'title': 'إضافة خصم'})),
                    if (permissions['add_clearing'] == true)
                      ListTile(
                          title: const Text('إضافة مقاصة'),
                          onTap: () => Navigator.pop(sheetContext,
                              {'action': 'clearing', 'title': 'إضافة مقاصة'})),
                  ])),
        ]);
    if (!mounted || selected == null) return;
    if (selected['action'] == 'split') {
      await recordSplitPayment();
      return;
    }
    final recorded = await Navigator.of(context).push<bool>(MaterialPageRoute(
        builder: (_) => AdjustmentPage(
            api: widget.api,
            subscriber: subscriber,
            store: widget.store,
            action: selected['action'] as String,
            title: selected['title'] as String,
            chargeType: selected['type'] == null
                ? null
                : Map<String, dynamic>.from(selected['type'] as Map))));
    if (!mounted) return;
    if (recorded == true) {
      recordedAny = true;
      showAppToast(context, 'سُجّلت الحركة بنجاح.');
    }
    await load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result =
          await widget.api.collectionSubscriber(widget.subscriber['id'] as int);
      if (mounted) setState(() => details = result);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> recordPayment() async {
    if (!canRecordPayment) return;
    final submitted = await Navigator.of(context).push<bool>(MaterialPageRoute(
        builder: (_) => PaymentPage(
            api: widget.api,
            store: widget.store,
            subscriber: subscriber,
            paymentMethods: paymentMethods,
            exchangeRates: widget.exchangeRates,
            transferBanks: widget.transferBanks)));
    if (!mounted) return;
    if (submitted == true) {
      recordedAny = true;
      showAppToast(context, 'سُجلت الدفعة مباشرة في السجل المالي.');
    }
    await load();
  }

  void close() => Navigator.pop(context, recordedAny);

  /// A payment or split transfer sent for this subscriber without an answer
  /// that settled it: opened again with the same operation id to resend or
  /// discard. (An unconfirmed charge, discount or clearing reopens from its
  /// own menu entry.)
  List<Widget> unconfirmedMoney() {
    final store = widget.store;
    if (store == null) return const [];
    return [
      for (final (kind, open) in [
        ('payment', recordPayment),
        ('split', recordSplitPayment),
      ])
        if (store.pendingCollection(kind, widget.subscriber['id'])
            case final pending?) ...[
          const SizedBox(height: 12),
          AppNotice('${pending['summary']}: لم يُؤكَّد تسجيلها.',
              warning: true, icon: 'err'),
          Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                  key: ValueKey('subscriber-resume-$kind'),
                  onPressed: open,
                  child: const Text('افتحها لإعادة الإرسال أو التجاهل'))),
        ],
    ];
  }

  Future<void> recordSplitPayment() async {
    if (!canRecordSplitPayment) return;
    final recorded = await Navigator.of(context).push<bool>(MaterialPageRoute(
        builder: (_) => SplitPaymentPage(
            api: widget.api,
            store: widget.store,
            subscriber: subscriber,
            transferBanks: widget.transferBanks,
            senderBanks: widget.senderBanks)));
    if (!mounted) return;
    if (recorded == true) {
      recordedAny = true;
      showAppToast(context, 'سُجلت الحوالة المقسّمة لجميع الاشتراكات.');
    }
    await load();
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) close();
        },
        child: Scaffold(
          body: SafeArea(
            child: Column(children: [
              AppHeader(
                  title: 'ملخص المشترك',
                  subtitle: 'حساب ${subscriber['account_number']}',
                  onBack: close),
              Expanded(
                child: RefreshIndicator(
                  color: AppIdentity.brand,
                  onRefresh: load,
                  child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                      children: [
                        if (text(subscriber['subscription_name'])
                            case final name?)
                          Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child:
                                  Text(name, style: AppIdentity.heading(22))),
                        balanceCard(),
                        ...unconfirmedMoney(),
                        if (loading)
                          Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                      minHeight: 3,
                                      color: AppIdentity.brand,
                                      backgroundColor: AppIdentity.sunken))),
                        if (error != null) ...[
                          const SizedBox(height: 12),
                          AppNotice(error!, error: true),
                          TextButton(
                              onPressed: loading ? null : load,
                              child: const Text('إعادة المحاولة')),
                        ],
                        if (details != null) ...[
                          const AppSection('خدمات المشترك'),
                          subscriberActions(),
                          const AppSection('البيانات الشخصية'),
                          KeyedSubtree(
                              key:
                                  const ValueKey('subscriber-personal-details'),
                              child: factRows(personalFacts())),
                        ],
                        const AppSection('معلومات الاشتراك'),
                        KeyedSubtree(
                            key: const ValueKey(
                                'subscriber-subscription-details'),
                            child: factRows(subscriptionFacts())),
                      ]),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                    color: AppIdentity.background,
                    border:
                        Border(top: BorderSide(color: AppIdentity.lineSoft))),
                child: Row(children: [
                  Expanded(
                      child: AppAction(
                          key: const ValueKey('subscriber-record-payment'),
                          label: 'تسجيل دفعة',
                          icon: 'cash',
                          onPressed: canRecordPayment ? recordPayment : null)),
                  if (canAdjust) ...[
                    const SizedBox(width: 8),
                    IconButton.filledTonal(
                        key: const ValueKey('subscriber-account-actions'),
                        tooltip: 'إجراءات الحساب',
                        constraints:
                            const BoxConstraints(minWidth: 54, minHeight: 54),
                        onPressed: openAdjustments,
                        icon: const Icon(Icons.keyboard_arrow_down)),
                  ],
                ]),
              ),
            ]),
          ),
        ),
      );

}
