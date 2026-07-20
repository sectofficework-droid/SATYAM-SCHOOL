import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/notice_card.dart';
import '../../../../common/widgets/notice_type_filter.dart';

class StudentNoticesPage extends StatefulWidget {
  final bool embedded;
  const StudentNoticesPage({super.key, this.embedded = false});
  @override
  State<StudentNoticesPage> createState() => _StudentNoticesPageState();
}

class _StudentNoticesPageState extends State<StudentNoticesPage> {
  List<Map<String, dynamic>> _notices = [];
  String _typeFilter = 'All';
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    // A student should see notices meant for students, plus anything meant
    // for everyone - not notices aimed only at staff/management.
    final notices = await SupabaseService.fetchNotices(
      audiences: const ['Everyone', 'All Students', 'Parents'],
    );
    setState(() { _notices = notices; _loading = false; });
  }

  List<Map<String, dynamic>> get _filtered => _typeFilter == 'All'
      ? _notices
      : _notices.where((n) => n['type'] == _typeFilter).toList();

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final listArea = _loading
        ? const Center(child: CircularProgressIndicator())
        : filtered.isEmpty
            ? const Center(child: Text('No notices.', style: TextStyle(color: AppColors.textLight)))
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => NoticeCard(notice: filtered[i]),
                ),
              );

    final body = Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: NoticeTypeFilter(
          selected: _typeFilter,
          onChanged: (t) => setState(() => _typeFilter = t),
        ),
      ),
      Expanded(child: listArea),
    ]);

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Notices'),
      ),
      body: body,
    );
  }
}
