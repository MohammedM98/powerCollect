/// Tags, section titles, field labels, empty states and the page header.
library;

import 'package:flutter/material.dart';

import 'app_identity.dart';

class AppTag extends StatelessWidget {
  const AppTag(this.label, this.tone, {this.icon, super.key});
  final String label;
  final AppTone tone;
  final String? icon;
  @override
  Widget build(BuildContext context) {
    final (foreground, background) = switch (tone) {
      AppTone.good => (AppIdentity.good, AppIdentity.goodTint),
      AppTone.warning => (AppIdentity.warning, AppIdentity.warningTint),
      AppTone.bad => (AppIdentity.bad, AppIdentity.badTint),
      AppTone.brand => (AppIdentity.brand, AppIdentity.brandSoft),
      AppTone.muted => (AppIdentity.muted, AppIdentity.sunken),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
      decoration: BoxDecoration(
          color: background, borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[
          AppIcon(icon!, size: 13, color: foreground),
          const SizedBox(width: 4),
        ],
        Flexible(
          child: Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppIdentity.body(11.5,
                  weight: FontWeight.w700, color: foreground)),
        ),
      ]),
    );
  }
}

/// A section's title, with a small note at the far end.
class AppSection extends StatelessWidget {
  const AppSection(this.title, {this.note, this.margin, super.key});
  final String title;
  final String? note;
  final EdgeInsetsGeometry? margin;
  @override
  Widget build(BuildContext context) => Padding(
        padding: margin ?? const EdgeInsets.fromLTRB(2, 20, 2, 10),
        child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(child: Text(title, style: AppIdentity.heading(17))),
              if (note != null)
                Flexible(
                    child: Text(note!,
                        textAlign: TextAlign.end,
                        style:
                            AppIdentity.body(12.5, color: AppIdentity.faint))),
            ]),
      );
}

/// A field's title with its small hint at the far end.
class AppLabel extends StatelessWidget {
  const AppLabel(this.title, {this.hint, this.trailing, super.key});
  final String title;
  final String? hint;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 16, 2, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Expanded(
                child: Text(title,
                    style: AppIdentity.body(14, weight: FontWeight.w700))),
            if (hint != null)
              Flexible(
                  child: Text(hint!,
                      textAlign: TextAlign.end,
                      style: AppIdentity.body(12, color: AppIdentity.faint))),
          ]),
          if (trailing != null)
            Padding(padding: const EdgeInsets.only(top: 6), child: trailing!),
        ]),
      );
}

class AppEmpty extends StatelessWidget {
  const AppEmpty(this.icon, this.title, this.subtitle,
      {this.good = false, super.key});
  final String icon;
  final String title;
  final String subtitle;
  final bool good;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
        child: Column(children: [
          Container(
              width: 60,
              height: 60,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                  color: good ? AppIdentity.goodTint : AppIdentity.raised,
                  borderRadius: BorderRadius.circular(20)),
              child: AppIcon(icon,
                  size: 28,
                  color: good ? AppIdentity.good : AppIdentity.faint)),
          const SizedBox(height: 10),
          Text(title,
              textAlign: TextAlign.center,
              style: AppIdentity.body(16, weight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(subtitle,
              textAlign: TextAlign.center,
              style: AppIdentity.body(13, color: AppIdentity.faint)),
        ]),
      );
}

class AppHeader extends StatelessWidget {
  const AppHeader(
      {required this.title,
      this.subtitle,
      this.onBack,
      this.onSync,
      this.syncLabel = 'حالة الإرسال',
      this.online = true,
      this.syncing = false,
      this.pending = 0,
      super.key});
  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final VoidCallback? onSync;
  final String syncLabel;
  final bool online;
  final bool syncing;
  final int pending;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
        child: Row(children: [
          if (onBack != null) ...[
            AppIconButton(
                icon: 'back',
                label: 'رجوع',
                onPressed: () {
                  if (!dismissAppKeyboard(context)) onBack!();
                }),
            const SizedBox(width: 10),
          ],
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(title,
                    style: AppIdentity.heading(22),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Text(subtitle!,
                      style: AppIdentity.body(12.5,
                          weight: FontWeight.w500, color: AppIdentity.faint),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
              ])),
          if (onSync != null) ...[
            const SizedBox(width: 10),
            AppIconButton(
                icon: syncing
                    ? 'sync'
                    : online
                        ? 'cloud'
                        : 'cloudoff',
                label: syncLabel,
                spinning: syncing,
                badge: pending,
                dot: online ? AppIdentity.good : AppIdentity.warning,
                onPressed: onSync!),
          ],
        ]),
      );
}
