import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/face_recognition_service.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/services/native_ui_service.dart';
import '../../../core/utils/punctuality.dart';
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
// No shutter button: a timer polls takePicture() every ~1s while idle on
// the camera stage. Polls that don't find an open-eyed face are silent
// (just keep trying); the moment one does, that's the trigger into
// _Stage.processing ("Verifying...") and, on a match, the native confirm
// dialog - the match is never recorded silently. A "Face not recognized"
// error offers a way out via an admin-issued numeric code
// (enter_punch_code_page.dart) instead of just leaving someone stuck.
class FacePunchPage extends StatefulWidget {
  const FacePunchPage({super.key});
  @override
  State<FacePunchPage> createState() => _FacePunchPageState();
}

class _FacePunchPageState extends State<FacePunchPage> {
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

  @override
  void initState() {
    super.initState();
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
      _pollTimer = Timer.periodic(_pollInterval, (_) => _autoCapture());
    } catch (e, st) {
      debugPrint('Camera init failed: $e\n$st');
      if (!mounted) return;
      setState(() { _stage = _Stage.error; _message = 'Camera error: $e'; });
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _returnTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _autoCapture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized || _busy || _stage != _Stage.camera) return;
    _busy = true;

    try {
      final photo = await controller.takePicture();
      final svc = FaceRecognitionService.instance;

      final face = await svc.detectSingleFace(photo.path);
      if (face == null) {
        _busy = false;
        return; // nobody in frame yet - keep polling silently
      }
      if (!svc.eyesOpen(face)) {
        _busy = false;
        if (mounted) setState(() => _message = 'Keep your eyes open');
        return; // keep polling silently, no need to error out over a blink
      }

      // Quality gate (spec: reject rather than force recognition through a
      // bad frame) - same silent-retry treatment as the detection/eyes
      // checks above, not a hard error, since these resolve themselves the
      // moment the next poll gets a better frame.
      if (await svc.isExposureUnusable(photo.path)) {
        _busy = false;
        if (mounted) setState(() => _message = 'Lighting is too dark or too bright - please adjust');
        return;
      }
      if (await svc.isTooBlurry(photo.path, face)) {
        _busy = false;
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
      final liveness = await svc.livenessScore(photo.path, face);
      if (liveness == null || liveness < FaceRecognitionService.kLivenessRealThreshold) {
        _showError('Liveness verification failed. Please try again.', offerCode: true);
        return;
      }

      final liveEmbedding = await svc.getEmbedding(photo.path, face);
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
      debugPrint('Face punch failed: $e\n$st');
      _showError('Something went wrong. Please try again.', offerCode: false);
    }
  }

  void _enterCodeInstead() async {
    _returnTimer?.cancel();
    await Get.toNamed(Routes.kioskEnterCode);
    if (!mounted) return;
    _controller?.resumePreview(); // no-op if it was never paused
    setState(() { _busy = false; _stage = _Stage.camera; _message = 'Position your face in the circle'; });
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

  void _retry() {
    _returnTimer?.cancel();
    _controller?.resumePreview(); // no-op if it was never paused
    setState(() { _busy = false; _stage = _Stage.camera; _message = 'Position your face in the circle'; });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.navyDark,
    body: SafeArea(
      child: _stage == _Stage.error ? _buildError() : _buildScanning(),
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

  Widget _buildError() => Center(
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
  );
}
