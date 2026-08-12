import 'dart:io';
import 'dart:math' as math;

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

// On-device face-scan attendance: ML Kit locates/crops the face and reports
// eye-open probabilities (used for a cheap blink-liveness check); a bundled
// MobileFaceNet TFLite model (assets/models/mobilefacenet.tflite, 112x112
// RGB in, 192-d embedding out) turns the crop into a vector that's compared
// to the staff member's stored reference vector via cosine similarity. All
// of this — detection, embedding, matching — runs offline; nothing is sent
// to a server to identify who this is.
//
// Deliberately still-photo based (CameraController.takePicture(), then
// InputImage.fromFilePath / img.decodeImage on the JPEG) rather than a live
// CameraImage frame stream: ML Kit + the `image` package both handle JPEG
// EXIF orientation for you, whereas raw camera frames need manual
// YUV420->RGB conversion and sensor-rotation math that's easy to get subtly
// wrong and impossible to verify without a physical device in hand. A still
// photo per attempt is a small UX cost for a lot more reliability.
class FaceRecognitionService {
  FaceRecognitionService._();
  static final FaceRecognitionService instance = FaceRecognitionService._();

  // Cosine similarity a live punch embedding must clear against the stored
  // enrollment embedding to be accepted as a match. Started conservative;
  // this is the number to retune first if real staff get false
  // rejects/accepts once this is actually used on real devices.
  static const double kMatchThreshold = 0.75;

  static const int _inputSize = 112; // MobileFaceNet's expected crop size
  static const double _eyeOpenThreshold   = 0.4;
  static const double _eyeClosedThreshold = 0.35;

  Interpreter? _interpreter;
  FaceDetector? _detector;

  FaceDetector get _faceDetector => _detector ??= FaceDetector(
    options: FaceDetectorOptions(
      performanceMode: FaceDetectorMode.accurate,
      enableClassification: true, // needed for eye-open probabilities
      enableLandmarks: false,
      enableContours: false,
      minFaceSize: 0.2,
    ),
  );

  Future<Interpreter> _model() async =>
      _interpreter ??= await Interpreter.fromAsset('assets/models/mobilefacenet.tflite');

  Future<void> preload() async {
    await _model();
    // ignore: unnecessary_statements
    _faceDetector;
  }

  // Returns the largest detected face in the photo at [imagePath], or null
  // if no face was found. "Largest" so a bystander in the background of a
  // punch selfie can't accidentally get picked over the person actually
  // taking it.
  Future<Face?> detectSingleFace(String imagePath) async {
    final input = InputImage.fromFilePath(imagePath);
    final faces = await _faceDetector.processImage(input);
    if (faces.isEmpty) return null;
    faces.sort((a, b) =>
        (b.boundingBox.width * b.boundingBox.height).compareTo(a.boundingBox.width * a.boundingBox.height));
    return faces.first;
  }

  bool eyesOpen(Face face) {
    final l = face.leftEyeOpenProbability, r = face.rightEyeOpenProbability;
    if (l == null || r == null) return false;
    return l > _eyeOpenThreshold && r > _eyeOpenThreshold;
  }

  bool eyesClosed(Face face) {
    final l = face.leftEyeOpenProbability, r = face.rightEyeOpenProbability;
    if (l == null || r == null) return false;
    return l < _eyeClosedThreshold && r < _eyeClosedThreshold;
  }

  // Crops [face]'s bounding box out of the photo at [imagePath], resizes it
  // to what MobileFaceNet expects, and returns its L2-normalized 192-d
  // embedding. Null if the file can't be decoded.
  Future<List<double>?> getEmbedding(String imagePath, Face face) async {
    final bytes = await File(imagePath).readAsBytes();
    var image = img.decodeImage(bytes);
    if (image == null) return null;
    image = img.bakeOrientation(image); // apply EXIF rotation so crop coords match ML Kit's

    final box = face.boundingBox;
    final x = box.left.clamp(0, image.width - 1).toInt();
    final y = box.top.clamp(0, image.height - 1).toInt();
    final w = box.width.clamp(1, image.width - x).toInt();
    final h = box.height.clamp(1, image.height - y).toInt();

    final cropped = img.copyCrop(image, x: x, y: y, width: w, height: h);
    final resized = img.copyResize(cropped, width: _inputSize, height: _inputSize);

    final input = List.generate(
      1,
      (_) => List.generate(
        _inputSize,
        (yy) => List.generate(_inputSize, (xx) {
          final p = resized.getPixel(xx, yy);
          return [
            (p.r - 127.5) / 128.0,
            (p.g - 127.5) / 128.0,
            (p.b - 127.5) / 128.0,
          ];
        }),
      ),
    );

    const embeddingSize = 192;
    final output = List.generate(1, (_) => List.filled(embeddingSize, 0.0));

    final interpreter = await _model();
    interpreter.run(input, output);

    return _l2Normalize(output[0]);
  }

  List<double> _l2Normalize(List<double> v) {
    var sumSq = 0.0;
    for (final x in v) {
      sumSq += x * x;
    }
    final norm = math.sqrt(sumSq);
    if (norm == 0) return v;
    return v.map((x) => x / norm).toList();
  }

  double cosineSimilarity(List<double> a, List<double> b) {
    if (a.length != b.length) return -1;
    var dot = 0.0, normA = 0.0, normB = 0.0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA == 0 || normB == 0) return -1;
    return dot / (math.sqrt(normA) * math.sqrt(normB));
  }

  // Averages several enrollment shots into one reference embedding, then
  // re-normalizes - more robust than trusting any single shot's lighting/angle.
  List<double> averageEmbeddings(List<List<double>> embeddings) {
    final size = embeddings.first.length;
    final avg = List.filled(size, 0.0);
    for (final e in embeddings) {
      for (var i = 0; i < size; i++) {
        avg[i] += e[i] / embeddings.length;
      }
    }
    return _l2Normalize(avg);
  }
}
