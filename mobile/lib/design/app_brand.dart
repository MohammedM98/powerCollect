import 'dart:convert';

import 'package:flutter/services.dart';

/// The company's identity as the server sends it (GET /brand, see
/// MobileBrand on the server): its names, logos, fonts and the colours of
/// both themes, read from the same values the website is painted with.
/// The app keeps the last one it got, so it looks right offline; before it
/// ever reaches the server it shows the identity it was built with
/// (assets/brand/default.json, kept equal to the server's default by
/// MobileBrandTest).
class AppBrand {
  AppBrand(this.json, {this.logos = const {}});

  /// The payload as received, kept to store it again as it is.
  final Map<String, dynamic> json;

  /// Each logo downloaded and kept on the phone, by variant (main, light).
  final Map<String, Uint8List> logos;

  static Future<AppBrand> builtIn() async => AppBrand(jsonDecode(
          await rootBundle.loadString('assets/brand/default.json'))
      as Map<String, dynamic>);

  String? get fingerprint => json['fingerprint'] as String?;
  Map<String, dynamic> get _company =>
      (json['company'] as Map?)?.cast<String, dynamic>() ?? const {};
  String get name => '${_company['name'] ?? ''}';
  String? get tagline => _company['tagline'] as String?;

  /// Where each logo is downloaded from; null when it cannot be drawn here
  /// (an SVG logo: the name is shown in its place).
  String? logoUrl(String variant) {
    final url = (json['logos'] as Map?)?[variant] as String?;
    return url == null || url.toLowerCase().endsWith('.svg') ? null : url;
  }

  /// The logo for a light or a dark background, if one is kept.
  Uint8List? logo({required bool onDark}) =>
      (onDark ? logos['light'] : null) ?? logos['main'];

  static const _families = {
    'zain': 'Zain',
    'plex': 'PlexArabic',
    'alexandria': 'Alexandria',
    'cairo': 'Cairo',
    'tajawal': 'Tajawal',
    'kufi': 'NotoKufi',
    'messiri': 'ElMessiri',
  };
  String _font(String role) =>
      _families[(json['fonts'] as Map?)?[role]] ?? 'Zain';
  String get bodyFont => _font('body');
  String get headingFont => _font('heading');

  final _parsed = <String, Color>{};

  /// One of the theme's colours ('#RRGGBB' from the server), or [fallback]
  /// when the server did not send it.
  Color color(String name, {required bool dark, required Color fallback}) =>
      _parsed.putIfAbsent('$dark.$name', () {
        final colors = (json['colors'] as Map?)?[dark ? 'dark' : 'light'];
        final hex = colors is Map ? colors[name] : null;
        final value = hex is String && RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(hex)
            ? int.tryParse(hex.substring(1), radix: 16)
            : null;
        return value == null ? fallback : Color(0xFF000000 | value);
      });
}
