import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:power_collect/core/api_client.dart';
import 'package:power_collect/core/diagnostics.dart';

void main() {
  late Directory directory;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('powercollect-log-');
    Diagnostics.directory = directory;
  });

  tearDown(() async {
    Diagnostics.directory = null;
    await directory.delete(recursive: true);
  });

  test('an error is logged by where and what, never by its text', () async {
    await Diagnostics.record(
        const ApiException('رصيد المشترك أحمد 120', 500), StackTrace.current,
        where: 'payment_form');
    await Diagnostics.record(StateError('token secret-123'), null,
        where: 'flutter');

    final log = await Diagnostics.read();
    expect(log, contains('payment_form · ApiException status 500'));
    expect(log, contains('flutter · StateError'));
    expect(log, contains('build $appBuildNumber'));
    expect(log, isNot(contains('أحمد')));
    expect(log, isNot(contains('secret-123')));
  });

  test('the log keeps its newest entries once it grows too large', () async {
    for (var i = 0; i < 400; i++) {
      await Diagnostics.record(FormatException('x'), StackTrace.current,
          where: 'entry-$i');
    }

    final log = await Diagnostics.read();
    expect(log.length, lessThanOrEqualTo(Diagnostics.maxBytes));
    expect(log, contains('entry-399'));
    expect(log, isNot(contains('entry-0 ')));
    expect(log, matches(RegExp(r'^\d{4}-')));
  });

  test('a sent log is cleared', () async {
    await Diagnostics.record(StateError('x'), null, where: 'main');
    await Diagnostics.clear();

    expect(await Diagnostics.read(), isEmpty);
  });
}
