import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../main.dart' show adminPanelUrl;

class S3Image extends StatefulWidget {
  final String? s3Key;
  final double  width;
  final double  height;
  final BoxFit  fit;
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
    _fetchUrl();
  }

  @override
  void didUpdateWidget(S3Image old) {
    super.didUpdateWidget(old);
    if (old.s3Key != widget.s3Key) {
      setState(() { _url = null; _failed = false; });
      _fetchUrl();
    }
  }

  Future<void> _fetchUrl() async {
    final key = widget.s3Key;
    if (key == null || key.isEmpty) {
      if (mounted) setState(() => _failed = true);
      return;
    }
    try {
      final res = await http.get(
        Uri.parse('$adminPanelUrl/api/s3/view-url?key=${Uri.encodeComponent(key)}'),
      ).timeout(const Duration(seconds: 15));
      if (res.statusCode == 200) {
        final url = (jsonDecode(res.body) as Map)['viewUrl'] as String?;
        if (url != null && mounted) {
          setState(() => _url = url);
          return;
        }
      }
      debugPrint('S3Image: view-url returned ${res.statusCode} for key=$key');
    } catch (e) {
      debugPrint('S3Image error: $e');
    }
    if (mounted) setState(() => _failed = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_failed)          return widget.fallback(context);
    if (_url == null) {
      return SizedBox(
        width:  widget.width,
        height: widget.height,
        child:  const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    return Image.network(
      _url!,
      width:   widget.width,
      height:  widget.height,
      fit:     widget.fit,
      errorBuilder: (_, __, ___) => widget.fallback(context),
    );
  }
}
