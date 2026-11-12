part of 'split_payment_page.dart';

/// A transfer sent without a settling answer: restored as sent, kept on the phone, forgotten once settled, or discarded.
extension _SplitUnconfirmed on _SplitPaymentPageState {
  /// A transfer sent before the app closed, still unanswered: shown as sent,
  /// to be sent again with the same operation id or discarded.
  void restoreUnconfirmed() {
    final pending =
        widget.store?.pendingCollection('split', widget.subscriber['id']);
    if (pending == null) return;
    final sent = Map<String, dynamic>.from(pending['submission'] as Map);
    final shares = [
      for (final part in (sent['parts'] as List? ?? []))
        Map<String, dynamic>.from(part as Map)
    ];
    final people = [
      for (final person
          in ((pending['context'] as Map?)?['subscribers'] as List? ?? []))
        Map<String, dynamic>.from(person as Map)
    ];
    if (people.length != shares.length) return;
    submission = sent;
    unconfirmed = true;
    confirmed = true;
    total.text = '${sent['total_amount'] ?? ''}';
    bank = sent['bank_name'] as String?;
    senderBank = sent['sender_bank_name'] as String?;
    bankReceivedOn = DateTime.tryParse('${sent['bank_received_on']}');
    sender.text = '${sent['sender_name'] ?? ''}';
    reference.text = '${sent['reference_number'] ?? ''}';
    notes.text = '${sent['notes'] ?? ''}';
    overpaymentConfirmed = needsOverpayment = sent['confirm_overpayment'] == true;
    duplicateConfirmed =
        needsDuplicate = sent['confirm_duplicate_reference'] == true;
    for (final part in parts) {
      part.amount.dispose();
    }
    parts
      ..clear()
      ..addAll([
        for (var index = 0; index < shares.length; index++)
          _SplitPart(people[index])
            ..amount.text = '${shares[index]['amount'] ?? ''}'
      ]);
    error = _SplitPaymentPageState.unconfirmedMessage;
  }

  Future<void> rememberSubmission() async {
    final store = widget.store;
    if (store == null || submission == null) return;
    try {
      await store.rememberCollection(
          kind: 'split',
          subscriber: widget.subscriber,
          submission: submission!,
          summary:
              'حوالة مقسّمة ${submission!['total_amount']} ₪ بمرجع ${submission!['reference_number']}',
          context: {
            'subscribers': [
              for (final part in parts)
                {
                  for (final key in [
                    'id',
                    'full_name',
                    'account_number',
                    'balance'
                  ])
                    key: part.subscriber[key],
                }
            ],
          });
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'split_payment_page'));
      // The transfer is still sent; only its copy on the phone is missing.
    }
  }

  Future<void> forgetSubmission() async {
    final store = widget.store;
    final operationId = submission?['mobile_operation_id'];
    if (store == null || operationId == null) return;
    try {
      await store.forgetCollection(operationId);
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'split_payment_page'));
      // Kept on the phone; sending it again is answered with the same transfer.
    }
  }

  /// After checking today's payments, drop the unconfirmed transfer and
  /// open the form again.
  Future<void> discardUnconfirmed() async {
    final discard = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
                title: const Text('تجاهل الحوالة غير المؤكدة؟'),
                content: const Text(
                    'تحقق أولًا من دفعات اليوم: إن وصلت هذه الحوالة للخادم فلا تسجلها مرة أخرى.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialogContext, false),
                      child: const Text('رجوع')),
                  TextButton(
                      key: const ValueKey('split-discard-confirm'),
                      onPressed: () => Navigator.pop(dialogContext, true),
                      child: const Text('تجاهلها')),
                ]));
    if (discard != true || !mounted) return;
    await forgetSubmission();
    if (!mounted) return;
    change(() {
      submission = null;
      unconfirmed = false;
      confirmed = false;
      error = null;
    });
  }
}
