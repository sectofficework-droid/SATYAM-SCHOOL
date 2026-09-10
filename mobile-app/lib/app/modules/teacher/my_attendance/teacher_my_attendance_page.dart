import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/attendance_view.dart';
import '../../../routes/app_routes.dart';

// Day-by-day attendance (Present/Absent/Leave), marked by admin or
// auto-marked 'L' when a leave request is approved (see "My Leave") - plus
// one self-service action: checkout. The attendance kiosk only ever
// records check-in (a shared device isn't the right place to trust a
// checkout time - anyone could walk up and tap it for someone else), so
// checkout happens here instead, behind the teacher's own login.
class TeacherMyAttendancePage extends StatefulWidget {
  const TeacherMyAttendancePage({super.key});
  @override
  State<TeacherMyAttendancePage> createState() => _TeacherMyAttendancePageState();
}

class _TeacherMyAttendancePageState extends State<TeacherMyAttendancePage> {
  List<Map<String, dynamic>> _records = [];
  List<Map<String, dynamic>> _todayShifts = [];
  bool _loading = true;
  bool _checkingOut = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile    = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final records = employeeId != null
        ? await SupabaseService.fetchEmployeeAttendance(employeeId)
        : <Map<String, dynamic>>[];
    final shifts = employeeId != null
        ? await SupabaseService.fetchEmployeeShiftsForDate(employeeId, today)
        : <Map<String, dynamic>>[];
    if (mounted) setState(() { _records = records; _todayShifts = shifts; _loading = false; });
  }

  Future<void> _checkOut() async {
    final profile    = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    if (employeeId == null || _checkingOut) return;
    setState(() => _checkingOut = true);
    try {
      final result = await SupabaseService.recordCheckOut(employeeId);
      if (result['status'] == 'no_open_shift' && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No open shift to check out of.')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not check out. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _checkingOut = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
      title: const Text('My Attendance'),
    ),
    body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
        : Column(children: [
            _buildTodayPunchBanner(),
            _buildScanQrButton(),
            Expanded(child: AttendanceView(records: _records, showLeave: true)),
          ]),
  );

  // Third check-in method alongside the kiosk's face-scan and admin override
  // code: scan the QR the kiosk is displaying (see qr_punch_page.dart /
  // scan_attendance_qr_page.dart). Only meaningful when there's no open
  // shift already - same "already_in" protection recordFacePunch enforces
  // server-side, this is just the UI not offering a redundant action.
  bool get _hasOpenShift => _todayShifts.any((s) => s['check_out_at'] == null);

  Widget _buildScanQrButton() {
    if (_hasOpenShift) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () async {
            final punched = await Get.toNamed(Routes.teacherQrScan);
            if (punched == true) _load();
          },
          icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
          label: const Text('Scan Attendance QR', style: TextStyle(fontWeight: FontWeight.w700)),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.indigo,
            side: const BorderSide(color: AppColors.indigo),
            padding: const EdgeInsets.symmetric(vertical: 12),
          ),
        ),
      ),
    );
  }

  // Every shift of the day, oldest first (one row of check-in/check-out
  // per shift) instead of a single pair - staff can punch in, check out,
  // and punch in again the same day, and all of those shifts should show,
  // not just the latest. The checkout button only ever appears once, on
  // whichever shift (if any) has no check_out_at yet - there's at most one
  // open shift at a time, enforced server-side.
  Widget _buildTodayPunchBanner() {
    if (_todayShifts.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(color: AppColors.indigoLight, borderRadius: BorderRadius.circular(16)),
      child: Column(children: [
        for (final shift in _todayShifts) _buildShiftRow(shift),
      ]),
    );
  }

  Widget _buildShiftRow(Map<String, dynamic> shift) {
    // check_in_at/check_out_at come back UTC-tagged from Postgres -
    // .toLocal() so the tiles below show the device's actual wall-clock
    // time instead of the raw UTC hour/minute.
    final checkIn  = DateTime.tryParse((shift['check_in_at']  ?? '').toString())?.toLocal();
    final checkOut = DateTime.tryParse((shift['check_out_at'] ?? '').toString())?.toLocal();
    final isOpen = checkOut == null;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Expanded(child: _punchTimeTile('Check In', checkIn)),
        Container(width: 1, height: 32, color: AppColors.indigo.withValues(alpha: .2)),
        Expanded(
          child: isOpen
              ? Center(
                  child: _checkingOut
                      ? const SizedBox(width: 20, height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.indigo))
                      : TextButton(
                          onPressed: _checkOut,
                          child: const Text('Check Out', style: TextStyle(
                            color: AppColors.indigo, fontWeight: FontWeight.w800, fontSize: 13)),
                        ),
                )
              : _punchTimeTile('Check Out', checkOut),
        ),
      ]),
    );
  }

  Widget _punchTimeTile(String label, DateTime? time) => Column(children: [
    Text(label, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.indigo)),
    const SizedBox(height: 4),
    Text(time == null ? '—' : DateFormat('h:mm a').format(time),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.text)),
  ]);
}
