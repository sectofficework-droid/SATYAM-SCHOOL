import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:io';
import '../app_config.dart';

// Centralized diagnostic logger (AGENTS.md §L). Structured JSON-line
// entries, auto-redacted, kept in a capped in-memory ring buffer AND
// persisted to a local file so they survive app restart/crash - unlike
// ScanTrace (kDebugMode-only, one screen's pipeline), this runs in every
// build and covers the whole app. error()/fatal() also auto-submit to
// Supabase's diagnostic_reports table (REQ-HYG-006) - no "Report a
// Problem" tap required; that dialog (report_problem_dialog.dart) is for a
// tester to add their own description on top of what's already captured
// automatically, not the only way a report reaches the table.
//
// Auto-submission is OFF by default and gated by diagnostic_settings.enabled
// (a single admin-toggled switch, flipped from the admin panel's
// /diagnostics page) - this logging exists for development/debugging, not
// to passively collect what users do, per the project owner's explicit
// instruction. Local buffer/file capture always happens regardless (stays
// on-device, needed for "Report a Problem" to have context) - only the
// Supabase submission is gated. Also throttled (per unique message, per
// session) so a single repeating bug can't flood the table even when on.
class DiagnosticLogger {
  DiagnosticLogger._();
  static final DiagnosticLogger instance = DiagnosticLogger._();

  static const _maxBufferEntries = 200;
  static const _maxFileBytes = 1024 * 1024; // 1MB, then rotate
  static const _autoSubmitCooldown = Duration(minutes: 5);
  static const _autoSubmitSessionCap = 20;
  static final _sensitiveKeyPattern =
      RegExp(r'password|token|secret|apikey|api_key|authorization', caseSensitive: false);

  final List<Map<String, dynamic>> _buffer = <Map<String, dynamic>>[];
  final Map<String, DateTime> _recentAutoSubmits = <String, DateTime>{};
  int _sessionSubmitCount = 0;
  bool _enabled = false; // default OFF until init() confirms otherwise
  String? _sessionId;
  String? _versionInfo;
  File? _logFile;
  bool _fileReady = false;

  String get sessionId {
    _sessionId ??= 'S-${_randomToken()}';
    return _sessionId!;
  }

  /// Call once at app startup (see app_bootstrap.dart) so the log file is
  /// ready before the first error can occur, and version/build info is
  /// captured on every entry from then on.
  Future<void> init() async {
    try {
      final info = await PackageInfo.fromPlatform();
      _versionInfo = '${info.version}+${info.buildNumber}';
    } catch (_) {
      _versionInfo = 'unknown';
    }
    try {
      final dir = await getApplicationDocumentsDirectory();
      _logFile = File('${dir.path}/diagnostic_log.jsonl');
      _fileReady = true;
    } catch (_) {
      _fileReady = false; // in-memory buffer still works even if this fails
    }
    debug('DiagnosticLogger initialized', {'version': _versionInfo});
  }

  /// Call once Supabase.initialize() has completed (see app_bootstrap.dart)
  /// - separate from init() because this needs the Supabase client and
  /// init() deliberately runs before Supabase.initialize() so the error
  /// handlers it sets up are live even if Supabase init itself throws.
  Future<void> refreshEnabledFlag() async {
    try {
      final res = await Supabase.instance.client
          .from('diagnostic_settings')
          .select('enabled')
          .eq('id', 1)
          .maybeSingle();
      _enabled = res?['enabled'] == true;
    } catch (_) {
      // No connectivity, or the migration hasn't been applied yet - leave
      // _enabled at its default (false/OFF).
    }
  }

  void debug(String message, [Map<String, dynamic>? context]) => _write('debug', message, context);
  void info(String message, [Map<String, dynamic>? context]) => _write('info', message, context);
  void warn(String message, [Map<String, dynamic>? context]) => _write('warn', message, context);

  /// Logs at error level, auto-submits a diagnostic report, and returns a
  /// short diagnosticId to surface to the user.
  String error(String message, [Map<String, dynamic>? context]) {
    final diagnosticId = 'ERR-${_randomToken()}';
    final entry = _write('error', message, {...?context, 'diagnosticId': diagnosticId});
    _submitReport(entry);
    return diagnosticId;
  }

  /// Same as error(), for failures severe enough to block the current flow entirely.
  String fatal(String message, [Map<String, dynamic>? context]) {
    final diagnosticId = 'ERR-${_randomToken()}';
    final entry = _write('fatal', message, {...?context, 'diagnosticId': diagnosticId});
    _submitReport(entry);
    return diagnosticId;
  }

  String get _appName {
    try {
      final role = AppConfig.lockedRole.name;
      return role == 'kiosk' ? 'attendance' : role; // 'teacher' | 'student' | 'attendance'
    } catch (_) {
      return 'teacher'; // AppConfig.lockedRole not set yet (e.g. very early startup error)
    }
  }

  /// Fire-and-forget - never let diagnostics reporting break the app it's
  /// trying to diagnose. Auto-submission needs no signed-in user; user_*
  /// fields stay null unless a caller passes them via context.
  void _submitReport(Map<String, dynamic> entry) {
    if (!_enabled) return;

    final message = entry['message'] as String? ?? '';
    final now = DateTime.now();
    final last = _recentAutoSubmits[message];
    if (last != null && now.difference(last) < _autoSubmitCooldown) return;
    if (_sessionSubmitCount >= _autoSubmitSessionCap) return;
    _recentAutoSubmits[message] = now;
    _sessionSubmitCount++;

    try {
      Supabase.instance.client.from('diagnostic_reports').insert({
        'app': _appName,
        'platform': defaultTargetPlatform.name,
        'version': _versionInfo,
        'session_id': sessionId,
        'log_entries': [entry],
        'status': 'New',
      }).then((_) {}, onError: (e) {
        if (kDebugMode) debugPrint('[DIAG] failed to auto-submit report: $e');
      });
    } catch (e) {
      // e.g. Supabase.initialize() hasn't completed yet (a very early
      // startup error) - the entry is still safe in the buffer/log file.
      if (kDebugMode) debugPrint('[DIAG] could not auto-submit report: $e');
    }
  }

  List<Map<String, dynamic>> get buffer => List.unmodifiable(_buffer);

  /// Reads the persisted log file (survives restart), most recent last.
  Future<List<String>> readPersistedLog() async {
    if (!_fileReady || _logFile == null) return const [];
    try {
      if (!await _logFile!.exists()) return const [];
      final lines = await _logFile!.readAsLines();
      return lines.where((l) => l.trim().isNotEmpty).toList();
    } catch (_) {
      return const [];
    }
  }

  Map<String, dynamic> _write(String level, String message, Map<String, dynamic>? context) {
    final entry = <String, dynamic>{
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      'level': level,
      'sessionId': sessionId,
      'version': _versionInfo,
      'message': message,
      if (context != null) 'context': _redact(context),
    };

    _buffer.add(entry);
    if (_buffer.length > _maxBufferEntries) _buffer.removeAt(0);

    final line = jsonEncode(entry);
    if (kDebugMode) {
      debugPrint('[DIAG:$level] $line');
    }
    _appendToFile(line);
    return entry;
  }

  Future<void> _appendToFile(String line) async {
    if (!_fileReady || _logFile == null) return;
    try {
      final file = _logFile!;
      await file.writeAsString('$line\n', mode: FileMode.append, flush: false);
      final size = await file.length();
      if (size > _maxFileBytes) {
        // Rotate: keep only the newest half of lines rather than growing forever.
        final lines = await file.readAsLines();
        final kept = lines.length > 500 ? lines.sublist(lines.length - 500) : lines;
        await file.writeAsString('${kept.join('\n')}\n', mode: FileMode.write, flush: false);
      }
    } catch (_) {
      // Logging must never crash the app it's trying to diagnose.
    }
  }

  dynamic _redact(dynamic value) {
    if (value == null) return null;
    if (value is Map) {
      final out = <String, dynamic>{};
      value.forEach((k, v) {
        out[k.toString()] = _sensitiveKeyPattern.hasMatch(k.toString()) ? '[REDACTED]' : _redact(v);
      });
      return out;
    }
    if (value is Iterable) return value.map(_redact).toList();
    return value.toString();
  }

  String _randomToken() {
    final rnd = Random();
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return List.generate(6, (_) => chars[rnd.nextInt(chars.length)]).join();
  }
}
