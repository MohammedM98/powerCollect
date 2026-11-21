import 'package:flutter/material.dart';

import 'app_brand.dart';

export 'app_brand.dart';
export 'app_choices.dart';
export 'app_controls.dart';
export 'app_feedback.dart';
export 'app_icons.dart';
export 'app_keypad.dart';
export 'app_labels.dart';
export 'app_navigation.dart';
export 'app_surfaces.dart';
export 'app_visuals.dart';

bool dismissAppKeyboard(BuildContext context) {
  if (MediaQuery.viewInsetsOf(context).bottom <= 0 &&
      View.of(context).viewInsets.bottom <= 0) {
    return false;
  }
  FocusManager.instance.primaryFocus?.unfocus();
  return true;
}

/// A back gesture dismisses the keyboard before leaving a screen.
class AppKeyboardBackScope extends StatelessWidget {
  const AppKeyboardBackScope(
      {required this.child, this.canPop = true, this.onBack, super.key});

  final Widget child;
  final bool canPop;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final keyboardVisible = MediaQuery.viewInsetsOf(context).bottom > 0;
    return PopScope(
        canPop: canPop && !keyboardVisible,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) return;
          if (keyboardVisible) {
            FocusManager.instance.primaryFocus?.unfocus();
            return;
          }
          onBack?.call();
        },
        child: child);
  }
}

/// Colours, type and numbers used everywhere, taken from the company's
/// identity on the server ([AppBrand]), so the app looks like the website.
/// The palette follows the phone's light or dark setting: [dark] and
/// [company] are set by the app root, so every colour here is a getter
/// rather than a constant.
abstract final class AppIdentity {
  static bool dark = false;

  /// The identity in use; the fallbacks below are the website's default.
  static AppBrand company = AppBrand(const {});

  static Color _pick(String name, int light, int night) =>
      company.color(name, dark: dark, fallback: Color(dark ? night : light));

  static Color get background => _pick('page', 0xFFECEEF1, 0xFF0C0E11);
  static Color get surface => _pick('surface', 0xFFFFFFFF, 0xFF15181D);
  static Color get raised => _pick('raised', 0xFFF4F5F7, 0xFF1C2026);
  static Color get sunken => background;
  static Color get line => _pick('line', 0xFFE2E5E9, 0xFF262B32);
  static Color get lineSoft => _pick('line_soft', 0xFFEEF0F3, 0xFF1C2026);
  static Color get ink => _pick('ink', 0xFF1F2329, 0xFFEEF0F3);
  static Color get ink2 => _pick('ink2', 0xFF373C44, 0xFFD2D6DC);
  static Color get muted => _pick('muted', 0xFF59606A, 0xFFA2A9B3);
  static Color get faint => _pick('faint', 0xFF606670, 0xFF8D949E);
  static Color get brand => _pick('brand', 0xFFCA4E05, 0xFFDC642E);
  static Color get brand2 => _pick('brand_strong', 0xFFAF4204, 0xFFEA875E);
  static Color get brandTint => brand.withAlpha(dark ? 0x1C : 0x12);
  static Color get brandSoft => _pick('brand_tint', 0xFFFBF1EE, 0xFF391708);

  /// A fill in the company's colour and the text on it.
  static Color get brandFill => _pick('brand_fill', 0xFFCA4E05, 0xFFCA4E05);
  static Color get onBrandFill =>
      _pick('brand_fill_ink', 0xFFFFFFFF, 0xFFFFFFFF);
  static Color get good => _pick('success', 0xFF047857, 0xFF34D399);
  static Color get goodTint => good.withAlpha(dark ? 0x1C : 0x14);
  static Color get warning => _pick('warning', 0xFFB45309, 0xFFFBBF24);
  static Color get warningTint => warning.withAlpha(dark ? 0x1C : 0x14);
  static Color get bad => _pick('danger', 0xFFDC2626, 0xFFF87171);
  static Color get badTint => bad.withAlpha(dark ? 0x1F : 0x12);
  static Color get info => _pick('info', 0xFF1D4ED8, 0xFF60A5FA);
  static Color get infoTint => info.withAlpha(dark ? 0x1C : 0x12);
  static Color get selected => ink;
  static Color get selectedInk => surface;
  static Color get keyFill => _pick('field', 0xFFFFFFFF, 0xFF1E2228);
  static Color get keypad => lineSoft;

  /// The page's main action (its one solid button): the website's charcoal,
  /// never the company's colour.
  static Color get actionFill => _pick('action', 0xFF24272E, 0xFF39404A);
  static Color get actionInk => _pick('action_ink', 0xFFFFFFFF, 0xFFFFFFFF);

  /// Text on the dark hero panels, which look the same in both modes.
  static const heroInk = Color(0xFFFFFFFF);
  static const heroFaint = Color(0xFFAEB6C1);
  static const heroGood = Color(0xFF6EE7B7);
  static const heroWarn = Color(0xFFFCD34D);
  static const heroBad = Color(0xFFFCA5A5);

  /// The hero panel's three greys, as the website's dark figure card.
  static List<Color> get heroColors => [
        _pick('hero_from', 0xFF2B2E34, 0xFF2B2E34),
        _pick('hero_via', 0xFF202329, 0xFF202329),
        _pick('hero_to', 0xFF13161C, 0xFF13161C),
      ];

  /// The plain dark gradient, for small tiles; big panels use [AppHero].
  static LinearGradient get hero => LinearGradient(
        begin: const Alignment(-.42, -.9),
        end: const Alignment(.42, .9),
        colors: heroColors,
        stops: const [0, .55, 1],
      );
  static LinearGradient get action =>
      LinearGradient(colors: [actionFill, actionFill]);

  static TextStyle body(double size,
          {FontWeight weight = FontWeight.normal, Color? color}) =>
      TextStyle(
          fontFamily: company.bodyFont,
          fontFamilyFallback: const ['PlexArabic'],
          fontSize: size,
          height: 1.4,
          fontWeight: weight,
          color: color ?? ink);
  static TextStyle heading(double size, {Color? color}) => TextStyle(
      fontFamily: company.headingFont,
      fontFamilyFallback: const ['PlexArabic'],
      fontSize: size,
      height: 1.3,
      fontWeight: FontWeight.w700,
      color: color ?? ink);
  static TextStyle number(double size,
          {Color? color, FontWeight weight = FontWeight.w700}) =>
      TextStyle(
          fontFamily: 'Alexandria',
          fontFamilyFallback: [company.bodyFont, 'PlexArabic'],
          fontSize: size,
          height: 1.2,
          fontWeight: weight,
          color: color ?? ink);

  static List<BoxShadow> get shadow => dark
      ? const [
          BoxShadow(
              color: Color(0x66000000), blurRadius: 2, offset: Offset(0, 1)),
          BoxShadow(
              color: Color(0x55000000), blurRadius: 18, offset: Offset(0, 6)),
        ]
      : const [
          BoxShadow(
              color: Color(0x0A101828), blurRadius: 2, offset: Offset(0, 1)),
          BoxShadow(
              color: Color(0x0D101828), blurRadius: 18, offset: Offset(0, 6)),
        ];

  static BoxDecoration card({double radius = 22}) => BoxDecoration(
      color: surface,
      border: Border.all(color: lineSoft),
      borderRadius: BorderRadius.circular(radius),
      boxShadow: shadow);

  static ThemeData get theme {
    final scheme = ColorScheme.fromSeed(
        seedColor: brand,
        brightness: dark ? Brightness.dark : Brightness.light,
        primary: brand,
        surface: surface);
    OutlineInputBorder border(Color color) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(15),
        borderSide: BorderSide(color: color, width: 1.5));
    return ThemeData(
      useMaterial3: true,
      brightness: dark ? Brightness.dark : Brightness.light,
      fontFamily: company.bodyFont,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      canvasColor: background,
      splashFactory: InkRipple.splashFactory,
      textTheme: TextTheme(
        titleLarge:
            TextStyle(fontFamily: company.headingFont, fontWeight: FontWeight.w700),
      ),
      textSelectionTheme: TextSelectionThemeData(cursorColor: brand),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        hintStyle: body(15, color: faint),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: border(line),
        enabledBorder: border(line),
        disabledBorder: border(line),
        focusedBorder: border(brand),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: selected,
        contentTextStyle: body(14, weight: FontWeight.w600, color: selectedInk),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        modalBarrierColor: const Color(0x8005080B),
        shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      ),
      dialogTheme: DialogThemeData(
          backgroundColor: surface,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(24))),
    );
  }

  /// 1250.5 -> 1,250.50, as the money amounts are shown.
  static String grouped(dynamic value) {
    final text = (double.tryParse('$value') ?? 0).toStringAsFixed(2);
    final parts = text.split('.');
    final negative = parts.first.startsWith('-');
    final digits = negative ? parts.first.substring(1) : parts.first;
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
      buffer.write(digits[i]);
    }
    return '${negative ? '-' : ''}$buffer.${parts.last}';
  }

  static String money(dynamic value) =>
      (double.tryParse('$value') ?? 0).toStringAsFixed(2);

  /// A meter reading without trailing zeros: 1250, not 1250.00.
  static String reading(dynamic value) {
    final number = double.tryParse('$value');
    if (number == null) return value == null ? '—' : '$value';
    return number == number.roundToDouble()
        ? number.toStringAsFixed(0)
        : number.toString();
  }

  /// How many readings, worded as Arabic counts them.
  static String readingsCount(int count) => switch (count) {
        0 => 'لا قراءات',
        1 => 'قراءة واحدة',
        2 => 'قراءتان',
        <= 10 => '$count قراءات',
        _ => '$count قراءة',
      };

  /// How many payments, worded as Arabic counts them.
  static String paymentsCount(int count) => switch (count) {
        0 => 'لا دفعات',
        1 => 'دفعة واحدة',
        2 => 'دفعتان',
        <= 10 => '$count دفعات',
        _ => '$count دفعة',
      };

  /// A date the server sent, day first: '2026-10-01 12:30' -> '01/10/2026 12:30'.
  /// Anything that does not start with a year-first date stays as it is.
  static String dayFirst(dynamic value) {
    final match =
        RegExp(r'^(\d{4})-(\d{2})-(\d{2})((?: .*)?)$').firstMatch('$value');
    return match == null
        ? '$value'
        : '${match[3]}/${match[2]}/${match[1]}${match[4]}';
  }

  /// A week's start date as day/month, the way the field staff say it.
  static String shortDate(dynamic value) {
    final date = DateTime.tryParse('$value');
    return date == null
        ? '—'
        : '${'${date.day}'.padLeft(2, '0')}/${'${date.month}'.padLeft(2, '0')}';
  }
}

/// Re-runs every widget's build, so colours read from [AppIdentity] again
/// after the phone switches between light and dark.
void rebuildEverything() {
  void visit(Element element) {
    element.markNeedsBuild();
    element.visitChildren(visit);
  }

  WidgetsBinding.instance.rootElement?.visitChildren(visit);
}
