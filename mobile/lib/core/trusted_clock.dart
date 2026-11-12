import 'dart:io';

/// The time by the server's clock, as far as the app can tell: the phone's
/// clock moved by how far it was from the `Date` header of the server's
/// last answer. Business rules (whether readings are open, when a reading
/// was taken, which day "today" is) use [TrustedClock.now]; a phone set to
/// the wrong day is told so before a whole route is read with it.
class TrustedClock {
  TrustedClock._();

  static Duration _offset = Duration.zero;
  static bool _known = false;

  /// How far the phone is off; within this it is taken as right.
  static const tolerance = Duration(minutes: 5);

  /// The server's time minus the phone's, once an answer has said.
  static Duration get offset => _offset;
  static bool get known => _known;
  static bool get isOff => _known && _offset.abs() > tolerance;

  static DateTime now() => DateTime.now().add(_offset);

  /// Learn the offset from an answer's `Date` header (second precision);
  /// an answer without one, or with a malformed one, changes nothing.
  static void observe(String? dateHeader, {DateTime? receivedAt}) {
    if (dateHeader == null) return;
    final DateTime server;
    try {
      server = HttpDate.parse(dateHeader);
    } on HttpException {
      return;
    } on FormatException {
      return;
    }
    _offset = server.difference(receivedAt ?? DateTime.now());
    _known = true;
  }

  /// Back to trusting the phone, as before any answer.
  static void reset() {
    _offset = Duration.zero;
    _known = false;
  }

  /// The difference in words, for the warning: "3 ساعات", "يومين"...
  static String describeOffset() {
    final minutes = _offset.inMinutes.abs();
    if (minutes >= 24 * 60) return '${(minutes / (24 * 60)).round()} يوم';
    if (minutes >= 60) return '${(minutes / 60).round()} ساعة';
    return '$minutes دقيقة';
  }
}
