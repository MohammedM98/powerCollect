import 'package:flutter/material.dart';

import 'api_client.dart';
import 'app_balance.dart';
import 'app_identity.dart';
import 'field_store.dart';
import 'search_text.dart';

class AdjustmentPage extends StatefulWidget {
  const AdjustmentPage(
      {required this.api,
      required this.subscriber,
      required this.action,
      required this.title,
      this.chargeType,
      this.store,
      super.key});
  final ApiClient api;

  /// Where a movement sent without a settling answer is kept (see
  /// [FieldStore.pendingCollections]).
  final FieldStore? store;
  final Map<String, dynamic> subscriber;
  final String action;
  final String title;
  final Map<String, dynamic>? chargeType;

  @override
  State<AdjustmentPage> createState() => _AdjustmentPageState();
}

class _AdjustmentPageState extends State<AdjustmentPage> {
  final form = GlobalKey<FormState>();
  final amount = TextEditingController();
  final notes = TextEditingController();
  final voucher = TextEditingController();
  bool busy = false;
  bool accessDenied = false;
  String? error;
  Map<String, dynamic>? submission;

  /// The movement on screen was sent earlier without an answer.
  bool unconfirmed = false;
  String get pendingKind => 'adjustment:${widget.action}';
  double get balance => double.tryParse('${widget.subscriber['balance']}') ?? 0;
  bool get isCharge => widget.action == 'charge';
  bool get isClearing => widget.action == 'clearing';
  bool get minimum => widget.chargeType?['value'] == 'minimum_charge';
  String get enteredAmount => normalizeSearch(amount.text).replaceAll('٫', '.');
  double get value => double.tryParse(enteredAmount) ?? 0;

  @override
  void initState() {
    super.initState();
    final usual = minimum
        ? widget.subscriber['minimum_payment']
        : widget.chargeType?['usualAmount'];
    if (usual != null) amount.text = '$usual';
    restoreUnconfirmed();
  }

  static const unconfirmedMessage =
      'لم يصل تأكيد التسجيل. أعد المحاولة بنفس البيانات؛ لن تُسجّل الحركة مرتين.';

  /// A movement sent before the app closed, still unanswered: shown as sent,
  /// to be sent again with the same operation id or discarded.
  void restoreUnconfirmed() {
    final pending =
        widget.store?.pendingCollection(pendingKind, widget.subscriber['id']);
    if (pending == null) return;
    final sent = Map<String, dynamic>.from(pending['submission'] as Map);
    if (isCharge && sent['type'] != widget.chargeType?['value']) return;
    submission = sent;
    unconfirmed = true;
    amount.text = '${sent['amount'] ?? sent['value'] ?? ''}';
    notes.text = '${sent['notes'] ?? ''}';
    voucher.text = '${sent['manual_voucher_number'] ?? ''}';
    error = unconfirmedMessage;
  }

  Future<void> rememberSubmission() async {
    final store = widget.store;
    if (store == null || submission == null) return;
    try {
      await store.rememberCollection(
          kind: pendingKind,
          subscriber: widget.subscriber,
          submission: submission!,
          summary:
              '${widget.title} ${submission!['amount'] ?? submission!['value']} ₪ على ${widget.subscriber['full_name']}');
    } catch (_) {
      // The movement is still sent; only its copy on the phone is missing.
    }
  }

  Future<void> forgetSubmission() async {
    final store = widget.store;
    final operationId = submission?['mobile_operation_id'];
    if (store == null || operationId == null) return;
    try {
      await store.forgetCollection(operationId);
    } catch (_) {
      // Kept on the phone; sending it again is answered with the same movement.
    }
  }

  /// After checking the statement, drop the unconfirmed movement and open
  /// the form again.
  Future<void> discardUnconfirmed() async {
    if (!await confirm(
        'تجاهل الحركة غير المؤكدة؟',
        'تحقق أولًا من السجل المالي: إن وصلت هذه الحركة للخادم فلا تسجلها مرة أخرى.',
        'تجاهلها')) {
      return;
    }
    await forgetSubmission();
    if (!mounted) return;
    setState(() {
      submission = null;
      unconfirmed = false;
      error = null;
    });
  }

  @override
  void dispose() {
    amount.dispose();
    notes.dispose();
    voucher.dispose();
    super.dispose();
  }

  Future<bool> confirm(String title, String message, String label) async =>
      await showAppSheet<
          bool>(context, title: title, message: message, children: [
        Builder(
            builder: (sheetContext) => Row(children: [
                  Expanded(
                      child: AppAction(
                          label: 'إلغاء',
                          primary: false,
                          onPressed: () => Navigator.pop(sheetContext, false))),
                  const SizedBox(width: 8),
                  Expanded(
                      child: AppAction(
                          label: label,
                          onPressed: () => Navigator.pop(sheetContext, true))),
                ]))
      ]) ==
      true;

  Future<void> close() async {
    if (busy) return;
    if (MediaQuery.viewInsetsOf(context).bottom > 0) {
      FocusScope.of(context).unfocus();
      return;
    }
    if (submission != null) {
      if (!await confirm(
          'لم يصل تأكيد الحركة',
          'قد تكون الحركة سُجّلت. يمكنك إعادة المحاولة من هذه الشاشة بأمان. إذا غادرت، تحقق من السجل المالي قبل تسجيل حركة جديدة.',
          'مغادرة')) {
        return;
      }
    } else if (amount.text.isNotEmpty ||
        notes.text.isNotEmpty ||
        voucher.text.isNotEmpty) {
      if (!await confirm(
          'مغادرة النموذج؟', 'لن تُحفظ البيانات المدخلة.', 'مغادرة')) {
        return;
      }
    }
    if (mounted) Navigator.pop(context, false);
  }

  Future<void> submit() async {
    if (busy) return;
    if (submission == null) {
      if (!form.currentState!.validate()) return;
      FocusScope.of(context).unfocus();
      final after = isCharge ? balance + value : balance - value;
      final accepted = await confirm(
          'تأكيد ${widget.title}؟',
          '${widget.subscriber['full_name']}\nالمبلغ: ${AppIdentity.grouped(value)} ₪\nالرصيد بعد الحركة: ${balanceText(after)}',
          'تأكيد التسجيل');
      if (!accepted || !mounted) return;
      submission = {
        'mobile_operation_id': newOperationId(),
        'action': widget.action,
        if (isCharge) 'type': widget.chargeType!['value'],
        if (widget.action == 'discount') ...{
          'method': 'shekel',
          'value': enteredAmount
        } else
          'amount': enteredAmount,
        'notes': notes.text.trim(),
        if (isClearing) ...{
          'manual_voucher_number': voucher.text.trim(),
          'confirm_over_balance': after < 0,
        },
      };
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await rememberSubmission();
      await widget.api
          .sendAdjustment(widget.subscriber['id'] as int, submission!);
      await forgetSubmission();
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (exception) {
      accessDenied = [401, 403, 404].contains(exception.statusCode);
      final uncertain = exception.isNetwork || exception.statusCode >= 500;
      if (exception.statusCode >= 400 && exception.statusCode < 500) {
        await forgetSubmission();
        submission = null;
      }
      unconfirmed = uncertain;
      if (mounted) {
        setState(() => error = accessDenied
            ? 'لم تعد هذه العملية متاحة لحسابك. ارجع إلى المشترك لتحديث الصلاحيات، أو سجّل الدخول مجددًا إذا انتهت الجلسة.'
            : exception.isNetwork || exception.statusCode >= 500
                ? unconfirmedMessage
                : exception.message);
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
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
            title: widget.title,
            subtitle: '${widget.subscriber['full_name']}',
            onBack: close),
        Expanded(
            child: Form(
                key: form,
                child: ListView(padding: const EdgeInsets.all(16), children: [
                  AppNotice('الرصيد الحالي: ${balanceText(balance)}'),
                  const SizedBox(height: 16),
                  TextFormField(
                      key: const ValueKey('adjustment-amount'),
                      controller: amount,
                      enabled: !busy &&
                          !accessDenied &&
                          submission == null &&
                          !minimum,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      textDirection: TextDirection.ltr,
                      decoration: const InputDecoration(
                          labelText: 'المبلغ بالشيكل', suffixText: '₪'),
                      validator: (_) {
                        if (!RegExp(r'^\d+(\.\d{1,2})?$')
                                .hasMatch(enteredAmount) ||
                            value <= 0) {
                          return 'أدخل مبلغًا موجبًا بمنزلتين عشريتين كحد أقصى.';
                        }
                        if (widget.action == 'discount' && value > balance) {
                          return 'لا يمكن أن يزيد الخصم عن الرصيد المستحق.';
                        }
                        return null;
                      }),
                  const SizedBox(height: 16),
                  TextFormField(
                      key: const ValueKey('adjustment-notes'),
                      controller: notes,
                      enabled: !busy && !accessDenied && submission == null,
                      minLines: 2,
                      maxLines: 4,
                      maxLength: 1000,
                      decoration: InputDecoration(
                          labelText: isClearing
                              ? 'الخدمة المقدمة من المشترك'
                              : 'التفاصيل'),
                      validator: (_) => (isClearing ||
                                  widget.chargeType?['needsReason'] == true) &&
                              notes.text.trim().isEmpty
                          ? 'اكتب تفاصيل الحركة لتظهر في كشف الحساب.'
                          : null),
                  if (isClearing) ...[
                    const SizedBox(height: 16),
                    TextFormField(
                        controller: voucher,
                        enabled: !busy && !accessDenied && submission == null,
                        maxLength: 50,
                        decoration: const InputDecoration(
                            labelText: 'رقم السند الورقي (اختياري)')),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 16),
                    AppNotice(error!, error: true)
                  ],
                  if (unconfirmed && !busy && widget.store != null)
                    Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: TextButton(
                            key: const ValueKey('adjustment-discard'),
                            onPressed: discardUnconfirmed,
                            child: const Text(
                                'تحققت من السجل المالي: تجاهل هذه الحركة'))),
                ]))),
        Padding(
            padding: const EdgeInsets.all(16),
            child: AppAction(
                key: const ValueKey('adjustment-submit'),
                label: accessDenied
                    ? 'العودة إلى المشترك'
                    : submission == null
                        ? 'مراجعة وتسجيل'
                        : 'إعادة المحاولة',
                busy: busy,
                onPressed: busy
                    ? null
                    : accessDenied
                        ? () => Navigator.pop(context, false)
                        : submit)),
      ]))));
}
