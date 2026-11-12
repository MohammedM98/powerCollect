import 'dart:convert';
import 'dart:io';

/// A server answer saved in test/fixtures, kept in step with the server's
/// API Resources by tests/Feature/MobileApiFixturesTest.php.
Map<String, dynamic> fixture(String name) =>
    jsonDecode(File('test/fixtures/$name.json').readAsStringSync())
        as Map<String, dynamic>;

/// The recorded-payment answer, with what a test's payment changed. It
/// leaves out balance_after (as servers before it did) unless given, so the
/// app works the balance out itself.
Map<String, dynamic> recordedCollection(
        [Map<String, dynamic> changes = const {}]) =>
    {...fixture('recorded_collection')..remove('balance_after'), ...changes};
