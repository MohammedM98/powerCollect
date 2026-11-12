part of 'split_payment_page.dart';

/// The recorded transfer and each share's balance after it.
extension _SplitSuccess on _SplitPaymentPageState {
  Widget success() => ListView(padding: const EdgeInsets.all(16), children: [
        const AppNotice('تم تسجيل الحوالة وحصص الاشتراكات معًا.',
            success: true),
        const SizedBox(height: 16),
        Text('المرجع: ${receipt!['reference_number']}',
            style: AppIdentity.body(16, weight: FontWeight.w700)),
        Text('الإجمالي: ${receipt!['total_amount']} ₪',
            style: AppIdentity.body(16)),
        const SizedBox(height: 8),
        Text('البنك المستلم: ${receipt!['bank_name'] ?? bank ?? '—'}',
            style: AppIdentity.body(14)),
        if ((receipt!['sender_bank_name'] ?? senderBank) != null)
          Text('البنك المرسل: ${receipt!['sender_bank_name'] ?? senderBank}',
              style: AppIdentity.body(14)),
        Text('اسم المحوّل: ${receipt!['sender_name'] ?? sender.text}',
            style: AppIdentity.body(14)),
        if ('${receipt!['notes'] ?? notes.text}'.trim().isNotEmpty)
          Text('ملاحظات: ${receipt!['notes'] ?? notes.text}',
              style: AppIdentity.body(14)),
        if (receipt!['bank_received_on'] != null)
          Text(
              'وصول الحوالة إلى البنك: ${'${receipt!['bank_received_on']}'.split('-').reversed.join('/')}',
              style: AppIdentity.body(14)),
        const AppSection('الاشتراكات والأرصدة بعد التسجيل'),
        ...((receipt!['parts'] as List?) ?? []).cast<Map>().map((part) => ListTile(
            title: Text('${part['subscription']}'),
            subtitle: Text('الرصيد بعد الدفعة: ${part['balance_after']}'),
            trailing: Text('${part['amount']} ₪'))),
        const SizedBox(height: 16),
        AppAction(label: 'تم', onPressed: close),
      ]);
}
