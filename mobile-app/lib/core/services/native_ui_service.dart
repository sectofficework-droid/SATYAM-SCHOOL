import 'package:flutter/services.dart';

// Wraps a couple of native Android UI calls (see MainActivity.kt) - the
// attendance kiosk's face-punch confirm step needs to show *something*
// right after the on-device face-detection/TFLite pipeline runs, and
// asking Flutter to paint that reproducibly corrupted its own rendering
// on every test device/SDK version tried. A native AlertDialog/Toast is
// composited entirely outside Flutter's engine, sidestepping whatever
// Flutter-side state the ML pipeline was corrupting.
class NativeUiService {
  static const _channel = MethodChannel('com.satyamstars.attendance/native_ui');

  static Future<bool> confirmPunch(String name) async {
    final result = await _channel.invokeMethod<bool>('confirmPunch', {'name': name});
    return result ?? false;
  }

  static Future<void> showToast(String message) async {
    await _channel.invokeMethod('showToast', {'message': message});
  }
}
