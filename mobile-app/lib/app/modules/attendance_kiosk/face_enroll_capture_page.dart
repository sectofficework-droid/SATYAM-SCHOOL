import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/face_recognition_service.dart';
import '../../../core/services/supabase_service.dart';
import '../../routes/app_routes.dart';

enum _Stage { camera, saving, success, error }

// Captures 3 shots for whoever just authenticated on FaceEnrollLoginPage,
// averages their embeddings into one reference vector (steadier than
// trusting a single shot's lighting/angle), and saves it. Re-running this
// (e.g. staff grew a beard, lighting keeps failing them) just overwrites
// the old embedding - saveFaceEmbedding is a plain update, not append.
class FaceEnrollCapturePage extends StatefulWidget {
  const FaceEnrollCapturePage({super.key});
  @override
  State<FaceEnrollCapturePage> createState() => _FaceEnrollCapturePageState();
}

class _FaceEnrollCapturePageState extends State<FaceEnrollCapturePage> {
  static const _totalShots = 3;

  late final String _employeeId;
  late final String _employeeName;

  CameraController? _controller;
  _Stage _stage = _Stage.camera;
  String _message = '';
  final List<List<double>> _embeddings = [];

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
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _capture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized || _employeeId.isEmpty) return;
    setState(() { _message = ''; });

    try {
      final photo = await controller.takePicture();
      final svc = FaceRecognitionService.instance;

      final face = await svc.detectSingleFace(photo.path);
      if (face == null) {
        setState(() => _message = 'No face detected - please face the camera and try again.');
        return;
      }
      if (!svc.eyesOpen(face)) {
        setState(() => _message = 'Keep your eyes open and try again.');
        return;
      }

      final embedding = await svc.getEmbedding(photo.path, face);
      if (embedding == null) {
        setState(() => _message = 'Could not read your face clearly - try again.');
        return;
      }

      _embeddings.add(embedding);

      if (_embeddings.length < _totalShots) {
        setState(() {});
        return;
      }

      setState(() => _stage = _Stage.saving);
      final reference = svc.averageEmbeddings(_embeddings);
      await SupabaseService.saveFaceEmbedding(_employeeId, reference);
      if (!mounted) return;
      setState(() => _stage = _Stage.success);
      Timer(const Duration(seconds: 3), () { if (mounted) Get.until((r) => r.settings.name == Routes.kioskHome); });
    } catch (e) {
      setState(() => _message = 'Something went wrong - please try again.');
    }
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
    return Column(children: [
      Align(
        alignment: Alignment.topLeft,
        child: IconButton(icon: const Icon(Icons.close_rounded, color: Colors.white70), onPressed: () => Get.back()),
      ),
      Text('Shot $shotNo of $_totalShots', style: const TextStyle(
        color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
      const SizedBox(height: 4),
      const Text('Look straight at the camera', style: TextStyle(color: Colors.white60, fontSize: 13, fontFamily: 'Poppins')),
      const SizedBox(height: 16),
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
      if (_message.isNotEmpty) Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 8),
        child: Text(_message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.amber, fontSize: 13)),
      ),
      Padding(
        padding: const EdgeInsets.all(32),
        child: GestureDetector(
          onTap: controller == null ? null : _capture,
          child: Container(
            width: 76, height: 76,
            decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.amber, border: Border.all(color: Colors.white, width: 4)),
            child: const Icon(Icons.camera_alt_rounded, color: AppColors.navyDark, size: 32),
          ),
        ),
      ),
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
