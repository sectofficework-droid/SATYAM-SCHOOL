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
import 'scan_debug_hud.dart';

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
// No shutter button: a self-rescheduling timer polls roughly every 1s
// while idle on the camera stage - "roughly" because the next poll is only
// armed ~1s AFTER the previous one fully finishes (see _scheduleNextPoll),
// not on a fixed period. It used to be a plain Timer.periodic, which kept
// firing into a busy poll every second even while one attempt was still
// running; overlapping fires didn't do anything (a re-entrancy guard just
// skipped them) but they were also evidence the pipeline was still chewing
// on the previous frame well past its 1s budget, which read to a bystander
// as the camera "restarting" over and over.
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
class FacePunchPage extends StatefulWidget {
  const FacePunchPage({super.key});
  @override
  State<FacePunchPage> createState() => _FacePunchPageState();
}

class _FacePunchPageState extends State<FacePunchPage> with WidgetsBindingObserver {
  static const _matchMargin = 0.05;
  static const _pollInterval = Duration(milliseconds: 1000);
  static const ringSize = 320.0;
  static const frameSize = 300.0;

  CameraController? _controller;
  Timer? _pollTimer;
  Timer? _returnTimer;
  _Stage _stage = _Stage.camera;
  String _message = 'Position your face in the circle';
  bool _busy = false;
  bool _offerCode = false;

  // Updated on every frame the live stream delivers (many times a second);
  // read by _autoCapture at most once a second. This - not takePicture() -
  // is now where each poll's frame comes from; see the class-level comment.
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
      // need to recompute as the device rotates. Standard formula for a
      // portrait host app (matches google_mlkit's own example apps):
      // front-facing sensors are mirrored, so compensate the other way.
      _rotationDegrees = front.lensDirection == CameraLensDirection.front
          ? (360 - front.sensorOrientation) % 360
          : front.sensorOrientation;
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
      _scheduleNextPoll();
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
  // pipeline being asked for a fresh photo once a second regardless of
  // whether the previous photo is still being processed; the old
  // Timer.periodic did exactly that; see the class-level comment above.
  void _scheduleNextPoll() {
    if (!mounted || _stage != _Stage.camera) return;
    _pollTimer?.cancel();
    _pollTimer = Timer(_pollInterval, () async {
      try {
        await _autoCapture();
      } finally {
        _scheduleNextPoll();
      }
    });
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
        _showError('Liveness verification failed. Please try again.', offerCode: true);
        return;
      }

      final liveEmbedding = await svc.getEmbedding(decoded, face);
      if (liveEmbedding == null) {
        _showError('Could not read your face clearly. Please try again.', offerCode: false);
        return;
      }

      final enrolled = await SupabaseService.fetchAllFaceEmbeddings().timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw TimeoutException('fetchAllFaceEmbeddings timed out'),
      );
      if (enrolled.isEmpty) {
        _showError('No staff have set up Face Punch yet. Ask admin.', offerCode: false);
        return;
      }

      double bestSim = -1, secondSim = -1;
      String? bestId, bestName;
      for (final row in enrolled) {
        final refs = (row['embeddings'] as List).cast<List<double>>();
        // Best of that person's several reference shots, not one blended
        // average - a live photo only has to be close to ONE of their
        // enrolled angles/lighting conditions to match.
        var sim = -1.0;
        for (final ref in refs) {
          final s = svc.cosineSimilarity(liveEmbedding, ref);
          if (s > sim) sim = s;
        }
        if (sim > bestSim) {
          secondSim = bestSim;
          bestSim = sim;
          bestId = row['id'] as String;
          bestName = row['name'] as String?;
        } else if (sim > secondSim) {
          secondSim = sim;
        }
      }

      final matched = bestId != null &&
          bestSim >= FaceRecognitionService.kMatchThreshold &&
          (bestSim - secondSim) >= _matchMargin;
      trace.log('MATCH', 'enrolled=${enrolled.length} best=${bestSim.toStringAsFixed(3)} '
          'second=${secondSim.toStringAsFixed(3)} matched=$matched '
          'attempt=${attempt.elapsedMilliseconds}ms');

      if (!matched) {
        _showError('Face not recognized. Please try again or contact admin.', offerCode: true);
        return;
      }

      // Pausing the camera before the confirm prompt - nothing past this
      // point needs the live feed, and this stops the plugin's background
      // texture stream while the dialog is up.
      await controller.pausePreview();
      if (!mounted) return;

      final confirmed = await NativeUiService.confirmPunch(bestName ?? 'Staff');
      if (!mounted) return;
      if (!confirmed) {
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
        Positioned.fill(child: _stage == _Stage.error ? _buildError() : _buildScanning()),
        // Debug builds only - ScanDebugHud renders nothing in release.
        const ScanDebugHud(),
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
        child: Text(_message, textAlign: TextAlign.center, style: TextStyle(
          color: verifying ? AppColors.orange : AppColors.amber, fontSize: 14, fontFamily: 'Poppins')),
      ),
      const SizedBox(height: 40),
    ]);
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
