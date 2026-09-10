# Model provenance and licensing

## mobilefacenet.tflite (face recognition embedding)

Already bundled prior to this note; original source/download not recorded
anywhere in this repo's history. MobileFaceNet as an architecture is
typically trained via InsightFace's training pipeline on MS1M/CASIA-WebFace
-family datasets, which InsightFace's own licensing states are for
non-commercial research use only (see
https://www.insightface.ai/solutions/face-recognition-licensing). Treat this
file's commercial-use status as **unverified/likely-restricted** until its
exact origin is tracked down. Accepted as a known risk for now (internal
school use, 2026-09-09 decision) - re-evaluate before any wider/commercial
rollout.

## spoof_model_scale_2_7.tflite / spoof_model_scale_4_0.tflite (liveness / anti-spoofing)

- **Source**: https://github.com/shubham0204/OnDevice-Face-Recognition-Android
  (`app/src/main/assets/spoof_model_scale_2_7.tflite`,
  `app/src/main/assets/spoof_model_scale_4_0.tflite`), downloaded 2026-09-09.
- **Upstream origin**: PyTorch weights from
  https://github.com/minivision-ai/Silent-Face-Anti-Spoofing (MiniFASNetV1SE /
  MiniFASNetV2, the dual-scale anti-spoofing models), converted to ONNX then
  TFLite by the shubham0204 repo (conversion notebook:
  `resources/Liveness_PT_Model_to_TF.ipynb` in that repo).
- **License**: both the upstream Silent-Face-Anti-Spoofing repo and the
  shubham0204 conversion repo are **Apache License 2.0** - permissive,
  explicitly allows commercial use and redistribution of the work (including
  model weights) with attribution. No dataset-provenance restriction like
  AdaFace/ArcFace's MS1M/WebFace-trained weights.
- **Inference contract** (see `FaceRecognitionService.livenessScore`): both
  models take an 80x80 BGR crop of the detected face, expanded to 2.7x and
  4.0x of the face bounding box respectively before resizing. Each outputs a
  3-class softmax; the two are averaged element-wise and argmax'd - class
  index 1 = real face. A real-class-probability floor
  (`kLivenessRealThreshold`) is applied on top of the bare argmax, since the
  reference implementation has none and an uncalibrated near-tie shouldn't
  count as a pass.
