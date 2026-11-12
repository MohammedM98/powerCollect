import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/api_client.dart';
import 'bank_received_date_field.dart';
import '../design/app_balance.dart';
import '../design/app_identity.dart';
import '../core/field_store.dart';
import '../core/diagnostics.dart';

part 'split_payment_unconfirmed.dart';
part 'split_payment_success.dart';

int? splitAmountCents(String value) {
  final match = RegExp(r'^(\d+)(?:\.(\d{1,2}))?$').firstMatch(value.trim());
  if (match == null) return null;
  final whole = int.tryParse(match.group(1)!);
  if (whole == null || whole > 1000000) return null;
  final cents =
      whole * 100 + int.parse((match.group(2) ?? '').padRight(2, '0'));
  return cents <= 100000000 ? cents : null;
}

class _SplitPart {
  _SplitPart(this.subscriber);
  final Map<String, dynamic> subscriber;
  final amount = TextEditingController();
}

class SplitPaymentPage extends StatefulWidget {
  const SplitPaymentPage(
      {required this.api,
      required this.subscriber,
      required this.transferBanks,
      this.senderBanks = const [],
      this.store,
      super.key});
  final ApiClient api;

  /// Where a transfer sent without a settling answer is kept (see
  /// [FieldStore.pendingCollections]).
  final FieldStore? store;
  final Map<String, dynamic> subscriber;
  final List<String> transferBanks;
  final List<String> senderBanks;
  @override
  State<SplitPaymentPage> createState() => _SplitPaymentPageState();
}

class _SplitPaymentPageState extends State<SplitPaymentPage> {
  /// Redraw after [update], for the parts of this library.
  void change(VoidCallback update) => setState(update);

  final total = TextEditingController();
  final sender = TextEditingController();
  final reference = TextEditingController();
  final notes = TextEditingController();
  final search = TextEditingController();
  late final List<_SplitPart> parts = [_SplitPart(widget.subscriber)];
  List<Map<String, dynamic>> results = [];
  Timer? searchTimer;
  int searchVersion = 0;
  String? bank, senderBank, error, searchError;
  DateTime? bankReceivedOn;
  bool busy = false, searching = false, confirmed = false;
  bool needsOverpayment = false, overpaymentConfirmed = false;
  bool needsDuplicate = false, duplicateConfirmed = false;
  Map<String, dynamic>? submission, receipt;

  /// The transfer on screen was sent earlier without an answer.
  bool unconfirmed = false;
  bool get locked => busy || submission != null;
  int get allocated => parts.fold(
      0, (sum, part) => sum + (splitAmountCents(part.amount.text) ?? 0));
  int get remaining => (splitAmountCents(total.text) ?? 0) - allocated;
  bool get valid =>
      parts.length >= 2 &&
      bank != null &&
      sender.text.trim().isNotEmpty &&
      reference.text.trim().isNotEmpty &&
      (splitAmountCents(total.text) ?? 0) > 0 &&
      remaining == 0 &&
      parts.every((part) => (splitAmountCents(part.amount.text) ?? 0) > 0) &&
      confirmed &&
      (!needsOverpayment || overpaymentConfirmed) &&
      (!needsDuplicate || duplicateConfirmed);

  static const unconfirmedMessage =
      'لم نتمكن من تأكيد التسجيل. أعد المحاولة هنا بنفس البيانات؛ لا تنشئ حوالة أخرى قبل التحقق من دفعات اليوم.';

  @override
  void initState() {
    super.initState();
    restoreUnconfirmed();
  }

  @override
  void dispose() {
    searchTimer?.cancel();
    for (final controller in [
      total,
      sender,
      reference,
      notes,
      search,
      ...parts.map((part) => part.amount)
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void changed(String _) => setState(() {
        confirmed = false;
        overpaymentConfirmed = false;
        duplicateConfirmed = false;
        needsOverpayment = false;
        needsDuplicate = false;
      });

  void findSubscribers(String term) {
    searchTimer?.cancel();
    final version = ++searchVersion;
    setState(() {
      results = [];
      searching = term.trim().length >= 2;
      searchError = null;
    });
    if (term.trim().length < 2) return;
    searchTimer = Timer(const Duration(milliseconds: 300), () async {
      try {
        final response =
            await widget.api.findCollectionSubscribers(term.trim());
        if (!mounted || version != searchVersion) return;
        setState(() {
          results = List<Map<String, dynamic>>.from((response['data'] as List)
                  .map((row) => Map<String, dynamic>.from(row as Map)))
              .where((row) =>
                  !parts.any((part) => part.subscriber['id'] == row['id']))
              .toList();
        });
      } on ApiException catch (exception) {
        if (mounted && version == searchVersion) {
          setState(() => searchError = exception.message);
        }
      } finally {
        if (mounted && version == searchVersion) {
          setState(() => searching = false);
        }
      }
    });
  }

  Future<void> submit() async {
    if (busy || (submission == null && !valid)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      busy = true;
      error = null;
    });
    submission ??= {
      'mobile_operation_id': newOperationId(),
      'collector_confirmed': true,
      'total_amount': total.text.trim(),
      'bank_name': bank,
      'bank_received_on': bankReceivedOn == null
          ? null
          : bankReceivedDateValue(bankReceivedOn!),
      'sender_bank_name': senderBank,
      'sender_name': sender.text.trim(),
      'reference_number': reference.text.trim(),
      'notes': notes.text.trim(),
      'confirm_overpayment': overpaymentConfirmed,
      'confirm_duplicate_reference': duplicateConfirmed,
      'parts': parts
          .map((part) => {
                'subscription_id': part.subscriber['id'],
                'amount': part.amount.text.trim()
              })
          .toList(),
    };
    try {
      await rememberSubmission();
      final response = await widget.api.sendSplitPayment(submission!);
      await forgetSubmission();
      unconfirmed = false;
      if (mounted) setState(() => receipt = response);
    } on ApiException catch (exception) {
      final uncertain = exception.isNetwork || exception.statusCode >= 500;
      if (!uncertain) {
        await forgetSubmission();
        submission = null;
      }
      unconfirmed = uncertain;
      if (mounted) {
        setState(() {
          needsOverpayment = needsOverpayment ||
              exception.errors.containsKey('confirm_overpayment');
          needsDuplicate = needsDuplicate ||
              (exception.errors.containsKey('reference_number') &&
                  exception.message.contains('مسبق'));
          error = uncertain ? unconfirmedMessage : exception.message;
        });
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> close() async {
    if (dismissAppKeyboard(context)) return;
    if (busy) return;
    if (receipt == null &&
        (submission != null ||
            sender.text.isNotEmpty ||
            total.text.isNotEmpty ||
            parts.length > 1)) {
      final leave = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
                title: const Text('إغلاق الحوالة المقسّمة؟'),
                content: Text(submission != null
                    ? 'قد تكون الحوالة سُجّلت. الأفضل إعادة التحقق هنا بنفس البيانات. إذا أغلقت الشاشة، تحقق من دفعات اليوم قبل تسجيل أي حوالة بديلة.'
                    : 'ستُفقد البيانات التي أدخلتها في هذه الشاشة.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('متابعة')),
                  TextButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('إغلاق'))
                ],
              ));
      if (leave != true || !mounted) return;
    }
    if (mounted) Navigator.pop(context, receipt != null);
  }

  Widget input(String label, TextEditingController controller, String key,
          {bool money = false, int maxLength = 255}) =>
      Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: TextField(
            key: ValueKey(key),
            controller: controller,
            enabled: !locked,
            onChanged: changed,
            maxLength: maxLength,
            keyboardType: money
                ? const TextInputType.numberWithOptions(decimal: true)
                : TextInputType.text,
            textDirection: money ? TextDirection.ltr : null,
            inputFormatters: money
                ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))]
                : null,
            decoration: InputDecoration(labelText: label, counterText: ''),
          ));

  Widget bankField(String label, String? value, List<String> options,
          void Function(String?) change, String key) =>
      Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: DropdownButtonFormField<String>(
            key: ValueKey(key),
            initialValue: value,
            isExpanded: true,
            decoration: InputDecoration(labelText: label),
            items: [
              if (key == 'split-sender-bank')
                const DropdownMenuItem<String>(
                    value: '', child: Text('غير محدد')),
              ...options.map((name) => DropdownMenuItem(
                  value: name,
                  child: Text(name, overflow: TextOverflow.ellipsis)))
            ],
            onChanged: locked
                ? null
                : (next) {
                    change(next == '' ? null : next);
                    changed('');
                  },
          ));

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
              title: 'دفعة مقسّمة',
              subtitle: 'حوالة بنكية واحدة لعدة اشتراكات',
              onBack: busy ? null : close),
          Expanded(
              child: receipt != null
                  ? success()
                  : ListView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      children: [
                          if (error != null) ...[
                            AppNotice(error!, error: true),
                            const SizedBox(height: 12)
                          ],
                          if (unconfirmed && !busy && widget.store != null)
                            Align(
                                alignment: AlignmentDirectional.centerStart,
                                child: TextButton(
                                    key: const ValueKey('split-discard'),
                                    onPressed: discardUnconfirmed,
                                    child: const Text(
                                        'تحققت من دفعات اليوم: تجاهل هذه الحوالة'))),
                          const AppSection('بيانات الحوالة'),
                          AppPanel(
                              child: Column(children: [
                            input('إجمالي الحوالة (شيكل)', total, 'split-total',
                                money: true),
                            bankField(
                                'البنك المستلم',
                                bank,
                                widget.transferBanks,
                                (value) => bank = value,
                                'split-bank'),
                            if (widget.senderBanks.isNotEmpty)
                              bankField(
                                  'البنك المرسل',
                                  senderBank,
                                  widget.senderBanks,
                                  (value) => senderBank = value,
                                  'split-sender-bank'),
                            input('اسم المرسل', sender, 'split-sender'),
                            BankReceivedDateField(
                                value: bankReceivedOn,
                                enabled: !locked,
                                onChanged: (date) =>
                                    setState(() => bankReceivedOn = date)),
                            input('الرقم المرجعي', reference, 'split-reference',
                                maxLength: 100),
                            input('ملاحظات', notes, 'split-notes',
                                maxLength: 1000),
                          ])),
                          const AppSection('توزيع الحوالة',
                              note: 'اختر من 2 إلى 20 اشتراكًا'),
                          ...parts.map((part) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: AppPanel(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                    Row(children: [
                                      Expanded(
                                          child: Text(
                                              '${part.subscriber['full_name']}',
                                              style: AppIdentity.body(16,
                                                  weight: FontWeight.w700))),
                                      IconButton(
                                          tooltip: 'إزالة الاشتراك',
                                          onPressed: locked
                                              ? null
                                              : () {
                                                  setState(() {
                                                    parts.remove(part);
                                                    confirmed = false;
                                                  });
                                                  part.amount.dispose();
                                                },
                                          icon:
                                              const Icon(Icons.close, size: 20))
                                    ]),
                                    Text(
                                        'حساب ${part.subscriber['account_number']} · ${balanceText(double.tryParse('${part.subscriber['balance']}') ?? 0)}',
                                        style: AppIdentity.body(13,
                                            color: AppIdentity.muted)),
                                    const SizedBox(height: 12),
                                    input('حصة الاشتراك (شيكل)', part.amount,
                                        'split-part-${part.subscriber['id']}',
                                        money: true),
                                  ])))),
                          if (!locked && parts.length < 20) ...[
                            TextField(
                                key: const ValueKey('split-search'),
                                controller: search,
                                onChanged: findSubscribers,
                                decoration: const InputDecoration(
                                    labelText: 'إضافة اشتراك',
                                    hintText: 'الاسم أو رقم الاشتراك',
                                    prefixIcon: Icon(Icons.search))),
                            if (searching) const LinearProgressIndicator(),
                            if (searchError != null)
                              AppNotice(searchError!, error: true),
                            ...results.map((row) => ListTile(
                                key: ValueKey('split-add-${row['id']}'),
                                title: Text('${row['full_name']}'),
                                subtitle: Text('${row['account_number']}'),
                                trailing: const Icon(Icons.add_circle_outline),
                                onTap: () => setState(() {
                                      parts.add(_SplitPart(row));
                                      results = [];
                                      search.clear();
                                      searchVersion++;
                                      confirmed = false;
                                    }))),
                          ],
                          const SizedBox(height: 16),
                          AppNotice(
                              'الموزّع: ${AppIdentity.grouped(allocated / 100)} ₪ · المتبقي: ${AppIdentity.grouped(remaining / 100)} ₪',
                              success: remaining == 0 && allocated > 0),
                          if (needsOverpayment)
                            CheckboxListTile(
                                key: const ValueKey('split-overpayment'),
                                value: overpaymentConfirmed,
                                onChanged: locked
                                    ? null
                                    : (value) => setState(() =>
                                        overpaymentConfirmed = value == true),
                                title: const Text(
                                    'راجعت التوزيع وأؤكد المبالغ التي تتجاوز المستحق')),
                          if (needsDuplicate)
                            CheckboxListTile(
                                key: const ValueKey('split-duplicate'),
                                value: duplicateConfirmed,
                                onChanged: locked
                                    ? null
                                    : (value) => setState(() =>
                                        duplicateConfirmed = value == true),
                                title: const Text(
                                    'راجعت المرجع وأؤكد تسجيل حوالة أخرى بالمرجع نفسه')),
                          CheckboxListTile(
                              key: const ValueKey('split-confirm'),
                              value: confirmed,
                              onChanged: locked
                                  ? null
                                  : (value) =>
                                      setState(() => confirmed = value == true),
                              title: const Text(
                                  'راجعت بيانات الحوالة وحصة كل اشتراك')),
                        ])),
          if (receipt == null)
            Padding(
                padding: const EdgeInsets.all(16),
                child: AppAction(
                    key: const ValueKey('split-submit'),
                    label: submission != null
                        ? 'إعادة التحقق من التسجيل'
                        : 'تسجيل الحوالة المقسّمة',
                    icon: 'cash',
                    busy: busy,
                    onPressed: !busy && (submission != null || valid)
                        ? submit
                        : null)),
        ]))),
      );

}
