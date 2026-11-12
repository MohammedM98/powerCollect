part of 'payment_page.dart';

/// The summary, the collector's confirmation, the method tiles and fields, and the recorded payment.
extension _SummarySection on _PaymentPageState {
  Widget summary() {
    final after = inShekels == null ? null : balance - inShekels!;
    final coverage = owed > 0 && inShekels != null
        ? min(100, (inShekels! / owed * 100).round())
        : null;
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: AppHero(
          radius: 22,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Column(children: [
            summaryRow('الرصيد الحالي', balanceText(balance),
                color: balanceColor(balance, onHero: true)),
            summaryRow(
                'هذه الدفعة', '${AppIdentity.grouped(inShekels ?? 0)} ₪'),
            Container(
                margin: const EdgeInsets.symmetric(vertical: 4),
                height: 1,
                color: const Color(0x22FFFFFF)),
            summaryRow(
                'الرصيد بعد الدفعة', after == null ? '—' : balanceText(after),
                color: after == null
                    ? const Color(0x80FFFFFF)
                    : balanceColor(after, onHero: true)),
            if (coverage != null) ...[
              summaryRow('تغطية المبلغ المستحق', '$coverage%'),
              Padding(
                  padding: const EdgeInsets.only(top: 2, bottom: 6),
                  child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                          value: coverage / 100,
                          minHeight: 6,
                          color: AppIdentity.heroGood,
                          backgroundColor: const Color(0x1FFFFFFF)))),
            ],
            summaryRow('الطريقة', methodText),
          ])),
    );
  }

  Widget summaryRow(String title, String text, {Color color = Colors.white}) =>
      Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
                child: Text(title,
                    style: AppIdentity.body(13.5,
                        color: const Color(0xBFFFFFFF)))),
            const SizedBox(width: 10),
            Expanded(
                child: Text(text,
                    textAlign: TextAlign.end,
                    style: AppIdentity.number(13.5, color: color)
                        .copyWith(fontFamily: 'PlexArabic'))),
          ]));

  Widget confirmation() => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Semantics(
          checked: collectorConfirmed,
          child: InkWell(
            key: const ValueKey('payment-confirm'),
            borderRadius: BorderRadius.circular(18),
            onTap: busy || scanning
                ? null
                : () =>
                    change(() => collectorConfirmed = !collectorConfirmed),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                  color: AppIdentity.surface,
                  border: Border.all(
                      color: collectorConfirmed
                          ? AppIdentity.good
                          : AppIdentity.lineSoft,
                      width: 1.5),
                  borderRadius: BorderRadius.circular(18)),
              child:
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                    width: 22,
                    height: 22,
                    margin: const EdgeInsets.only(top: 1),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                        color: collectorConfirmed
                            ? AppIdentity.good
                            : Colors.transparent,
                        border: Border.all(
                            color: collectorConfirmed
                                ? AppIdentity.good
                                : AppIdentity.line,
                            width: 2),
                        borderRadius: BorderRadius.circular(7)),
                    child: collectorConfirmed
                        ? const AppIcon('check',
                            size: 15, strokeWidth: 3, color: Colors.white)
                        : null),
                const SizedBox(width: 10),
                Expanded(
                    child: Text(
                        'أؤكد استلام هذه الدفعة من $subscriberName وتسجيلها مباشرة في السجل المالي.',
                        style: AppIdentity.body(13.5))),
              ]),
            ),
          ),
        ),
      );

  Widget detailField(String hint, TextEditingController controller,
          {required String key, bool ltr = false, bool readOnly = false}) =>
      TextField(
        key: ValueKey(key),
        controller: controller,
        enabled: editable,
        readOnly: readOnly,
        textDirection: ltr ? TextDirection.ltr : null,
        textAlign: ltr ? TextAlign.right : TextAlign.start,
        style: ltr
            ? AppIdentity.number(15, weight: FontWeight.w500)
            : AppIdentity.body(15,
                color: readOnly ? AppIdentity.muted : AppIdentity.ink),
        onTap: () => change(() => showKeypad = false),
        onTapOutside: (_) => FocusScope.of(context).unfocus(),
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => FocusScope.of(context).unfocus(),
        onChanged: (_) => change(() {}),
        decoration: InputDecoration(
            hintText: hint,
            hintStyle: ltr
                ? AppIdentity.number(15,
                    weight: FontWeight.w500, color: AppIdentity.faint)
                : null,
            fillColor: readOnly ? AppIdentity.raised : AppIdentity.surface),
      );

  Widget methodTile(String key, String title, String icon) => Expanded(
        child: InkWell(
            key: ValueKey('payment-method-$key'),
            onTap: editable ? () => change(() => method = key) : null,
            borderRadius: BorderRadius.circular(18),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
              decoration: BoxDecoration(
                  color: method == key
                      ? AppIdentity.brandSoft
                      : AppIdentity.surface,
                  border: Border.all(
                      color:
                          method == key ? AppIdentity.brand : AppIdentity.line,
                      width: method == key ? 2.5 : 1.5),
                  borderRadius: BorderRadius.circular(18)),
              child: Column(children: [
                AppIcon(icon,
                    size: 24,
                    color:
                        method == key ? AppIdentity.brand : AppIdentity.muted),
                const SizedBox(height: 6),
                Text(title,
                    textAlign: TextAlign.center,
                    style: AppIdentity.body(13.5,
                        weight: FontWeight.w700,
                        color: method == key
                            ? AppIdentity.brand
                            : AppIdentity.ink2))
              ]),
            )),
      );

  Widget success() {
    final recordedInShekels =
        double.tryParse('${receipt?['amount_in_shekels']}') ?? inShekels ?? 0;
    final newBalance = balanceAfter(recordedInShekels);
    final recordedAmount = receipt?['amount'] ?? amount.text;
    final recordedReference = receipt?['reference_number'] ?? reference.text;
    final recordedVoucher = receipt?['voucher_number'] ?? '—';
    return AppSuccess(
      title: 'تم تسجيل الدفعة',
      message:
          '${AppIdentity.money(recordedAmount)} ${currencyLook.$3} من $subscriberName · سُجّلت مباشرة في السجل المالي.',
      facts: [
        (
          throughBank ? 'رقم المرجع' : 'رقم السند',
          AppFact('${throughBank ? recordedReference : recordedVoucher}',
              number: true)
        ),
        (
          'المبلغ',
          AppFact('${AppIdentity.money(recordedAmount)} ${currencyLook.$2}',
              number: true)
        ),
        if (!isShekel)
          (
            'بالشيكل',
            AppFact('${AppIdentity.grouped(recordedInShekels)} ₪', number: true)
          ),
        ('الطريقة', AppFact(methodText)),
        if (throughBank) ...[
          ('البنك المستلم', AppFact('${receipt?['bank_name'] ?? bank ?? '—'}')),
          if ((receipt?['sender_bank_name'] ?? senderBank) != null)
            (
              'البنك المرسل',
              AppFact('${receipt?['sender_bank_name'] ?? senderBank}')
            ),
          ('اسم المحوّل', AppFact('${receipt?['sender_name'] ?? sender.text}')),
        ],
        if ('${receipt?['notes'] ?? notes.text}'.trim().isNotEmpty)
          ('ملاحظات', AppFact('${receipt?['notes'] ?? notes.text}')),
        if (receipt?['bank_received_on'] != null)
          (
            'وصول البنك',
            AppFact(
                '${receipt!['bank_received_on']}'.split('-').reversed.join('/'),
                number: true)
          ),
        (
          'الرصيد بعد الدفعة',
          AppFact(balanceText(newBalance),
              number: true, color: balanceColor(newBalance))
        ),
      ],
      actions: [
        AppAction(
            label: 'العودة إلى صفحة المشترك',
            onPressed: () => Navigator.pop(context, true)),
        AppAction(
            key: const ValueKey('payment-another'),
            label: 'دفعة جديدة',
            icon: 'plus',
            primary: false,
            onPressed: () => startAnother(newBalance)),
      ],
    );
  }
}
