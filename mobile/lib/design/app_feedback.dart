/// Notices, strips, figures and service cards.
library;

import 'package:flutter/material.dart';

import 'app_identity.dart';

/// A short message in a tinted strip: grey for a tip, amber for a warning,
/// red for a failure, green for a success.
class AppNotice extends StatelessWidget {
  const AppNotice(this.text,
      {this.error = false,
      this.success = false,
      this.warning = false,
      this.icon,
      super.key});
  final String text;
  final bool error;
  final bool success;
  final bool warning;
  final String? icon;
  @override
  Widget build(BuildContext context) {
    final (color, background, glyph) = error
        ? (AppIdentity.bad, AppIdentity.badTint, 'err')
        : success
            ? (AppIdentity.good, AppIdentity.goodTint, 'check')
            : warning
                ? (AppIdentity.warning, AppIdentity.warningTint, 'info')
                : (AppIdentity.muted, AppIdentity.raised, 'info');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
          color: background, borderRadius: BorderRadius.circular(15)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
            padding: const EdgeInsets.only(top: 2),
            child: AppIcon(icon ?? glyph, size: 17, color: color)),
        const SizedBox(width: 9),
        Expanded(
            child: Text(text,
                style: AppIdentity.body(13,
                    weight: FontWeight.w600, color: color))),
      ]),
    );
  }
}

/// A tinted strip that opens something: «2 readings waiting» and the like.
class AppStrip extends StatelessWidget {
  const AppStrip(
      {required this.icon,
      required this.text,
      required this.action,
      required this.tone,
      required this.onTap,
      super.key});
  final String icon;
  final String text;
  final String action;
  final AppTone tone;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final (color, background) = switch (tone) {
      AppTone.warning => (AppIdentity.warning, AppIdentity.warningTint),
      AppTone.bad => (AppIdentity.bad, AppIdentity.badTint),
      _ => (AppIdentity.brand, AppIdentity.brandSoft),
    };
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(17),
        child: InkWell(
          borderRadius: BorderRadius.circular(17),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              AppIcon(icon, color: color),
              const SizedBox(width: 10),
              Expanded(
                  child: Text(text,
                      style: AppIdentity.body(14,
                          weight: FontWeight.w600, color: color))),
              Text(action,
                  style: AppIdentity.body(13.5,
                      weight: FontWeight.w700, color: color)),
              const SizedBox(width: 10),
              AppIcon('chev', size: 18, color: color),
            ]),
          ),
        ),
      ),
    );
  }
}

class AppStat extends StatelessWidget {
  const AppStat(this.label, this.value, {this.color, super.key});
  final String label;
  final String value;
  final Color? color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: AppIdentity.card(radius: 18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: AppIdentity.body(12.5,
                  weight: FontWeight.w600, color: AppIdentity.faint)),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppIdentity.number(22,
                  weight: FontWeight.w800, color: color)),
        ]),
      );
}

/// One of the home screen's big buttons.
class AppServiceCard extends StatelessWidget {
  const AppServiceCard(
      {required this.title,
      required this.subtitle,
      required this.summary,
      required this.icon,
      required this.color,
      required this.tint,
      required this.onTap,
      super.key});
  final String title;
  final String subtitle;
  final String summary;
  final String icon;
  final Color color;
  final Color tint;
  final VoidCallback onTap;

  Widget summaryBadge() => Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
          color: AppIdentity.raised, borderRadius: BorderRadius.circular(10)),
      child: Text(summary,
          style: AppIdentity.number(12.5, color: AppIdentity.ink2)));

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Container(
          decoration: AppIdentity.card(),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(22),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: LayoutBuilder(builder: (context, constraints) {
                  final stacked = constraints.maxWidth <
                      420 * MediaQuery.textScalerOf(context).scale(14) / 14;
                  return Row(children: [
                    AppIconTile(icon, color, tint, size: 52, iconSize: 24),
                    const SizedBox(width: 14),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text(title,
                              style: AppIdentity.body(16,
                                  weight: FontWeight.w700)),
                          Text(subtitle,
                              style: AppIdentity.body(12.5,
                                  color: AppIdentity.faint)),
                          if (stacked) ...[
                            const SizedBox(height: 6),
                            summaryBadge(),
                          ],
                        ])),
                    if (!stacked) ...[
                      const SizedBox(width: 14),
                      summaryBadge(),
                    ],
                  ]);
                }),
              ),
            ),
          ),
        ),
      );
}
