import 'supabase_service.dart';

// Gates the attendance kiosk's "Set up / update my face" flow behind a PIN
// that's now centrally managed from the admin panel (Settings -> Kiosk),
// not set on-device. Previously this was a device-local secret
// (flutter_secure_storage) with "no recovery flow by design" - fine for one
// kiosk, not for a school that wants it reset/managed centrally. Both RPCs
// are anon-callable (see SUPABASE_KIOSK_SETTINGS.sql) but the PIN hash
// itself is never returned to any client, hashed or not.
class KioskPinService {
  KioskPinService._();

  static Future<bool> isConfigured() async {
    final settings = await SupabaseService.fetchKioskPublicSettings();
    return settings['pinIsSet'] as bool? ?? false;
  }

  static Future<bool> verifyPin(String pin) => SupabaseService.verifyKioskAdminPin(pin);
}
