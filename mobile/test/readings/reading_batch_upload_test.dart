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

  /// A refusal of a whole request, by the number of the batch it answers.
  final refusals = <int, ApiException>{};

  @override
  Future<List<Map<String, dynamic>>> postAssignmentReadings(
      List<Map<String, dynamic>> readings) async {
    if (refusals.remove(batches.length + 1) case final refusal?) {
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
      ..refusals[1] = const ApiException('Too Many Attempts.', 429);
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

  testWidgets(
      'readings recorded before a later batch is refused leave the phone, the rest stay',
      (tester) async {
    final api = BatchApi()
      ..refusals[2] = const ApiException('Too Many Attempts.', 429);
    final store = await openReview(tester, api,
        queue: [for (var id = 1; id <= 120; id++) queued(id)]);

    await uploadAll(tester);

    expect(api.batches, [50]);
    expect(store.queuedReadings.map((reading) => reading['subscription_id']),
        [for (var id = 51; id <= 120; id++) id]);
    expect(
        store.queuedReadings
            .every((reading) => reading['upload_uncertain'] != true),
        isTrue);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
      'a batch the server refuses as a whole is sent again one by one, so only the bad reading keeps an error',
      (tester) async {
    final api = BatchApi()
      ..refusals[1] = const ApiException('Validation failed', 422)
      ..errors[2] = const ApiException('Validation failed', 422, errors: {
        'readings.0.current_reading': ['القراءة غير صالحة.']
      });
    final store = await openReview(tester, api);

    await uploadAll(tester);

    expect(
        api.requests.map((reading) => reading['subscription_id']), [1, 2, 3]);
    expect(store.queuedReadings.single['subscription_id'], 2);
    expect(store.queuedReadings.single['sync_error'], 'القراءة غير صالحة.');
    await tester.pumpWidget(const SizedBox());
  });
}
