import 'dart:async';

import 'package:flutter/foundation.dart';

// Diagnostic tracing for the kiosk face-scan pipeline (face_punch_page.dart
// + face_recognition_service.dart), added while chasing the reported
// "camera freezes, then restarts over and over" behaviour.
//
// Two things this records that plain debugPrint calls could not:
//
//  1. Per-stage wall-clock cost (`step`). The scan pipeline runs five
//     separate full-JPEG decodes per poll on the main isolate, so knowing
//     WHICH stage eats the budget - and whether it exceeds the 1s poll
//     interval - is the whole question.
//  2. Main-isolate stalls (`startStallWatch`). A Timer scheduled every
//     `_stallTick` can only run late if the isolate was busy elsewhere, so
//     the lateness IS the freeze, measured directly. A frozen CameraPreview
//     with no exception in the log is otherwise indistinguishable from a
//     dead native capture session; this tells the two apart.
//
// Lines go to logcat with a fixed `[SCAN]` prefix (filter with
// `adb logcat -s flutter:* | findstr SCAN`) and are also kept in a small
// ring buffer so the on-screen debug HUD can show them without a cable
// attached - the kiosk tablet is not always next to a dev machine.
//
// Cheap but not free (it times and formats on every stage), so everything
// here is gated on kDebugMode and compiles out of release builds.
class ScanTrace {
  ScanTrace._();
  static final ScanTrace instance = ScanTrace._();

  static const _maxLines = 60;
  static const _stallTick = Duration(milliseconds: 100);

  // A stall only counts once the timer is this far past due - Dart timers
  // are already routinely a frame or two late under normal load, and
  // logging that noise would bury the multi-second blocks that matter.
  static const _stallThresholdMs = 250;

  final List<String> _lines = <String>[];

  // Bumped on every appended line so the HUD can rebuild off a
  // ValueListenableBuilder instead of the page calling setState (which
  // would itself perturb the timings being measured).
  final ValueNotifier<int> revision = ValueNotifier<int>(0);

  final Stopwatch _since = Stopwatch()..start();
  Timer? _stallTimer;
  int _lastStallCheckMs = 0;

  List<String> get lines => List.unmodifiable(_lines);

  bool get enabled => kDebugMode;

  void log(String tag, String message) {
    if (!enabled) return;
    final t = (_since.elapsedMilliseconds / 1000).toStringAsFixed(2);
    final line = '${t.padLeft(7)}s $tag $message';
    debugPrint('[SCAN] $line');
    _lines.add(line);
    if (_lines.length > _maxLines) _lines.removeAt(0);
    revision.value++;
  }

  // Times [body] and logs its duration under [label]. Returns whatever
  // [body] returned, and re-logs-then-rethrows on failure so a stage that
  // throws is still visible in the trace with the cost it incurred before
  // dying - a stage that fails after 4 seconds and one that fails instantly
  // point at completely different causes.
  Future<T> step<T>(String label, Future<T> Function() body) async {
    if (!enabled) return body();
    final sw = Stopwatch()..start();
    try {
      final result = await body();
      log('STEP', '$label ok in ${sw.elapsedMilliseconds}ms');
      return result;
    } catch (e) {
      log('STEP', '$label THREW after ${sw.elapsedMilliseconds}ms: $e');
      rethrow;
    }
  }

  // Starts the main-isolate stall watch. Safe to call repeatedly; the
  // existing watch is replaced rather than doubled up.
  void startStallWatch() {
    if (!enabled) return;
    _stallTimer?.cancel();
    _lastStallCheckMs = _since.elapsedMilliseconds;
    _stallTimer = Timer.periodic(_stallTick, (_) {
      final now = _since.elapsedMilliseconds;
      final late = now - _lastStallCheckMs - _stallTick.inMilliseconds;
      _lastStallCheckMs = now;
      if (late >= _stallThresholdMs) {
        log('STALL', 'main isolate blocked ~${late}ms');
      }
    });
  }

  void stopStallWatch() {
    _stallTimer?.cancel();
    _stallTimer = null;
  }

  void clear() {
    _lines.clear();
    revision.value++;
  }
}
