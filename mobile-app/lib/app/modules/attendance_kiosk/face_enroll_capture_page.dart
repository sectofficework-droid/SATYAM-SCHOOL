import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/face_recognition_service.dart';
import '../../../core/services/supabase_service.dart';
import '../../routes/app_routes.dart';

enum _Stage { camera, saving, success, error }

// Captures 25 diverse shots (22 if the staff member doesn't wear
// spectacles - see _wearsGlasses) for whoever admin just picked on
// StaffEnrollListPage and saves all of them as reference embeddings (not
// one blended average - see saveFaceEmbedding) so a punch only has to be
// close to ONE of them, not a compromise of all of them. Admin answers the
// spectacles question and taps "I'm Ready" to start; after that it's
// hands-off - a timer polls takePicture() every ~1s (same still-photo
// pipeline the punch screen uses) and auto-accepts the first attempt per
// prompt that clears face-detected + eyes-open + quality gate (blur/
// exposure, see isTooBlurry/isExposureUnusable) and, for prompts that are
// supposed to be a genuinely new head angle, a pose-diverse-enough check
// too (see _isDiverseEnough / _EnrollPrompt.poseDiverse) - someone who
// doesn't actually move for the "turn left" prompt just keeps getting told
// to change their angle instead of silently recording two near-identical
// shots. Re-running this (e.g. staff grew a beard, lighting keeps failing
// them) just overwrites the old embeddings - saveFaceEmbedding is a plain
// update, not append.
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
// _isDiverseEnough below. Everything else (repeat frontal shots,
// expression/spectacles/lighting variety) intentionally holds roughly the
// SAME head pose as whatever came before it, so gating those on pose delta
// would just reject them as "already captured" despite being exactly the
// kind of same-pose-different-condition sample the 25-shot breakdown asks
// for. [requiresGlasses] prompts only appear in the session when the staff
// member said they wear spectacles (see _wearsGlasses).
class _EnrollPrompt {
  const _EnrollPrompt(this.text, {this.poseDiverse = false, this.requiresGlasses = false});
  final String text;
  final bool poseDiverse;
  final bool requiresGlasses;
}

class _FaceEnrollCapturePageState extends State<FaceEnrollCapturePage> {
  // 25 diverse shots: 5 frontal, 4 slight-left/right, 4 slight-up/down,
  // 3 normal expression, 3 different expression, 3 with spectacles (if
  // applicable - dropped to leave 22 when the staff member doesn't wear
  // any), 3 lighting variations (lighting itself isn't something the app
  // can control - these are instructions for the staff member/admin to
  // physically move; each shot still goes through the same quality gates
  // as every other prompt).
  static const _allPrompts = [
    _EnrollPrompt('Look straight at the camera', poseDiverse: true),
    _EnrollPrompt('Look straight at the camera, relax your face'),
    _EnrollPrompt('Look straight at the camera again'),
    _EnrollPrompt('Keep looking straight, chin level'),
    _EnrollPrompt('One more, straight at the camera'),
    _EnrollPrompt('Turn your head slightly left', poseDiverse: true),
    _EnrollPrompt('Hold that left turn'),
    _EnrollPrompt('Turn your head slightly right', poseDiverse: true),
    _EnrollPrompt('Hold that right turn'),
    _EnrollPrompt('Tilt your chin up a little', poseDiverse: true),
    _EnrollPrompt('Hold your chin up'),
    _EnrollPrompt('Tilt your chin down a little', poseDiverse: true),
    _EnrollPrompt('Hold your chin down'),
    _EnrollPrompt('Normal expression, look straight'),
    _EnrollPrompt('Normal expression, relax'),
    _EnrollPrompt('Normal expression, one more'),
    _EnrollPrompt('Now smile naturally'),
    _EnrollPrompt('Try a different expression'),
    _EnrollPrompt('One more expression'),
    _EnrollPrompt('Put on your spectacles, look straight', requiresGlasses: true),
    _EnrollPrompt('Hold still with your spectacles', requiresGlasses: true),
    _EnrollPrompt('One more with your spectacles', requiresGlasses: true),
    _EnrollPrompt('If possible, move to brighter lighting'),
    _EnrollPrompt('If possible, move to dimmer or normal lighting'),
    _EnrollPrompt('One more shot, any lighting'),
  ];

  // Built when "I'm Ready" is tapped, locking in whatever the spectacles
  // toggle was set to at that moment (see _wearsGlasses) - 25 prompts if
  // yes, 22 if no.
  List<_EnrollPrompt> _prompts = const [];
  int _totalShots = 0;
  bool? _wearsGlasses;

  static const _pollInterval  = Duration(milliseconds: 1000);
  static const _tickDuration  = Duration(milliseconds: 700);
  static const _nextShotDelay = Duration(milliseconds: 1300);

  // How different a shot's pose must be from every prior shot to count as
  // a new angle rather than a repeat - degrees of head rotation, or a
  // fractional change in how tall the detected face is in-frame (a stand-in
  // for "moved closer/farther" that angle alone can't catch). Untested
  // against real staff yet; if genuine angle changes keep getting rejected,
  // or near-repeats keep getting accepted, loosen/tighten these first.
  static const _minAngleDeltaDeg = 6.0;
  static const _minSizeRatioDelta = 0.12;

  // A shot only gets accepted once two consecutive polls (~1s apart) land
  // on nearly the same pose - one still frame mid-head-turn is blurry and
  // makes for a worse reference embedding than waiting a second for
  // someone to actually settle into the pose the prompt asked for.
  static const _stabilityAngleDeg = 2.5;
  static const _stabilitySizeRatioDelta = 0.04;

  late final String _employeeId;
  late final String _employeeName;

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

  @override
  void initState() {
    super.initState();
    final args = Get.arguments as Map? ?? {};
    _employeeId   = args['id'] as String? ?? '';
    _employeeName = args['name'] as String? ?? 'Staff';
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
      final controller = CameraController(front, ResolutionPreset.medium, enableAudio: false);
      await controller.initialize();
      if (!mounted) return;
      setState(() => _controller = controller);
    } catch (e, st) {
      debugPrint('Camera init failed: $e\n$st');
      if (!mounted) return;
      setState(() { _stage = _Stage.error; _message = 'Camera error: $e'; });
    }
  }

  void _startScanning() {
    final wearsGlasses = _wearsGlasses ?? false;
    _prompts = _allPrompts.where((p) => !p.requiresGlasses || wearsGlasses).toList();
    _totalShots = _prompts.length;
    setState(() { _ready = true; _message = 'Hold still...'; });
    _pollTimer = Timer.periodic(_pollInterval, (_) => _autoCapture());
  }

  // Live count shown on the pre-ready screen, reacting to the spectacles
  // toggle before it's locked in by _startScanning - 25 total prompts if
  // yes, 22 (glasses prompts dropped) if no or not yet answered.
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
    _controller?.dispose();
    super.dispose();
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
    _busy = true;

    try {
      final photo = await controller.takePicture();
      final svc = FaceRecognitionService.instance;

      final face = await svc.detectSingleFace(photo.path);
      if (!mounted) return;
      if (face == null) {
        setState(() { _busy = false; _message = 'Position your face in the circle'; });
        return;
      }
      if (!svc.eyesOpen(face)) {
        setState(() { _busy = false; _message = 'Keep your eyes open'; });
        return;
      }

      // Quality gate - reject rather than silently bank a frame that's too
      // dark/bright/blurry to make a good reference embedding from (spec:
      // enrollment must not count blurry/over/underexposed samples).
      if (await svc.isExposureUnusable(photo.path)) {
        setState(() { _busy = false; _message = 'Lighting is too dark or too bright - please adjust'; });
        return;
      }
      if (await svc.isTooBlurry(photo.path, face)) {
        setState(() { _busy = false; _message = 'Image is blurry - please hold still'; });
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
        setState(() { _busy = false; _message = 'Hold steady...'; });
        return;
      }

      // Only prompts that establish a NEW head angle are pose-gated - a
      // repeat frontal/expression/spectacles/lighting shot is SUPPOSED to
      // hold roughly the same pose as what came before it, so gating those
      // too would reject exactly the same-pose-different-condition samples
      // this 25-shot breakdown is asking for. See _EnrollPrompt.poseDiverse.
      final currentPrompt = _prompts[_embeddings.length];
      if (currentPrompt.poseDiverse && !_isDiverseEnough(currentPose)) {
        setState(() { _busy = false; _message = 'That angle is already captured - please change your angle or distance'; });
        return;
      }

      final embedding = await svc.getEmbedding(photo.path, face);
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
        // Stays busy through the pause - otherwise the next periodic tick
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

    await SupabaseService.saveFaceEmbedding(_employeeId, _embeddings);
    if (!mounted) return;
    setState(() => _stage = _Stage.success);
    Timer(const Duration(seconds: 3), () { if (mounted) Get.until((r) => r.settings.name == Routes.kioskHome); });
  }

  Future<Map<String, dynamic>?> _findDuplicate(FaceRecognitionService svc) async {
    final enrolled = await SupabaseService.fetchAllFaceEmbeddings();
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
