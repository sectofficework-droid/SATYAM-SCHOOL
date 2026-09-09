import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/supabase_service.dart';
import '../../routes/app_routes.dart';

// Reached after the admin PIN gate (kiosk_home_page.dart -> admin_pin_dialog.dart).
// Admin picks who to (re-)enroll from the real staff list instead of that
// staff member typing their own login - "Not Registered" for first-time
// setup, "Registered" for a re-scan (lighting kept failing them, grew a
// beard, etc). Both tabs land on the same capture screen; saveFaceEmbedding
// is a plain update either way.
class StaffEnrollListPage extends StatefulWidget {
  const StaffEnrollListPage({super.key});
  @override
  State<StaffEnrollListPage> createState() => _StaffEnrollListPageState();
}

class _StaffEnrollListPageState extends State<StaffEnrollListPage> {
  List<Map<String, dynamic>>? _staff;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _error = null; _staff = null; });
    try {
      final staff = await SupabaseService.fetchStaffForEnrollment();
      if (!mounted) return;
      setState(() => _staff = staff);
    } catch (e, st) {
      debugPrint('Failed to load staff enrollment list: $e\n$st');
      if (!mounted) return;
      setState(() => _error = 'Could not load staff list. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    child: Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Enroll Staff Face'),
        bottom: const TabBar(
          indicatorColor: AppColors.amber,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: [
            Tab(text: 'Not Registered'),
            Tab(text: 'Registered'),
          ],
        ),
      ),
      body: _buildBody(),
    ),
  );

  Widget _buildBody() {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textLight)),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: _load, child: const Text('Retry')),
          ]),
        ),
      );
    }
    if (_staff == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final unregistered = _staff!.where((s) => s['registered'] == false).toList();
    final registered   = _staff!.where((s) => s['registered'] == true).toList();
    return TabBarView(children: [
      _StaffList(staff: unregistered, emptyText: 'Every active staff member has a face registered.'),
      _StaffList(staff: registered, emptyText: 'No one has been enrolled yet.', onDeleted: _load),
    ]);
  }
}

class _StaffList extends StatelessWidget {
  const _StaffList({required this.staff, required this.emptyText, this.onDeleted});
  final List<Map<String, dynamic>> staff;
  final String emptyText;
  final VoidCallback? onDeleted;

  Future<void> _confirmDelete(BuildContext context, String id, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove Registered Face?'),
        content: Text('$name will need to be re-enrolled before Face Punch works for them again.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Remove', style: TextStyle(color: AppColors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await SupabaseService.deleteFaceEmbedding(id);
    onDeleted?.call();
  }

  @override
  Widget build(BuildContext context) {
    if (staff.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(emptyText, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textLight)),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: staff.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final s = staff[i];
        final registered = s['registered'] == true;
        return Material(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => Get.toNamed(Routes.kioskEnrollCapture, arguments: {
              'id':   s['id'] as String,
              'name': s['name'] as String? ?? 'Staff',
            }),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: registered ? AppColors.greenLight : AppColors.blueLight,
                  child: Icon(
                    registered ? Icons.how_to_reg_rounded : Icons.person_add_alt_1_rounded,
                    color: registered ? AppColors.green : AppColors.blue,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(s['name'] as String? ?? 'Staff',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.text)),
                ),
                Text(registered ? 'Re-scan' : 'Register',
                  style: const TextStyle(fontSize: 12, color: AppColors.textLight, fontWeight: FontWeight.w600)),
                if (registered)
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, color: AppColors.red, size: 20),
                    tooltip: 'Remove registered face',
                    onPressed: () => _confirmDelete(context, s['id'] as String, s['name'] as String? ?? 'This staff member'),
                  )
                else ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.textLight, size: 20),
                ],
              ]),
            ),
          ),
        );
      },
    );
  }
}
