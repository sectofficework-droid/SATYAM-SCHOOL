import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/face_recognition_service.dart';
import '../../../core/services/supabase_service.dart';
import '../../routes/app_routes.dart';

enum _Stage { camera, saving, success, error }

// Captures 8 diverse shots (9 if the staff member wears spectacles - see
// _wearsGlasses) for whoever admin just picked on
// StaffEnrollListPage and saves all of them as reference embeddings (not
// one blended average - see saveFaceEmbedding) so a punch only has to be
// close to ONE of them, not a compromise of all of them. Admin answers the
// spectacles question and taps "I'm Ready" to start; after that it's
// hands-off - a self-rescheduling poll reads the MOST RECENT frame off a
// continuously running CameraController.startImageStream() (same mechanism
// as face_punch_page.dart's kiosk polling - see that file's class comment
// for why: CameraController.takePicture() itself was measured taking
// 4-7 seconds per call on this app's camera, which is what made this
// screen's camera look like it kept freezing/restarting between shots,
// SESSION-2026-09-13-*) and auto-accepts the first attempt per prompt that
// clears face-detected + eyes-open + quality gate (blur/exposure, see
// isTooBlurry/isExposureUnusable) and, for prompts that are supposed to be
// a genuinely new head angle, a pose-diverse-enough check too (see
// _isDiverseEnough / _EnrollPrompt.poseDiverse) - someone who doesn't
// actually move for the "turn left" prompt just keeps getting told to
// change their angle instead of silently recording two near-identical
// shots. The camera itself never stops or reinitializes between shots -
// the person can freely rotate through every prompted angle in front of a
// single continuous live preview, exactly like looking in a mirror, while
// this polls in the background for a stable, diverse-enough, in-focus
// frame to bank. Re-running this (e.g. staff grew a beard, lighting keeps
// failing them) just overwrites the old embeddings - saveFaceEmbedding is
// a plain update, not append.
class FaceEnrollCapturePage extends StatefulWidget {
  const FaceEnrollCapturePage({super.key});
  @override
  State<FaceEnrollCapturePage> createState() => _FaceEnrollCapturePageState();
}

class _ShotPose {
  _ShotPose(this.yaw, this.pitch, this.faceHeight);
  final double yaw;
  final double pitch;
  final double faceHeight;
}

// One capture slot. [poseDiverse] marks the prompts that establish a NEW
// head angle (first-of-each-direction) - only those get checked against
// _isDiverseEnough below. The normal-expression/smile/spectacles prompts
// intentionally hold roughly the SAME (frontal) head pose as whatever came
// before them, so gating those on pose delta would just reject them as
// "already captured" despite being exactly the kind of same-pose-
// different-condition sample this shot list asks for. [requiresGlasses]
// prompts only appear in the session when the staff member said they wear
// spectacles (see _wearsGlasses).
class _EnrollPrompt {
  const _EnrollPrompt(this.text, {this.poseDiverse = false, this.requiresGlasses = false});
  final String text;
  final bool poseDiverse;
  final bool requiresGlasses;
}

class _FaceEnrollCapturePageState extends State<FaceEnrollCapturePage> {
  // 8 distinct shots (9 if the staff member wears spectacles - see
  // _wearsGlasses): one each of frontal, left, right, chin-up, chin-down,
  // normal expression, smiling, and (conditionally) spectacles. Was 25/22,
  // built from 3-5 near-duplicate repeats per category (e.g. 5 separate
  // "look straight" prompts) - cut down because (a) it made enrollment take
  // 2+ minutes, and (b) per real-data validation of REQ-BUG-014
  // (governance/planning/TODO.md), MORE near-identical shots per person
  // didn't meaningfully improve genuine-match scores once averaged into a
  // centroid, but DID increase the odds of an outlier shot confusing two
  // people - genuinely distinct poses/expressions, not repeat count, is
  // what the centroid actually benefits from. Lighting variation is
  // dropped entirely (nothing here can force the room to actually change
  // lighting between prompts - those 3 slots in the old list mostly just
  // recorded the same lighting three times).
  static const _allPrompts = [
    _EnrollPrompt('Look straight at the camera', poseDiverse: true),
    _EnrollPrompt('Turn your head slightly left', poseDiverse: true),
    _EnrollPrompt('Turn your head slightly right', poseDiverse: true),
    _EnrollPrompt('Tilt your chin up a little', poseDiverse: true),
    _EnrollPrompt('Tilt your chin down a little', poseDiverse: true),
    _EnrollPrompt('Normal expression, look straight'),
    _EnrollPrompt('Now smile naturally'),
    _EnrollPrompt('Put on your spectacles, look straight', requiresGlasses: true),
  ];

  // Built when "I'm Ready" is tapped, locking in whatever the spectacles
  // toggle was set to at that moment (see _wearsGlasses) - 9 prompts if
  // yes, 8 if no.
  List<_EnrollPrompt> _prompts = const [];
  int _totalShots = 0;
  bool? _wearsGlasses;

  // Was 1000/700/1300ms - each shot needs 2 consecutive stable polls before
  // it counts (see _autoCapture's stability check below), so the poll
  // interval alone used to cost ~2s of an enrollment session's time before
  // a shot could even be accepted, on top of the tick+delay pause after
  // it. Tightened to match face_punch_page's already-proven 200ms poll
  // cadence (that page does MORE per poll - it runs the full match, not
  // just detection/stability - so this page has headroom to poll at least
  // as fast); the stability/quality gates themselves are UNCHANGED, so
  // this only cuts wall-clock waiting, not what counts as an acceptable
  // shot.
  static const _pollInterval  = Duration(milliseconds: 300);
  static const _tickDuration  = Duration(milliseconds: 350);
  static const _nextShotDelay = Duration(milliseconds: 500);

  // How different a shot's pose must be from every prior shot to count as
  // a new angle rather than a repeat - degrees of head rotation, or a
  // fractional change in how tall the detected face is in-frame (a stand-in
  // for "moved closer/farther" that angle alone can't catch). Untested
  // against real staff yet; if genuine angle changes keep getting rejected,
  // or near-repeats keep getting accepted, loosen/tighten these first.
  static const _minAngleDeltaDeg = 6.0;
  static const _minSizeRatioDelta = 0.12;

  // A shot only gets accepted once two consecutive polls (~1s apart) land
  // on nearly the same pose - one frame mid-head-turn is blurry and makes
  // for a worse reference embedding than waiting a second for someone to
  // actually settle into the pose the prompt asked for.
  static const _stabilityAngleDeg = 2.5;
  static const _stabilitySizeRatioDelta = 0.04;

  late final String _employeeId;
  late final String _employeeName;
  // REQ-SEC-002 fast-track (2026-09-19): kiosk-admin session token, threaded
  // through from the PIN dialog - required by every face-embedding call.
  late final String _kioskToken;

  CameraController? _controller;
  Timer? _pollTimer;
  bool _ready = false;
  _Stage _stage = _Stage.camera;
  String _message = '';
  bool _showTick = false;
  final List<List<double>> _embeddings = [];
  final List<_ShotPose> _poses = [];
  _ShotPose? _lastSeenPose;
  bool _busy = false;

  // Updated on every frame the live stream delivers; read by _autoCapture
  // at most once a second. See face_punch_page.dart's matching field for
  // why this replaced takePicture().
  CameraImage? _latestFrame;

  // Computed once per camera init - see face_punch_page.dart's matching
  // fields/comment for the rotation formula and why front-camera frames
  // need mirroring for both ML Kit and our own nv21ToImage conversion to
  // agree on the same coordinate space.
  int _rotationDegrees = 0;
  InputImageRotation _mlkitRotation = InputImageRotation.rotation0deg;
  bool _mirrorFrame = false;

  @override
  void initState() {
    super.initState();
    final args = Get.arguments as Map? ?? {};
    _employeeId   = args['id'] as String? ?? '';
    _employeeName = args['name'] as String? ?? 'Staff';
    _kioskToken   = args['token'] as String? ?? '';
    FaceRecognitionService.instance.preload();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        setState(() { _stage = _Stage.error; _message = 'No camera available on this device.'; });
        return;
      }
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      // ImageFormatGroup.nv21 (Android): camera_android_camerax converts
      // each stream frame to a single, already-destrided NV21 buffer for us
      // (see FaceRecognitionService.nv21ToImage's doc comment) - the same
      // format ML Kit's InputImage.fromBytes expects on Android, so this
      // one setting serves both this page's own conversion AND detection.
      final controller = CameraController(
        front, ResolutionPreset.medium, enableAudio: false,
        imageFormatGroup: ImageFormatGroup.nv21,
      );
      await controller.initialize();
      if (!mounted) return;

      // See the matching comment in face_punch_page.dart's _initCamera:
      // tried as a fix for takePicture() latency, measured and DISPROVEN
      // (SESSION-2026-09-13-4.md). Left in as a harmless default override -
      // the front camera has no flash hardware to begin with - but it is
      // not what fixes the latency.
      await controller.setFlashMode(FlashMode.off);

      // See face_punch_page.dart's matching comment for the full derivation
      // and the real-device bug this fixes: with the device pinned at
      // deviceRotationDegrees=0 (this screen is likewise used in a fixed
      // portrait orientation), the value ML Kit/nv21ToImage need is just
      // sensorOrientation directly, for front and back cameras alike - NOT
      // its (360 - sensorOrientation) complement, which is 180 degrees wrong
      // whenever sensorOrientation isn't 0 (invisible on BlueStacks, which
      // reports 0; wrong on real hardware).
      _rotationDegrees = front.sensorOrientation % 360;
      _mlkitRotation =
          InputImageRotationValue.fromRawValue(_rotationDegrees) ?? InputImageRotation.rotation0deg;
      _mirrorFrame = front.lensDirection == CameraLensDirection.front;

      // startImageStream() is deferred to _startScanning(), not called here
      // - see face_punch_page.dart's matching comment: attaching the image
      // stream this early visibly caps the live preview's frame rate on
      // real hardware for as long as the pre-ready "Set Up Face Punch"
      // screen sits on screen, which is otherwise just an idle preview with
      // no analysis work happening yet anyway.
      _latestFrame = null;

      setState(() => _controller = controller);
    } catch (e, st) {
      debugPrint('Camera init failed: $e\n$st');
      if (!mounted) return;
      setState(() { _stage = _Stage.error; _message = 'Camera error: $e'; });
    }
  }

  void _startScanning() async {
    final wearsGlasses = _wearsGlasses ?? false;
    _prompts = _allPrompts.where((p) => !p.requiresGlasses || wearsGlasses).toList();
    _totalShots = _prompts.length;
    final controller = _controller;
    if (controller != null && !controller.value.isStreamingImages) {
      _latestFrame = null;
      await controller.startImageStream((image) => _latestFrame = image);
    }
    if (!mounted) return;
    setState(() { _ready = true; _message = 'Hold still...'; });
    _scheduleNextPoll();
  }

  // Live count shown on the pre-ready screen, reacting to the spectacles
  // toggle before it's locked in by _startScanning - 9 total prompts if
  // yes, 8 (glasses prompt dropped) if no or not yet answered.
  int get _plannedShotCount =>
      _allPrompts.where((p) => !p.requiresGlasses || (_wearsGlasses ?? false)).length;

  Widget _glassesChoiceButton(String label, bool value) {
    final selected = _wearsGlasses == value;
    return OutlinedButton(
      onPressed: () => setState(() => _wearsGlasses = value),
      style: OutlinedButton.styleFrom(
        backgroundColor: selected ? AppColors.amber : Colors.transparent,
        foregroundColor: selected ? AppColors.navyDark : Colors.white70,
        side: BorderSide(color: selected ? AppColors.amber : Colors.white24),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    final controller = _controller;
    if (controller != null && controller.value.isStreamingImages) {
      // Best-effort - dispose() below tears this down regardless, but
      // stopping explicitly first avoids a stream callback landing on a
      // controller mid-dispose (see face_punch_page.dart's _reinitCamera).
      controller.stopImageStream().catchError((e) => debugPrint('Stopping image stream failed (ignoring): $e'));
    }
    controller?.dispose();
    super.dispose();
  }

  // Arms a ONE-SHOT timer for the next poll, then re-arms itself only after
  // that poll's _autoCapture() has fully finished - see
  // face_punch_page.dart's matching method for why this (not
  // Timer.periodic) is what keeps the camera from ever looking like it's
  // "catching up" on a backlog of fires.
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

  // The poll loop calls this every ~300ms, and "Hold steady..." in
  // particular can hold across many consecutive polls while someone
  // settles into a pose - without this guard every one of those polls
  // would rebuild the whole capture screen (camera preview included) to
  // redraw identical text, visible as jank on the kiosk tablet for no
  // visual benefit. See face_punch_page.dart's matching helper.
  void _updateMessage(String msg) {
    if (!mounted || _message == msg) return;
    setState(() => _message = msg);
  }

  bool _isDiverseEnough(_ShotPose pose) {
    final yaw = pose.yaw;
    final pitch = pose.pitch;
    final height = pose.faceHeight;
    for (final prev in _poses) {
      final angleDiff = (yaw - prev.yaw).abs() > (pitch - prev.pitch).abs()
          ? (yaw - prev.yaw).abs()
          : (pitch - prev.pitch).abs();
      final sizeRatioDiff = (height - prev.faceHeight).abs() / prev.faceHeight;
      if (angleDiff < _minAngleDeltaDeg && sizeRatioDiff < _minSizeRatioDelta) return false;
    }
    return true;
  }

  Future<void> _autoCapture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized || _employeeId.isEmpty || _busy || !_ready || _stage != _Stage.camera) return;

    // The stream delivers frames continuously from the moment
    // startImageStream() is called in _initCamera, so _latestFrame is only
    // null for a brief window right at startup before the first one has
    // arrived - not a failure, just too early.
    final frame = _latestFrame;
    if (frame == null || frame.planes.isEmpty) return;

    _busy = true;
    try {
      final svc = FaceRecognitionService.instance;

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
      if (!mounted) return;
      if (face == null) {
        _busy = false;
        _updateMessage('Position your face in the circle');
        return;
      }
      if (!svc.eyesOpen(face)) {
        _busy = false;
        _updateMessage('Keep your eyes open');
        return;
      }

      // A face is genuinely present - NOW pay for the NV21->RGB conversion,
      // reused by every stage below same as the old JPEG path's single
      // decodeOriented() call.
      final decoded = svc.nv21ToImage(
        nv21: frame.planes.first.bytes,
        width: frame.width,
        height: frame.height,
        rotationDegrees: _rotationDegrees,
        mirror: _mirrorFrame,
      );

      // Quality gate - reject rather than silently bank a frame that's too
      // dark/bright/blurry to make a good reference embedding from (spec:
      // enrollment must not count blurry/over/underexposed samples).
      if (await svc.isExposureUnusable(decoded)) {
        _busy = false;
        _updateMessage('Lighting is too dark or too bright - please adjust');
        return;
      }
      if (await svc.isTooBlurry(decoded, face)) {
        _busy = false;
        _updateMessage('Image is blurry - please hold still');
        return;
      }

      final currentPose = _ShotPose(face.headEulerAngleY ?? 0, face.headEulerAngleX ?? 0, face.boundingBox.height);
      final lastSeen = _lastSeenPose;
      _lastSeenPose = currentPose;
      final stable = lastSeen != null &&
          (currentPose.yaw - lastSeen.yaw).abs() < _stabilityAngleDeg &&
          (currentPose.pitch - lastSeen.pitch).abs() < _stabilityAngleDeg &&
          (currentPose.faceHeight - lastSeen.faceHeight).abs() / lastSeen.faceHeight < _stabilitySizeRatioDelta;
      if (!stable) {
        _busy = false;
        _updateMessage('Hold steady...');
        return;
      }

      // Only prompts that establish a NEW head angle are pose-gated - the
      // expression/spectacles shots are SUPPOSED to hold roughly the same
      // (frontal) pose as what came before them, so gating those too would
      // reject exactly the same-pose-different-condition sample this shot
      // list is asking for. See _EnrollPrompt.poseDiverse.
      final currentPrompt = _prompts[_embeddings.length];
      if (currentPrompt.poseDiverse && !_isDiverseEnough(currentPose)) {
        _busy = false;
        _updateMessage('That angle is already captured - please change your angle or distance');
        return;
      }

      final embedding = await svc.getEmbedding(decoded, face);
      if (!mounted) return;
      if (embedding == null) {
        setState(() { _busy = false; _message = 'Could not read your face clearly, hold still'; });
        return;
      }

      _embeddings.add(embedding);
      _poses.add(currentPose);
      _lastSeenPose = null; // next shot starts its own stability streak fresh
      await _celebrateShot();
      if (!mounted) return;

      if (_embeddings.length < _totalShots) {
        // Stays busy through the pause - otherwise the next scheduled poll
        // could fire mid-delay and race this one into taking two photos
        // for what's supposed to be one shot.
        setState(() => _message = 'Hold still...');
        await Future.delayed(_nextShotDelay);
        if (!mounted) return;
        _busy = false;
        return;
      }

      await _finishEnrollment(svc);
    } catch (e, st) {
      debugPrint('Face enroll capture failed: $e\n$st');
      if (!mounted) return;
      setState(() { _busy = false; _stage = _Stage.camera; _message = 'Something went wrong. Please try again.'; });
    }
  }

  Future<void> _celebrateShot() async {
    if (!mounted) return;
    setState(() => _showTick = true);
    await Future.delayed(_tickDuration);
    if (!mounted) return;
    setState(() => _showTick = false);
  }

  // Checks the freshly-captured shots against every OTHER already-enrolled
  // staff member's stored embeddings (own prior enrollment, if any, is
  // skipped so re-registering yourself never "conflicts" with yourself).
  // A hit doesn't block the save - twins, siblings on staff, or admin just
  // re-confirming the same person under a different name are all real
  // possibilities - it's a heads-up so admin can catch a genuine mix-up
  // (wrong name picked from the list) before it's saved.
  Future<void> _finishEnrollment(FaceRecognitionService svc) async {
    setState(() => _stage = _Stage.saving);

    final duplicate = await _findDuplicate(svc);
    if (duplicate != null) {
      if (!mounted) return;
      final proceed = await _confirmDuplicate(duplicate['name'] as String? ?? 'another staff member');
      if (!proceed) {
        if (!mounted) return;
        setState(() {
          _busy = false; _stage = _Stage.camera; _message = 'Registration cancelled.';
          _embeddings.clear(); _poses.clear();
        });
        return;
      }
    }

    await SupabaseService.saveFaceEmbedding(_kioskToken, _employeeId, _embeddings);
    if (!mounted) return;
    setState(() => _stage = _Stage.success);
    Timer(const Duration(seconds: 3), () { if (mounted) Get.until((r) => r.settings.name == Routes.kioskHome); });
  }

  Future<Map<String, dynamic>?> _findDuplicate(FaceRecognitionService svc) async {
    final enrolled = await SupabaseService.fetchAllFaceEmbeddings(_kioskToken);
    double bestSim = -1;
    Map<String, dynamic>? best;
    for (final row in enrolled) {
      if (row['id'] == _employeeId) continue;
      final refs = (row['embeddings'] as List).cast<List<double>>();
      for (final mine in _embeddings) {
        for (final ref in refs) {
          final sim = svc.cosineSimilarity(mine, ref);
          if (sim > bestSim) { bestSim = sim; best = row; }
        }
      }
    }
    return (best != null && bestSim >= FaceRecognitionService.kMatchThreshold) ? best : null;
  }

  Future<bool> _confirmDuplicate(String otherName) async {
    final proceed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: const Text('Face Already Registered'),
        content: Text('This face looks like it\'s already registered to $otherName. Register it for $_employeeName anyway?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Register Anyway')),
        ],
      ),
    );
    return proceed ?? false;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.navyDark,
    body: SafeArea(
      child: switch (_stage) {
        _Stage.camera  => _buildCamera(),
        _Stage.saving  => _buildMessage(spinner: true, text: 'Saving...'),
        _Stage.success => _buildMessage(icon: Icons.check_rounded, iconColor: AppColors.green, text: 'Face Punch is set up for $_employeeName'),
        _Stage.error   => _buildMessage(icon: Icons.close_rounded, iconColor: AppColors.red, text: _message),
      },
    ),
  );

  Widget _buildCamera() {
    final controller = _controller;
    final shotNo = _embeddings.length + 1;

    // A fixed 320px frame assumed a tall phone screen - on a short/
    // landscape window (e.g. a BlueStacks window docked wide-and-short)
    // that plus the header/prompt text and Ready button below it
    // overflowed. A LayoutBuilder+ScrollView "fix" for that turned out
    // worse (broke layout of everything below the frame entirely on the
    // BlueStacks test device). Simplest fix that's actually safe: just use
    // a smaller fixed frame that comfortably fits any real kiosk screen,
    // no dynamic sizing machinery - same approach as face_punch_page.dart.
    const frameSize = 200.0;
    return Column(children: [
      Align(
        alignment: Alignment.topLeft,
        child: IconButton(icon: const Icon(Icons.close_rounded, color: Colors.white70), onPressed: () => Get.back()),
      ),
      if (_ready) ...[
        Text('Shot $shotNo of $_totalShots', style: const TextStyle(
          color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
        const SizedBox(height: 4),
        Text(_prompts[(shotNo - 1).clamp(0, _prompts.length - 1)].text,
          style: const TextStyle(color: Colors.white60, fontSize: 13, fontFamily: 'Poppins')),
      ] else ...[
        const Text('Set Up Face Punch', style: TextStyle(
          color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
        const SizedBox(height: 4),
        Text('$_plannedShotCount quick shots for $_employeeName - line up in the circle, then tap ready',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white60, fontSize: 13, fontFamily: 'Poppins')),
        const SizedBox(height: 12),
        Text('Does $_employeeName normally wear spectacles?', style: const TextStyle(
          color: Colors.white70, fontSize: 12, fontFamily: 'Poppins')),
        const SizedBox(height: 6),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _glassesChoiceButton('Yes', true),
          const SizedBox(width: 10),
          _glassesChoiceButton('No', false),
        ]),
      ],
      const SizedBox(height: 16),
      Center(
          child: controller == null || !controller.value.isInitialized
              ? const SizedBox(width: frameSize, height: frameSize, child: Center(child: CircularProgressIndicator(color: Colors.white)))
              : ClipRRect(
                  borderRadius: BorderRadius.circular(frameSize / 2),
                  child: SizedBox(
                    width: frameSize, height: frameSize,
                    child: Stack(fit: StackFit.expand, children: [
                      FittedBox(fit: BoxFit.cover, child: SizedBox(
                        width: controller.value.previewSize?.height ?? frameSize,
                        height: controller.value.previewSize?.width ?? frameSize,
                        child: CameraPreview(controller),
                      )),
                      AnimatedOpacity(
                        opacity: _showTick ? 1 : 0,
                        duration: const Duration(milliseconds: 150),
                        child: Container(
                          color: Colors.black.withValues(alpha: .35),
                          child: Center(
                            child: AnimatedScale(
                              scale: _showTick ? 1 : 0.6,
                              duration: const Duration(milliseconds: 250),
                              curve: Curves.elasticOut,
                              child: const Icon(Icons.check_circle_rounded, color: AppColors.green, size: 96),
                            ),
                          ),
                        ),
                      ),
                    ]),
                  ),
                ),
        ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 8),
        child: _ready
            ? Text(_message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.amber, fontSize: 13))
            : ElevatedButton(
                onPressed: controller == null || !controller.value.isInitialized || _wearsGlasses == null ? null : _startScanning,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.amber, foregroundColor: AppColors.navyDark,
                  padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                ),
                child: const Text("I'm Ready", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              ),
      ),
      const SizedBox(height: 32),
    ]);
  }

  Widget _buildMessage({IconData? icon, Color? iconColor, bool spinner = false, required String text}) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        if (spinner) const CircularProgressIndicator(color: Colors.white)
        else Container(
          width: 96, height: 96,
          decoration: BoxDecoration(color: iconColor, shape: BoxShape.circle),
          child: Icon(icon, color: Colors.white, size: 56),
        ),
        const SizedBox(height: 24),
        Text(text, textAlign: TextAlign.center, style: const TextStyle(
          color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
      ]),
    ),
  );
}
