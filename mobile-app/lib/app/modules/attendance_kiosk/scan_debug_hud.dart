import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../core/utils/scan_trace.dart';

// On-screen tail of the ScanTrace ring buffer, overlaid on the face-punch
// screen in debug builds only. The kiosk tablet usually sits in the office
// with nobody holding a laptop next to it, so "reproduce it, then read what
// the last few seconds actually did" has to be possible without adb.
//
// Deliberately IgnorePointer + top-aligned-but-below the close button: it
// must never intercept a tap meant for the screen underneath, and it must
// not cover the preview circle being diagnosed.
class ScanDebugHud extends StatelessWidget {
  const ScanDebugHud({super.key});

  @override
  Widget build(BuildContext context) {
    if (!kDebugMode) return const SizedBox.shrink();
    return Positioned(
      left: 8, right: 8, bottom: 8,
      child: IgnorePointer(
        child: ValueListenableBuilder<int>(
          valueListenable: ScanTrace.instance.revision,
          builder: (_, __, ___) {
            final lines = ScanTrace.instance.lines;
            final tail = lines.length <= 12 ? lines : lines.sublist(lines.length - 12);
            return Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: .62),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final line in tail)
                    Text(
                      line,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: line.contains('STALL') || line.contains('THREW')
                            ? Colors.redAccent
                            : Colors.greenAccent,
                        fontSize: 9,
                        height: 1.25,
                        fontFamily: 'monospace',
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
