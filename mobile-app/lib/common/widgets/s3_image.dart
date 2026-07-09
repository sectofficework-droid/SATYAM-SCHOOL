import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
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
  String? _viewUrl;
  bool    _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(S3Image old) {
    super.didUpdateWidget(old);
    if (old.s3Key != widget.s3Key) {
      setState(() { _viewUrl = null; _failed = false; });
      _load();
    }
  }

  Future<void> _load() async {
    final key = widget.s3Key;
    if (key == null || key.isEmpty) {
      if (mounted) setState(() => _failed = true);
      return;
    }
    try {
      final uri = Uri.parse(
        '$adminPanelUrl/api/s3/view-url?key=${Uri.encodeComponent(key)}',
      );
      final res = await http.get(uri).timeout(const Duration(seconds: 15));
      if (res.statusCode == 200) {
        final url = (jsonDecode(res.body) as Map)['viewUrl'] as String?;
        if (url != null && mounted) {
          setState(() => _viewUrl = url);
          return;
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _failed = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_failed)         return widget.fallback(context);
    if (_viewUrl == null) {
      return SizedBox(
        width: widget.width, height: widget.height,
        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    return CachedNetworkImage(
      imageUrl:    _viewUrl!,
      width:       widget.width,
      height:      widget.height,
      fit:         widget.fit,
      errorWidget: (_, __, ___) => widget.fallback(context),
    );
  }
}
