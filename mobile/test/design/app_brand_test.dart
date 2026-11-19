import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:power_collect/core/api_client.dart';
import 'package:power_collect/core/field_store.dart';
import 'package:power_collect/design/app_identity.dart';
import 'package:power_collect/main.dart';

/// A 1x1 PNG, standing in for the company's logo.
final logoBytes = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

Map<String, dynamic> companyBrand({String fingerprint = 'ma-1'}) => {
      'fingerprint': fingerprint,
      'company': {
        'name': 'مصعب العجل وأحمد الكفارنة',
        'short_name': 'مصعب العجل وأحمد الكفارنة',
        'tagline': 'للتجارة العامة'
      },
      'logos': {
        'main': 'https://power.example/storage/brand/main.png',
        'light': 'https://power.example/storage/brand/light.png',
        'icon': 'https://power.example/storage/brand/icon.png'
      },
      'fonts': {'body': 'tajawal', 'heading': 'cairo'},
      'colors': {
        'light': {'brand': '#CA4E05', 'action': '#24272E', 'page': '#ECEEF1'},
        'dark': {'brand': '#DC642E', 'action': '#39404A', 'page': '#0C0E11'},
      },
    };

class BrandApi extends ApiClient {
  BrandApi(this.answer);
  Object answer;
  final downloads = <String>[];

  @override
  Future<Map<String, dynamic>> brand() async {
    if (answer is ApiException) throw answer;
    return answer as Map<String, dynamic>;
  }

  @override
  Future<Uint8List> downloadLogo(String url) async {
    downloads.add(url);
    return logoBytes;
  }

  @override
  Future<Map<String, dynamic>> me() async =>
      throw const ApiException('Offline', 0);
}

/// Keeps logos in a real folder; the state itself stays in memory.
class FolderStore extends FieldStore {
  FolderStore(Directory directory) : super(directory: directory);
  @override
  Future<void> load() async {}
  @override
  Future<void> save() async {}
}

/// Lets the app's real file reads and writes and its brand refresh finish between frames.
Future<void> settle(WidgetTester tester) async {
  for (var step = 0; step < 40; step++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 10)));
    await tester.pump();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('powercollect-brand-');
    AppIdentity.company = AppBrand(const {});
    AppIdentity.dark = false;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('powercollect.session'), (call) async => null);
  });
  tearDown(() => directory.delete(recursive: true));

  test('colours and fonts come from the identity, with the website default for anything missing', () {
    final brand = AppBrand({
      ...companyBrand(),
      'colors': {
        'light': {'brand': '#CA4E05', 'action': 'red'}
      },
      'logos': {'main': 'https://power.example/logo.svg'},
    });
    AppIdentity.company = brand;

    expect(AppIdentity.brand, const Color(0xFFCA4E05));
    expect(AppIdentity.actionFill, const Color(0xFF24272E));
    expect(AppIdentity.body(14).fontFamily, 'Tajawal');
    expect(AppIdentity.heading(20).fontFamily, 'Cairo');
    // An SVG logo cannot be drawn here: the name stands in for it.
    expect(brand.logoUrl('main'), isNull);
  });

  testWidgets('the sign-in screen shows the server\'s company and keeps it with its logos', (tester) async {
    final api = BrandApi(companyBrand());
    final store = FolderStore(directory);
    await tester.pumpWidget(PowerCollectApp(apiClient: api, fieldStore: store));
    await settle(tester);

    expect(find.text('مصعب العجل وأحمد الكفارنة'), findsOneWidget);
    expect(find.byKey(const ValueKey('login-logo')), findsOneWidget);
    expect(AppIdentity.brand, const Color(0xFFCA4E05));
    expect((store.state['brand'] as Map)['fingerprint'], 'ma-1');
    expect(api.downloads, ['https://power.example/storage/brand/main.png', 'https://power.example/storage/brand/light.png']);
    expect(await tester.runAsync(() => File('${directory.path}/brand-light').readAsBytes()), logoBytes);

    // The same identity again downloads nothing.
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(PowerCollectApp(apiClient: api, fieldStore: store));
    await settle(tester);
    expect(api.downloads, hasLength(2));
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('offline, the app opens in the identity it kept', (tester) async {
    final store = FolderStore(directory)..state = {'brand': companyBrand()};
    await tester.runAsync(() => File('${directory.path}/brand-light').writeAsBytes(logoBytes));
    AppIdentity.dark = true;

    await tester.pumpWidget(PowerCollectApp(
        apiClient: BrandApi(const ApiException('Offline', 0)), fieldStore: store));
    await settle(tester);

    expect(find.text('مصعب العجل وأحمد الكفارنة'), findsOneWidget);
    expect(find.byKey(const ValueKey('login-logo')), findsOneWidget);
    expect((store.state['brand'] as Map)['fingerprint'], 'ma-1');
    await tester.pumpWidget(const SizedBox());
  });
}
