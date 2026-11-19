import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../design/app_identity.dart';
import '../shell/development_credits.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({required this.onLogin, super.key});
  final Future<void> Function(String, String, bool) onLogin;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final username = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  bool showPassword = false;
  bool remember = false;
  String? error;

  @override
  void dispose() {
    username.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.onLogin(username.text.trim(), password.text, remember);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      password.clear();
      if (mounted) setState(() => busy = false);
    }
  }

  InputDecoration _decoration(String hint, String icon, {Widget? suffix}) =>
      InputDecoration(
        hintText: hint,
        hintStyle: AppIdentity.body(16, color: AppIdentity.faint),
        prefixIcon: Padding(
            padding: const EdgeInsetsDirectional.only(start: 14, end: 10),
            child: AppIcon(icon, color: AppIdentity.faint)),
        prefixIconConstraints: const BoxConstraints(),
        suffixIcon: suffix,
        suffixIconConstraints: const BoxConstraints(),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 17),
        border: _border(AppIdentity.line),
        enabledBorder: _border(AppIdentity.line),
        focusedBorder: _border(AppIdentity.brand),
      );

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(17),
      borderSide: BorderSide(color: color, width: 1.5));

  /// The company's logo and name on the website's dark panel, as its sign-in page shows them.
  Widget companyCard() {
    final company = AppIdentity.company;
    final logo = company.logo(onDark: true);
    return AppHero(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
        child: Row(children: [
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(company.name,
                    key: const ValueKey('login-company'),
                    style: AppIdentity.heading(22, color: AppIdentity.heroInk)),
                if (company.tagline != null)
                  Text(company.tagline!,
                      style: AppIdentity.body(13.5,
                          color: AppIdentity.heroFaint)),
              ])),
          if (logo != null) ...[
            const SizedBox(width: 14),
            Image.memory(logo,
                key: const ValueKey('login-logo'),
                height: 64,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const SizedBox.shrink()),
          ],
        ]));
  }

  @override
  Widget build(BuildContext context) => AppKeyboardBackScope(
          child: Scaffold(
        body: SafeArea(
            child: Center(
                child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: ListView(
              padding: const EdgeInsets.fromLTRB(22, 30, 22, 30),
              children: [
                companyCard(),
                Padding(
                    padding: const EdgeInsets.only(top: 22),
                    child: Text('تسجيل الدخول',
                        key: const ValueKey('login-title'),
                        style: AppIdentity.heading(27))),
                Padding(
                    padding: const EdgeInsets.only(top: 2, bottom: 20),
                    child: Text(
                        'تطبيق الميدان: ادخل باسم المستخدم الذي أعطاك إياه مدير النظام.',
                        style: AppIdentity.body(14, color: AppIdentity.muted))),
                AutofillGroup(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                      TextField(
                          controller: username,
                          autofillHints: const [AutofillHints.username],
                          textInputAction: TextInputAction.next,
                          style: AppIdentity.body(16),
                          decoration: _decoration('اسم المستخدم', 'user')),
                      const SizedBox(height: 12),
                      TextField(
                          controller: password,
                          obscureText: !showPassword,
                          autofillHints: const [AutofillHints.password],
                          onSubmitted: (_) => submit(),
                          style: AppIdentity.body(16),
                          decoration: _decoration('كلمة المرور', 'lock',
                              suffix: Padding(
                                  padding: const EdgeInsetsDirectional.only(
                                      start: 10, end: 14),
                                  child: IconButton(
                                      tooltip: showPassword
                                          ? 'إخفاء كلمة المرور'
                                          : 'إظهار كلمة المرور',
                                      onPressed: () => setState(
                                          () => showPassword = !showPassword),
                                      icon: AppIcon(
                                          showPassword ? 'eyeoff' : 'eye',
                                          color: AppIdentity.faint))))),
                      const SizedBox(height: 12),
                      CheckboxListTile(
                          value: remember,
                          onChanged: busy
                              ? null
                              : (value) =>
                                  setState(() => remember = value ?? false),
                          contentPadding: EdgeInsets.zero,
                          controlAffinity: ListTileControlAffinity.leading,
                          title: Row(children: [
                            const Text('تذكرني'),
                            IconButton(
                                tooltip: 'معلومات تذكرني',
                                icon: AppIcon('err',
                                    size: 18, color: AppIdentity.faint),
                                onPressed: () => showAppSheet<void>(context,
                                    title: 'تذكرني',
                                    message:
                                        'ابقَ مسجّل الدخول على هذا الجهاز لمدة تصل إلى 30 يومًا.',
                                    children: const [])),
                          ])),
                      if (error != null) ...[
                        AppNotice(error!, error: true),
                        const SizedBox(height: 12),
                      ],
                      AppAction(
                          key: const ValueKey('login-submit'),
                          label: busy ? 'جارٍ الدخول...' : 'تسجيل الدخول',
                          icon: 'login',
                          busy: busy,
                          onPressed: busy ? null : submit),
                    ])),
                Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Text(
                        'بعد أول دخول وتحميل البيانات، يمكنك إدخال قراءات العدادات دون اتصال. التحصيل يحتاج إلى الإنترنت.',
                        textAlign: TextAlign.center,
                        style:
                            AppIdentity.body(12.5, color: AppIdentity.faint))),
                const SizedBox(height: 20),
                const DevelopmentCredits(),
              ]),
        ))),
      ));
}
