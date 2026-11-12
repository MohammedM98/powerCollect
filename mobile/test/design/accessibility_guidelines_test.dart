import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:power_collect/design/app_identity.dart';
import 'package:power_collect/main.dart';
import 'package:power_collect/collection/payment_page.dart';

import '../cash_boxes/cash_boxes_test.dart' show BoxesApi, openHome;
import '../shell/field_app_test.dart' show MemoryStore, OfflineApi;
import '../collection/payment_page_test.dart' show RecordingApi;
import '../readings/reading_flow_test.dart' show readerStore;

/// Every tappable thing has a name TalkBack reads, and is big enough to hit.
Future<void> meetsTapGuidelines(WidgetTester tester) async {
  await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
  await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
}

void main() {
  setUp(() async {});

  testWidgets('the sign-in screen', (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(
        PowerCollectApp(apiClient: OfflineApi(), fieldStore: MemoryStore()));
    await tester.pumpAndSettle();
    await meetsTapGuidelines(tester);
    semantics.dispose();
  });

  testWidgets('the readings screen', (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
        PowerCollectApp(apiClient: OfflineApi(), fieldStore: readerStore()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('إدخال القراءات').last);
    await tester.pumpAndSettle();
    await meetsTapGuidelines(tester);
    semantics.dispose();
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('the payment screen, with its keypad open', (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(MaterialApp(
        theme: AppIdentity.theme,
        home: PaymentPage(api: RecordingApi(), subscriber: const {
          'id': 42,
          'full_name': 'Subscriber',
          'account_number': 'A42',
          'balance': '100.00'
        })));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('payment-amount')));
    await tester.pumpAndSettle();
    await meetsTapGuidelines(tester);
    semantics.dispose();
  });

  testWidgets('the cash boxes screen', (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await openHome(tester, BoxesApi());
    await tester.tap(find.byKey(const ValueKey('collector-cash-boxes-service')));
    await tester.pumpAndSettle();
    await meetsTapGuidelines(tester);
    semantics.dispose();
    await tester.pumpWidget(const SizedBox());
  });
}
