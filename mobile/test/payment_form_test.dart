import 'package:flutter_test/flutter_test.dart';
import 'package:power_collect/api_client.dart';
import 'package:power_collect/field_store.dart';
import 'package:power_collect/payment_form.dart';

class MemoryStore extends FieldStore {
  @override
  Future<void> load() async {}
  @override
  Future<void> save() async {}
}

class ScriptedApi extends ApiClient {
  ScriptedApi(this.answers);

  /// Each send takes the next answer: an [ApiException] is thrown, a map is returned.
  final List<Object> answers;
  final sent = <Map<String, dynamic>>[];

  @override
  Future<Map<String, dynamic>> sendCollection(
      Map<String, dynamic> collection) async {
    sent.add(Map<String, dynamic>.from(collection));
    final answer = answers.removeAt(0);
    if (answer is ApiException) throw answer;
    return answer as Map<String, dynamic>;
  }
}

const subscriber = {
  'id': 42,
  'full_name': 'Subscriber',
  'account_number': 'A42',
  'balance': '100.00'
};

PaymentForm cashForm(ApiClient api, {FieldStore? store}) => PaymentForm(
    api: api,
    subscriber: subscriber,
    store: store,
    paymentMethods: const ['cash', 'bank_transfer'],
    exchangeRates: const {'USD': 3.7})
  ..method = 'cash';

void main() {
  test('a transfer names what is still missing, in the order it is asked', () {
    final form = PaymentForm(api: ApiClient(), subscriber: subscriber);
    expect(form.method, 'bank_transfer');
    expect(form.sender.text, 'Subscriber');
    expect(form.missingDetail, 'أدخل مبلغًا أكبر من صفر.');

    form.amount.text = '50';
    expect(form.missingDetail, contains('اختر البنك'));
    form.bank = 'بنك فلسطين';
    form.sender.clear();
    expect(form.missingDetail, contains('اسم صاحب الحساب'));
    form.sender.text = 'Sender';
    expect(form.missingDetail, contains('الرقم المرجعي'));
    form.reference.text = 'TRX-1';
    expect(form.missingDetail, isNull);
    expect(form.methodText, 'تحويل إلى بنك فلسطين');
  });

  test('another currency counts at the company rate, and one with no rate cannot be taken', () {
    final form = cashForm(ApiClient())..amount.text = '20';
    form.currency = 'USD';
    expect(form.inShekels, 74);
    form.currency = 'JOD';
    expect(form.inShekels, isNull);
    expect(form.missingDetail, contains('سعر صرف دينار'));
  });

  test('the keypad keeps at most two decimals and ten characters', () {
    final form = cashForm(ApiClient());
    for (final key in ['0', '7', '.', '2', '5', '9']) {
      form.enterAmount(key);
    }
    expect(form.amount.text, '7.25');
    form.enterAmount('delete');
    expect(form.amount.text, '7.2');
    form.enterAmount('clear');
    for (var i = 0; i < 12; i++) {
      form.enterAmount('9');
    }
    expect(form.amount.text, '9999999999');
  });

  test('a recorded payment is sent once and leaves nothing on the phone', () async {
    final store = MemoryStore()..state = {'user': {'id': 5}};
    final api = ScriptedApi([
      {'id': 1, 'balance_after': '75.00'}
    ]);
    final form = cashForm(api, store: store)
      ..amount.text = '25'
      ..collectorConfirmed = true;

    await form.submit();

    expect(api.sent.single, containsPair('amount', '25'));
    expect(api.sent.single['payment_method'], 'cash');
    expect(form.recordedAny, isTrue);
    expect(form.balanceAfter(25), 75);
    expect(store.pendingCollections, isEmpty);
  });

  test('an unanswered payment is kept and sent again with the same operation id', () async {
    final store = MemoryStore()..state = {'user': {'id': 5}};
    final api = ScriptedApi([
      const ApiException('Timeout', 0),
      {'id': 1}
    ]);
    final form = cashForm(api, store: store)
      ..amount.text = '25'
      ..collectorConfirmed = true;

    await form.submit();
    expect(form.unconfirmed, isTrue);
    expect(form.error, PaymentForm.unconfirmedMessage);
    expect(store.pendingCollection('payment', 42), isNotNull);

    await form.submit();
    expect(api.sent[1]['mobile_operation_id'], api.sent[0]['mobile_operation_id']);
    expect(store.pendingCollections, isEmpty);
  });

  test('a refused payment is dropped, so a corrected one gets a new operation id', () async {
    final store = MemoryStore()..state = {'user': {'id': 5}};
    final api = ScriptedApi([
      const ApiException('المبلغ غير صالح.', 422),
      {'id': 1}
    ]);
    final form = cashForm(api, store: store)
      ..amount.text = '25'
      ..collectorConfirmed = true;

    await form.submit();
    expect(form.error, 'المبلغ غير صالح.');
    expect(form.submission, isNull);
    expect(store.pendingCollections, isEmpty);

    await form.submit();
    expect(api.sent[1]['mobile_operation_id'], isNot(api.sent[0]['mobile_operation_id']));
  });

  test('a kept payment comes back as sent, and can be discarded', () async {
    final store = MemoryStore()..state = {'user': {'id': 5}};
    final first =
        cashForm(ScriptedApi([const ApiException('Timeout', 0)]), store: store)
          ..amount.text = '30'
          ..notes.text = 'note'
          ..collectorConfirmed = true;
    await first.submit();

    final reopened = cashForm(ScriptedApi([]), store: store);
    expect(reopened.amount.text, '30');
    expect(reopened.notes.text, 'note');
    expect(reopened.method, 'cash');
    expect(reopened.editable, isFalse);

    await reopened.discardUnconfirmed();
    expect(reopened.editable, isTrue);
    expect(reopened.collectorConfirmed, isFalse);
    expect(store.pendingCollections, isEmpty);
  });
}
