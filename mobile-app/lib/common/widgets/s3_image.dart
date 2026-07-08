import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../main.dart' show adminPanelUrl;

class S3Image extends StatelessWidget {
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

  static String? photoUrl(String? key) {
    if (key == null || key.isEmpty) return null;
    return '$adminPanelUrl/api/s3/photo?key=${Uri.encodeComponent(key)}';
  }

  @override
  Widget build(BuildContext context) {
    final url = photoUrl(s3Key);
    if (url == null) return fallback(context);
    return CachedNetworkImage(
      imageUrl:    url,
      width:       width,
      height:      height,
      fit:         fit,
      placeholder: (_, __) => SizedBox(
        width: width, height: height,
        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      errorWidget: (_, __, ___) => fallback(context),
    );
  }
}
