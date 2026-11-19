/// The app's buttons, notices, strips, segments, chips, search box and switches.
library;

import 'package:flutter/material.dart';

import 'app_identity.dart';

/// A rounded square button holding one icon, with an optional count badge
/// and status dot.
class AppIconButton extends StatelessWidget {
  const AppIconButton(
      {required this.icon,
      required this.label,
      required this.onPressed,
      this.spinning = false,
      this.badge = 0,
      this.dot,
      this.size = 48,
      this.iconSize = 20,
      this.flat = false,
      this.color,
      super.key});
  final String icon;
  final String label;
  final VoidCallback? onPressed;
  final bool spinning;
  final int badge;
  final Color? dot;
  final double size;
  final double iconSize;
  final bool flat;
  final Color? color;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        child: Tooltip(
          message: label,
          child: SizedBox(
            width: size,
            height: size,
            child: Stack(clipBehavior: Clip.none, children: [
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                      color: AppIdentity.surface,
                      border: Border.all(color: AppIdentity.lineSoft),
                      borderRadius: BorderRadius.circular(size * .34),
                      boxShadow: flat ? null : AppIdentity.shadow),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(size * .34),
                      onTap: onPressed,
                      child: Center(
                          child: AppSpin(
                              spinning: spinning,
                              child: AppIcon(icon,
                                  size: iconSize,
                                  color: color ?? AppIdentity.ink2))),
                    ),
                  ),
                ),
              ),
              if (badge > 0)
                PositionedDirectional(
                    top: -5,
                    end: -5,
                    child: IgnorePointer(
                      child: Container(
                        constraints:
                            const BoxConstraints(minWidth: 20, minHeight: 20),
                        padding: const EdgeInsets.symmetric(horizontal: 5),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                            color: AppIdentity.warning,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: AppIdentity.background, width: 2)),
                        child: Text('$badge',
                            style: AppIdentity.number(11,
                                    weight: FontWeight.w800,
                                    color: Colors.white)
                                .copyWith(height: 1.1)),
                      ),
                    )),
              if (dot != null)
                PositionedDirectional(
                    bottom: 7,
                    end: 7,
                    child: IgnorePointer(
                      child: Container(
                          width: 9,
                          height: 9,
                          decoration: BoxDecoration(
                              color: dot,
                              shape: BoxShape.circle,
                              border: Border.all(
                                  color: AppIdentity.surface, width: 2))),
                    )),
            ]),
          ),
        ),
      );
}

/// Turns [child] round and round while [spinning].
class AppSpin extends StatefulWidget {
  const AppSpin({required this.spinning, required this.child, super.key});
  final bool spinning;
  final Widget child;
  @override
  State<AppSpin> createState() => _AppSpinState();
}

class _AppSpinState extends State<AppSpin> with SingleTickerProviderStateMixin {
  late final controller =
      AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void initState() {
    super.initState();
    if (widget.spinning) controller.repeat();
  }

  @override
  void didUpdateWidget(AppSpin old) {
    super.didUpdateWidget(old);
    if (widget.spinning && !controller.isAnimating) {
      controller.repeat();
    } else if (!widget.spinning && controller.isAnimating) {
      controller.stop();
      controller.value = 0;
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      RotationTransition(turns: controller, child: widget.child);
}

class AppAction extends StatelessWidget {
  const AppAction(
      {required this.label,
      required this.onPressed,
      this.primary = true,
      this.icon,
      this.busy = false,
      this.height = 54,
      super.key});
  final String label;
  final VoidCallback? onPressed;
  final bool primary;
  final String? icon;
  final bool busy;
  final double height;
  @override
  Widget build(BuildContext context) {
    final foreground = primary ? AppIdentity.actionInk : AppIdentity.ink;
    return Opacity(
      opacity: onPressed == null ? .5 : 1,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: primary ? null : AppIdentity.surface,
          gradient: primary ? AppIdentity.action : null,
          border:
              primary ? null : Border.all(color: AppIdentity.line, width: 1.5),
          borderRadius: BorderRadius.circular(height > 50 ? 18 : 14),
          boxShadow: primary
              ? [
                  BoxShadow(
                      color: AppIdentity.actionFill,
                      blurRadius: 24,
                      offset: Offset(0, 12),
                      spreadRadius: -14)
                ]
              : null,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(height > 50 ? 18 : 14),
            onTap: busy ? null : onPressed,
            child: ConstrainedBox(
              constraints:
                  BoxConstraints(minHeight: height, minWidth: double.infinity),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                child:
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  if (busy)
                    SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: foreground))
                  else if (icon != null)
                    AppIcon(icon!, size: 20, color: foreground),
                  if (busy || icon != null) const SizedBox(width: 8),
                  Flexible(
                      child: Text(label,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppIdentity.body(height > 50 ? 15.5 : 14,
                              weight: FontWeight.w700, color: foreground))),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A switch with its caption, as «the subscriber himself» on the payment form.
class AppToggle extends StatelessWidget {
  const AppToggle(
      {required this.label,
      required this.value,
      required this.onChanged,
      super.key});
  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;
  @override
  Widget build(BuildContext context) => Semantics(
        toggled: value,
        label: label,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onChanged == null ? null : () => onChanged!(!value),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Flexible(
                child: Text(label,
                    style: AppIdentity.body(13,
                        weight: FontWeight.w600, color: AppIdentity.muted))),
            const SizedBox(width: 8),
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: 46,
              height: 28,
              padding: const EdgeInsets.all(3),
              alignment: value
                  ? AlignmentDirectional.centerEnd
                  : AlignmentDirectional.centerStart,
              decoration: BoxDecoration(
                  color: value ? AppIdentity.good : AppIdentity.line,
                  borderRadius: BorderRadius.circular(14)),
              child: Container(
                  width: 22,
                  height: 22,
                  decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                            color: Color(0x33000000),
                            blurRadius: 5,
                            offset: Offset(0, 2))
                      ])),
            ),
          ]),
        ),
      );
}
