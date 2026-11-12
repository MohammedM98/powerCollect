import 'json_fields.dart';

/// A payment the server recorded (RecordedCollectionResource): what the
/// collector's receipt screen shows.
class CollectionReceipt {
  const CollectionReceipt({
    required this.id,
    required this.subscription,
    required this.amount,
    required this.currency,
    required this.amountInShekels,
    required this.paymentMethod,
    required this.status,
    required this.recordedAt,
    this.exchangeRate,
    this.bankName,
    this.bankReceivedOn,
    this.senderBankName,
    this.voucherNumber,
    this.referenceNumber,
    this.senderName,
    this.notes,
    this.balanceAfter,
  });

  factory CollectionReceipt.fromJson(Map<String, dynamic> json) {
    const model = 'CollectionReceipt';
    return CollectionReceipt(
      id: json.requiredInt('id', model),
      subscription: json.requiredString('subscription', model),
      amount: json.requiredString('amount', model),
      currency: json.requiredString('currency', model),
      amountInShekels: json.requiredString('amount_in_shekels', model),
      paymentMethod: json.requiredString('payment_method', model),
      status: json.requiredString('status', model),
      recordedAt: json.requiredString('recorded_at', model),
      exchangeRate: json.optionalString('exchange_rate'),
      bankName: json.optionalString('bank_name'),
      bankReceivedOn: json.optionalString('bank_received_on'),
      senderBankName: json.optionalString('sender_bank_name'),
      voucherNumber: json.optionalString('voucher_number'),
      referenceNumber: json.optionalString('reference_number'),
      senderName: json.optionalString('sender_name'),
      notes: json.optionalString('notes'),
      balanceAfter: json.optionalNumber('balance_after'),
    );
  }

  final int id;
  final String subscription;

  /// In the currency it was paid in, as the server keeps it ("50.00").
  final String amount;
  final String currency;
  final String amountInShekels;
  final String paymentMethod;
  final String status;
  final String recordedAt;
  final String? exchangeRate;
  final String? bankName;

  /// The day the transfer reached the bank, as Y-m-d.
  final String? bankReceivedOn;
  final String? senderBankName;
  final String? voucherNumber;
  final String? referenceNumber;
  final String? senderName;
  final String? notes;

  /// The subscription's balance after the payment; older servers send none.
  final double? balanceAfter;
}
