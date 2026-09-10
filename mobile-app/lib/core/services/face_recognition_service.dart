import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' show Rect;

import 'package:flutter/foundation.dart';
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

  // Minimum averaged real-face probability (see livenessScore) to accept a
  // punch as a live person rather than a photo/screen spoof. The upstream
  // reference implementation has no threshold beyond a bare argmax over 3
  // classes - this floor exists so a near-tie (e.g. 34% real vs 33%/33%
  // spoof classes) doesn't count as a pass. Untested against real spoof
  // attempts yet; this is the number to retune first once that testing
  // happens - see assets/models/LICENSE_MODELS.md.
  static const double kLivenessRealThreshold = 0.6;
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

  Future<void> preload() async {
    await _model();
    await _liveness27();
    await _liveness40();
    // ignore: unnecessary_statements
    _faceDetector;
  }

  // Returns the largest detected face in the photo at [imagePath], or null
  // if no face was found. "Largest" so a bystander in the background of a
  // punch selfie can't accidentally get picked over the person actually
  // taking it.
  //
  // Detection runs on an exposure-corrected copy when the shot is badly
  // over/underexposed (see _exposureCorrectedCopy) - a washed-out
  // highlight or a near-black frame both erase the contrast a detector
  // needs to find facial contours at all, regardless of how good the
  // detector otherwise is. The correction only changes pixel brightness,
  // never geometry, so the returned Face's boundingBox is still valid
  // pixel coordinates against the original file for getEmbedding to crop.
  Future<Face?> detectSingleFace(String imagePath) async {
    final correctedPath = await _exposureCorrectedCopy(imagePath);
    try {
      final input = InputImage.fromFilePath(correctedPath ?? imagePath);
      final faces = await _faceDetector.processImage(input);
      if (faces.isEmpty) return null;
      faces.sort((a, b) =>
          (b.boundingBox.width * b.boundingBox.height).compareTo(a.boundingBox.width * a.boundingBox.height));
      return faces.first;
    } finally {
      if (correctedPath != null) {
        try { await File(correctedPath).delete(); } catch (_) {}
      }
    }
  }

  // Null (use the original photo as-is) unless the shot is bright/dark
  // enough that a detector would plausibly struggle with it, in which case
  // returns the path to a gamma-corrected copy. Any failure here (decode
  // error, disk full, whatever) just falls back to the original file
  // rather than blocking detection entirely.
  Future<String?> _exposureCorrectedCopy(String imagePath) async {
    try {
      final bytes = await File(imagePath).readAsBytes();
      var image = img.decodeImage(bytes);
      if (image == null) return null;
      image = img.bakeOrientation(image);

      final gamma = _exposureGammaFor(image);
      if (gamma == null) return null;

      final corrected = img.adjustColor(image, gamma: gamma);
      final correctedPath = '$imagePath.exposure.jpg';
      await File(correctedPath).writeAsBytes(img.encodeJpg(corrected, quality: 90));
      return correctedPath;
    } catch (e) {
      debugPrint('Exposure correction skipped: $e');
      return null;
    }
  }

  // Gamma > 1 darkens (recovers a blown-out highlight back into a
  // detectable range); gamma < 1 brightens (pulls a near-black frame up).
  // Untested against real staff yet - if detection still fails at the
  // extremes, or starts mis-firing in normal light, these thresholds/gamma
  // values are the first thing to retune.
  double? _exposureGammaFor(img.Image image) {
    final meanLuminance = _averageLuminance(image);
    if (meanLuminance > 190) return 1.8;
    if (meanLuminance < 55) return 0.6;
    return null;
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

  // Hard reject bounds, distinct from _exposureGammaFor's soft-correct
  // range above - a near-black or near-blown-out frame has lost real detail
  // that gamma correction can only stretch, not restore, so past these
  // points the honest answer is "ask for another shot", not "quietly patch
  // it up and hope the detector/recognizer copes". Untested against real
  // staff yet; retune first if legitimate shots keep getting rejected.
  static const double kMinUsableLuminance = 20.0;
  static const double kMaxUsableLuminance = 235.0;

  Future<bool> isExposureUnusable(String imagePath) async {
    final bytes = await File(imagePath).readAsBytes();
    final image = img.decodeImage(bytes);
    if (image == null) return true; // unreadable - treat as unusable, not a free pass
    final lum = _averageLuminance(image);
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
  Future<bool> isTooBlurry(String imagePath, Face face) async {
    final bytes = await File(imagePath).readAsBytes();
    var image = img.decodeImage(bytes);
    if (image == null) return true;
    image = img.bakeOrientation(image);

    final box = face.boundingBox;
    final x = box.left.clamp(0, image.width - 1).toInt();
    final y = box.top.clamp(0, image.height - 1).toInt();
    final w = box.width.clamp(1, image.width - x).toInt();
    final h = box.height.clamp(1, image.height - y).toInt();
    final crop = img.copyCrop(image, x: x, y: y, width: w, height: h);
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
    interpreter.run(input, output);

    return _l2Normalize(output[0]);
  }

  // Liveness / anti-spoofing (MiniFASNet, dual-scale) - see
  // assets/models/LICENSE_MODELS.md for source/license/inference contract.
  // Two models look at the same detected face cropped/expanded at different
  // scales (2.7x and 4.0x of its bounding box, centered on it) - a printed
  // photo or phone/tablet screen shows different texture/moiré artifacts at
  // different crop scales than a real face does, which is what these models
  // are actually trained to pick up on (ML Kit's detectSingleFace already
  // answered "is there a face here", this answers "is it real").
  //
  // Returns the averaged real-face probability (compare against
  // kLivenessRealThreshold), or null if either crop/inference failed - kept
  // as a raw score rather than a bool so the caller can log/display it the
  // same way match similarity is handled, not hidden behind an opaque cutoff.
  Future<double?> livenessScore(String imagePath, Face face) async {
    final bytes = await File(imagePath).readAsBytes();
    var image = img.decodeImage(bytes);
    if (image == null) return null;
    image = img.bakeOrientation(image);

    final p27 = await _runLivenessModel(await _liveness27(), image, face.boundingBox, 2.7);
    final p40 = await _runLivenessModel(await _liveness40(), image, face.boundingBox, 4.0);
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
    interpreter.run(input, output);
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
