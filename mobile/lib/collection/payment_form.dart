import 'dart:async';
import 'dart:math';

import 'package:flutter/widgets.dart';

import '../core/api_client.dart';
import 'bank_received_date_field.dart';
import '../core/field_store.dart';
import '../core/diagnostics.dart';
import '../models/collection_receipt.dart';

/// The banks and e-wallets a transfer can go to, used until the server
/// sends its own list with the signed-in user.
const defaultTransferBanks = [
  'بنك فلسطين',
  'محفظة بالباي',
  'جوال باي',
  'البنك الإسلامي الفلسطيني',
  'البنك الوطني الإسلامي',
];

/// Each bank or e-wallet's logo, as on the website; one not listed here
/// gets a plain tile.
const _bankLogos = {
  'بنك فلسطين': 'assets/images/banks/bank-of-palestine.webp',
  'محفظة بالباي': 'assets/images/banks/palpay.webp',
  'جوال باي': 'assets/images/banks/jawwal-pay.webp',
  'البنك الإسلامي الفلسطيني': 'assets/images/banks/palestine-islamic-bank.webp',
  'البنك الوطني الإسلامي': 'assets/images/banks/national-islamic-bank.webp',
  'بنك القدس': 'assets/images/banks/quds-bank.webp',
};

String? bankLogoAsset(String name) => _bankLogos[name];

/// Currency code, symbol and name, in the website's order.
const paymentCurrencies = [
  ('ILS', '₪', 'شيكل'),
  ('USD', '\$', 'دولار'),
  ('JOD', 'JD', 'دينار'),
];

/// The company's exchange rates from the website's payment settings, by
/// currency code, as the server sends them (`user.currencies`). A currency
/// with no rate set there is left out, so it cannot be taken in the app.
Map<String, double> exchangeRatesFrom(Object? currencies) => {
      if (currencies is List)
        for (final currency in currencies)
          if (currency is Map &&
              (double.tryParse('${currency['rate']}') ?? 0) > 0)
            '${currency['code']}': double.parse('${currency['rate']}'),
    };

/// One payment from one subscriber, as the payment page edits and sends it:
/// what was typed, what it comes to in shekels, why it cannot be sent yet,
/// and the submission itself, kept with its operation id until the server
/// settles it (see [FieldStore.pendingCollections]). Holds no widgets, so
/// it is tested without pumping a page.
class PaymentForm extends ChangeNotifier {
  PaymentForm(
      {required this.api,
      required this.subscriber,
      this.store,
      this.paymentMethods = const ['cash', 'bank_transfer'],
      this.exchangeRates = const {}}) {
    method = defaultMethod;
    sender.text = subscriberName;
    restoreUnconfirmed();
  }

  final ApiClient api;
  final Map<String, dynamic> subscriber;
  final FieldStore? store;
  final List<String> paymentMethods;

  /// See [exchangeRatesFrom]: the only rates a payment can be taken at.
  final Map<String, double> exchangeRates;

  final amount = TextEditingController();
  final sender = TextEditingController();
  final reference = TextEditingController();
  final notes = TextEditingController();
  final voucher = TextEditingController();
  String currency = 'ILS';
  // The website's payment form starts on a transfer too.
  String method = 'bank_transfer';
  String? bank;
  String? senderBank;
  DateTime? bankReceivedOn;
  bool senderIsSubscriber = true;
  bool busy = false;
  bool scanning = false;
  bool collectorConfirmed = false;

  /// The server asked to confirm an amount far above what is owed (an
  /// advance payment): sent again only once the collector ticks it.
  bool needsOverpayment = false;
  bool overpaymentConfirmed = false;
  bool recordedAny = false;
  late double balance = double.tryParse('${subscriber['balance']}') ?? 0;
  String? error;
  Map<String, dynamic>? submission;
  CollectionReceipt? receipt;

  /// The payment on screen was sent earlier without an answer, and is kept
  /// on the phone until it is sent again or discarded.
  bool unconfirmed = false;

  static const unconfirmedMessage =
      'تعذر تأكيد تسجيل الدفعة. أعد المحاولة من هذه الشاشة بنفس البيانات، أو تحقق من دفعات اليوم قبل إنشاء دفعة أخرى.';

  String get subscriberName => '${subscriber['full_name']}';
  String get defaultMethod => paymentMethods.contains('bank_transfer')
      ? 'bank_transfer'
      : paymentMethods.firstOrNull ?? '';
  bool get editable => !busy && !scanning && submission == null;
  bool get readyToSend =>
      collectorConfirmed && (!needsOverpayment || overpaymentConfirmed);
  bool get throughBank => method == 'bank_transfer';
  bool get isShekel => currency == 'ILS';
  double get value => double.tryParse(amount.text) ?? 0;
  double? get rateValue => isShekel ? 1 : exchangeRates[currency];
  double? get inShekels => rateValue == null || rateValue! <= 0
      ? null
      // Rounded from the decimal text, as the server and the website do: 8.825 is 8.83, not 8.82.
      : (double.tryParse('${value * rateValue!}e2') ?? value * rateValue! * 100)
              .round() /
          100;
  double get owed => max(balance, 0);
  (String, String, String) get currencyLook =>
      paymentCurrencies.firstWhere((look) => look.$1 == currency);
  String get methodText => throughBank
      ? bank == null
          ? 'تحويل بنكي'
          : 'تحويل ${senderBank == null ? '' : 'من $senderBank '}إلى $bank'
      : 'نقد';

  bool _disposed = false;

  /// Change any part of the form and redraw what shows it (unless the page
  /// has gone, as when a payment's answer arrives after it closed).
  void update(VoidCallback change) {
    change();
    if (!_disposed) notifyListeners();
  }

  /// A payment sent before the app closed, still unanswered: shown as it was
  /// sent, to be sent again with the same operation id or discarded.
  void restoreUnconfirmed() {
    final pending = store?.pendingCollection('payment', subscriber['id']);
    if (pending == null) return;
    final sent = Map<String, dynamic>.from(pending['submission'] as Map);
    submission = sent;
    unconfirmed = true;
    collectorConfirmed = true;
    overpaymentConfirmed =
        needsOverpayment = sent['confirm_overpayment'] == true;
    amount.text = '${sent['amount'] ?? ''}';
    currency = '${sent['currency'] ?? 'ILS'}';
    method = '${sent['payment_method'] ?? method}';
    bank = sent['bank_name'] as String?;
    senderBank = sent['sender_bank_name'] as String?;
    bankReceivedOn = DateTime.tryParse('${sent['bank_received_on']}');
    if (sent['sender_name'] != null) sender.text = '${sent['sender_name']}';
    reference.text = '${sent['reference_number'] ?? ''}';
    voucher.text = '${sent['manual_voucher_number'] ?? ''}';
    notes.text = '${sent['notes'] ?? ''}';
    error = unconfirmedMessage;
  }

  /// After the collector checked today's payments: drop the unconfirmed
  /// payment and open the form again for a new one.
  Future<void> discardUnconfirmed() async {
    await _forgetSubmission();
    update(() {
      submission = null;
      unconfirmed = false;
      collectorConfirmed = false;
      needsOverpayment = overpaymentConfirmed = false;
      error = null;
    });
  }

  /// A key of the amount keypad: a digit, '.', 'delete' or 'clear'; at most
  /// ten characters and two decimals.
  void enterAmount(String key) {
    if (!editable) return;
    final current = amount.text;
    var next = current;
    if (key == 'clear') {
      next = '';
    } else if (key == 'delete') {
      next = current.isEmpty ? '' : current.substring(0, current.length - 1);
    } else if (key == '.') {
      if (!current.contains('.')) next = '${current.isEmpty ? '0' : current}.';
    } else if (current.length < 10 &&
        !(current.contains('.') && current.split('.').last.length >= 2)) {
      next = current == '0' ? key : '$current$key';
    }
    update(() {
      amount.text = next;
      needsOverpayment = overpaymentConfirmed = false;
    });
  }

  /// The balance the server reports after the payment; the app's own sum
  /// when an older server sends none.
  double balanceAfter(double recordedInShekels) =>
      receipt?.balanceAfter ?? balance - recordedInShekels;

  /// Back to an empty form for another payment from the same subscriber,
  /// starting from the balance the last one left, as the website's
  /// «دفعة جديدة» does.
  void startAnother(double newBalance) => update(() {
        for (final controller in [amount, reference, notes, voucher]) {
          controller.clear();
        }
        balance = newBalance;
        currency = 'ILS';
        method = defaultMethod;
        bank = null;
        senderBank = null;
        bankReceivedOn = null;
        senderIsSubscriber = true;
        sender.text = subscriberName;
        collectorConfirmed = false;
        needsOverpayment = overpaymentConfirmed = false;
        submission = null;
        receipt = null;
        error = null;
      });

  void toggleSender(bool isSubscriber) => update(() {
        senderIsSubscriber = isSubscriber;
        sender.text = isSubscriber ? subscriberName : '';
      });

  /// What a transfer receipt read on the phone filled in.
  void applyReceipt(Map<String, String> picked) => update(() {
        if (picked['amount'] != null) {
          amount.text = picked['amount']!;
          needsOverpayment = overpaymentConfirmed = false;
        }
        if (picked['reference_number'] != null) {
          reference.text = picked['reference_number']!;
        }
        if (picked['sender_name'] != null) {
          senderIsSubscriber = false;
          sender.text = picked['sender_name']!;
        }
      });

  String? get missingDetail {
    if (!paymentMethods.contains(method)) {
      return 'لا تملك صلاحية تسجيل هذه الدفعة.';
    }
    if (!(value > 0) || !value.isFinite) return 'أدخل مبلغًا أكبر من صفر.';
    if (inShekels == null) {
      return 'لم يُحدَّد سعر صرف ${currencyLook.$3} في إعدادات الموقع.';
    }
    if (throughBank) {
      if (bank == null) return 'اختر البنك أو المحفظة التي حُوّل إليها المبلغ.';
      if (sender.text.trim().isEmpty) {
        return 'أدخل اسم صاحب الحساب الذي حُوّل منه المبلغ.';
      }
      if (reference.text.trim().isEmpty) {
        return 'أدخل الرقم المرجعي من إشعار الحوالة.';
      }
    }
    return null;
  }

  /// The payment as the server takes it, with a new operation id.
  Map<String, dynamic> _newSubmission() => {
        'mobile_operation_id': newOperationId(),
        'collector_confirmed': true,
        'subscription_id': subscriber['id'],
        'amount': amount.text.trim().replaceFirst(RegExp(r'\.$'), ''),
        'currency': currency,
        if (!isShekel) 'exchange_rate': '$rateValue',
        'payment_method': method,
        if (throughBank) ...{
          'bank_name': bank,
          'bank_received_on': bankReceivedOn == null
              ? null
              : bankReceivedDateValue(bankReceivedOn!),
          if (senderBank != null) 'sender_bank_name': senderBank,
          'sender_name': sender.text.trim(),
          'reference_number': reference.text.trim(),
        },
        if (!throughBank && voucher.text.trim().isNotEmpty)
          'manual_voucher_number': voucher.text.trim(),
        'notes': notes.text.trim(),
        'confirm_overpayment': overpaymentConfirmed,
      };

  /// Send the payment, or send again the one already sent: the same
  /// operation id, so the server records it once. Kept on the phone until
  /// the server records or refuses it.
  Future<void> submit() async {
    if (busy || scanning || !readyToSend) return;
    if (submission == null && missingDetail != null) {
      update(() => error = missingDetail);
      return;
    }
    update(() {
      busy = true;
      error = null;
    });
    try {
      submission ??= _newSubmission();
      await _rememberSubmission();
      final result =
          CollectionReceipt.fromJson(await api.sendCollection(submission!));
      await _forgetSubmission();
      recordedAny = true;
      unconfirmed = false;
      receipt = result;
    } on FormatException catch (problem, stack) {
      // An answer the app cannot read: the payment may be recorded, so it
      // stays on the phone to send again with the same operation id.
      unawaited(Diagnostics.record(problem, stack, where: 'payment_form'));
      unconfirmed = true;
      error = unconfirmedMessage;
    } on ApiException catch (exception) {
      final uncertain = exception.isNetwork || exception.statusCode >= 500;
      if (!uncertain) {
        await _forgetSubmission();
        submission = null;
      }
      unconfirmed = uncertain;
      needsOverpayment = needsOverpayment ||
          exception.errors.containsKey('confirm_overpayment');
      error = uncertain ? unconfirmedMessage : exception.message;
    } finally {
      update(() => busy = false);
    }
  }

  Future<void> _rememberSubmission() async {
    final store = this.store;
    if (store == null || submission == null) return;
    try {
      await store.rememberCollection(
          kind: 'payment',
          subscriber: subscriber,
          submission: submission!,
          summary:
              'دفعة ${submission!['amount']} ${submission!['currency']} من $subscriberName');
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'payment_form'));
      // The payment is still sent; only its copy on the phone is missing.
    }
  }

  Future<void> _forgetSubmission() async {
    final store = this.store;
    final operationId = submission?['mobile_operation_id'];
    if (store == null || operationId == null) return;
    try {
      await store.forgetCollection(operationId);
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'payment_form'));
      // Kept on the phone; sending it again is answered with the same payment.
    }
  }

  @override
  void dispose() {
    _disposed = true;
    for (final controller in [amount, sender, reference, notes, voucher]) {
      controller.dispose();
    }
    super.dispose();
  }
}
