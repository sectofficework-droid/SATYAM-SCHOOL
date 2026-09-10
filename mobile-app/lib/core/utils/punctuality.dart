// Shared formatting for the is_late/late_minutes pair every punch RPC now
// returns (see SUPABASE_KIOSK_SETTINGS.sql) - both null means "not the
// day's first shift, no judgement made", which every caller treats as
// simply showing nothing extra.
String? punctualityLabel(bool? isLate, int? lateMinutes) {
  if (isLate == null) return null;
  if (isLate) return 'Late by ${lateMinutes ?? 0} min';
  return 'On time';
}
