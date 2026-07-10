import 'package:flutter/material.dart';
import '../../main.dart' show adminPanelUrl;

class S3Image extends StatelessWidget {
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

  // Vercel serves image bytes directly with CORS headers — no redirect, no XHR issues
  static String? imageUrl(String? key) {
    if (key == null || key.isEmpty) return null;
    return '$adminPanelUrl/api/s3/view-url?serve=1&key=${Uri.encodeComponent(key)}';
  }

  @override
  Widget build(BuildContext context) {
    final url = imageUrl(s3Key);
    if (url == null) return fallback(context);
    return Image.network(
      url,
      width:  width,
      height: height,
      fit:    fit,
      loadingBuilder: (_, child, progress) => progress == null
          ? child
          : SizedBox(
              width:  width,
              height: height,
              child:  const Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
      errorBuilder: (_, __, ___) => fallback(context),
    );
  }
}
