/// The segmented switch, filter chips and the search field.
library;

import 'package:flutter/material.dart';

import 'app_identity.dart';

/// The two- or three-way switch with a thumb that slides to the choice.
class AppSegment extends StatelessWidget {
  const AppSegment(
      {required this.labels,
      required this.selected,
      required this.onChanged,
      super.key});
  final List<Widget Function(Color)> labels;
  final int selected;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => Container(
        // Each choice is 48 high inside the 4-pixel track, a full finger's target.
        height: 56 + (MediaQuery.textScalerOf(context).scale(14.5) - 14.5) * 2,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
            color: AppIdentity.sunken, borderRadius: BorderRadius.circular(16)),
        child: Stack(children: [
          AnimatedAlign(
            duration: const Duration(milliseconds: 350),
            curve: const Cubic(.22, 1.2, .36, 1),
            alignment: AlignmentDirectional(
                labels.length == 1
                    ? 0
                    : -1 + 2 * selected / (labels.length - 1),
                0),
            child: FractionallySizedBox(
              widthFactor: 1 / labels.length,
              heightFactor: 1,
              child: DecoratedBox(
                  decoration: BoxDecoration(
                      color: AppIdentity.surface,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: AppIdentity.shadow)),
            ),
          ),
          Row(children: [
            for (var i = 0; i < labels.length; i++)
              Expanded(
                  child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => onChanged(i),
                child: Center(
                    child: labels[i](
                        i == selected ? AppIdentity.ink : AppIdentity.muted)),
              )),
          ]),
        ]),
      );
}

class AppChip extends StatelessWidget {
  const AppChip(this.label,
      {required this.selected, required this.onTap, this.count, super.key});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;
  @override
  Widget build(BuildContext context) {
    final color = selected ? AppIdentity.selectedInk : AppIdentity.muted;
    // Drawn 36 high, touched 48 high: the band above and below is part of
    // the chip for the finger and for TalkBack, as Material's padded chips.
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Ink(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: ShapeDecoration(
                color: selected ? AppIdentity.selected : AppIdentity.surface,
                shape: StadiumBorder(
                    side: BorderSide(
                        color:
                            selected ? AppIdentity.selected : AppIdentity.line,
                        width: 1.5))),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Flexible(
                  child: Text(label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppIdentity.body(13,
                          weight: FontWeight.w700, color: color))),
              if (count != null) ...[
                const SizedBox(width: 6),
                Opacity(
                    opacity: .65,
                    child: Text('$count',
                        style: AppIdentity.number(11, color: color))),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}

/// The search box used above every list.
class AppSearchField extends StatelessWidget {
  const AppSearchField(
      {required this.controller,
      required this.hint,
      required this.onChanged,
      required this.onClear,
      this.onSubmitted,
      this.maxLength,
      this.fieldKey,
      this.autofocus = false,
      super.key});
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;
  final ValueChanged<String>? onSubmitted;
  final int? maxLength;
  final Key? fieldKey;
  final bool autofocus;
  @override
  Widget build(BuildContext context) => TextFieldTapRegion(
          child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
            color: AppIdentity.surface,
            border: Border.all(color: AppIdentity.lineSoft),
            borderRadius: BorderRadius.circular(17),
            boxShadow: AppIdentity.shadow),
        child: Row(children: [
          AppIcon('search', color: AppIdentity.faint),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              key: fieldKey,
              controller: controller,
              autofocus: autofocus,
              onChanged: onChanged,
              onTapOutside: (_) => FocusScope.of(context).unfocus(),
              onSubmitted: onSubmitted,
              maxLength: maxLength,
              textInputAction: TextInputAction.search,
              style: AppIdentity.body(15.5),
              decoration: InputDecoration(
                  counterText: '',
                  hintText: hint,
                  hintStyle: AppIdentity.body(15.5, color: AppIdentity.faint),
                  filled: false,
                  isDense: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: EdgeInsets.zero),
            ),
          ),
          if (controller.text.isNotEmpty)
            InkWell(
              borderRadius: BorderRadius.circular(9),
              onTap: onClear,
              child: Tooltip(
                message: 'مسح البحث',
                child: Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                        color: AppIdentity.sunken,
                        borderRadius: BorderRadius.circular(9)),
                    child: AppIcon('x', size: 15, color: AppIdentity.muted)),
              ),
            ),
        ]),
      ));
}
