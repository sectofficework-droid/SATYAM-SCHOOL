import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Mobile port of the web admin panel's Settings -> Kiosk tab
// (admin-panel/src/app/(dashboard)/settings/KioskSettingsTab.js) - punch
// timing, special-day overrides, kiosk admin PIN. Senior Admin/Management
// only (staff_admin_kiosk_* RPCs re-check the tier server-side regardless).
class AdminKioskSettingsPage extends StatefulWidget {
  const AdminKioskSettingsPage({super.key});
  @override
  State<AdminKioskSettingsPage> createState() => _AdminKioskSettingsPageState();
}

class _AdminKioskSettingsPageState extends State<AdminKioskSettingsPage> {
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  bool _loading = true;
  String? _error;

  TimeOfDay? _startTime;
  int _grace = 10;
  bool _cutoffEnabled = false;
  TimeOfDay? _cutoffTime;
  TimeOfDay? _shiftEndTime;
  bool _pinIsSet = false;
  bool _saving = false;

  List<Map<String, dynamic>> _specialDays = [];
  bool _specialDaysLoading = true;

  @override
  void initState() { super.initState(); _load(); _loadSpecialDays(); }

  TimeOfDay? _parseTime(String? s) {
    if (s == null || s.isEmpty) return null;
    final parts = s.split(':');
    if (parts.length < 2) return null;
    return TimeOfDay(hour: int.tryParse(parts[0]) ?? 0, minute: int.tryParse(parts[1]) ?? 0);
  }

  String? _fmtTime(TimeOfDay? t) => t == null ? null : '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}:00';

  String _label(TimeOfDay? t) => t == null ? 'Not set' : t.format(context);

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final s = await StaffAdminService.kioskGetSettings(_employeeId);
      if (mounted) {
        setState(() {
          _startTime = _parseTime(s['o_expected_start_time'] as String?) ?? const TimeOfDay(hour: 9, minute: 0);
          _grace = (s['o_late_grace_minutes'] as num?)?.toInt() ?? 10;
          final cutoff = _parseTime(s['o_absent_cutoff_time'] as String?);
          _cutoffEnabled = cutoff != null;
          _cutoffTime = cutoff ?? const TimeOfDay(hour: 11, minute: 0);
          _shiftEndTime = _parseTime(s['o_shift_end_time'] as String?) ?? const TimeOfDay(hour: 16, minute: 0);
          _pinIsSet = s['o_pin_is_set'] as bool? ?? false;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load kiosk settings.'; _loading = false; });
    }
  }

  Future<void> _loadSpecialDays() async {
    setState(() => _specialDaysLoading = true);
    try {
      final list = await StaffAdminService.kioskListSpecialDays(_employeeId);
      if (mounted) setState(() { _specialDays = list; _specialDaysLoading = false; });
    } catch (e) {
      if (mounted) setState(() => _specialDaysLoading = false);
    }
  }

  Future<void> _pickTime(TimeOfDay? current, ValueChanged<TimeOfDay> onPicked) async {
    final picked = await showTimePicker(context: context, initialTime: current ?? TimeOfDay.now());
    if (picked != null) onPicked(picked);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await StaffAdminService.kioskSaveSettings(_employeeId,
        expectedStartTime: _fmtTime(_startTime), lateGraceMinutes: _grace,
        absentCutoffTime: _cutoffEnabled ? _fmtTime(_cutoffTime) : null,
        shiftEndTime: _fmtTime(_shiftEndTime));
      if (mounted) showAdminSnack(context, 'Kiosk timing saved');
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to save.', isError: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _setPin() async {
    final controller = TextEditingController();
    final confirmController = TextEditingController();
    final pin = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(_pinIsSet ? 'Reset Kiosk PIN' : 'Set Kiosk PIN', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: controller, obscureText: true, keyboardType: TextInputType.number, maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(labelText: 'New PIN (4-6 digits)', border: OutlineInputBorder())),
          TextField(controller: confirmController, obscureText: true, keyboardType: TextInputType.number, maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(labelText: 'Confirm PIN', border: OutlineInputBorder())),
          const SizedBox(height: 8),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () {
              if (controller.text.length < 4) { showAdminSnack(ctx, 'PIN must be at least 4 digits.', isError: true); return; }
              if (controller.text != confirmController.text) { showAdminSnack(ctx, "PINs don't match.", isError: true); return; }
              Navigator.pop(ctx, controller.text);
            },
            child: const Text('Save PIN'),
          ),
        ]),
      ),
    );
    if (pin == null) return;
    try {
      await StaffAdminService.kioskSetPin(_employeeId, pin);
      if (mounted) { setState(() => _pinIsSet = true); showAdminSnack(context, 'PIN saved'); }
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to set PIN.', isError: true);
    }
  }

  Future<void> _addSpecialDay() async {
    DateTime? date;
    TimeOfDay? startTime;
    TimeOfDay? cutoffTime;
    TimeOfDay? shiftEndTime;
    int? grace;
    final reasonCtrl = TextEditingController();

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Special Occasion Timing', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 4),
          const Text('Applies only on this date. Leave a field blank to keep the normal default.', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: () async {
              final picked = await showDatePicker(context: ctx, initialDate: DateTime.now(),
                firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
              if (picked != null) setSheet(() => date = picked);
            },
            child: Text(date == null ? 'Pick a date' : '${date!.year}-${date!.month.toString().padLeft(2, '0')}-${date!.day.toString().padLeft(2, '0')}'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () async { final p = await showTimePicker(context: ctx, initialTime: startTime ?? TimeOfDay.now()); if (p != null) setSheet(() => startTime = p); },
            child: Text(startTime == null ? 'Report by (start time)' : 'Start: ${startTime!.format(ctx)}')),
          const SizedBox(height: 10),
          TextField(keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Late grace (minutes, optional)', border: OutlineInputBorder()),
            onChanged: (v) => grace = int.tryParse(v)),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () async { final p = await showTimePicker(context: ctx, initialTime: cutoffTime ?? TimeOfDay.now()); if (p != null) setSheet(() => cutoffTime = p); },
            child: Text(cutoffTime == null ? 'Absent cutoff (optional)' : 'Cutoff: ${cutoffTime!.format(ctx)}')),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () async { final p = await showTimePicker(context: ctx, initialTime: shiftEndTime ?? TimeOfDay.now()); if (p != null) setSheet(() => shiftEndTime = p); },
            child: Text(shiftEndTime == null ? 'Shift end (optional)' : 'Shift end: ${shiftEndTime!.format(ctx)}')),
          const SizedBox(height: 10),
          TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: 'Reason (optional)', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () {
              if (date == null) { showAdminSnack(ctx, 'Pick a date.', isError: true); return; }
              if (startTime == null && cutoffTime == null && shiftEndTime == null && grace == null) {
                showAdminSnack(ctx, 'Set at least one timing field to override.', isError: true); return;
              }
              Navigator.pop(ctx, true);
            },
            child: const Text('Add Special Day'),
          ),
        ])),
      )),
    );

    if (saved != true || date == null) return;
    final dateStr = '${date!.year}-${date!.month.toString().padLeft(2, '0')}-${date!.day.toString().padLeft(2, '0')}';
    try {
      await StaffAdminService.kioskSaveSpecialDay(_employeeId,
        date: dateStr, expectedStartTime: _fmtTime(startTime), lateGraceMinutes: grace,
        absentCutoffTime: _fmtTime(cutoffTime), shiftEndTime: _fmtTime(shiftEndTime),
        reason: reasonCtrl.text.trim().isEmpty ? null : reasonCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Special day saved');
      _loadSpecialDays();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to save special day.', isError: true);
    }
  }

  Future<void> _deleteSpecialDay(String date) async {
    final ok = await confirmAdminAction(context, title: 'Remove special day',
      message: 'Remove the special timing for $date? Normal timing resumes for that date.', confirmLabel: 'Remove');
    if (!ok) return;
    try {
      await StaffAdminService.kioskDeleteSpecialDay(_employeeId, date);
      if (mounted) setState(() => _specialDays.removeWhere((d) => d['o_date'] == date));
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to remove.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Kiosk Settings'),
      body: _loading
        ? const AdminLoading()
        : _error != null
          ? AdminErrorState(message: _error!, onRetry: _load)
          : RefreshIndicator(color: AppColors.navy, onRefresh: () async { await _load(); await _loadSpecialDays(); },
              child: ListView(padding: const EdgeInsets.all(16), children: [
                _sectionTitle('Punch Timing', Icons.access_time_rounded),
                AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _timeRow('Expected start time', _startTime, (t) => setState(() => _startTime = t)),
                  const SizedBox(height: 10),
                  Row(children: [
                    const Expanded(child: Text('Late grace (minutes)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                    IconButton(onPressed: () => setState(() => _grace = (_grace - 1).clamp(0, 999)), icon: const Icon(Icons.remove_circle_outline)),
                    Text('$_grace', style: const TextStyle(fontWeight: FontWeight.w700)),
                    IconButton(onPressed: () => setState(() => _grace = _grace + 1), icon: const Icon(Icons.add_circle_outline)),
                  ]),
                  const Divider(height: 24),
                  _timeRow('Shift end time (auto check-out)', _shiftEndTime, (t) => setState(() => _shiftEndTime = t)),
                  const Divider(height: 24),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Auto-mark Absent for staff who never punch in', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    value: _cutoffEnabled,
                    activeThumbColor: AppColors.navy,
                    onChanged: (v) => setState(() => _cutoffEnabled = v),
                  ),
                  if (_cutoffEnabled) _timeRow('Cutoff time', _cutoffTime, (t) => setState(() => _cutoffTime = t)),
                  const SizedBox(height: 14),
                  SizedBox(width: double.infinity, child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, padding: const EdgeInsets.symmetric(vertical: 14)),
                    onPressed: _saving ? null : _save,
                    child: _saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Save'),
                  )),
                ])),
                const SizedBox(height: 22),

                _sectionTitle('Special Occasion Timing', Icons.event_rounded),
                AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('A one-off report time for a specific future date.', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
                  const SizedBox(height: 12),
                  SizedBox(width: double.infinity, child: OutlinedButton.icon(
                    onPressed: _addSpecialDay, icon: const Icon(Icons.add_rounded), label: const Text('Add Special Day'))),
                  if (!_specialDaysLoading && _specialDays.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    ..._specialDays.map((d) {
                      final date = d['o_date'] as String;
                      final parts = <String>[];
                      final st = _parseTime(d['o_expected_start_time'] as String?);
                      if (st != null) parts.add('report by ${st.format(context)}');
                      if (d['o_late_grace_minutes'] != null) parts.add('${d['o_late_grace_minutes']} min grace');
                      final co = _parseTime(d['o_absent_cutoff_time'] as String?);
                      if (co != null) parts.add('cutoff ${co.format(context)}');
                      final se = _parseTime(d['o_shift_end_time'] as String?);
                      if (se != null) parts.add('shift end ${se.format(context)}');
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: AppColors.bg, borderRadius: BorderRadius.circular(10)),
                          child: Row(children: [
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(date, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              if (parts.isNotEmpty) Text(parts.join(' · '), style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                              if ((d['o_reason'] ?? '').toString().isNotEmpty)
                                Text(d['o_reason'] as String, style: const TextStyle(fontSize: 11, color: AppColors.textLight, fontStyle: FontStyle.italic)),
                            ])),
                            IconButton(icon: const Icon(Icons.delete_outline_rounded, color: AppColors.red, size: 20), onPressed: () => _deleteSpecialDay(date)),
                          ]),
                        ),
                      );
                    }),
                  ],
                ])),
                const SizedBox(height: 22),

                _sectionTitle('Kiosk Admin PIN', Icons.pin_rounded),
                AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(_pinIsSet ? Icons.check_circle_rounded : Icons.warning_amber_rounded, color: _pinIsSet ? AppColors.green : AppColors.amber, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(
                      _pinIsSet ? 'PIN is configured' : "No PIN set yet - the kiosk's enroll screen is locked",
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _pinIsSet ? AppColors.green : AppColors.amber))),
                  ]),
                  const SizedBox(height: 12),
                  SizedBox(width: double.infinity, child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, padding: const EdgeInsets.symmetric(vertical: 14)),
                    onPressed: _setPin, icon: const Icon(Icons.key_rounded), label: Text(_pinIsSet ? 'Reset PIN' : 'Set PIN'))),
                ])),
              ]),
            ),
    );
  }

  Widget _sectionTitle(String title, IconData icon) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [
      Icon(icon, size: 18, color: AppColors.navy),
      const SizedBox(width: 8),
      Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.text)),
    ]),
  );

  Widget _timeRow(String label, TimeOfDay? value, ValueChanged<TimeOfDay> onPicked) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(children: [
      Expanded(child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
      OutlinedButton(onPressed: () => _pickTime(value, onPicked), child: Text(_label(value))),
    ]),
  );
}
