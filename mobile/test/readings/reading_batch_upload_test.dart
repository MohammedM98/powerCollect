import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:power_collect/core/api_client.dart';
import 'reading_review_test.dart'
    show ReviewApi, confirmUpload, openReview, queued;

/// Answers the assigned readings as the server does: one request per batch,
/// an answer per reading by its operation id.
class BatchApi extends ReviewApi {
  final batches = <int>[];
  final rejected = <int>{};
  ApiException? refuseNext;

  @override
  Future<List<Map<String, dynamic>>> postAssignmentReadings(
      List<Map<String, dynamic>> readings) async {
    if (refuseNext case final refusal?) {
      refuseNext = null;
      throw refusal;
    }
    batches.add(readings.length);
    return [
      for (final reading in readings)
        {
          'operation_id': reading['mobile_operation_id'],
          'status': rejected.contains(reading['subscription_id'])
              ? 'rejected'
              : 'accepted',
          'message': rejected.contains(reading['subscription_id'])
              ? 'هذا الطبلون ليس ضمن مهامك.'
              : null,
        }
    ];
  }

  // The app's own batching, not ReviewApi's one-by-one stand-in.
  BatchApi() {
    oneByOne = false;
  }
}

Future<void> uploadAll(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('upload-all-readings')));
  await tester.pumpAndSettle();
  await confirmUpload(tester);
}

void main() {
  testWidgets('a long day of assigned readings goes up in a few requests',
      (tester) async {
    final api = BatchApi();
    final store = await openReview(tester, api,
        queue: [for (var id = 1; id <= 120; id++) queued(id)]);

    await uploadAll(tester);

    expect(api.batches, [50, 50, 20]);
    expect(store.queuedReadings, isEmpty);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('a reading the server refuses stays without stopping the others',
      (tester) async {
    final api = BatchApi()..rejected.add(2);
    final store = await openReview(tester, api);

    await uploadAll(tester);

    expect(api.batches, [3]);
    expect(store.queuedReadings.single['subscription_id'], 2);
    expect(store.queuedReadings.single['sync_error'],
        'هذا الطبلون ليس ضمن مهامك.');
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('too many requests keeps every reading to send again',
      (tester) async {
    final api = BatchApi()
      ..refuseNext = const ApiException('Too Many Attempts.', 429);
    final store = await openReview(tester, api);

    await uploadAll(tester);

    expect(store.queuedReadings, hasLength(3));
    expect(
        store.queuedReadings
            .every((reading) => reading['upload_uncertain'] != true),
        isTrue);
    expect(find.textContaining('أعد الرفع بعد دقيقة'), findsWidgets);
    await tester.pumpWidget(const SizedBox());
  });
}
