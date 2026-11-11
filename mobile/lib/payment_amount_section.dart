part of 'payment_page.dart';

/// The balance strip and the amount panel: currency, typed amount, rate and quick amounts.
extension _AmountSection on _PaymentPageState {
  Widget balanceStrip() {
    final status = widget.subscriber['status'];
    final unusual = status != null && status != 'active';
    return AppHero(
        padding: const EdgeInsets.all(16),
        radius: 26,
        child: Row(children: [
          Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                  color: const Color(0x14FFFFFF),
                  borderRadius: BorderRadius.circular(15)),
              child: const AppIcon('user', color: Colors.white)),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('الرصيد الحالي',
                    style:
                        AppIdentity.body(12.5, color: AppIdentity.heroFaint)),
                Text(balanceText(balance),
                    style: AppIdentity.number(23,
                        weight: FontWeight.w800,
                        color: balanceColor(balance, onHero: true))),
              ])),
          if (unusual)
            Container(
                height: 26,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                    color: const Color(0x18FFFFFF),
                    borderRadius: BorderRadius.circular(99)),
                child: Text('${widget.subscriber['status_label'] ?? status}',
                    style: AppIdentity.body(12,
                        weight: FontWeight.w600, color: AppIdentity.heroWarn))),
        ]));
  }

  Widget amountPanel() => AppPanel(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        InkWell(
          key: const ValueKey('payment-amount'),
          onTap: () {
            FocusScope.of(context).unfocus();
            change(() => showKeypad = true);
          },
          child: Row(children: [
            Expanded(
                child: Container(
              constraints: const BoxConstraints(minHeight: 44),
              alignment: Alignment.centerRight,
              child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: Row(
                      mainAxisSize: MainAxisSize.min,
                      textDirection: TextDirection.ltr,
                      children: [
                        Text(amount.text.isEmpty ? '0.00' : amount.text,
                            textDirection: TextDirection.ltr,
                            style: AppIdentity.number(36,
                                weight: FontWeight.w800,
                                color: amount.text.isEmpty
                                    ? AppIdentity.faint
                                    : AppIdentity.ink)),
                        if (showKeypad && editable) const AppCaret(height: 34),
                      ])),
            )),
            const SizedBox(width: 10),
            Text(currencyLook.$2,
                style: AppIdentity.number(20, color: AppIdentity.faint)),
          ]),
        ),
        const SizedBox(height: 10),
        Container(
          key: const ValueKey('payment-currency'),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
              color: AppIdentity.sunken,
              borderRadius: BorderRadius.circular(14)),
          child: Row(children: [
            for (final (index, (code, symbol, name))
                in paymentCurrencies.indexed) ...[
              if (index > 0) const SizedBox(width: 4),
              Expanded(
                child: Opacity(
                  opacity: code == 'ILS' || widget.exchangeRates[code] != null
                      ? 1
                      : .4,
                  child: InkWell(
                    key: ValueKey('payment-currency-$code'),
                    borderRadius: BorderRadius.circular(11),
                    onTap: editable &&
                            (code == 'ILS' ||
                                widget.exchangeRates[code] != null)
                        ? () => change(() => currency = code)
                        : null,
                    child: Container(
                      height: 38,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                          color: currency == code
                              ? AppIdentity.surface
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(11),
                          boxShadow:
                              currency == code ? AppIdentity.shadow : null),
                      child: Text('$symbol $name',
                          style: AppIdentity.body(13.5,
                              weight: FontWeight.w700,
                              color: currency == code
                                  ? AppIdentity.ink
                                  : AppIdentity.muted)),
                    ),
                  ),
                ),
              ),
            ],
          ]),
        ),
        if (paymentCurrencies.any((look) =>
            look.$1 != 'ILS' && widget.exchangeRates[look.$1] == null))
          Padding(
            key: const ValueKey('payment-currency-unpriced'),
            padding: const EdgeInsets.only(top: 8),
            child: Text(
                'لا يمكن الدفع بـ${paymentCurrencies.where((look) => look.$1 != 'ILS' && widget.exchangeRates[look.$1] == null).map((look) => look.$3).join(' أو ')} حتى يُحدَّد سعر صرفه في إعدادات الموقع.',
                style: AppIdentity.body(12.5, color: AppIdentity.faint)),
          ),
        if (!isShekel)
          Padding(
              key: const ValueKey('payment-rate'),
              padding: const EdgeInsets.only(top: 12),
              child: Row(children: [
                Expanded(
                  child: Text(
                      'سعر الصرف ${AppIdentity.grouped(rateValue ?? 0)} من إعدادات الشركة',
                      style: AppIdentity.body(13.5, color: AppIdentity.muted)),
                ),
                const SizedBox(width: 8),
                Text('= ${AppIdentity.grouped(inShekels ?? 0)} ₪',
                    style: AppIdentity.body(13.5,
                        weight: FontWeight.w700, color: AppIdentity.ink)),
              ])),
        Container(
          margin: const EdgeInsets.only(top: 12),
          padding: const EdgeInsets.only(top: 12),
          decoration: BoxDecoration(
              border: Border(top: BorderSide(color: AppIdentity.lineSoft))),
          child: Wrap(spacing: 6, runSpacing: 6, children: [
            for (final quick in ['50', '100', '200'])
              _quickChip(quick, () => change(() => amount.text = quick)),
            if (owed > 0)
              _quickChip(
                  'تسديد كامل الدين',
                  editable && (rateValue ?? 0) > 0
                      ? () => change(() =>
                          amount.text = (owed / rateValue!).toStringAsFixed(2))
                      : null,
                  full: true,
                  key: const ValueKey('payment-full-debt')),
          ]),
        ),
      ]));

  Widget _quickChip(String label, VoidCallback? onTap,
      {bool full = false, Key? key}) {
    final enabled = onTap != null && editable;
    return Opacity(
      opacity: enabled ? 1 : .5,
      child: Material(
        key: key,
        color: full ? AppIdentity.brandSoft : AppIdentity.raised,
        borderRadius: BorderRadius.circular(11),
        child: InkWell(
          borderRadius: BorderRadius.circular(11),
          onTap: enabled ? onTap : null,
          child: Container(
            height: 34,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
                border: Border.all(
                    color: full
                        ? Color.alphaBlend(
                            AppIdentity.brand.withValues(alpha: .35),
                            AppIdentity.line)
                        : AppIdentity.line),
                borderRadius: BorderRadius.circular(11)),
            child: Center(
                widthFactor: 1,
                child: Text(label,
                    style: full
                        ? AppIdentity.body(13,
                            weight: FontWeight.w700, color: AppIdentity.brand)
                        : AppIdentity.number(13, color: AppIdentity.ink2))),
          ),
        ),
      ),
    );
  }
}
