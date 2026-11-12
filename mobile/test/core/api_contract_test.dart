import 'package:flutter_test/flutter_test.dart';
import 'package:power_collect/models/collection_receipt.dart';

import '../support/fixtures.dart';

/// The fixtures are the server's answers (checked against its API Resources
/// by tests/Feature/MobileApiFixturesTest.php): a field renamed on either
/// side fails a test on both.
void main() {
  test('a recorded payment, as the server sends it, reads into the receipt', () {
    final receipt =
        CollectionReceipt.fromJson(fixture('recorded_collection'));

    expect(receipt.id, 77);
    expect(receipt.amount, '25.00');
    expect(receipt.amountInShekels, '25.00');
    expect(receipt.paymentMethod, 'cash');
    expect(receipt.voucherNumber, 'P-77');
    expect(receipt.balanceAfter, 75);
    expect(receipt.bankName, isNull);
  });

  test('a missing required field is named; amounts may come as numbers', () {
    final answer = fixture('recorded_collection')..remove('payment_method');
    expect(
        () => CollectionReceipt.fromJson(answer),
        throwsA(isA<FormatException>().having(
            (error) => error.message, 'message', contains('payment_method'))));

    final numeric = fixture('recorded_collection')
      ..['id'] = '77'
      ..['balance_after'] = 75.5;
    expect(CollectionReceipt.fromJson(numeric).id, 77);
    expect(CollectionReceipt.fromJson(numeric).balanceAfter, 75.5);
  });
}
