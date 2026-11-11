import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:power_collect/main.dart';
import 'package:power_collect/trusted_clock.dart';

import 'field_app_test.dart' show OfflineApi;
import 'reading_flow_test.dart' show readerStore;

void main() {
  tearDown(TrustedClock.reset);

  test('the server Date header sets how far the phone is off', () {
    final received = DateTime.utc(2026, 11, 10, 9);
    TrustedClock.observe(
        HttpDate.format(received.add(const Duration(days: 1))),
        receivedAt: received);

    expect(TrustedClock.known, isTrue);
    expect(TrustedClock.offset, const Duration(days: 1));
    expect(TrustedClock.isOff, isTrue);
    expect(TrustedClock.describeOffset(), '1 يوم');
    expect(
        TrustedClock.now().difference(DateTime.now()).inHours, inInclusiveRange(23, 24));
  });

  test('a few seconds apart is right, and a missing or bad header changes nothing', () {
    final received = DateTime.utc(2026, 11, 10, 9);
    TrustedClock.observe(
        HttpDate.format(received.add(const Duration(seconds: 40))),
        receivedAt: received);
    expect(TrustedClock.isOff, isFalse);

    TrustedClock.observe(null);
    TrustedClock.observe('yesterday');
    expect(TrustedClock.offset, const Duration(seconds: 40));
  });

  testWidgets('the readings screen warns a reader whose phone shows the wrong day',
      (tester) async {
    TrustedClock.observe(
        HttpDate.format(DateTime.now().toUtc().add(const Duration(days: 1))));
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
        PowerCollectApp(apiClient: OfflineApi(), fieldStore: readerStore()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('إدخال القراءات').last);
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('reading-clock-warning')), findsOneWidget);
    expect(find.textContaining('ساعة الهاتف تختلف عن وقت الخادم'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
