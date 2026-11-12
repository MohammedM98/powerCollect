part of 'payment_page.dart';

/// The transfer details: reading a receipt, the receiving and sending banks, the arrival date, the sender and the reference.
extension _TransferSection on _PaymentPageState {
  Widget transferDetails() => AppPanel(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('قراءة إيصال التحويل',
            style: AppIdentity.body(14, weight: FontWeight.w700)),
        Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
                'صوّر الإيصال أو اختر صورته، ثم اضغط على الأرقام لنقلها إلى الحقول. تُقرأ الصورة على الجوال ولا تُرفع.',
                style: AppIdentity.body(12.5, color: AppIdentity.muted))),
        const SizedBox(height: 10),
        if (scanning)
          Row(children: [
            SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppIdentity.brand)),
            const SizedBox(width: 10),
            Text('جارٍ فتح الإيصال...', style: AppIdentity.body(13.5))
          ])
        else
          Row(children: [
            Expanded(
                child: scanButton('receipt-camera', 'scan', 'تصوير الإيصال',
                    () => readReceipt(ReceiptImageSource.camera))),
            const SizedBox(width: 8),
            Expanded(
                child: scanButton('receipt-gallery', 'img', 'اختيار صورة',
                    () => readReceipt(ReceiptImageSource.gallery))),
          ]),
        const AppLabel('البنك المستلم'),
        GridView(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                mainAxisExtent: 98),
            shrinkWrap: true,
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              for (final name in widget.transferBanks) bankTile(name)
            ]),
        const AppLabel('البنك المرسل', hint: 'اختياري'),
        senderBankField(),
        BankReceivedDateField(
            value: bankReceivedOn,
            enabled: editable,
            onChanged: (date) => change(() => bankReceivedOn = date)),
        AppLabel('اسم المحوِّل',
            trailing: AppToggle(
                key: const ValueKey('payment-sender-is-subscriber'),
                label: 'المشترك نفسه',
                value: senderIsSubscriber,
                onChanged: editable ? toggleSender : null)),
        detailField('اسم صاحب الحساب الذي حُوّل منه المبلغ', sender,
            key: 'payment-sender', readOnly: senderIsSubscriber),
        const AppLabel('الرقم المرجعي', hint: 'من إشعار الحوالة'),
        detailField('مثال: TRX-48213', reference,
            key: 'payment-reference', ltr: true),
      ]));

  Widget scanButton(
          String key, String icon, String label, VoidCallback onTap) =>
      Opacity(
        opacity: editable ? 1 : .5,
        child: AppDashedBox(
          child: Material(
            color: AppIdentity.raised,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              key: ValueKey(key),
              borderRadius: BorderRadius.circular(14),
              onTap: editable ? onTap : null,
              child: SizedBox(
                height: 46,
                child:
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  AppIcon(icon, color: AppIdentity.ink2),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppIdentity.body(13.5,
                            weight: FontWeight.w700, color: AppIdentity.ink2)),
                  ),
                ]),
              ),
            ),
          ),
        ),
      );

  Widget bankLogo(String name, double size, double radius) {
    final logo = bankLogoAsset(name);
    return ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: logo == null
            ? Container(
                width: size,
                height: size,
                alignment: Alignment.center,
                color: AppIdentity.sunken,
                child: AppIcon('bank', color: AppIdentity.muted))
            : Image.asset(logo, width: size, height: size, fit: BoxFit.cover));
  }

  Widget bankTile(String name) {
    final selected = bank == name;
    return InkWell(
        key: ValueKey('payment-bank-$name'),
        onTap: editable ? () => change(() => bank = name) : null,
        borderRadius: BorderRadius.circular(16),
        child: Stack(children: [
          Positioned.fill(
              child: Container(
                  padding: const EdgeInsets.fromLTRB(4, 10, 4, 8),
                  decoration: BoxDecoration(
                      color: selected
                          ? AppIdentity.brandSoft
                          : AppIdentity.surface,
                      border: Border.all(
                          color: selected
                              ? AppIdentity.brand
                              : AppIdentity.lineSoft,
                          width: selected ? 2.5 : 1.5),
                      borderRadius: BorderRadius.circular(16)),
                  child: Column(children: [
                    bankLogo(name, 40, 12),
                    const SizedBox(height: 6),
                    Expanded(
                      child: Text(name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: AppIdentity.body(11.5,
                                  weight: FontWeight.w700,
                                  color: AppIdentity.ink2)
                              .copyWith(height: 1.25)),
                    ),
                  ]))),
          if (selected)
            PositionedDirectional(
                top: 6,
                start: 6,
                child: Container(
                    width: 17,
                    height: 17,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                        color: AppIdentity.good, shape: BoxShape.circle),
                    child: const AppIcon('check',
                        size: 11, strokeWidth: 3.4, color: Colors.white))),
        ]));
  }

  Widget senderBankField() => Material(
        color: AppIdentity.surface,
        borderRadius: BorderRadius.circular(15),
        child: InkWell(
          key: const ValueKey('payment-sender-bank'),
          borderRadius: BorderRadius.circular(15),
          onTap: editable ? chooseSenderBank : null,
          child: Container(
            height: 50,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
                border: Border.all(color: AppIdentity.line, width: 1.5),
                borderRadius: BorderRadius.circular(15)),
            child: Row(children: [
              if (senderBank != null) ...[
                bankLogo(senderBank!, 28, 8),
                const SizedBox(width: 10),
              ],
              Expanded(
                  child: Text(
                      senderBank ?? 'اختر البنك أو المحفظة المحوّل منها',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppIdentity.body(15,
                          color: senderBank == null
                              ? AppIdentity.faint
                              : AppIdentity.ink))),
              AppIcon('down', color: AppIdentity.faint),
            ]),
          ),
        ),
      );

  Future<void> chooseSenderBank() async {
    FocusScope.of(context).unfocus();
    change(() => showKeypad = false);
    final choice = await showAppSheet<List<String?>>(context,
        title: 'البنك المرسل',
        message: 'اختياري · من أين حُوّل المبلغ',
        children: [
          Builder(
              builder: (sheet) => AppRows(children: [
                    AppRow(
                        key: const ValueKey('payment-sender-bank-none'),
                        onTap: () => Navigator.pop(sheet, <String?>[null]),
                        leading: AppIconTile(
                            'x', AppIdentity.muted, AppIdentity.sunken,
                            size: 40),
                        title: const AppRowTitle('غير محدد'),
                        trailing: senderBank == null
                            ? AppIcon('check', color: AppIdentity.good)
                            : null),
                    for (final name in widget.transferBanks)
                      AppRow(
                          key: ValueKey('payment-sender-bank-$name'),
                          onTap: () => Navigator.pop(sheet, <String?>[name]),
                          leading: bankLogo(name, 40, 12),
                          title: AppRowTitle(name),
                          trailing: senderBank == name
                              ? AppIcon('check', color: AppIdentity.good)
                              : null),
                  ])),
        ]);
    if (choice != null && mounted) change(() => senderBank = choice.first);
  }
}
