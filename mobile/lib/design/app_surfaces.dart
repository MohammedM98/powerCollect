/// The app's cards, rows, tags, section titles, empty states and screen header.
library;

import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'app_identity.dart';

/// Shows or hides [child] by sliding it open or closed.
class AppReveal extends StatelessWidget {
  const AppReveal({required this.visible, required this.child, super.key});
  final bool visible;
  final Widget child;
  @override
  Widget build(BuildContext context) => ClipRect(
        child: AnimatedSize(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          alignment: Alignment.topCenter,
          child: visible ? child : const SizedBox(width: double.infinity),
        ),
      );
}

/// The dark panel behind the home summary, the payment balance and the
/// payment summary: a charcoal gradient with a red glow at the top and a
/// warm one at the bottom.
class AppHero extends StatelessWidget {
  const AppHero(
      {required this.child,
      this.padding = const EdgeInsets.all(18),
      this.radius = 26,
      this.shadow = true,
      super.key});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final bool shadow;
  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            boxShadow: !shadow
                ? null
                : const [
                    BoxShadow(
                        color: Color(0xFF111820),
                        blurRadius: 36,
                        offset: Offset(0, 18),
                        spreadRadius: -22)
                  ]),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(radius),
          child: CustomPaint(
              painter: const _HeroPainter(),
              child: Padding(padding: padding, child: child)),
        ),
      );
}

class _HeroPainter extends CustomPainter {
  const _HeroPainter();

  ui.Shader _glow(
      Offset center, double rx, double ry, Color color, double end) {
    final matrix = Matrix4.identity()
      ..translateByDouble(center.dx, center.dy, 0, 1)
      ..scaleByDouble(rx, ry, 1, 1)
      ..translateByDouble(-center.dx, -center.dy, 0, 1);
    return ui.Gradient.radial(center, 1, [color, color.withValues(alpha: 0)],
        [0, end], TileMode.clamp, matrix.storage);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    // CSS linear-gradient(155deg, ...): the gradient line runs through the
    // centre at 155 degrees and is as long as the box's projection on it.
    const sinA = .42261826, cosA = -.90630779;
    final length = (size.width * sinA).abs() + (size.height * cosA).abs();
    final centre = rect.center;
    final direction = const Offset(sinA, -cosA);
    canvas.drawRect(
        rect,
        Paint()
          ..shader = ui.Gradient.linear(
              centre - direction * (length / 2),
              centre + direction * (length / 2),
              const [Color(0xFF262C34), Color(0xFF1C2127), Color(0xFF111418)],
              const [0, .55, 1]));
    canvas.drawRect(
        rect,
        Paint()
          ..shader = _glow(Offset(size.width * .9, 0), size.width * 1.2,
              size.height * .9, const Color(0x50A51D26), .55));
    canvas.drawRect(
        rect,
        Paint()
          ..shader = _glow(Offset(0, size.height * 1.1), size.width * .9,
              size.height * .8, const Color(0x2EB98A3E), .6));
  }

  @override
  bool shouldRepaint(_HeroPainter old) => false;
}

/// The previous reading, the new one and the consumption between them,
/// side by side so a wrong number stands out before it is saved.
class AppReadingCompare extends StatelessWidget {
  const AppReadingCompare(
      {required this.previous,
      required this.current,
      required this.consumption,
      this.currentHint = '—',
      this.currentLabel = 'الجديدة',
      this.alert,
      this.highlightCurrent = false,
      super.key});
  final String previous;
  final String? current;
  final String? consumption;
  final String currentHint;
  final String currentLabel;
  final Color? alert;
  final bool highlightCurrent;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
        child: Row(children: [
          Expanded(child: _cell('السابقة', previous)),
          _operator('←'),
          Expanded(
              child: _cell(currentLabel, current ?? currentHint,
                  muted: current == null, emphasised: highlightCurrent)),
          _operator('='),
          Expanded(child: _cell('الاستهلاك', consumption ?? '—')),
        ]),
      );

  Widget _operator(String text) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child:
            Text(text, style: AppIdentity.number(14, color: AppIdentity.faint)),
      );

  Widget _cell(String label, String value,
          {bool emphasised = false, bool muted = false}) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
            color: emphasised ? AppIdentity.surface : AppIdentity.raised,
            border: emphasised
                ? Border.all(color: alert ?? AppIdentity.brand, width: 1.5)
                : null,
            borderRadius: BorderRadius.circular(14)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              maxLines: 1,
              style: AppIdentity.body(11,
                  weight: FontWeight.w600, color: AppIdentity.faint)),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textDirection: TextDirection.ltr,
                style: muted
                    ? AppIdentity.body(14, color: AppIdentity.faint)
                    : AppIdentity.number(17, weight: FontWeight.w800)),
          ),
        ]),
      );
}

class AppPanel extends StatelessWidget {
  const AppPanel(
      {required this.child,
      this.padding = const EdgeInsets.all(14),
      super.key});
  final Widget child;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        decoration: AppIdentity.card(),
        child: Padding(padding: padding, child: child),
      );
}

/// A card of rows, each separated from the next by a hairline.
class AppRows extends StatelessWidget {
  const AppRows({required this.children, super.key});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
        decoration: AppIdentity.card(),
        clipBehavior: Clip.antiAlias,
        child: Material(
          color: Colors.transparent,
          child: Column(children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0)
                Divider(height: 1, thickness: 1, color: AppIdentity.lineSoft),
              children[i],
            ],
          ]),
        ),
      );
}

/// One row of a list: a leading tile, a title with a line under it, and
/// whatever sits at the far end.
class AppRow extends StatelessWidget {
  const AppRow(
      {required this.title,
      this.subtitle,
      this.leading,
      this.trailing,
      this.onTap,
      this.onLongPress,
      this.adaptiveTrailing = false,
      this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      this.crossAxisAlignment = CrossAxisAlignment.center,
      super.key});
  final Widget title;
  final Widget? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final bool adaptiveTrailing;
  final EdgeInsetsGeometry padding;
  final CrossAxisAlignment crossAxisAlignment;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        child: Padding(
          padding: padding,
          child: LayoutBuilder(builder: (context, constraints) {
            final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;
            final stackTrailing = adaptiveTrailing &&
                trailing != null &&
                trailing is! AppIcon &&
                constraints.maxWidth < 280 * textScale;
            return Row(crossAxisAlignment: crossAxisAlignment, children: [
              if (leading != null) ...[leading!, const SizedBox(width: 12)],
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    title,
                    if (subtitle != null) subtitle!,
                    if (stackTrailing)
                      Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Align(
                              alignment: AlignmentDirectional.centerEnd,
                              child: trailing!)),
                  ])),
              if (trailing != null && !stackTrailing) ...[
                const SizedBox(width: 12),
                trailing!
              ],
            ]);
          }),
        ),
      );
}

/// A row's name, in bold, on one line.
class AppRowTitle extends StatelessWidget {
  const AppRowTitle(this.text, {this.size = 15, super.key});
  final String text;
  final double size;
  @override
  Widget build(BuildContext context) => Text(text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppIdentity.body(size, weight: FontWeight.w700));
}

/// The grey line under a row's name.
class AppRowNote extends StatelessWidget {
  const AppRowNote(this.text, {this.color, super.key});
  final String text;
  final Color? color;
  @override
  Widget build(BuildContext context) => Text(text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppIdentity.body(12.5, color: color ?? AppIdentity.faint));
}

/// The letter tile that stands in for a person's photo.
class AppAvatar extends StatelessWidget {
  const AppAvatar(this.name, {this.size = 44, super.key});
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
            color: AppIdentity.sunken,
            borderRadius: BorderRadius.circular(size * .34)),
        child: Text(name.isEmpty ? '?' : name.characters.first,
            style: AppIdentity.number(15,
                weight: FontWeight.w800, color: AppIdentity.ink2)),
      );
}

/// A square tile holding an icon, in a tint.
class AppIconTile extends StatelessWidget {
  const AppIconTile(this.icon, this.color, this.tint,
      {this.size = 44, this.iconSize = 20, super.key});
  final String icon;
  final Color color;
  final Color tint;
  final double size;
  final double iconSize;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
            color: tint, borderRadius: BorderRadius.circular(size * .34)),
        child: AppIcon(icon, size: iconSize, color: color),
      );
}

enum AppTone { good, warning, bad, brand, muted }
