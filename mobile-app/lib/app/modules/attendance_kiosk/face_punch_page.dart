import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/face_recognition_service.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/services/native_ui_service.dart';
import '../../../core/utils/punctuality.dart';
import '../../../core/utils/scan_trace.dart';
import '../../routes/app_routes.dart';

enum _Stage { camera, processing, error }

// The kiosk's core flow: capture one photo, find the best-matching enrolled
// staff member by face (1-to-many - nobody is pre-identified going in),
// then confirm via a NATIVE Android dialog (NativeUiService.confirmPunch,
// see MainActivity.kt), not a Flutter-rendered screen. Every Flutter-side
// attempt at that confirm UI - Column, Row, Wrap, Stack/Positioned,
// RepaintBoundary, even a genuinely separate route/page - reproducibly
// painted corrupted, multiple stages' text stacked on the same spot,
// across two Flutter SDK versions and two different devices. The one
// constant: it only ever happened right after this screen's on-device
// face-detection/TFLite pipeline ran, and teacher/student (which never
// touch that pipeline) never show it - pointing at something below
// Flutter's own framework, not fixable by changing what Flutter paints.
// A native AlertDialog is composited entirely outside Flutter's engine.
//
// No shutter button: a self-rescheduling timer polls roughly every 200ms
// while idle on the camera stage - "roughly" because the next poll is only
// armed 200ms AFTER the previous one fully finishes (see
// _scheduleNextPoll), not on a fixed period. It used to be a plain
// Timer.periodic, which kept firing into a busy poll every second even
// while one attempt was still running; overlapping fires didn't do
// anything (a re-entrancy guard just skipped them) but they were also
// evidence the pipeline was still chewing on the previous frame well past
// its budget, which read to a bystander as the camera "restarting" over
// and over. The very first poll of a fresh camera session fires
// immediately, not after one interval's wait - someone already framed and
// ready the instant the screen opens shouldn't sit through a dead pause
// before the first attempt even starts (see _initCamera's call into this).
//
// Each poll analyzes the MOST RECENT frame from a continuously running
// CameraController.startImageStream() (see _latestFrame), not a fresh
// CameraController.takePicture() call. That switch (SESSION-2026-09-13-5)
// replaced the original still-photo design after takePicture() itself was
// measured taking 4-7 seconds per call on this app's camera - confirmed on
// both BlueStacks and the real kiosk tablet, and unaffected by flash mode,
// 3A focus/exposure locking, or swapping the native Android camera engine
// (all tried and measured first; see that session for the full trail). A
// live preview frame carries none of that "capture a high-quality photo"
// round-trip cost - it's already flowing at the camera's native frame
// rate; reading the latest one is instant. See FaceRecognitionService's
// header comment and nv21ToImage for the raw-frame conversion this needed.
//
// Polls that don't find an open-eyed face are silent (just keep trying);
// the moment one does, that's the trigger into _Stage.processing
// ("Verifying...") and, on a match, the native confirm dialog - the match
// is never recorded silently. A "Face not recognized" error offers a way
// out via an admin-issued numeric code (enter_punch_code_page.dart)
// instead of just leaving someone stuck.
//
// Scanning doesn't start the instant the screen opens: the camera
// initializes and shows a live preview immediately, but polling only
// begins once the person taps "Start Scan" on a centered popup prompt
// over that preview (see _ready/_startScanning/_buildReadyPopup) - giving
// them a moment to actually get in frame instead of the earliest poll
// capturing them still mid-walk-up/turning their head, which only hurts
// match/liveness quality.
//
// A single failed attempt (liveness or 1-to-many match came back
// negative) doesn't drop straight to the hard error screen: up to 2 are
// silently absorbed with a brief on-screen warning while scanning keeps
// running (see _handleScanFailure/_failedAttempts) - momentary bad
// angles/lighting are common and shouldn't force someone to explicitly
// retry for something the next poll might just clear on its own. Only
// the 3rd consecutive failure escalates to the full error screen (message
// + auto-return home), matching how camera/system-level errors already
// behaved.
//
// The 1-to-many match itself (SupabaseService.matchFaceEmbedding, see
// SUPABASE_FACE_MATCH_RPC.sql) runs server-side: this sends just the one
// live 192-float embedding and Postgres compares it against every enrolled
// person's references itself, returning only a name + two similarity
// scores. An earlier version of this screen instead downloaded EVERY
// enrolled person's full reference set to the phone on every attempt
// (fetchAllFaceEmbeddings) and compared client-side - measured taking
// 6-11+ seconds on real kiosk network conditions, sometimes timing out
// outright (SESSION-2026-09-15), and only getting worse as more staff
// enroll. No more reason to prefetch anything in parallel with camera
// setup either - there's no bulk download left to hide the latency of.
class FacePunchPage extends StatefulWidget {
  const FacePunchPage({super.key});
  @override
  State<FacePunchPage> createState() => _FacePunchPageState();
}

class _FacePunchPageState extends State<FacePunchPage> with WidgetsBindingObserver {
  static const _matchMargin = 0.05;
  // Was 1000ms; tightened once the stream-based poll itself was measured
  // cheap (22-400ms, SESSION-2026-09-13-6) - the old value meant someone
  // already framed and ready could wait up to a full second for the next
  // poll to even look. Safe to shorten because _scheduleNextPoll only ever
  // arms the NEXT poll after the previous one fully finishes - a smaller
  // number here can't cause overlapping polls, just a shorter idle gap
  // between them.
  static const _pollInterval = Duration(milliseconds: 200);
  static const ringSize = 320.0;
  static const frameSize = 300.0;

  CameraController? _controller;
  Timer? _pollTimer;
  Timer? _returnTimer;
  _Stage _stage = _Stage.camera;
  String _message = 'Position your face in the circle';
  bool _busy = false;
  bool _offerCode = false;

  // Gates the poll loop behind an explicit "Start Scan" tap - see the
  // class-level comment. Set true once, on the first tap; a later retry
  // ("Try Again" from the error screen) does NOT reset it back to false,
  // since that tap already IS the person's "I'm ready" signal.
  bool _ready = false;

  // Consecutive scan attempts that reached a conclusive (not "no face
  // yet"/blink/blur/exposure - those retry silently forever) failure -
  // liveness, unreadable embedding, or no match. See
  // _handleScanFailure/the class-level comment. Reset whenever a fresh
  // scanning session starts (_startScanning, _reinitCamera).
  int _failedAttempts = 0;
  static const _maxAttempts = 3;

  // Updated on every frame the live stream delivers (many times a second);
  // read by _autoCapture at most once per _pollInterval. This - not
  // takePicture() - is now where each poll's frame comes from; see the
  // class-level comment.
  CameraImage? _latestFrame;

  // Computed once per camera generation in _initCamera (the kiosk is bolted
  // down in a fixed portrait orientation - confirmed by every screenshot
  // taken while building this - so unlike a handheld app this never needs
  // to change with device rotation). _rotationDegrees is handed to BOTH ML
  // Kit (via _mlkitRotation, so Face.boundingBox lands in the same
  // coordinate space) and FaceRecognitionService.nv21ToImage (so our own
  // exposure/blur/liveness/embedding crop matches that box) - they must
  // stay in agreement or a detected face's box will land on the wrong
  // pixels of our own converted image.
  int _rotationDegrees = 0;
  InputImageRotation _mlkitRotation = InputImageRotation.rotation0deg;
  bool _mirrorFrame = false;

  // Diagnostics only (see scan_trace.dart). _tick counts poll fires and
  // _skipped counts fires that returned without doing any work - a long run
  // of skips behind a frozen preview means the pipeline is still chewing on
  // the previous frame, which is a completely different failure from
  // takePicture() throwing on every poll.
  int _tick = 0;
  int _skipped = 0;
  int _cameraGeneration = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ScanTrace.instance
      ..clear()
      ..log('PAGE', 'FacePunchPage opened')
      ..startStallWatch();
    FaceRecognitionService.instance.preload();
    _initCamera();
  }

  // Purely observational for now: Android tears the camera session down when
  // the kiosk app is backgrounded, and a controller that survives into the
  // foreground still pointing at that dead session is one of the documented
  // ways a preview ends up frozen. This records whether that is what is
  // happening here rather than silently papering over it.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    ScanTrace.instance.log('LIFECYCLE',
        '$state controller=${_controller == null ? 'null' : 'gen$_cameraGeneration'} '
        'initialized=${_controller?.value.isInitialized}');
  }

  Future<void> _initCamera() async {
    // Defensive: makes this function safe to call again on an already-live
    // widget (see _reinitCamera) without ending up with two poll chains
    // both scheduling _autoCapture.
    _pollTimer?.cancel();
    _cameraGeneration++;
    final gen = _cameraGeneration;
    final trace = ScanTrace.instance;
    trace.log('CAMERA', 'init gen$gen starting');
    try {
      final cameras = await trace.step('availableCameras', availableCameras);
      if (cameras.isEmpty) {
        setState(() { _stage = _Stage.error; _message = 'No camera available on this device.'; });
        return;
      }
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      trace.log('CAMERA', 'gen$gen using ${front.name} (${front.lensDirection.name})');
      // ImageFormatGroup.nv21 (Android): camera_android_camerax converts
      // each stream frame to a single, already-destrided NV21 buffer for us
      // (see FaceRecognitionService.nv21ToImage's doc comment) - the same
      // format ML Kit's InputImage.fromBytes expects on Android, so this
      // one setting serves both this page's own conversion AND detection.
      final controller = CameraController(
        front, ResolutionPreset.medium, enableAudio: false,
        imageFormatGroup: ImageFormatGroup.nv21,
      );
      await trace.step('controller.initialize', controller.initialize);
      if (!mounted) return;

      // The `camera` package defaults every CameraController to
      // FlashMode.auto (see its own source); explicitly off since this
      // front camera has no flash hardware to begin with regardless of
      // capture mechanism, so there's nothing to gain from leaving it on.
      await trace.step('setFlashMode(off)', () => controller.setFlashMode(FlashMode.off));

      // 3A focus/exposure locking was tried here in an earlier pass at this
      // same latency problem (SESSION-2026-09-13-5.md) - measured on a
      // camera where it succeeded, it made no difference to takePicture()
      // timing, which (combined with everything else ruled out that
      // session) is what led to replacing takePicture() with the frame
      // stream below entirely. Deliberately NOT carried forward here: it
      // has a real cost (locked exposure stops tracking the kiosk's
      // ambient light through the day) for no longer any expected benefit,
      // now that the mechanism it was trying to work around is gone.
      //
      // Rotation/mirror for BOTH ML Kit and our own nv21ToImage conversion
      // below - computed once per camera generation, not per frame, since
      // this kiosk is bolted down in a fixed portrait orientation (see the
      // class-level comment) rather than something a handheld app would
      // need to recompute as the device rotates.
      //
      // The value ML Kit wants is the sensor-orientation-compensated-for-
      // device-rotation angle: (sensorOrientation ± deviceRotationDegrees) %
      // 360, "+" for front cameras / "-" for back (Google's own ML Kit
      // camera sample). With this kiosk pinned at deviceRotationDegrees=0,
      // BOTH reduce to just sensorOrientation directly - front and back
      // alike. A previous version of this formula instead complemented the
      // front-camera case to (360 - sensorOrientation) % 360, which happened
      // to be numerically invisible on BlueStacks (sensorOrientation=0,
      // where the complement is also 0) but is 180 DEGREES WRONG on a real
      // phone (sensorOrientation=270 measured on a OnePlus Nord -> the old
      // formula produced 90 instead of 270) - upside-down/mirror-flipped
      // faces reaching both ML Kit (unreliable detection) and our own
      // nv21ToImage crop (catastrophic liveness scores, ~0.13 vs the 0.45
      // threshold, on the rare frame that still detected). Never caught
      // until this, the first time this code ran on hardware with a
      // genuinely nonzero sensorOrientation.
      _rotationDegrees = front.sensorOrientation % 360;
      _mlkitRotation =
          InputImageRotationValue.fromRawValue(_rotationDegrees) ?? InputImageRotation.rotation0deg;
      _mirrorFrame = front.lensDirection == CameraLensDirection.front;
      trace.log('CAMERA', 'gen$gen sensorOrientation=${front.sensorOrientation} '
          'rotation=$_rotationDegrees mirror=$_mirrorFrame');

      _latestFrame = null;
      await trace.step('startImageStream', () => controller.startImageStream((image) => _latestFrame = image));

      trace.log('CAMERA', 'gen$gen ready, preview=${controller.value.previewSize}, '
          'polling every ${_pollInterval.inMilliseconds}ms');
      setState(() => _controller = controller);
      _tick = 0;
      _skipped = 0;
      // Does NOT start polling here - see _ready/_startScanning and the
      // class-level comment. If this is a reinit after the person already
      // tapped "Start Scan" once (_ready already true), resume scanning
      // immediately rather than making them tap it again.
      if (_ready) _scheduleNextPoll(Duration.zero);
    } catch (e, st) {
      debugPrint('Camera init failed: $e\n$st');
      trace.log('CAMERA', 'gen$gen init FAILED: $e');
      if (!mounted) return;
      setState(() { _stage = _Stage.error; _message = 'Camera error: $e'; });
    }
  }

  // BlueStacks' virtualized camera (and, per bug reports, some real devices
  // too) can leave the native capture session in a genuinely broken state
  // mid-scan (observed in logcat: V4L2Camera "Unable to set 25 fps" followed
  // by "Surface had no valid native window") - takePicture() then throws on
  // every subsequent poll. Calling resumePreview() on that same broken
  // CameraController doesn't fix anything, it just resumes the same dead
  // session, so manual "Try Again"/"Enter Code Instead"-and-back kept
  // failing the exact same way. Disposing and recreating the controller
  // from scratch gives it a real chance to recover.
  Future<void> _reinitCamera() async {
    ScanTrace.instance.log('CAMERA', 'reinit requested, disposing gen$_cameraGeneration');
    _returnTimer?.cancel();
    _failedAttempts = 0;
    final old = _controller;
    _controller = null;
    _latestFrame = null;
    setState(() { _busy = false; _stage = _Stage.camera; _message = 'Position your face in the circle'; });
    try {
      // Best-effort - dispose() below should tear this down regardless even
      // if it's already stopped/never started, but stopping explicitly
      // first avoids a stream callback landing on a controller mid-dispose.
      await old?.stopImageStream();
    } catch (e) {
      debugPrint('Stopping stale image stream failed (ignoring): $e');
    }
    try {
      await old?.dispose();
    } catch (e) {
      debugPrint('Disposing stale camera controller failed (ignoring): $e');
    }
    if (!mounted) return;
    await _initCamera();
  }

  @override
  void dispose() {
    ScanTrace.instance
      ..log('PAGE', 'FacePunchPage disposed after $_tick poll(s), $_skipped skipped')
      ..stopStallWatch();
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    _returnTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  // Arms a ONE-SHOT timer for the next poll, then re-arms itself only after
  // that poll's _autoCapture() has fully finished (success, failure, or
  // silent retry - `finally` covers all of them). This is what stops the
  // pipeline being asked for a fresh photo regardless of whether the
  // previous one is still being processed; the old Timer.periodic did
  // exactly that; see the class-level comment above. [delay] defaults to
  // _pollInterval - only _initCamera's very first call after a fresh
  // camera session passes Duration.zero instead, every re-arm from within
  // this method's own `finally` uses the default.
  void _scheduleNextPoll([Duration? delay]) {
    if (!mounted || !_ready || _stage != _Stage.camera) return;
    _pollTimer?.cancel();
    _pollTimer = Timer(delay ?? _pollInterval, () async {
      try {
        await _autoCapture();
      } finally {
        _scheduleNextPoll();
      }
    });
  }

  // "Start Scan" tap - see _ready and the class-level comment.
  void _startScanning() {
    setState(() { _ready = true; _message = 'Position your face in the circle'; });
    _failedAttempts = 0;
    _scheduleNextPoll(Duration.zero);
  }

  Future<void> _autoCapture() async {
    final trace = ScanTrace.instance;
    _tick++;
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized || _busy || _stage != _Stage.camera) {
      _skipped++;
      // Now purely defensive - _scheduleNextPoll only arms one poll at a
      // time, so this shouldn't fire in normal operation any more. Logged
      // every time, not sampled, in case it does: steady `busy=true` skips
      // would mean something is re-entering _autoCapture unexpectedly;
      // steady `initialized=false` skips mean the native session went away
      // underneath us.
      trace.log('POLL', 'tick $_tick SKIP (controller=${controller == null ? 'null' : 'gen$_cameraGeneration'} '
          'initialized=${controller?.value.isInitialized} busy=$_busy stage=${_stage.name}) '
          'skipped=$_skipped/$_tick');
      return;
    }
    _busy = true;
    final attempt = Stopwatch()..start();
    trace.log('POLL', 'tick $_tick START on gen$_cameraGeneration');

    // The stream delivers frames continuously from the moment
    // startImageStream() is called in _initCamera, so _latestFrame is only
    // null for a brief window right at startup before the first one has
    // arrived - not a failure, just too early. Reading it is a plain field
    // access (no native call, no async gap), so unlike the old
    // takePicture() there's no "controller changed mid-capture" race to
    // guard against here - nothing awaits between reading this and using it.
    final frame = _latestFrame;
    if (frame == null || frame.planes.isEmpty) {
      _busy = false;
      trace.log('POLL', 'tick $_tick END no-frame-yet in ${attempt.elapsedMilliseconds}ms');
      return;
    }

    try {
      final svc = FaceRecognitionService.instance;

      // ML Kit runs directly off the raw NV21 bytes - no conversion needed
      // for detection alone. The RGB img.Image (nv21ToImage, below) is only
      // built once we know a face is actually present, since that pixel
      // loop is real work and most polls - nobody standing at the kiosk -
      // never get past this line.
      final inputImage = InputImage.fromBytes(
        bytes: frame.planes.first.bytes,
        metadata: InputImageMetadata(
          size: Size(frame.width.toDouble(), frame.height.toDouble()),
          rotation: _mlkitRotation,
          format: InputImageFormat.nv21,
          bytesPerRow: frame.planes.first.bytesPerRow,
        ),
      );

      final face = await svc.detectFaceFromInputImage(inputImage);
      if (face == null) {
        _busy = false;
        trace.log('POLL', 'tick $_tick END no-face in ${attempt.elapsedMilliseconds}ms');
        return; // nobody in frame yet - keep polling silently
      }
      trace.log('FACE', 'box=${face.boundingBox.width.toInt()}x${face.boundingBox.height.toInt()} '
          'eyesL=${face.leftEyeOpenProbability?.toStringAsFixed(2)} '
          'eyesR=${face.rightEyeOpenProbability?.toStringAsFixed(2)}');
      if (!svc.eyesOpen(face)) {
        _busy = false;
        trace.log('POLL', 'tick $_tick END eyes-closed in ${attempt.elapsedMilliseconds}ms');
        if (mounted) setState(() => _message = 'Keep your eyes open');
        return; // keep polling silently, no need to error out over a blink
      }

      // A face is genuinely present - NOW pay for the NV21->RGB conversion
      // (see nv21ToImage's doc comment), reused by every stage below same
      // as the old JPEG path's single decodeOriented() call.
      final decoded = await trace.step('nv21ToImage', () async => svc.nv21ToImage(
        nv21: frame.planes.first.bytes,
        width: frame.width,
        height: frame.height,
        rotationDegrees: _rotationDegrees,
        mirror: _mirrorFrame,
      ));

      // Quality gate (spec: reject rather than force recognition through a
      // bad frame) - same silent-retry treatment as the detection/eyes
      // checks above, not a hard error, since these resolve themselves the
      // moment the next poll gets a better frame.
      if (await svc.isExposureUnusable(decoded)) {
        _busy = false;
        trace.log('POLL', 'tick $_tick END bad-exposure in ${attempt.elapsedMilliseconds}ms');
        if (mounted) setState(() => _message = 'Lighting is too dark or too bright - please adjust');
        return;
      }
      if (await svc.isTooBlurry(decoded, face)) {
        _busy = false;
        trace.log('POLL', 'tick $_tick END too-blurry in ${attempt.elapsedMilliseconds}ms');
        if (mounted) setState(() => _message = 'Image is blurry - please hold still');
        return;
      }

      // A real face just cleared detection - this is the actual verification step.
      if (!mounted) return;
      setState(() { _stage = _Stage.processing; _message = 'Verifying...'; });

      // Liveness / anti-spoofing - a photo or phone/tablet screen held up to
      // the camera can pass face-similarity matching just fine, this is the
      // dedicated check that catches that instead of trusting embedding
      // similarity alone. Runs before the (more expensive) 1-to-many
      // embedding match below, and a fail is a hard error (not a silent
      // retry) with the same code-fallback offered as an unrecognized face,
      // since a genuine live person mis-scored here deserves a way out too.
      final liveness = await svc.livenessScore(decoded, face);
      trace.log('LIVENESS', 'score=${liveness?.toStringAsFixed(3)} '
          'threshold=${FaceRecognitionService.kLivenessRealThreshold}');
      if (liveness == null || liveness < FaceRecognitionService.kLivenessRealThreshold) {
        _handleScanFailure('Liveness verification failed.', offerCode: true);
        return;
      }

      final liveEmbedding = await svc.getEmbedding(decoded, face);
      if (liveEmbedding == null) {
        _handleScanFailure('Could not read your face clearly.', offerCode: false);
        return;
      }

      // Server-side match (see SUPABASE_FACE_MATCH_RPC.sql /
      // SupabaseService.matchFaceEmbedding) - sends just this one live
      // embedding; Postgres compares it against every enrolled person's
      // references itself and returns only the result, not their raw data.
      final matchResult = await SupabaseService.matchFaceEmbedding(liveEmbedding).timeout(
        const Duration(seconds: 8),
        onTimeout: () => throw TimeoutException('matchFaceEmbedding timed out'),
      );
      final enrolledCount = matchResult['enrolledCount'] as int;
      if (enrolledCount == 0) {
        _showError('No staff have set up Face Punch yet. Ask admin.', offerCode: false);
        return;
      }

      final bestId = matchResult['id'] as String?;
      final bestName = matchResult['name'] as String?;
      final bestSim = matchResult['bestSimilarity'] as double;
      final secondSim = matchResult['secondSimilarity'] as double;

      final matched = bestId != null &&
          bestSim >= FaceRecognitionService.kMatchThreshold &&
          (bestSim - secondSim) >= _matchMargin;
      trace.log('MATCH', 'enrolled=$enrolledCount best=${bestSim.toStringAsFixed(3)} '
          'second=${secondSim.toStringAsFixed(3)} matched=$matched '
          'attempt=${attempt.elapsedMilliseconds}ms');

      if (!matched) {
        _handleScanFailure('Face not recognized.', offerCode: true);
        return;
      }

      // Pausing the camera before the confirm prompt - nothing past this
      // point needs the live feed, and this stops the plugin's background
      // texture stream while the dialog is up.
      await controller.pausePreview();
      if (!mounted) return;

      final confirmResult = await NativeUiService.confirmPunch(bestName ?? 'Staff');
      if (!mounted) return;
      if (confirmResult == PunchConfirmResult.cancelled) {
        // Awaited: the preview was paused above for the confirm dialog and
        // is never implicitly resumed by GetX's route pop - see the "Not
        // Me" branch below for why resumePreview matters even though this
        // path closes the screen right after.
        await controller.resumePreview();
        if (mounted) Get.back();
        return;
      }
      if (confirmResult == PunchConfirmResult.notMe) {
        // Awaited: the preview was paused above for the confirm dialog and
        // is never implicitly resumed by GetX's route pop, so without this
        // await+resume the camera comes back from Enter Code frozen on its
        // last frame - neither rescanning nor returning home - until the
        // user happens to hit "Try Again" (which is the only other place
        // resumePreview() is called).
        await Get.toNamed(Routes.kioskEnterCode);
        if (!mounted) return;
        await controller.resumePreview();
        setState(() { _busy = false; _stage = _Stage.camera; _message = 'Position your face in the circle'; });
        return;
      }

      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final result = await SupabaseService.recordFacePunch(bestId, today).timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw TimeoutException('recordFacePunch timed out'),
      );
      final time = result['time'] as DateTime;
      if (result['status'] == 'already_in') {
        await controller.resumePreview();
        _showError('$bestName is already checked in since ${DateFormat('h:mm a').format(time)}.'
            ' Check out from your app first.', offerCode: false);
        return;
      }
      final punctuality = punctualityLabel(result['isLate'] as bool?, result['lateMinutes'] as int?);
      final suffix = punctuality != null ? ' - $punctuality' : '';
      await NativeUiService.showToast('$bestName checked in at ${DateFormat('h:mm a').format(time)}$suffix');
      if (mounted) Get.back();
    } catch (e, st) {
      trace.log('POLL', 'tick $_tick FAILED after ${attempt.elapsedMilliseconds}ms: $e');
      debugPrint('Face punch failed: $e\n$st');
      _showError('Something went wrong. Please try again.', offerCode: false);
    }
  }

  void _enterCodeInstead() async {
    _returnTimer?.cancel();
    await Get.toNamed(Routes.kioskEnterCode);
    if (!mounted) return;
    // Full reinit, not resumePreview - see _reinitCamera: this screen is
    // only ever reached after a camera poll already failed once (the error
    // stage's own "Enter Code Instead" button), so the session behind this
    // controller may already be the broken one.
    await _reinitCamera();
  }

  // A CONCLUSIVE scan failure (liveness, unreadable embedding, or no
  // match - never the silent no-face/blink/blur/exposure retries, which
  // don't call this at all). The first _maxAttempts-1 are absorbed with a
  // brief warning, staying on the camera stage so scanning just keeps
  // going - see the class-level comment. Only the last one escalates to
  // the full error screen via _showError.
  void _handleScanFailure(String message, {required bool offerCode}) {
    _failedAttempts++;
    if (_failedAttempts < _maxAttempts) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _stage = _Stage.camera;
        _message = '$message (attempt $_failedAttempts of $_maxAttempts)';
      });
      return; // _scheduleNextPoll's own `finally` keeps polling going
    }
    _showError(message, offerCode: offerCode);
  }

  void _showError(String message, {required bool offerCode}) {
    if (!mounted) return;
    setState(() { _busy = false; _stage = _Stage.error; _message = message; _offerCode = offerCode; });
    _scheduleReturn(seconds: 4);
  }

  void _scheduleReturn({int seconds = 3}) {
    _returnTimer?.cancel();
    _returnTimer = Timer(Duration(seconds: seconds), () {
      if (mounted) Get.back();
    });
  }

  void _retry() => _reinitCamera();

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.navyDark,
    body: SafeArea(
      child: Stack(children: [
        _stage == _Stage.error ? _buildError() : _buildScanning(),
        // Centered modal over the live preview, not part of the normal
        // scrolling layout - see _buildReadyPopup's own comment.
        if (_stage != _Stage.error && !_ready) _buildReadyPopup(),
      ]),
    ),
  );

  Widget _buildScanning() {
    final controller = _controller;
    final verifying = _stage == _Stage.processing;
    return Column(children: [
      Align(
        alignment: Alignment.topLeft,
        child: IconButton(
          icon: const Icon(Icons.close_rounded, color: Colors.white70),
          onPressed: () => Get.back(),
        ),
      ),
      const SizedBox(height: 8),
      const Text('Look at the camera', style: TextStyle(
        color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
      const SizedBox(height: 20),
      Expanded(
        child: Center(
          child: controller == null || !controller.value.isInitialized
              ? const CircularProgressIndicator(color: Colors.white)
              : SizedBox(
                  width: ringSize, height: ringSize,
                  child: Stack(alignment: Alignment.center, children: [
                    if (verifying)
                      const SizedBox(
                        width: ringSize, height: ringSize,
                        child: CircularProgressIndicator(strokeWidth: 6, color: AppColors.orange),
                      )
                    else
                      Container(
                        width: ringSize, height: ringSize,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white24, width: 6),
                        ),
                      ),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(frameSize / 2),
                      child: SizedBox(
                        width: frameSize, height: frameSize,
                        child: FittedBox(fit: BoxFit.cover, child: SizedBox(
                          width: controller.value.previewSize?.height ?? frameSize,
                          height: controller.value.previewSize?.width ?? frameSize,
                          child: CameraPreview(controller),
                        )),
                      ),
                    ),
                  ]),
                ),
        ),
      ),
      const SizedBox(height: 20),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Text(_ready ? _message : '', textAlign: TextAlign.center, style: TextStyle(
          color: verifying ? AppColors.orange : AppColors.amber, fontSize: 14, fontFamily: 'Poppins')),
      ),
      const SizedBox(height: 40),
    ]);
  }

  // Centered modal prompt over the live preview, shown until the person
  // taps Start Scan - see _ready and the class-level comment on why
  // scanning doesn't just start the instant this screen opens. A popup
  // (dark scrim + centered card) rather than inline text/button below the
  // preview, so it reads as a clear "waiting for you" prompt instead of
  // blending into the rest of the screen.
  Widget _buildReadyPopup() {
    final controller = _controller;
    final canStart = controller != null && controller.value.isInitialized;
    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: .6),
        child: Center(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 40),
            padding: const EdgeInsets.fromLTRB(28, 28, 28, 24),
            decoration: BoxDecoration(
              color: AppColors.navy,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white12),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.face_retouching_natural_rounded, color: AppColors.amber, size: 40),
              const SizedBox(height: 12),
              const Text('Ready to scan?', style: TextStyle(
                color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
              const SizedBox(height: 8),
              const Text('Line up in the circle, then tap Start Scan',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white60, fontSize: 13, fontFamily: 'Poppins')),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: canStart ? _startScanning : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.amber, foregroundColor: AppColors.navyDark,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                  ),
                  child: const Text('Start Scan', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _buildError() => Stack(children: [
    Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 96, height: 96,
            decoration: const BoxDecoration(color: AppColors.red, shape: BoxShape.circle),
            child: const Icon(Icons.close_rounded, color: Colors.white, size: 56),
          ),
          const SizedBox(height: 24),
          Text(_message, textAlign: TextAlign.center, style: const TextStyle(
            color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
          const SizedBox(height: 24),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            TextButton(
              onPressed: _retry,
              child: const Text('Try Again', style: TextStyle(color: AppColors.amber, fontSize: 15, fontWeight: FontWeight.w700)),
            ),
            if (_offerCode) ...[
              const SizedBox(width: 8),
              TextButton(
                onPressed: _enterCodeInstead,
                child: const Text('Enter Code Instead', style: TextStyle(color: Colors.white60, fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ],
          ]),
        ]),
      ),
    ),
    // Previously the only way out of an error was "Try Again"/"Enter Code"
    // or waiting out the 4s auto-return - no way to just back out to kiosk
    // home, unlike the scanning screen (which always has this same button).
    SafeArea(
      child: Align(
        alignment: Alignment.topLeft,
        child: IconButton(
          icon: const Icon(Icons.close_rounded, color: Colors.white70),
          onPressed: () { _returnTimer?.cancel(); Get.back(); },
        ),
      ),
    ),
  ]);
}
