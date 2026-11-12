part of 'field_shell.dart';

/// The upload status screen and the account screen.
extension _ShellAccount on _FieldShellState {
  Widget syncView() => ReadingReview(
        queue: widget.store.queuedReadings,
        subscribers: widget.store.subscribers,
        canUpload: canRead,
        canEdit: (reading) =>
            canRead &&
            readingEntryIsOpen(widget.store.state, TrustedClock.now()) &&
            reading['week_start'] == widget.store.state['week_start'] &&
            widget.store.subscribers.any(
                (subscriber) => subscriber['id'] == reading['subscription_id']),
        online: online,
        busy: syncing || uploadingReadings,
        onRefresh: () => synchronize(forceRoster: true),
        onUpload: uploadReadings,
        onReenter: reenterReading,
        onDiscard: discardRejectedReading,
      );
  Widget account() {
    final name = '${widget.user['name'] ?? '?'}';
    return ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        children: [
          AppPanel(
              child: Row(children: [
            SizedBox(
                width: 66,
                height: 66,
                child: AppHero(
                    radius: 22,
                    shadow: false,
                    padding: EdgeInsets.zero,
                    child: Center(
                        child: Text(name.characters.first,
                            style: AppIdentity.heading(28,
                                color: Colors.white))))),
            const SizedBox(width: 14),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(name, style: AppIdentity.heading(21)),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Text('@${widget.user['username']}',
                        textDirection: TextDirection.ltr,
                        style: AppIdentity.body(13, color: AppIdentity.faint)),
                  ),
                  Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Row(children: [
                        AppIcon('pin', size: 15, color: AppIdentity.faint),
                        const SizedBox(width: 4),
                        Expanded(
                            child: Text(
                                '${widget.user['branch_name'] ?? 'جميع الفروع'}',
                                style: AppIdentity.body(13,
                                    color: AppIdentity.faint))),
                      ])),
                ])),
          ])),
          if (widget.onAppearanceChanged != null) ...[
            const AppSection('مظهر التطبيق'),
            AppRows(children: [
              for (final (mode, label) in [
                (ThemeMode.light, 'فاتح'),
                (ThemeMode.dark, 'داكن'),
                (ThemeMode.system, 'حسب إعداد الهاتف'),
              ])
                AppRow(
                  key: ValueKey('appearance-${mode.name}'),
                  title: AppRowTitle(label),
                  trailing: Icon(
                      widget.appearance == mode
                          ? Icons.radio_button_checked
                          : Icons.radio_button_unchecked,
                      color: widget.appearance == mode
                          ? AppIdentity.brand
                          : AppIdentity.faint),
                  onTap: () async {
                    try {
                      await widget.onAppearanceChanged!(mode);
                    } catch (error, stack) {
                      unawaited(Diagnostics.record(error, stack, where: 'field_shell'));
                      if (mounted) {
                        showAppToast(context, 'تعذر حفظ المظهر. أعد المحاولة.',
                            icon: 'err');
                      }
                    }
                  },
                ),
            ]),
          ],
          const AppSection('الصلاحيات المتاحة'),
          AppRows(children: [
            for (final (allowed, label, icon) in [
              (canRead, 'إدخال القراءات', 'bolt'),
              (canCollect, 'تسجيل الدفعات', collectionIcon),
              (
                currentUser['can_adjust_balances'] == true,
                'إضافة الحركات المالية',
                'cash'
              ),
              (canRecordSplitPayments, 'الحوالات المقسّمة', 'bank'),
              (canViewSubscriptions, 'كشوف حساب المشتركين', 'hist'),
              (canViewReadings, 'عرض القراءات الأسبوعية', 'hist'),
              (
                currentUser['can_distribute_readings'] == true,
                'توزيع القراءات',
                'bolt'
              ),
              (
                currentUser['can_approve_reading_assignments'] == true,
                'اعتماد توزيع القراءات',
                'check'
              ),
              (canSendMessages, 'إرسال الرسائل', 'message'),
              (canViewMessages, 'سجل الرسائل', 'message'),
            ])
              if (allowed)
                AppRow(
                    leading: AppIconTile(
                        icon,
                        allowed ? AppIdentity.ink : AppIdentity.faint,
                        AppIdentity.sunken,
                        size: 40,
                        iconSize: 20),
                    title: Text(label,
                        style: AppIdentity.body(15,
                            weight: FontWeight.w700,
                            color:
                                allowed ? AppIdentity.ink : AppIdentity.faint)),
                    trailing: AppTag(allowed ? 'مفعّلة' : 'غير مفعّلة',
                        allowed ? AppTone.good : AppTone.muted)),
          ]),
          if (widget.store.queuedReadings.isNotEmpty)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child: AppNotice(
                    '${AppIdentity.readingsCount(widget.store.queuedReadings.length)} لم تُرسل بعد. زامنها قبل تسجيل الخروج.',
                    warning: true)),
          Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                  key: const ValueKey('send-diagnostics'),
                  onPressed: sendDiagnostics,
                  child: const Text('إرسال سجل أخطاء التطبيق إلى الدعم'))),
          const SizedBox(height: 16),
          AppAction(
              label: 'تسجيل الخروج',
              primary: false,
              icon: 'logout',
              onPressed: signOut),
          const SizedBox(height: 24),
          const DevelopmentCredits(),
        ]);
  }
}
