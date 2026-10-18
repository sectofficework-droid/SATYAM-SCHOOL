import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/supabase_service.dart';

// REQ-FEAT-018 (2026-10-18) - "teacher should be notified about student
// progress so teachers and principals can counsel before it comes to
// parents' attention; if a student is performing poor consistently it
// should be notified". Backend (fetch_my_class_risk_alerts) re-evaluates
// three signals - official-exam average, daily-log incompletes, attendance
// - and returns any open flag for a class this teacher teaches, one row per
// (student, signal). Always visible once loaded (same idiom as
// TodaysBirthdaysCard) - shows a calm "all good" state instead of
// disappearing, so the card has a predictable spot rather than a surprise
// pop-in.
class AtRiskStudentsCard extends StatefulWidget {
  const AtRiskStudentsCard({super.key});
  @override
  State<AtRiskStudentsCard> createState() => _AtRiskStudentsCardState();
}

class _AtRiskStudentsCardState extends State<AtRiskStudentsCard> {
  static const int _collapsedLimit = 3;

  List<Map<String, dynamic>> _alerts = const [];
  bool _loaded = false;
  bool _expanded = false;
  String? _error;
  final Set<String> _acking = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;
    if (employeeId == null || sessionToken == null) {
      setState(() => _loaded = true);
      return;
    }
    try {
      final data = await SupabaseService.fetchMyClassRiskAlerts(employeeId, sessionToken);
      if (!mounted) return;
      setState(() { _alerts = data; _loaded = true; });
    } catch (e) {
      // Supplementary card, not core flow - fails quiet (same reasoning as
      // the "not core flow" bits of this app's other optional widgets),
      // but keeps the message for anyone who inspects state while debugging.
      if (mounted) setState(() { _loaded = true; _error = e.toString(); });
    }
  }

  Future<void> _acknowledge(String flagId, void Function(void Function()) sheetSetState) async {
    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;
    if (employeeId == null || sessionToken == null) return;
    setState(() => _acking.add(flagId));
    sheetSetState(() {});
    try {
      await SupabaseService.acknowledgeRiskFlag(employeeId, sessionToken, flagId);
      if (!mounted) return;
      setState(() {
        final i = _alerts.indexWhere((a) => a['id'] == flagId);
        if (i != -1) _alerts[i]['status'] = 'Acknowledged';
        _acking.remove(flagId);
      });
      sheetSetState(() {});
    } catch (_) {
      if (mounted) setState(() => _acking.remove(flagId));
      sheetSetState(() {});
    }
  }

  String _signalLabel(String s) {
    switch (s) {
      case 'exam': return 'Exam performance';
      case 'daily_log': return 'Daily progress';
      case 'attendance': return 'Attendance';
      default: return s;
    }
  }

  // One student can trip more than one signal at once (e.g. low attendance
  // AND poor exam results AND incomplete daily log) - group the flat
  // per-(student, signal) rows the RPC returns so that case reads as ONE
  // entry with a combined detail view, not several duplicate-looking rows
  // for the same name (user-reported gap, 2026-10-18).
  List<List<Map<String, dynamic>>> get _groups {
    final byStudent = <String, List<Map<String, dynamic>>>{};
    final order = <String>[];
    for (final a in _alerts) {
      final id = a['student_id'] as String;
      if (!byStudent.containsKey(id)) order.add(id);
      (byStudent[id] ??= []).add(a);
    }
    return order.map((id) => byStudent[id]!).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _error != null) return const SizedBox.shrink();
    final groups = _groups;

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: groups.isEmpty ? AppColors.tealLight : AppColors.redLight,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: (groups.isEmpty ? AppColors.teal : AppColors.red).withValues(alpha: .25)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(Icons.flag_rounded, size: 18, color: groups.isEmpty ? AppColors.teal : AppColors.red),
            const SizedBox(width: 8),
            const Text('Needs Attention', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
            if (groups.isNotEmpty) ...[
              const Spacer(),
              Text('${groups.length}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.red)),
            ],
          ]),
          const SizedBox(height: 12),
          if (groups.isEmpty)
            Row(children: [
              Icon(Icons.check_circle_outline_rounded, color: AppColors.teal.withValues(alpha: .6), size: 18),
              const SizedBox(width: 8),
              const Text('No students flagged right now', style: TextStyle(fontSize: 12.5, color: AppColors.textLight)),
            ])
          else ...[
            // Capped by default - with a real flagged count in the dozens,
            // rendering every row made this card push the whole dashboard's
            // navigation grid off the first screen (user-reported 2026-10-18).
            ...(_expanded ? groups : groups.take(_collapsedLimit)).map(_groupRow),
            if (groups.length > _collapsedLimit)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: TextButton(
                  onPressed: () => setState(() => _expanded = !_expanded),
                  style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, alignment: Alignment.centerLeft),
                  child: Text(_expanded ? 'Show less' : 'Show all ${groups.length}',
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.navy)),
                ),
              ),
          ],
        ]),
      ),
    );
  }

  Widget _groupRow(List<Map<String, dynamic>> group) {
    final first = group.first;
    final name = '${first['first_name'] ?? ''} ${first['last_name'] ?? ''}'.trim();
    final allAcknowledged = group.every((a) => a['status'] == 'Acknowledged');

    if (group.length == 1) {
      return _singleSignalRow(name, first, allAcknowledged);
    }

    // Multiple signals for the same student - compact combined summary,
    // tap to see every signal's own detail + an individual Noted action.
    final labels = group.map((a) => _signalLabel(a['signal'] as String)).join(', ');
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () => _openDetail(name, group),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            margin: const EdgeInsets.only(top: 2),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: allAcknowledged ? AppColors.teal.withValues(alpha: .15) : AppColors.red,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text('${group.length}',
              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800,
                color: allAcknowledged ? AppColors.teal : Colors.white)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name.isEmpty ? '—' : name, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.text)),
              Text(labels, style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
            ]),
          ),
          const SizedBox(width: 8),
          Icon(allAcknowledged ? Icons.check_circle : Icons.chevron_right_rounded,
            size: 18, color: allAcknowledged ? AppColors.teal : AppColors.textLight),
        ]),
      ),
    );
  }

  Widget _singleSignalRow(String name, Map<String, dynamic> a, bool acknowledged) {
    final id = a['id'] as String;
    final busy = _acking.contains(id);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name.isEmpty ? '—' : name, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.text)),
            Text('${_signalLabel(a['signal'] as String)} · ${a['detail'] ?? ''}',
              style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
          ]),
        ),
        const SizedBox(width: 8),
        if (acknowledged)
          const Padding(padding: EdgeInsets.only(top: 2), child: Icon(Icons.check_circle, size: 18, color: AppColors.teal))
        else
          SizedBox(
            height: 28,
            child: busy
              ? const Padding(padding: EdgeInsets.all(4), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)))
              : TextButton(
                  onPressed: () => _acknowledge(id, setState),
                  style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: Size.zero),
                  child: const Text('Noted', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.navy)),
                ),
          ),
      ]),
    );
  }

  void _openDetail(String name, List<Map<String, dynamic>> group) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, sheetSetState) => Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: 20 + MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.flag_rounded, color: AppColors.red, size: 18),
              const SizedBox(width: 8),
              Expanded(child: Text(name.isEmpty ? 'Student' : name,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text))),
            ]),
            const SizedBox(height: 4),
            Text('${group.length} signals need attention',
              style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
            const SizedBox(height: 16),
            ...group.map((a) {
              final id = a['id'] as String;
              final acknowledged = a['status'] == 'Acknowledged';
              final busy = _acking.contains(id);
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_signalLabel(a['signal'] as String),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.text)),
                      const SizedBox(height: 2),
                      Text('${a['detail'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                    ]),
                  ),
                  const SizedBox(width: 8),
                  if (acknowledged)
                    const Padding(padding: EdgeInsets.only(top: 2), child: Icon(Icons.check_circle, size: 20, color: AppColors.teal))
                  else
                    SizedBox(
                      height: 30,
                      child: busy
                        ? const Padding(padding: EdgeInsets.all(5), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)))
                        : TextButton(
                            onPressed: () => _acknowledge(id, sheetSetState),
                            style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10), minimumSize: Size.zero),
                            child: const Text('Noted', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy)),
                          ),
                    ),
                ]),
              );
            }),
          ]),
        ),
      ),
    );
  }
}
