import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/api_client.dart';
import 'design/app_identity.dart';
import 'core/field_store.dart';
import 'shell/field_shell.dart';
import 'auth/login_page.dart';
import 'core/diagnostics.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // The look the app was built with, until the kept or the server's identity replaces it.
  try {
    AppIdentity.company = await AppBrand.builtIn();
  } catch (error, stack) {
    unawaited(Diagnostics.record(error, stack, where: 'brand'));
  }
  // Every error the app did not handle goes to the log the collector can send.
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    unawaited(
        Diagnostics.record(details.exception, details.stack, where: 'flutter'));
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    unawaited(Diagnostics.record(error, stack, where: 'platform'));
    return false;
  };
  runApp(const PowerCollectApp());
}

class PowerCollectApp extends StatefulWidget {
  const PowerCollectApp({super.key, this.apiClient, this.fieldStore});
  final ApiClient? apiClient;
  final FieldStore? fieldStore;

  @override
  State<PowerCollectApp> createState() => _PowerCollectAppState();
}

class _PowerCollectAppState extends State<PowerCollectApp>
    with WidgetsBindingObserver {
  late final ApiClient api = widget.apiClient ?? ApiClient();
  late final FieldStore store = widget.fieldStore ?? FieldStore();
  bool loading = true;
  Map<String, dynamic>? user;
  String? startupError;
  final navigatorKey = GlobalKey<NavigatorState>();
  ThemeMode appearance = ThemeMode.system;

  bool get isDark =>
      appearance == ThemeMode.dark ||
      (appearance == ThemeMode.system && _systemIsDark);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    api.onUnauthenticated = requireLogin;
    restore();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    api.onUnauthenticated = null;
    super.dispose();
  }

  @override
  void didChangePlatformBrightness() {
    AppIdentity.dark = isDark;
    rebuildEverything();
  }

  bool get _systemIsDark =>
      WidgetsBinding.instance.platformDispatcher.platformBrightness ==
      Brightness.dark;

  Future<void> restore() async {
    try {
      await store.load();
      await restoreBrand();
      appearance = ThemeMode.values.firstWhere(
          (mode) => mode.name == store.state['appearance'],
          orElse: () => ThemeMode.system);
      api.token = store.token;
      if (mounted) {
        setState(() => user =
            store.remembersSession && store.token != null ? store.user : null);
      }
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'main'));
      startupError = 'تعذر فتح التخزين المحلي. أعد تشغيل التطبيق.';
    } finally {
      if (mounted) setState(() => loading = false);
      unawaited(refreshBrand());
    }
  }

  /// The identity kept from the last time the server was reached; without
  /// one, the app keeps the one it was built with (see main).
  Future<void> restoreBrand() async {
    final kept = store.state['brand'];
    if (kept is! Map) return;
    final logos = <String, Uint8List>{};
    for (final variant in ['main', 'light']) {
      final bytes = await store.readKept('brand-$variant');
      if (bytes != null) logos[variant] = bytes;
    }
    AppIdentity.company =
        AppBrand(Map<String, dynamic>.from(kept), logos: logos);
  }

  /// Ask the server for the company's identity and, when it changed, keep it
  /// with its logos and redraw the app in it. Offline, the kept one stays.
  Future<void> refreshBrand() async {
    try {
      final next = AppBrand(await api.brand());
      final current = AppIdentity.company;
      if (next.fingerprint != null && next.fingerprint == current.fingerprint) {
        return;
      }
      final logos = <String, Uint8List>{};
      for (final variant in ['main', 'light']) {
        final url = next.logoUrl(variant);
        if (url == null) continue;
        try {
          logos[variant] = await api.downloadLogo(url);
          await store.keep('brand-$variant', logos[variant]!);
        } catch (error, stack) {
          unawaited(Diagnostics.record(error, stack, where: 'brand'));
        }
      }
      store.state['brand'] = next.json;
      await store.save();
      if (!mounted) return;
      setState(() => AppIdentity.company = AppBrand(next.json, logos: logos));
      rebuildEverything();
    } on ApiException {
      // Offline or an older server: the kept identity stays.
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'brand'));
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(refreshBrand());
  }

  Future<void> login(String username, String password, bool remember) async {
    if (store.queuedReadings.isNotEmpty &&
        store.user?['username'] != username) {
      throw const ApiException(
          'توجد قراءات غير مرسلة لحساب آخر. اتصل بالإنترنت وزامنها أولًا.', 0);
    }
    final previousToken = api.token;
    final result = await api.login(username, password, remember: remember);
    final nextUser = Map<String, dynamic>.from(result['user'] as Map);
    try {
      await store.saveSession(nextUser, result['token'] as String,
          remember: remember);
    } on PendingReadingsAccountSwitch {
      try {
        await api.logout();
      } on ApiException catch (error, stack) {
        unawaited(Diagnostics.record(error, stack, where: 'main'));
        // Restore the original session even if the new token cannot be revoked.
      }
      api.token = previousToken;
      throw const ApiException(
          'توجد قراءات غير مرسلة لحساب آخر. زامنها أولًا.', 0);
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'main'));
      try {
        await api.logout();
      } on ApiException catch (error, stack) {
        unawaited(Diagnostics.record(error, stack, where: 'main'));
      }
      api.token = previousToken;
      throw const ApiException(
          'تعذر حفظ جلسة الدخول بأمان على الجهاز. حاول مجددًا.', 0);
    }
    if (mounted) setState(() => user = nextUser);
  }

  Future<void> logout() async {
    if (store.queuedReadings.isNotEmpty) {
      throw const ApiException(
          'زامن القراءات غير المرسلة قبل تسجيل الخروج.', 0);
    }
    try {
      await api.logout();
    } on ApiException catch (error) {
      // Offline, the session still ends on this phone: the token is erased
      // from it, and the collector signs in again like anyone else.
      if (!error.isNetwork) rethrow;
      api.token = null;
    }
    // Payments sent without an answer stay, for the same collector to settle.
    final pendingCollections = store.state['pending_collections'];
    store.state.clear();
    final brand = store.state['brand'];
    store.state['appearance'] = appearance.name;
    if (brand != null) store.state['brand'] = brand;
    if (pendingCollections != null) {
      store.state['pending_collections'] = pendingCollections;
    }
    await store.save();
    if (mounted) setState(() => user = null);
  }

  void requireLogin() {
    if (user == null) return;
    api.token = null;
    store.state['remember_session'] = false;
    store.clearRoster();
    unawaited(store.save().catchError((Object _) {}));
    navigatorKey.currentState?.popUntil((route) => route.isFirst);
    if (mounted) setState(() => user = null);
  }

  Future<void> setAppearance(ThemeMode mode) async {
    final previous = store.state['appearance'];
    store.state['appearance'] = mode.name;
    try {
      await store.save();
    } catch (error, stack) {
      unawaited(Diagnostics.record(error, stack, where: 'main'));
      if (previous == null) {
        store.state.remove('appearance');
      } else {
        store.state['appearance'] = previous;
      }
      rethrow;
    }
    if (!mounted) return;
    setState(() => appearance = mode);
    AppIdentity.dark = isDark;
    rebuildEverything();
  }

  @override
  Widget build(BuildContext context) {
    AppIdentity.dark = isDark;
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'MA',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: AppIdentity.theme,
      home: loading
          ? Scaffold(
              body: Center(
                  child: CircularProgressIndicator(color: AppIdentity.brand)))
          : startupError != null
              ? Scaffold(body: Center(child: Text(startupError!)))
              : user == null
                  ? LoginPage(onLogin: login)
                  : FieldShell(
                      api: api,
                      store: store,
                      user: user!,
                      onLogout: logout,
                      appearance: appearance,
                      onAppearanceChanged: setAppearance,
                      onReauthenticate: requireLogin),
    );
  }
}
