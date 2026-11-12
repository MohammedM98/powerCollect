import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:power_collect/core/api_client.dart';
import 'package:power_collect/design/app_identity.dart';
import 'package:power_collect/core/field_store.dart';
import 'package:power_collect/collection/payment_page.dart';
import 'package:power_collect/collection/split_payment_page.dart';

/// Keeps its state in memory: a "restart" copies it through JSON, as the
/// file on the phone would.
class MemoryStore extends FieldStore {
  @override
  Future<void> load() async {}
  @override
  Future<void> save() async {}
}

class TimingOutApi extends ApiClient {
  TimingOutApi({this.timeOut = false});
  final bool timeOut;
  final requests = <Map<String, dynamic>>[];
  @override
  Future<Map<String, dynamic>> sendCollection(
      Map<String, dynamic> collection) async {
    requests.add(Map<String, dynamic>.from(collection));
    if (timeOut) throw const ApiException('Timeout', 0);
    return {
      'id': 9,
      'status': 'recorded',
      'amount': collection['amount'],
      'currency': collection['currency'],
      'voucher_number': 'P-9',
    };
  }
}

class SplitRecorder extends ApiClient {
  final requests = <Map<String, dynamic>>[];
  @override
  Future<Map<String, dynamic>> sendSplitPayment(
      Map<String, dynamic> payment) async {
    requests.add(Map<String, dynamic>.from(payment));
    return {
      'id': 1,
      'total_amount': payment['total_amount'],
      'reference_number': payment['reference_number'],
      'parts': const [],
    };
  }
}

const subscriber = {
  'id': 42,
  'full_name': 'Subscriber',
  'account_number': 'A42',
  'balance': '100.00'
};

MemoryStore restartedFrom(FieldStore store) => MemoryStore()
  ..state = jsonDecode(jsonEncode(store.state)) as Map<String, dynamic>;

void main() {
  Future<void> openPayment(
      WidgetTester tester, ApiClient api, FieldStore store) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(MaterialApp(
        theme: AppIdentity.theme,
        home: PaymentPage(
            api: api,
            store: store,
            paymentMethods: const ['cash'],
            subscriber: subscriber)));
    await tester.pumpAndSettle();
  }

  Future<void> tapVisible(WidgetTester tester, Finder target) async {
    await tester.scrollUntilVisible(target, 150,
        scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    await tester.tap(target);
    await tester.pumpAndSettle();
  }

  Future<void> payCash(WidgetTester tester) async {
    await tester.tap(find.byKey(const ValueKey('payment-amount')));
    await tester.pumpAndSettle();
    for (final digit in ['2', '5']) {
      await tester.tap(find.byKey(ValueKey('payment-key-$digit')));
      await tester.pump();
    }
    await tapVisible(tester, find.byKey(const ValueKey('payment-confirm')));
    await tester.tap(find.byKey(const ValueKey('payment-submit')));
    await tester.pumpAndSettle();
  }

  testWidgets(
      'a payment left unconfirmed survives a restart and is sent again with the same operation id',
      (tester) async {
    final store = MemoryStore()..state = {'user': {'id': 5}};
    final first = TimingOutApi(timeOut: true);
    await openPayment(tester, first, store);
    await payCash(tester);

    expect(first.requests, hasLength(1));
    expect(store.pendingCollections, hasLength(1));
    expect(store.pendingCollections.single['summary'], contains('25'));

    // The app is killed and opened again.
    final restarted = restartedFrom(store);
    final second = TimingOutApi();
    await openPayment(tester, second, restarted);
    await tester.scrollUntilVisible(
        find.textContaining('تعذر تأكيد تسجيل الدفعة'), 150,
        scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('تعذر تأكيد تسجيل الدفعة'), findsOneWidget);
    expect(find.text('تسجيل 25.00 شيكل'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('payment-submit')));
    await tester.pumpAndSettle();

    expect(second.requests, hasLength(1));
    expect(second.requests.single['mobile_operation_id'],
        first.requests.single['mobile_operation_id']);
    expect(second.requests.single['amount'], '25');
    expect(restarted.pendingCollections, isEmpty);
  });

  testWidgets(
      'after checking the day, the collector discards an unconfirmed payment and starts again',
      (tester) async {
    final store = MemoryStore()..state = {'user': {'id': 5}};
    await openPayment(tester, TimingOutApi(timeOut: true), store);
    await payCash(tester);
    final restarted = restartedFrom(store);
    await openPayment(tester, TimingOutApi(), restarted);

    await tapVisible(tester, find.byKey(const ValueKey('payment-discard')));
    await tester.tap(find.byKey(const ValueKey('payment-discard-confirm')));
    await tester.pumpAndSettle();

    expect(restarted.pendingCollections, isEmpty);
    expect(find.textContaining('تعذر تأكيد تسجيل الدفعة'), findsNothing);
  });

  test('another collector on the same phone does not see the payment', () {
    final store = MemoryStore()
      ..state = {
        'user': {'id': 6},
        'pending_collections': [
          {
            'kind': 'payment',
            'user_id': 5,
            'subscription_id': 42,
            'submission': {'mobile_operation_id': 'op-1'},
          }
        ],
      };

    expect(store.pendingCollections, isEmpty);
    expect(store.pendingCollection('payment', 42), isNull);
  });

  testWidgets(
      'a split transfer left unconfirmed reopens with its shares and resends the same operation',
      (tester) async {
    final store = MemoryStore()
      ..state = {
        'user': {'id': 5},
        'pending_collections': [
          {
            'kind': 'split',
            'user_id': 5,
            'subscription_id': 42,
            'subscriber': subscriber,
            'summary': 'حوالة مقسّمة 100 ₪ بمرجع REF-7',
            'context': {
              'subscribers': [
                subscriber,
                {'id': 43, 'full_name': 'Second', 'account_number': 'A43'},
              ],
            },
            'submission': {
              'mobile_operation_id': 'op-split-1',
              'collector_confirmed': true,
              'total_amount': '100',
              'bank_name': 'Bank',
              'bank_received_on': null,
              'sender_bank_name': null,
              'sender_name': 'Sender',
              'reference_number': 'REF-7',
              'notes': '',
              'confirm_overpayment': false,
              'confirm_duplicate_reference': false,
              'parts': [
                {'subscription_id': 42, 'amount': '60'},
                {'subscription_id': 43, 'amount': '40'},
              ],
            },
          }
        ],
      };
    final api = SplitRecorder();
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(MaterialApp(
        theme: AppIdentity.theme,
        home: SplitPaymentPage(
            api: api,
            store: store,
            subscriber: subscriber,
            transferBanks: const ['Bank'])));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
        find.byKey(const ValueKey('split-part-43')), 150,
        scrollable: find.byType(Scrollable).first);
    expect(find.text('Second'), findsOneWidget);
    expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('split-part-43')))
            .controller!
            .text,
        '40');
    await tester.tap(find.byKey(const ValueKey('split-submit')));
    await tester.pumpAndSettle();

    expect(api.requests.single['mobile_operation_id'], 'op-split-1');
    expect(api.requests.single['parts'], hasLength(2));
    expect(store.pendingCollections, isEmpty);
  });
}
