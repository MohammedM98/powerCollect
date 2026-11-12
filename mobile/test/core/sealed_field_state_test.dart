import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:power_collect/core/field_store.dart';

/// A stand-in for the Android Keystore: "sealing" is reversible here, but the
/// file no longer holds the JSON as text, which is what these tests check.
void fakeKeystore({bool keyLost = false}) {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(const MethodChannel('powercollect.session'),
          (call) async {
    switch (call.method) {
      case 'seal':
        return 'pcs1.iv.${base64.encode(utf8.encode(call.arguments as String))}';
      case 'open':
        if (keyLost) return null;
        return utf8.decode(base64.decode((call.arguments as String).split('.').last));
      default:
        return null;
    }
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  File stateFile() => File('${directory.path}/field_state.json');

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('powercollect-sealed-');
    fakeKeystore();
  });

  tearDown(() => directory.delete(recursive: true));

  test('the roster is written sealed and read back', () async {
    final store = FieldStore(directory: directory)
      ..state = {
        'user': {'id': 5},
        'subscribers': [
          {'id': 42, 'full_name': 'Private Subscriber', 'phone': '0599000000'}
        ],
      };
    await store.save();

    final text = await stateFile().readAsString();
    expect(text, startsWith('pcs1.'));
    expect(text, isNot(contains('Private Subscriber')));
    expect(text, isNot(contains('0599000000')));

    final restored = FieldStore(directory: directory);
    await restored.load();
    expect(restored.subscribers.single['full_name'], 'Private Subscriber');
  });

  test('a file written before sealing is read once and sealed', () async {
    await stateFile().writeAsString(jsonEncode({
      'user': {'id': 5},
      'subscribers': [
        {'id': 42, 'full_name': 'Private Subscriber'}
      ],
    }));

    final store = FieldStore(directory: directory);
    await store.load();

    expect(store.subscribers, hasLength(1));
    expect(await stateFile().readAsString(), startsWith('pcs1.'));
  });

  test('a sealed file whose key is gone reads as empty', () async {
    final store = FieldStore(directory: directory)
      ..state = {
        'user': {'id': 5}
      };
    await store.save();
    fakeKeystore(keyLost: true);

    final restored = FieldStore(directory: directory);
    await restored.load();

    expect(restored.user, isNull);
  });

  test('an expired session drops the roster and keeps the unsent readings', () {
    final store = FieldStore(directory: directory)
      ..state = {
        'subscribers': [
          {'id': 42}
        ],
        'next_reading': {'boxes': []},
        'roster_updated_at': '2026-11-12T08:00:00Z',
        'queued_readings': [
          {'mobile_operation_id': 'op-1', 'subscription_id': 42}
        ],
      };

    store.clearRoster();

    expect(store.subscribers, isEmpty);
    expect(store.state['next_reading'], isNull);
    expect(store.queuedReadings.single['mobile_operation_id'], 'op-1');
  });
}
