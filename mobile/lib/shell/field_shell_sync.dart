part of 'field_shell.dart';

/// Keeping the phone in step with the server: the session, the reading roster and the readings waiting to upload.
extension _ShellSync on _FieldShellState {
  Future<void> refreshSession() async {
    final sessionToken = widget.api.token;
    change(() => syncing = true);
    try {
      do {
        final forceRoster = rosterRefreshRequested;
        rosterRefreshRequested = false;
        final session = await widget.api.me();
        if (!mounted) return;
        change(() {
          if (session['user'] is Map &&
              (session['user'] as Map)['id'] == widget.user['id']) {
            currentUser = Map<String, dynamic>.from(session['user'] as Map);
            widget.store.state['user'] = currentUser;
          }
          online = true;
          requiresLogin = false;
        });
        final lastRosterUpdate = DateTime.tryParse(
            '${widget.store.state['roster_updated_at'] ?? ''}');
        final shouldRefreshRoster = canRead &&
            (forceRoster ||
                lastRosterUpdate == null ||
                DateTime.now().difference(lastRosterUpdate) >
                    const Duration(minutes: 5));
        await Future.wait([
          if (shouldRefreshRoster) refreshRoster(),
          if (canCollect) refreshCollections(),
        ]);
        if (mounted) change(() => message = null);
      } while (mounted && rosterRefreshRequested);
    } on ApiException catch (error) {
      if (error.statusCode == 401) {
        if (mounted && widget.api.token == sessionToken) {
          widget.onReauthenticate();
        }
        return;
      }
      if (mounted) {
        change(() {
          online = false;
          requiresLogin = error.statusCode == 401;
          message = error.statusCode == 401
              ? 'انتهت جلسة الدخول. سجّل الدخول مجددًا لمتابعة العمل.'
              : error.message;
        });
      }
    } finally {
      if (mounted) change(() => syncing = false);
    }
  }

  Future<void> refreshRoster() async {
    // The assignments come whole, in one answer.
    final first = await widget.api.assignedRoster();
    final all = (first['data'] as List)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    widget.store.state['subscribers'] = all;
    widget.store.state['week_start'] = first['week_start'];
    widget.store.state['week_end'] = first['week_end'];
    for (final key in [
      'assignment_roster_version',
      'next_reading',
      'entry_starts_at',
      'entry_ends_at',
      'reading_date'
    ]) {
      widget.store.state[key] = first[key];
    }
    widget.store.state['can_record_readings_now'] =
        first['can_record_readings_now'];
    widget.store.state['roster_updated_at'] = DateTime.now().toIso8601String();
    await widget.store.save();
    if (mounted) change(() {});
  }

  Future<ReadingUploadReport> uploadReadings(
      List<Map<String, dynamic>> reviewed) async {
    if (uploadingReadings || syncing || !canRead) {
      return const ReadingUploadReport(
          message: 'تعذّر الرفع الآن. تحقق من الصلاحية وانتظر انتهاء التحديث.',
          interrupted: true);
    }
    change(() => uploadingReadings = true);
    var sent = 0;
    var held = 0;
    var failed = 0;
    final reviewNotes = <String>[];
    String? interruption;
    try {
      final sending = <Map<String, dynamic>>[];
      for (final reading in reviewed) {
        final id = reading['mobile_operation_id'] as String;
        if (!widget.store.queuedReadings
            .any((item) => item['mobile_operation_id'] == id)) {
          continue;
        }
        final validation = readingValidation(reading);
        if (validation != null) {
          await widget.store.markReadingError(id, validation);
          failed++;
          continue;
        }
        sending.add(reading);
      }
      // Marked uncertain before they leave: an answer lost on the way leaves
      // them to be sent again as they are, never recorded twice.
      for (final reading in sending) {
        await widget.store
            .markReadingUncertain(reading['mobile_operation_id'] as String);
      }
      Map<String, Object> outcomes;
      try {
        outcomes = sending.isEmpty
            ? const {}
            : await widget.api.sendReadings([
                for (final reading in sending)
                  {...reading}
                    ..remove('sync_error')
                    ..remove('upload_uncertain')
                    ..remove('review')
              ]);
      } on ApiException catch (error) {
        outcomes = {
          for (final reading in sending)
            reading['mobile_operation_id'] as String: error
        };
      }
      // Each reading takes its own answer, even after the sending stopped or
      // the screen closed; one left without an answer was never sent.
      for (final reading in sending) {
        final id = reading['mobile_operation_id'] as String;
        final outcome = outcomes[id];
        if (outcome == null) {
          await widget.store.markReadingUncertain(id, uncertain: false);
          continue;
        }
        try {
          if (outcome is ApiException) throw outcome;
          final response = outcome as Map<String, dynamic>;
          final subscribers = widget.store.subscribers;
          for (final subscriber in subscribers) {
            if (subscriber['id'] == reading['subscription_id'] &&
                reading['week_start'] == widget.store.state['week_start']) {
              subscriber['current_reading'] = reading['current_reading'];
              subscriber['reading_status'] =
                  ['needs_review', 'approved'].contains(response['status'])
                      ? response['status']
                      : 'pending';
            }
          }
          widget.store.state['subscribers'] = subscribers;
          await widget.store.removeReading(id);
          sent++;
          if (response['status'] == 'needs_review') {
            held++;
            final review = readingReviewData(reading, subscribers);
            reviewNotes.add(
                '${review['name'] ?? review['full_name'] ?? 'مشترك #${reading['subscription_id']}'}: ${response['message'] ?? 'تحتاج مراجعة المسؤول.'}');
          }
        } on ApiException catch (error) {
          if (error.isNetwork || error.statusCode >= 500) {
            interruption =
                'انقطع الاتصال أو تعذّر معرفة نتيجة الرفع. بقيت القراءات على الجهاز؛ أعد المحاولة بنفسها لتجنب التكرار.';
            if (mounted) change(() => online = false);
            continue;
          }
          if (error.statusCode == 401 || error.statusCode == 403) {
            await widget.store.markReadingUncertain(id, uncertain: false);
            interruption = error.statusCode == 401
                ? 'انتهت جلسة الدخول. سجّل الدخول مجددًا ثم راجع القراءات وارفعها.'
                : 'لم يعد الرفع مسموحًا لحسابك. تواصل مع المسؤول.';
            if (mounted) {
              change(() => requiresLogin = error.statusCode == 401);
            }
            continue;
          }
          if (error.statusCode == 426) {
            // The server turned this old app away before reading anything,
            // so the readings stay on the phone until the app is updated.
            await widget.store.markReadingUncertain(id, uncertain: false);
            interruption = error.message;
            continue;
          }
          if (error.statusCode == 429) {
            // Too many requests: refused before reading any, so they stay to send again.
            await widget.store.markReadingUncertain(id, uncertain: false);
            interruption =
                'أُرسلت طلبات كثيرة في وقت قصير. بقيت القراءات على الجهاز؛ أعد الرفع بعد دقيقة.';
            continue;
          }
          final details = error.errors.values
              .expand((value) => value is List ? value : [value])
              .map((value) => '$value')
              .toSet();
          await widget.store.markReadingError(
              id, details.isEmpty ? error.message : details.join('\n'));
          failed++;
        }
      }
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'field_shell'));
      interruption =
          'تعذّر حفظ حالة الرفع على الجهاز. احتفظ بالقراءات وأعد المحاولة بنفسها.';
    } finally {
      if (mounted) change(() => uploadingReadings = false);
    }
    return ReadingUploadReport(
        sent: sent,
        held: held,
        failed: failed,
        reviewNotes: reviewNotes,
        message: interruption,
        interrupted: interruption != null);
  }
}
