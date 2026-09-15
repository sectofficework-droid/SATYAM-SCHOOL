import 'dart:math' as math;
import 'dart:ui' show Rect;

import 'package:flutter/foundation.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

import '../utils/scan_trace.dart';

// On-device face-scan attendance: ML Kit locates/crops the face and reports
// eye-open probabilities (used for a cheap blink-liveness check); a bundled
// MobileFaceNet TFLite model (assets/models/mobilefacenet.tflite, 112x112
// RGB in, 192-d embedding out) turns the crop into a vector that's compared
// to the staff member's stored reference vector via cosine similarity. All
// of this — detection, embedding, matching — runs offline; nothing is sent
// to a server to identify who this is.
//
// Both face_punch_page's ~1s kiosk polling and face_enroll_capture_page's
// 25-shot enrollment sequence feed this from the SAME source: the most
// recent frame off a continuously running CameraController.startImageStream()
// (NV21, converted by nv21ToImage() below). This replaced an original
// still-photo design (CameraController.takePicture() per attempt) after
// takePicture() itself was measured taking 4-7 seconds per call on this
// app's camera (confirmed on both BlueStacks and the real kiosk tablet, and
// unaffected by flash mode, 3A lock, or swapping the native Android camera
// engine - see SESSION-2026-09-13-1 through -6 for the full history, first
// on face_punch_page, later carried over to face_enroll_capture_page too).
// A live preview frame is exactly what a still capture is NOT: already
// flowing continuously at the camera's native frame rate with no "capture a
// high-quality photo" round trip to wait on - which is also what makes the
// camera itself never need to stop/reinitialize between shots.
//
// One frame is decoded ONCE per attempt and the resulting img.Image is
// threaded through every stage below - detection, exposure/blur gating,
// liveness, embedding. The old still-photo path used to decode the same
// JPEG five separate times per ~1s poll, all synchronous Dart work on the
// main isolate; that was long enough to stall Flutter's own frame painting,
// which is what made the camera preview look "frozen" during a scan even
// though the native camera session was fine (SESSION-2026-09-13-1/2).
class FaceRecognitionService {
  FaceRecognitionService._();
  static final FaceRecognitionService instance = FaceRecognitionService._();

  // Cosine similarity a live punch embedding must clear against the stored
  // enrollment embedding to be accepted as a match. Was 0.75 (conservative
  // guess), lowered to 0.6 after real-device testing showed legitimate
  // staff getting false-rejected too often - then raised here to 0.72
  // after 0.6 turned out to let OTHER people match as the one enrolled
  // staff member (SESSION-2026-09-15, real-device testing with a single
  // enrollee): the correct person's own live score swung as wide as
  // 0.26-0.77 across consecutive frames of the same short attempt, so 0.6
  // sat squarely inside that spread - exactly where both a marginal
  // legitimate frame AND a false accept are most likely to land. 0.72
  // still clears every legitimate match actually observed that session
  // (best was 0.77) while cutting off the 0.5-0.6 band. This does trade
  // away some convenience - expect more retries for genuine staff until
  // enrollment quality/lighting variance is separately improved - and
  // still isn't independently verified against real impostor attempts
  // (no second enrolled staff member existed to test against). Retune
  // upward again if false accepts persist, downward if legitimate staff
  // start getting rejected too often.
  static const double kMatchThreshold = 0.72;

  static const int _inputSize = 112; // MobileFaceNet's expected crop size
  static const double _eyeOpenThreshold   = 0.4;
  static const double _eyeClosedThreshold = 0.35;

  // Minimum averaged real-face probability (see livenessScore) to accept a
  // punch as a live person rather than a photo/screen spoof. The upstream
  // reference implementation has no threshold beyond a bare argmax over 3
  // classes - this floor exists so a near-tie (e.g. 34% real vs 33%/33%
  // spoof classes) doesn't count as a pass. Was 0.6; lowered to 0.45 after
  // real-device testing showed legitimate live attempts getting rejected
  // too often - see assets/models/LICENSE_MODELS.md. Retune upward if
  // spoof attempts (photo/screen) start passing instead.
  static const double kLivenessRealThreshold = 0.45;
  static const int _livenessInputSize = 80; // MiniFASNet's expected crop size

  Interpreter? _interpreter;
  Interpreter? _livenessInterpreter27;
  Interpreter? _livenessInterpreter40;
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

  Future<Interpreter> _liveness27() async =>
      _livenessInterpreter27 ??= await Interpreter.fromAsset('assets/models/spoof_model_scale_2_7.tflite');

  Future<Interpreter> _liveness40() async =>
      _livenessInterpreter40 ??= await Interpreter.fromAsset('assets/models/spoof_model_scale_4_0.tflite');


  // Every heavy entry point below is wrapped in a ScanTrace.step so a single
  // scan attempt's cost shows up stage-by-stage in the log rather than as one
  // opaque "the camera froze". The wrappers are thin on purpose: the real
  // bodies are the untouched `_`-prefixed methods underneath them, so release
  // builds (where ScanTrace.step is a straight pass-through) run exactly the
  // code they ran before this instrumentation was added.

  // Converts one live-preview frame (NV21, single interleaved-VU plane -
  // request this via CameraController(..., imageFormatGroup:
  // ImageFormatGroup.nv21), which on Android makes camera_android_camerax
  // hand back a clean, already-destrided NV21 buffer rather than raw
  // YUV_420_888 planes with sensor-specific row padding to account for) into
  // an upright, RGB img.Image ready for the exposure/blur/liveness/embedding
  // stages below.
  //
  // [rotationDegrees] must be the SAME rotation passed to ML Kit's
  // InputImageMetadata for this frame (see face_punch_page.dart's
  // _sensorRotationDegrees) - ML Kit reports Face.boundingBox in the
  // rotated-to-upright coordinate space, so this image and that box only
  // line up if both were rotated the same way. [mirror] should be true for
  // a front camera - the sensor sees a mirror image of what the person
  // sees in the preview (which Android/CameraX mirror back for display),
  // and matching that here keeps left/right consistent with what a live
  // photo (takePicture, mirrored by the same camera) would have produced.
  //
  // Math is the standard BT.601 YUV->RGB conversion, full-pixel (no chroma
  // interpolation) - a 4:2:0 frame only has one U/V sample per 2x2 luma
  // block, so all 4 of those pixels use the same chroma sample. Plenty
  // accurate for face detection/recognition; this is not a photography
  // pipeline.
  img.Image nv21ToImage({
    required Uint8List nv21,
    required int width,
    required int height,
    required int rotationDegrees,
    required bool mirror,
  }) {
    final image = img.Image(width: width, height: height, numChannels: 3);
    final frameSize = width * height;
    for (var y = 0; y < height; y++) {
      final yRowStart = y * width;
      final uvRowStart = frameSize + (y >> 1) * width;
      for (var x = 0; x < width; x++) {
        final yValue = nv21[yRowStart + x] & 0xff;
        final uvIndex = uvRowStart + (x & ~1);
        final v = (nv21[uvIndex] & 0xff) - 128;
        final u = (nv21[uvIndex + 1] & 0xff) - 128;

        final r = (yValue + 1.370705 * v).round().clamp(0, 255);
        final g = (yValue - 0.337633 * u - 0.698001 * v).round().clamp(0, 255);
        final b = (yValue + 1.732446 * u).round().clamp(0, 255);
        image.setPixelRgb(x, y, r, g, b);
      }
    }

    var oriented = rotationDegrees == 0 ? image : img.copyRotate(image, angle: rotationDegrees);
    if (mirror) oriented = img.flipHorizontal(oriented);
    return oriented;
  }

  // Runs ML Kit directly on an already-built InputImage (from
  // InputImage.fromBytes - see face_punch_page.dart/
  // face_enroll_capture_page.dart) rather than reading+decoding a file. A
  // live stream frame already reflects the camera's continuously running
  // auto-exposure, and isExposureUnusable below remains as the independent
  // safety net for a genuinely bad frame either way. "Largest" detected
  // face wins when more than one is found, so a bystander in the
  // background can't accidentally get picked over the person actually
  // using the kiosk.
  Future<Face?> detectFaceFromInputImage(InputImage input) =>
      ScanTrace.instance.step('detectFaceFromInputImage', () => _detectFaceFromInputImage(input));

  Future<Face?> _detectFaceFromInputImage(InputImage input) async {
    final sw = Stopwatch()..start();
    final faces = await _faceDetector.processImage(input);
    ScanTrace.instance.log('MLKIT', 'processImage(stream) ${sw.elapsedMilliseconds}ms -> ${faces.length} face(s)');
    if (faces.isEmpty) return null;
    faces.sort((a, b) =>
        (b.boundingBox.width * b.boundingBox.height).compareTo(a.boundingBox.width * a.boundingBox.height));
    return faces.first;
  }

  Future<bool> isExposureUnusable(img.Image? decoded) =>
      ScanTrace.instance.step('isExposureUnusable', () => _isExposureUnusable(decoded));

  Future<bool> isTooBlurry(img.Image? decoded, Face face) =>
      ScanTrace.instance.step('isTooBlurry', () => _isTooBlurry(decoded, face));

  Future<double?> livenessScore(img.Image? decoded, Face face) =>
      ScanTrace.instance.step('livenessScore', () => _livenessScore(decoded, face));

  Future<List<double>?> getEmbedding(img.Image? decoded, Face face) =>
      ScanTrace.instance.step('getEmbedding', () => _getEmbedding(decoded, face));

  Future<void> preload() async {
    final sw = Stopwatch()..start();
    await _model();
    await _liveness27();
    await _liveness40();
    // ignore: unnecessary_statements
    _faceDetector;
    ScanTrace.instance.log('PRELOAD', 'models + detector ready in ${sw.elapsedMilliseconds}ms');
  }

  double _averageLuminance(img.Image image) {
    var sum = 0.0;
    var count = 0;
    const stride = 4; // sampling is plenty for an average, and far cheaper
                       // than visiting every pixel of a full-res photo
    for (var y = 0; y < image.height; y += stride) {
      for (var x = 0; x < image.width; x += stride) {
        sum += image.getPixel(x, y).luminance;
        count++;
      }
    }
    return count == 0 ? 128 : sum / count;
  }

  // A near-black or near-blown-out frame has lost real detail no amount of
  // downstream processing can restore, so past these points the honest
  // answer is "ask for another shot", not "quietly try to cope". Untested
  // against real staff yet; retune first if legitimate shots keep getting
  // rejected.
  static const double kMinUsableLuminance = 20.0;
  static const double kMaxUsableLuminance = 235.0;

  Future<bool> _isExposureUnusable(img.Image? decoded) async {
    if (decoded == null) return true; // unreadable - treat as unusable, not a free pass
    final lum = _averageLuminance(decoded);
    return lum < kMinUsableLuminance || lum > kMaxUsableLuminance;
  }

  // Below this Laplacian-variance-style sharpness score, a shot is too
  // blurry to trust for recognition/enrollment - a sharp image has high
  // local-contrast variance, a blurry/out-of-focus one is smooth and lands
  // well below this. Untested against real staff yet; retune first if
  // legitimate (if slightly soft) shots keep getting rejected.
  static const double kMinSharpnessVariance = 60.0;

  // Runs on [face]'s cropped region specifically, not the whole frame, so a
  // blurry background behind a sharp face doesn't wrongly reject a shot
  // that's actually fine to use.
  Future<bool> _isTooBlurry(img.Image? decoded, Face face) async {
    if (decoded == null) return true;

    final box = face.boundingBox;
    final x = box.left.clamp(0, decoded.width - 1).toInt();
    final y = box.top.clamp(0, decoded.height - 1).toInt();
    final w = box.width.clamp(1, decoded.width - x).toInt();
    final h = box.height.clamp(1, decoded.height - y).toInt();
    final crop = img.copyCrop(decoded, x: x, y: y, width: w, height: h);
    final gray = img.grayscale(crop);
    return _laplacianVariance(gray) < kMinSharpnessVariance;
  }

  // 4-neighbor discrete Laplacian (center*4 - up - down - left - right) as
  // a cheap stand-in for a full 3x3 Laplacian convolution - variance of
  // that response across the image is the sharpness score. Strided for the
  // same reason _averageLuminance is: plenty accurate for a pass/fail gate
  // without walking every pixel of a full-res crop.
  double _laplacianVariance(img.Image gray) {
    const stride = 2;
    final responses = <double>[];
    for (var y = 1; y < gray.height - 1; y += stride) {
      for (var x = 1; x < gray.width - 1; x += stride) {
        final c = gray.getPixel(x, y).luminance.toDouble();
        final u = gray.getPixel(x, y - 1).luminance.toDouble();
        final d = gray.getPixel(x, y + 1).luminance.toDouble();
        final l = gray.getPixel(x - 1, y).luminance.toDouble();
        final r = gray.getPixel(x + 1, y).luminance.toDouble();
        responses.add(4 * c - u - d - l - r);
      }
    }
    if (responses.isEmpty) return 0;
    final mean = responses.reduce((a, b) => a + b) / responses.length;
    final variance = responses.map((v) => (v - mean) * (v - mean)).reduce((a, b) => a + b) / responses.length;
    return variance;
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
  //
  // Histogram-equalizes the crop before it reaches the model (see
  // _normalizeLighting below) - this is what makes a punch taken in a dim
  // hallway comparable to an enrollment shot taken under bright office
  // light. Applied identically on both the enrollment and punch paths
  // (this one function serves both), so it doesn't bias the match either
  // way, just removes absolute-brightness differences before they can.
  Future<List<double>?> _getEmbedding(img.Image? decoded, Face face) async {
    if (decoded == null) return null;

    final box = face.boundingBox;
    final x = box.left.clamp(0, decoded.width - 1).toInt();
    final y = box.top.clamp(0, decoded.height - 1).toInt();
    final w = box.width.clamp(1, decoded.width - x).toInt();
    final h = box.height.clamp(1, decoded.height - y).toInt();

    final cropped = img.copyCrop(decoded, x: x, y: y, width: w, height: h);
    final resized = _normalizeLighting(img.copyResize(cropped, width: _inputSize, height: _inputSize));

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
    final sw = Stopwatch()..start();
    interpreter.run(input, output);
    ScanTrace.instance.log('TFLITE', 'mobilefacenet run ${sw.elapsedMilliseconds}ms');

    return _l2Normalize(output[0]);
  }

  // Liveness / anti-spoofing (MiniFASNet, dual-scale) - see
  // assets/models/LICENSE_MODELS.md for source/license/inference contract.
  // Two models look at the same detected face cropped/expanded at different
  // scales (2.7x and 4.0x of its bounding box, centered on it) - a printed
  // photo or phone/tablet screen shows different texture/moiré artifacts at
  // different crop scales than a real face does, which is what these models
  // are actually trained to pick up on (ML Kit's detectFaceFromInputImage
  // already answered "is there a face here", this answers "is it real").
  //
  // Returns the averaged real-face probability (compare against
  // kLivenessRealThreshold), or null if either crop/inference failed - kept
  // as a raw score rather than a bool so the caller can log/display it the
  // same way match similarity is handled, not hidden behind an opaque cutoff.
  Future<double?> _livenessScore(img.Image? decoded, Face face) async {
    if (decoded == null) return null;

    final p27 = await _runLivenessModel(await _liveness27(), decoded, face.boundingBox, 2.7);
    final p40 = await _runLivenessModel(await _liveness40(), decoded, face.boundingBox, 4.0);
    if (p27 == null || p40 == null) return null;

    // Upstream label convention: class index 1 = real face (0 and 2 are
    // different spoof-attack categories). Averaging the two scales' softmax
    // outputs before reading off the real-class slot matches
    // shubham0204/OnDevice-Face-Recognition-Android's combination logic
    // exactly - that's where these converted .tflite files came from.
    const realIndex = 1;
    return (p27[realIndex] + p40[realIndex]) / 2.0;
  }

  Future<List<double>?> _runLivenessModel(Interpreter interpreter, img.Image image, Rect box, double scale) async {
    final crop = _expandAndCrop(image, box, scale);
    if (crop == null) return null;
    final resized = img.copyResize(crop, width: _livenessInputSize, height: _livenessInputSize);

    // BGR, not RGB - these models expect BGR input (see
    // LICENSE_MODELS.md), unlike MobileFaceNet's RGB-normalized path above.
    // Raw 0-255 values, no /128 normalization - matches the reference
    // implementation's preprocessing.
    final input = List.generate(
      1,
      (_) => List.generate(
        _livenessInputSize,
        (yy) => List.generate(_livenessInputSize, (xx) {
          final p = resized.getPixel(xx, yy);
          return [p.b.toDouble(), p.g.toDouble(), p.r.toDouble()];
        }),
      ),
    );

    final output = List.generate(1, (_) => List.filled(3, 0.0));
    final sw = Stopwatch()..start();
    interpreter.run(input, output);
    ScanTrace.instance.log('TFLITE', 'minifasnet@$scale run ${sw.elapsedMilliseconds}ms');
    return _softmax(output[0]);
  }

  // Replicates Silent-Face-Anti-Spoofing's CropImage.crop: expand [box] to
  // scale x its own width/height around its own center, clamp the scale so
  // the expanded box can't exceed the source image, then SHIFT (not shrink)
  // any edge that still falls outside the image back into bounds. A subtly
  // wrong crop here wouldn't error, it would just silently feed the model a
  // differently-framed face than it was trained on - replicated faithfully
  // rather than approximated for that reason.
  img.Image? _expandAndCrop(img.Image image, Rect box, double scale) {
    final srcW = image.width, srcH = image.height;
    final boxW = box.width, boxH = box.height;
    if (boxW <= 0 || boxH <= 0) return null;

    final cappedScale = [scale, (srcH - 1) / boxH, (srcW - 1) / boxW].reduce(math.min);
    final cx = box.left + boxW / 2, cy = box.top + boxH / 2;
    final newW = boxW * cappedScale, newH = boxH * cappedScale;

    var left = cx - newW / 2, top = cy - newH / 2;
    var right = cx + newW / 2, bottom = cy + newH / 2;

    if (left < 0)      { right  -= left; left   = 0; }
    if (top < 0)       { bottom -= top;  top    = 0; }
    if (right > srcW)  { left   -= (right - srcW);  right  = srcW.toDouble(); }
    if (bottom > srcH) { top    -= (bottom - srcH); bottom = srcH.toDouble(); }
    left = left.clamp(0, srcW - 1);
    top  = top.clamp(0, srcH - 1);

    final cropX = left.round();
    final cropY = top.round();
    final cropW = (right - left).round().clamp(1, srcW - cropX);
    final cropH = (bottom - top).round().clamp(1, srcH - cropY);
    return img.copyCrop(image, x: cropX, y: cropY, width: cropW, height: cropH);
  }

  List<double> _softmax(List<double> logits) {
    final maxVal = logits.reduce(math.max);
    final exps = logits.map((x) => math.exp(x - maxVal)).toList();
    final sum = exps.reduce((a, b) => a + b);
    return exps.map((x) => x / sum).toList();
  }

  // Spreads the crop's luminance histogram into full [0, 255] range in HSL
  // color mode (stretches lightness, leaves hue/saturation alone) so a
  // washed-out low-light shot and a well-lit one land in roughly the same
  // brightness/contrast neighborhood before the model ever sees them.
  // Plain per-pixel brightness math (e.g. a flat gamma bump) doesn't do
  // this - it shifts everything by the same amount instead of correcting
  // for how compressed the dynamic range already is.
  img.Image _normalizeLighting(img.Image face) =>
      img.histogramEqualization(face, mode: img.HistogramEqualizeMode.color);

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

}
