import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../main.dart' show adminPanelUrl;

// Mirrors the admin panel's S3Image component.
// Takes an S3 key (e.g. "students/abc.jpg"), fetches a presigned URL
// from the admin panel API, then displays the image.
class S3Image extends StatefulWidget {
  final String? s3Key;
  final double width;
  final double height;
  final BoxFit fit;
  final Widget Function(BuildContext) fallback;

  const S3Image({
    super.key,
    required this.s3Key,
    required this.width,
    required this.height,
    this.fit = BoxFit.cover,
    required this.fallback,
  });

  @override
  State<S3Image> createState() => _S3ImageState();
}

class _S3ImageState extends State<S3Image> {
  String? _url;
  bool    _failed = false;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void didUpdateWidget(S3Image old) {
    super.didUpdateWidget(old);
    if (old.s3Key != widget.s3Key) { _url = null; _failed = false; _resolve(); }
  }

  Future<void> _resolve() async {
    final key = widget.s3Key;
    if (key == null || key.isEmpty) { setState(() => _failed = true); return; }
    try {
      final uri = Uri.parse('$adminPanelUrl/api/s3/view-url?key=${Uri.encodeComponent(key)}');
      final res = await http.get(uri).timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        if (mounted) setState(() => _url = data['viewUrl'] as String?);
        return;
      }
    } catch (_) {}
    if (mounted) setState(() => _failed = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_failed || _url == null) return widget.fallback(context);
    return Image.network(
      _url!,
      width:  widget.width,
      height: widget.height,
      fit:    widget.fit,
      errorBuilder: (_, __, ___) => widget.fallback(context),
    );
  }
}
