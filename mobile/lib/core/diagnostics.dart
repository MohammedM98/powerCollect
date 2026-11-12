import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart' show MethodChannel, PlatformException;

import 'api_client.dart';

/// The app's error log on the phone: a small file of what went wrong (when,
/// where in the app, the error's type and stack), so "the app closed" or "my
/// reading did not upload" can be looked into. It never holds tokens,
/// messages from the server or subscriber data: an error is kept by its type
/// and, for the server's answers, by status code only. The collector sends
/// it from the account screen.
class Diagnostics {
  Diagnostics._();

  /// Where the log is kept; the app's files directory unless a test sets it.
  static Directory? directory;

  /// The log is cut back to its newest half once it reaches this size.
  static const maxBytes = 64 * 1024;

  static Future<void> _lastWrite = Future<void>.value();

  static Future<File> _file() async {
    directory ??= Directory(await const MethodChannel('powercollect.storage')
            .invokeMethod<String>('filesDirectory') ??
        '');
    if (directory!.path.isEmpty) {
      throw StateError('Local storage is unavailable');
    }
    await directory!.create(recursive: true);
    return File('${directory!.path}${Platform.pathSeparator}diagnostics.log');
  }

  /// One line for [error]: never its text, which can carry what was typed.
  static String describe(Object error) => switch (error) {
        ApiException(:final statusCode) => 'ApiException status $statusCode',
        PlatformException(:final code) => 'PlatformException $code',
        _ => '${error.runtimeType}',
      };

  /// Append [error] seen at [where]; a log that cannot be written is let go.
  static Future<void> record(Object error, StackTrace? stack,
      {required String where}) {
    final frames = (stack?.toString() ?? '')
        .split('\n')
        .where((line) => line.trim().isNotEmpty)
        .take(12)
        .join('\n');
    final entry = '${DateTime.now().toUtc().toIso8601String()} '
        'build $appBuildNumber · $where · ${describe(error)}\n'
        '${frames.isEmpty ? '' : '$frames\n'}\n';
    final write = _lastWrite.then<void>((_) async {
      final file = await _file();
      var text = await file.exists() ? await file.readAsString() : '';
      text += entry;
      if (text.length > maxBytes) {
        text = text.substring(text.length - maxBytes ~/ 2);
        text = text.substring(text.indexOf('\n\n') + 2);
      }
      await file.writeAsString(text, flush: true);
    });
    _lastWrite = write.catchError((Object _) {});
    return _lastWrite;
  }

  /// The log as it stands, or '' when nothing went wrong yet.
  static Future<String> read() async {
    await _lastWrite;
    try {
      final file = await _file();
      return await file.exists() ? await file.readAsString() : '';
    } on Exception {
      return '';
    }
  }

  static Future<void> clear() async {
    await _lastWrite;
    final file = await _file();
    if (await file.exists()) await file.delete();
  }
}
