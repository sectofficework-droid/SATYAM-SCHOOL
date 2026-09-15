import 'package:flutter/services.dart';

// Wraps a couple of native Android UI calls (see MainActivity.kt) - the
// attendance kiosk's face-punch confirm step needs to show *something*
// right after the on-device face-detection/TFLite pipeline runs, and
// asking Flutter to paint that reproducibly corrupted its own rendering
// on every test device/SDK version tried. A native AlertDialog/Toast is
// composited entirely outside Flutter's engine, sidestepping whatever
// Flutter-side state the ML pipeline was corrupting.
// Punch In (record the match), Not Me (wrong match - fall back to
// enter_punch_code_page.dart), or Cancel (abort, straight back to kiosk
// home - no code fallback offered, unlike Not Me).
enum PunchConfirmResult { confirmed, notMe, cancelled }

class NativeUiService {
  static const _channel = MethodChannel('com.satyamstars.attendance/native_ui');

  static Future<PunchConfirmResult> confirmPunch(String name) async {
    final result = await _channel.invokeMethod<String>('confirmPunch', {'name': name});
    return switch (result) {
      'confirmed' => PunchConfirmResult.confirmed,
      'cancelled' => PunchConfirmResult.cancelled,
      _ => PunchConfirmResult.notMe,
    };
  }

  // enter_punch_code_page.dart's confirm step - only ever reached straight
  // from the face-scan screen above, so it needs the same native treatment.
  // Returns whether punch-in was confirmed and, if so, the offset (minutes
  // back from "now") the user dragged the time slider to.
  static Future<({bool confirmed, int offsetMinutes})> confirmPunchCode({
    required String name,
    required int maxTimeMillis,
    required int maxOffsetMinutes,
  }) async {
    final result = await _channel.invokeMapMethod<String, dynamic>('confirmPunchCode', {
      'name': name,
      'maxTimeMillis': maxTimeMillis,
      'maxOffsetMinutes': maxOffsetMinutes,
    });
    return (
      confirmed: result?['confirmed'] as bool? ?? false,
      offsetMinutes: (result?['offsetMinutes'] as num?)?.toInt() ?? 0,
    );
  }

  static Future<void> showToast(String message) async {
    await _channel.invokeMethod('showToast', {'message': message});
  }
}
