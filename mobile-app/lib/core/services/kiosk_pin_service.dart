import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// Gates the attendance kiosk's "Set up / update my face" flow behind a PIN
// only the admin operating this device knows - the kiosk itself has no
// concept of an admin account (mobile auth is per-staff/per-student RPCs,
// see auth_service.dart), so this is a device-local secret rather than
// anything checked against Supabase. First use sets the PIN; there's no
// recovery flow by design - if it's forgotten, reinstalling the kiosk app
// clears secure storage and lets it be set again.
class KioskPinService {
  KioskPinService._();
  static const _storage = FlutterSecureStorage();
  static const _key = 'kiosk_admin_pin';

  static Future<bool> hasPin() async => (await _storage.read(key: _key)) != null;

  static Future<void> setPin(String pin) => _storage.write(key: _key, value: pin);

  static Future<bool> verifyPin(String pin) async => await _storage.read(key: _key) == pin;
}
