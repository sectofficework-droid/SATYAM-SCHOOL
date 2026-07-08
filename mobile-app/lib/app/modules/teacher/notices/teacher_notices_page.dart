import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/notice_card.dart';

class TeacherNoticesPage extends StatefulWidget {
  final bool embedded;
  const TeacherNoticesPage({super.key, this.embedded = false});
  @override
  State<TeacherNoticesPage> createState() => _TeacherNoticesPageState();
}

class _TeacherNoticesPageState extends State<TeacherNoticesPage> {
  List<Map<String, dynamic>> _notices = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final notices = await SupabaseService.fetchNotices();
    setState(() { _notices = notices; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator())
        : _notices.isEmpty
            ? const Center(child: Text('No notices.', style: TextStyle(color: AppColors.textLight)))
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _notices.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => NoticeCard(notice: _notices[i]),
                ),
              );

    if (widget.embedded) return body;
    return Scaffold(appBar: AppBar(title: const Text('Notices')), body: body);
  }
}
