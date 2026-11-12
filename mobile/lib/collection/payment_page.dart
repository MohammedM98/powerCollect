import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/api_client.dart';
import 'bank_received_date_field.dart';
import '../design/app_balance.dart';
import '../design/app_identity.dart';
import '../core/field_store.dart';
import 'payment_form.dart';
import 'receipt_reader_page.dart';
import 'receipt_scan.dart';

export 'payment_form.dart'
    show bankLogoAsset, defaultTransferBanks, exchangeRatesFrom;

part 'payment_amount_section.dart';
part 'payment_transfer_section.dart';
part 'payment_summary_section.dart';

/// Record a payment the way the website's payment form does: the amount in
/// shekels, dollars or dinars (at the company's exchange rate), paid in cash or by a
/// transfer to one of the company's banks or e-wallets, with who sent it
/// and its reference. A transfer receipt can be read on the phone to fill
/// in its numbers.
class PaymentPage extends StatefulWidget {
  const PaymentPage(
      {required this.api,
      required this.subscriber,
      this.transferBanks = defaultTransferBanks,
      this.paymentMethods = const ['cash', 'bank_transfer'],
      this.exchangeRates = const {},
      this.receiptScanner = const ReceiptScanner(),
      this.receiptReader = const DeviceReceiptTextReader(),
      this.store,
      super.key});
  final ApiClient api;

  /// Where a payment sent without a settling answer is kept, so it can be
  /// sent again with the same operation id after the app closes.
  final FieldStore? store;
  final Map<String, dynamic> subscriber;
  final List<String> transferBanks;
  final List<String> paymentMethods;

  /// See [exchangeRatesFrom]: the only rates a payment can be taken at.
  final Map<String, double> exchangeRates;
  final ReceiptScanner receiptScanner;
  final ReceiptTextReader receiptReader;
  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

class _PaymentPageState extends State<PaymentPage> {
  /// Redraw after [update], for the sections in this library's part files.
  void change(VoidCallback update) => setState(update);

  late final PaymentForm form = PaymentForm(
      api: widget.api,
      subscriber: widget.subscriber,
      store: widget.store,
      paymentMethods: widget.paymentMethods,
      exchangeRates: widget.exchangeRates)
    ..addListener(redraw);
  bool showKeypad = false;

  void redraw() {
    if (mounted) setState(() {});
  }

  // The form's state, under the names the layout below reads.
  TextEditingController get amount => form.amount;
  TextEditingController get sender => form.sender;
  TextEditingController get reference => form.reference;
  TextEditingController get notes => form.notes;
  TextEditingController get voucher => form.voucher;
  String get currency => form.currency;
  set currency(String value) => form.currency = value;
  String get method => form.method;
  set method(String value) => form.method = value;
  String? get bank => form.bank;
  set bank(String? value) => form.bank = value;
  String? get senderBank => form.senderBank;
  set senderBank(String? value) => form.senderBank = value;
  DateTime? get bankReceivedOn => form.bankReceivedOn;
  set bankReceivedOn(DateTime? value) => form.bankReceivedOn = value;
  bool get senderIsSubscriber => form.senderIsSubscriber;
  bool get busy => form.busy;
  bool get scanning => form.scanning;
  set scanning(bool value) => form.scanning = value;
  bool get collectorConfirmed => form.collectorConfirmed;
  set collectorConfirmed(bool value) => form.collectorConfirmed = value;
  bool get recordedAny => form.recordedAny;
  double get balance => form.balance;
  String? get error => form.error;
  set error(String? value) => form.error = value;
  Map<String, dynamic>? get receipt => form.receipt;
  bool get unconfirmed => form.unconfirmed;
  String get subscriberName => form.subscriberName;
  bool get editable => form.editable;
  bool get throughBank => form.throughBank;
  bool get isShekel => form.isShekel;
  double get value => form.value;
  double? get rateValue => form.rateValue;
  double? get inShekels => form.inShekels;
  double get owed => form.owed;
  (String, String, String) get currencyLook => form.currencyLook;
  String get methodText => form.methodText;
  double balanceAfter(double recordedInShekels) =>
      form.balanceAfter(recordedInShekels);
  void enterAmount(String key) => form.enterAmount(key);
  void toggleSender(bool isSubscriber) => form.toggleSender(isSubscriber);
  void startAnother(double newBalance) {
    showKeypad = false;
    form.startAnother(newBalance);
  }

  /// After checking today's payments, the collector drops the unconfirmed
  /// payment and the form opens again for a new one.
  Future<void> discardUnconfirmed() async {
    final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
                title: const Text('تجاهل الدفعة غير المؤكدة؟'),
                content: const Text(
                    'تحقق أولًا من دفعات اليوم: إن وصلت هذه الدفعة للخادم فلا تسجلها مرة أخرى.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialogContext, false),
                      child: const Text('رجوع')),
                  TextButton(
                      key: const ValueKey('payment-discard-confirm'),
                      onPressed: () => Navigator.pop(dialogContext, true),
                      child: const Text('تجاهلها')),
                ]));
    if (confirmed != true || !mounted) return;
    await form.discardUnconfirmed();
  }

  @override
  void dispose() {
    form.removeListener(redraw);
    form.dispose();
    super.dispose();
  }

  Future<void> readReceipt(ReceiptImageSource source) async {
    if (!editable) return;
    FocusScope.of(context).unfocus();
    setState(() {
      scanning = true;
      showKeypad = false;
      error = null;
    });
    ReceiptImage? image;
    try {
      image = await widget.receiptScanner.pick(source);
      if (image == null || !mounted) return;
      final picked = await Navigator.push<Map<String, String>>(
          context,
          MaterialPageRoute(
              builder: (_) => ReceiptReaderPage(
                  image: image!,
                  scanner: widget.receiptScanner,
                  reader: widget.receiptReader)));
      if (picked == null || !mounted) return;
      form.applyReceipt(picked);
    } on PlatformException catch (exception) {
      if (mounted) {
        setState(() => error = exception.message ??
            'تعذر فتح صورة الإيصال. جرّب صورة أخرى أو أدخل البيانات يدويًا.');
      }
    } on MissingPluginException {
      if (mounted) {
        setState(() => error = 'قراءة الإيصالات متاحة في تطبيق Android فقط.');
      }
    } finally {
      if (image != null) {
        try {
          await widget.receiptScanner.discard(image);
        } on PlatformException {
          // Temporary images are also cleared by the Android scanner on restart.
        } on MissingPluginException {
          // Tests and unsupported platforms have no native image cache.
        }
      }
      if (mounted) setState(() => scanning = false);
    }
  }

  Future<void> submit() async {
    if (busy || scanning || !collectorConfirmed) return;
    FocusScope.of(context).unfocus();
    await form.submit();
  }

  @override
  Widget build(BuildContext context) {
    final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;
    final availableHeight = MediaQuery.sizeOf(context).height -
        MediaQuery.paddingOf(context).vertical;
    final inlineKeypad = availableHeight < 500 * textScale;
    final showNumberPad =
        showKeypad && MediaQuery.viewInsetsOf(context).bottom == 0;
    final keypad = AppKeypad(
        adaptive: true,
        keyPrefix: 'payment',
        enabled: editable,
        onClose: () => setState(() => showKeypad = false),
        onKey: enterAmount);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) goBack();
      },
      child: Scaffold(
          body: SafeArea(
              child: receipt != null
                  ? Column(children: [
                      Expanded(child: success()),
                    ])
                  : Column(children: [
                      AppHeader(
                          title: subscriberName,
                          subtitle:
                              'حساب ${widget.subscriber['account_number']} · تسجيل دفعة',
                          onBack: busy || scanning ? null : goBack),
                      Expanded(
                          child: ListView(
                              keyboardDismissBehavior:
                                  ScrollViewKeyboardDismissBehavior.onDrag,
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                              children: [
                            balanceStrip(),
                            const AppLabel('المبلغ المستلم',
                                hint: 'بالعملة التي استُلم بها'),
                            amountPanel(),
                            if (inlineKeypad && showNumberPad) keypad,
                            const AppLabel('طريقة الدفع'),
                            Row(children: [
                              if (widget.paymentMethods
                                  .contains('bank_transfer'))
                                methodTile('bank_transfer',
                                    'تحويل بنكي أو محفظة', 'bank'),
                              if (widget.paymentMethods
                                      .contains('bank_transfer') &&
                                  widget.paymentMethods.contains('cash'))
                                const SizedBox(width: 8),
                              if (widget.paymentMethods.contains('cash'))
                                methodTile('cash', 'نقد', 'cash'),
                            ]),
                            if (throughBank)
                              Padding(
                                  padding: const EdgeInsets.only(top: 12),
                                  child: transferDetails())
                            else ...[
                              const AppLabel('رقم السند اليدوي',
                                  hint: 'رقم الوصل الورقي'),
                              detailField('مثال: 00412', voucher,
                                  key: 'payment-voucher', ltr: true),
                            ],
                            const AppLabel('ملاحظة',
                                hint: 'اختياري · تظهر في كشف الحساب'),
                            detailField('أي تفصيل يُحفظ مع الدفعة', notes,
                                key: 'payment-notes'),
                            summary(),
                            confirmation(),
                            if (error != null) ...[
                              const SizedBox(height: 12),
                              AppNotice(error!, error: true)
                            ],
                            if (unconfirmed && !busy && widget.store != null)
                              Align(
                                  alignment: AlignmentDirectional.centerStart,
                                  child: TextButton(
                                      key: const ValueKey('payment-discard'),
                                      onPressed: discardUnconfirmed,
                                      child: const Text(
                                          'تحققت من دفعات اليوم: تجاهل هذه الدفعة'))),
                          ])),
                      Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                              color: AppIdentity.background,
                              border: Border(
                                  top:
                                      BorderSide(color: AppIdentity.lineSoft))),
                          child: AppAction(
                              key: const ValueKey('payment-submit'),
                              label: busy
                                  ? 'جارٍ التسجيل...'
                                  : value > 0
                                      ? 'تسجيل ${AppIdentity.money(value)} ${currencyLook.$3}'
                                      : 'تسجيل الدفعة',
                              icon: 'check',
                              busy: busy,
                              onPressed: busy ||
                                      scanning ||
                                      !collectorConfirmed ||
                                      value <= 0
                                  ? null
                                  : submit)),
                      if (!inlineKeypad && showNumberPad) keypad,
                    ]))),
    );
  }

  void goBack() {
    if (busy || scanning) return;
    if ((receipt == null && showKeypad) ||
        MediaQuery.viewInsetsOf(context).bottom > 0) {
      FocusScope.of(context).unfocus();
      setState(() => showKeypad = false);
      return;
    }
    Navigator.pop(context, recordedAny);
  }
}
