import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/face_recognition_service.dart';
import '../../../core/services/supabase_service.dart';

enum _Stage { camera, processing, success, error }

// The kiosk's core flow: capture one photo, find the best-matching enrolled
// staff member by face (1-to-many - nobody is pre-identified going in),
// record their punch, show the result, then return to the idle screen on
// its own. A cosine-similarity margin over the runner-up (not just clearing
// the threshold) guards against two staff who happen to look similar both
// scoring high on the same photo.
class FacePunchPage extends StatefulWidget {
  const FacePunchPage({super.key});
  @override
  State<FacePunchPage> createState() => _FacePunchPageState();
}

class _FacePunchPageState extends State<FacePunchPage> {
  static const _matchMargin = 0.05;

  CameraController? _controller;
  _Stage _stage = _Stage.camera;
  String _message = '';
  String? _resultName;
  String? _resultAction; // 'check_in' | 'check_out'
  DateTime? _resultTime;
  Timer? _returnTimer;

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
    } catch (e, st) {
      debugPrint('Camera init failed: $e\n$st');
      if (!mounted) return;
      setState(() { _stage = _Stage.error; _message = 'Camera error: $e'; });
    }
  }

  @override
  void dispose() {
    _returnTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _capture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    setState(() { _stage = _Stage.processing; _message = 'Scanning...'; });

    try {
      final photo = await controller.takePicture();
      final svc = FaceRecognitionService.instance;

      final face = await svc.detectSingleFace(photo.path);
      if (face == null) {
        _showError('No face detected. Please face the camera and try again.');
        return;
      }
      if (!svc.eyesOpen(face)) {
        _showError('Please keep your eyes open and try again.');
        return;
      }

      final liveEmbedding = await svc.getEmbedding(photo.path, face);
      if (liveEmbedding == null) {
        _showError('Could not read your face clearly. Please try again.');
        return;
      }

      final enrolled = await SupabaseService.fetchAllFaceEmbeddings();
      if (enrolled.isEmpty) {
        _showError('No staff have set up Face Punch yet. Ask admin.');
        return;
      }

      double bestSim = -1, secondSim = -1;
      String? bestId, bestName;
      for (final row in enrolled) {
        final sim = svc.cosineSimilarity(liveEmbedding, (row['embedding'] as List).cast<double>());
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
        _showError('Face not recognized. Please try again or contact admin.');
        return;
      }

      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final result = await SupabaseService.recordFacePunch(bestId, today);

      if (result['action'] == 'already_done') {
        _showError('$bestName has already punched in and out today.');
        return;
      }

      if (!mounted) return;
      setState(() {
        _stage = _Stage.success;
        _resultName = bestName;
        _resultAction = result['action'] as String;
        _resultTime = result['time'] as DateTime;
      });
      _scheduleReturn();
    } catch (e, st) {
      debugPrint('Face punch failed: $e\n$st');
      _showError('Error: $e');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    setState(() { _stage = _Stage.error; _message = message; });
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
    setState(() { _stage = _Stage.camera; _message = ''; });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.navyDark,
    body: SafeArea(
      child: switch (_stage) {
        _Stage.camera      => _buildCamera(),
        _Stage.processing  => _buildProcessing(),
        _Stage.success     => _buildSuccess(),
        _Stage.error       => _buildError(),
      },
    ),
  );

  Widget _buildCamera() {
    final controller = _controller;
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
              : ClipRRect(
                  borderRadius: BorderRadius.circular(200),
                  child: SizedBox(
                    width: 320, height: 320,
                    child: FittedBox(fit: BoxFit.cover, child: SizedBox(
                      width: controller.value.previewSize?.height ?? 320,
                      height: controller.value.previewSize?.width ?? 320,
                      child: CameraPreview(controller),
                    )),
                  ),
                ),
        ),
      ),
      Padding(
        padding: const EdgeInsets.all(32),
        child: GestureDetector(
          onTap: controller == null ? null : _capture,
          child: Container(
            width: 76, height: 76,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.amber,
              border: Border.all(color: Colors.white, width: 4),
            ),
            child: const Icon(Icons.camera_alt_rounded, color: AppColors.navyDark, size: 32),
          ),
        ),
      ),
    ]);
  }

  Widget _buildProcessing() => const Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      CircularProgressIndicator(color: Colors.white),
      SizedBox(height: 16),
      Text('Verifying...', style: TextStyle(color: Colors.white, fontSize: 15, fontFamily: 'Poppins')),
    ]),
  );

  Widget _buildSuccess() {
    final isIn = _resultAction == 'check_in';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 96, height: 96,
            decoration: const BoxDecoration(color: AppColors.green, shape: BoxShape.circle),
            child: const Icon(Icons.check_rounded, color: Colors.white, size: 56),
          ),
          const SizedBox(height: 24),
          Text(_resultName ?? '', textAlign: TextAlign.center, style: const TextStyle(
            color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
          const SizedBox(height: 8),
          Text(isIn ? 'Checked In' : 'Checked Out', style: const TextStyle(
            color: AppColors.amber, fontSize: 17, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
          const SizedBox(height: 4),
          Text(_resultTime != null ? DateFormat('h:mm:ss a').format(_resultTime!) : '', style: const TextStyle(
            color: Colors.white70, fontSize: 15, fontFamily: 'Poppins')),
        ]),
      ),
    );
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
        TextButton(
          onPressed: _retry,
          child: const Text('Try Again', style: TextStyle(color: AppColors.amber, fontSize: 15, fontWeight: FontWeight.w700)),
        ),
      ]),
    ),
  );
}
