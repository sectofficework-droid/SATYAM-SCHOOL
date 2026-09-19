import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';
import 'admin_attendance_page.dart';
import 'admin_punch_code_page.dart';
import 'admin_inventory_page.dart';
import 'admin_notices_page.dart';
import 'admin_queries_page.dart';
import 'admin_documents_page.dart';
import 'admin_syllabus_requests_page.dart';
import 'admin_syllabus_page.dart';
import 'admin_tasks_page.dart';
import 'admin_students_page.dart';
import 'admin_employees_page.dart';
import 'admin_fees_page.dart';
import 'admin_expenses_page.dart';
import 'admin_gr_book_page.dart';
import 'admin_users_roles_page.dart';
import 'admin_salary_page.dart';

// Admin Workspace home — full admin-web parity, phase 2 (2026-09-19: user
// asked for a richer dashboard + full feature parity, not the phase-1
// flat module list). Shown when the logged-in employee is linked to an
// admin_users row. Two placements, both driven from TeacherHome
// (STAFF-APP-DESIGN-FIXED.md §4): a Teacher+Admin combo gets this as an
// extra tab; a non-teaching (admin-only) linked account gets this as
// their entire app instead of the Teacher tabs. Always `embedded: true`
// in both cases so TeacherHome's single AppBar is the only header shown.
class AdminWorkspaceHome extends StatefulWidget {
  final bool embedded;
  const AdminWorkspaceHome({super.key, this.embedded = false});
  @override
  State<AdminWorkspaceHome> createState() => _AdminWorkspaceHomeState();
}

class _AdminWorkspaceHomeState extends State<AdminWorkspaceHome> {
  Map<String, dynamic>? _summary;
  bool _loading = true;
  String? _error;

  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  String get _name => AuthService.to.profile.value?['name'] as String? ?? 'Admin';
  String get _tier => (AuthService.to.profile.value?['admin_role'] as Map?)?['tier'] as String? ?? '';
  bool get _isSeniorOrMgmt => _tier == 'senior_admin' || _tier == 'management';
  bool get _isMgmt => _tier == 'management';

  static const _tierLabels = {'management': 'Management Head', 'senior_admin': 'Senior Admin', 'normal_admin': 'Admin'};

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final summary = await StaffAdminService.dashboardSummary(_employeeId);
      if (mounted) setState(() { _summary = summary; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load dashboard.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final body = RefreshIndicator(
      color: AppColors.navy,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _HeroHeader(name: _name, tierLabel: _tierLabels[_tier] ?? _tier),
          const SizedBox(height: 18),
          if (_loading) const Padding(padding: EdgeInsets.only(top: 24), child: AdminLoading())
          else if (_error != null) AdminErrorState(message: _error!, onRetry: _load)
          else _SummaryGrid(summary: _summary!),
          const SizedBox(height: 24),

          _SectionHeader(icon: Icons.groups_rounded, color: AppColors.blue, title: 'People'),
          const SizedBox(height: 10),
          _ModuleGrid(tiles: [
            _Tile('Students', Icons.school_rounded, AppColors.blue, AppColors.blueLight, () => Get.to(() => const AdminStudentsPage())),
            _Tile('Employees', Icons.badge_rounded, AppColors.teal, AppColors.tealLight, () => Get.to(() => const AdminEmployeesPage())),
            _Tile('Attendance', Icons.fact_check_rounded, AppColors.indigo, AppColors.indigoLight, () => Get.to(() => const AdminAttendancePage())),
            _Tile('Punch Code', Icons.qr_code_2_rounded, AppColors.amber, AppColors.amberLight, () => Get.to(() => const AdminPunchCodePage())),
          ]),
          const SizedBox(height: 22),

          _SectionHeader(icon: Icons.menu_book_rounded, color: AppColors.green, title: 'Academic'),
          const SizedBox(height: 10),
          _ModuleGrid(tiles: [
            _Tile('Syllabus', Icons.auto_stories_rounded, AppColors.green, AppColors.greenLight, () => Get.to(() => const AdminSyllabusPage())),
            if (_isSeniorOrMgmt)
              _Tile('Syllabus Requests', Icons.rule_rounded, AppColors.green, AppColors.greenLight, () => Get.to(() => const AdminSyllabusRequestsPage())),
            _Tile('GR Book', Icons.book_rounded, AppColors.cyan, AppColors.cyanLight, () => Get.to(() => const AdminGrBookPage())),
            _Tile('Question Papers', Icons.description_rounded, AppColors.purple, AppColors.purpleLight, () => Get.to(() => const AdminDocumentsPage())),
          ]),
          const SizedBox(height: 22),

          _SectionHeader(icon: Icons.account_balance_wallet_rounded, color: AppColors.orange, title: 'Finance'),
          const SizedBox(height: 10),
          _ModuleGrid(tiles: [
            _Tile('Fees', Icons.receipt_long_rounded, AppColors.orange, AppColors.orangeLight, () => Get.to(() => const AdminFeesPage())),
            _Tile('Expenses', Icons.money_off_rounded, AppColors.red, AppColors.redLight, () => Get.to(() => const AdminExpensesPage())),
            if (_isMgmt)
              _Tile('Salary', Icons.payments_rounded, AppColors.green, AppColors.greenLight, () => Get.to(() => const AdminSalaryPage())),
          ]),
          const SizedBox(height: 22),

          _SectionHeader(icon: Icons.build_rounded, color: AppColors.pink, title: 'Operations'),
          const SizedBox(height: 10),
          _ModuleGrid(tiles: [
            _Tile('Inventory', Icons.inventory_2_rounded, AppColors.teal, AppColors.tealLight, () => Get.to(() => const AdminInventoryPage())),
            _Tile('Notices', Icons.campaign_rounded, AppColors.purple, AppColors.purpleLight, () => Get.to(() => const AdminNoticesPage())),
            _Tile('Queries', Icons.forum_rounded, AppColors.pink, AppColors.pinkLight, () => Get.to(() => const AdminQueriesPage())),
            _Tile('Tasks', Icons.task_alt_rounded, AppColors.orange, AppColors.orangeLight, () => Get.to(() => const AdminTasksPage())),
          ]),

          if (_isSeniorOrMgmt) ...[
            const SizedBox(height: 22),
            _SectionHeader(icon: Icons.admin_panel_settings_rounded, color: AppColors.navy, title: 'Administration'),
            const SizedBox(height: 10),
            _ModuleGrid(tiles: [
              _Tile('Users & Roles', Icons.manage_accounts_rounded, AppColors.navy, AppColors.blueLight, () => Get.to(() => const AdminUsersRolesPage())),
            ]),
          ],
        ],
      ),
    );

    if (widget.embedded) return body;
    return Scaffold(appBar: const AdminAppBar(title: 'Admin Workspace'), body: body);
  }
}

class _HeroHeader extends StatelessWidget {
  final String name;
  final String tierLabel;
  const _HeroHeader({required this.name, required this.tierLabel});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(gradient: AppColors.navyGradient, borderRadius: BorderRadius.circular(20), boxShadow: AppShadows.card),
    child: Row(children: [
      Container(width: 50, height: 50,
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: .15), shape: BoxShape.circle),
        child: const Icon(Icons.shield_rounded, color: Colors.white, size: 26)),
      const SizedBox(width: 14),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Welcome back', style: TextStyle(color: Colors.white.withValues(alpha: .7), fontSize: 12)),
        Text(name, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: .18), borderRadius: BorderRadius.circular(20)),
          child: Text(tierLabel, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
        ),
      ])),
    ]),
  );
}

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  const _SectionHeader({required this.icon, required this.color, required this.title});
  @override
  Widget build(BuildContext context) => Row(children: [
    Icon(icon, size: 18, color: color),
    const SizedBox(width: 8),
    Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.text)),
  ]);
}

class _Tile {
  final String title;
  final IconData icon;
  final Color color;
  final Color light;
  final VoidCallback onTap;
  _Tile(this.title, this.icon, this.color, this.light, this.onTap);
}

class _ModuleGrid extends StatelessWidget {
  final List<_Tile> tiles;
  const _ModuleGrid({required this.tiles});
  @override
  Widget build(BuildContext context) => GridView.count(
    crossAxisCount: 2,
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    mainAxisSpacing: 10,
    crossAxisSpacing: 10,
    childAspectRatio: 2.4,
    children: tiles.map((t) => Material(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: t.onTap,
        child: Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), boxShadow: AppShadows.card),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(children: [
            Container(width: 38, height: 38,
              decoration: BoxDecoration(color: t.light, borderRadius: BorderRadius.circular(11)),
              child: Icon(t.icon, color: t.color, size: 19)),
            const SizedBox(width: 10),
            Expanded(child: Text(t.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: AppColors.text), maxLines: 2)),
          ]),
        ),
      ),
    )).toList(),
  );
}

class _SummaryGrid extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _SummaryGrid({required this.summary});
  @override
  Widget build(BuildContext context) {
    final items = [
      ('Classes Marked Today', summary['classesMarkedToday'], Icons.class_rounded, AppColors.blue, AppColors.blueLight),
      ('Pending Attendance Edits', summary['pendingAttendanceEdits'], Icons.edit_calendar_rounded, AppColors.amber, AppColors.amberLight),
      ('Open Queries', summary['openQueries'], Icons.forum_rounded, AppColors.pink, AppColors.pinkLight),
      ('Active Notices', summary['activeNotices'], Icons.campaign_rounded, AppColors.purple, AppColors.purpleLight),
      ('Open Tasks', summary['openTasks'], Icons.task_alt_rounded, AppColors.orange, AppColors.orangeLight),
    ];
    return SizedBox(
      height: 138,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final it = items[i];
          return Container(
            width: 140,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), boxShadow: AppShadows.card,
              border: Border(top: BorderSide(color: it.$4, width: 3))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Container(width: 32, height: 32,
                decoration: BoxDecoration(color: it.$5, borderRadius: BorderRadius.circular(9)),
                child: Icon(it.$3, color: it.$4, size: 16)),
              const SizedBox(height: 10),
              Text('${it.$2 ?? 0}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.text)),
              const SizedBox(height: 2),
              Text(it.$1, style: const TextStyle(fontSize: 11, color: AppColors.textLight), maxLines: 2, overflow: TextOverflow.ellipsis),
            ]),
          );
        },
      ),
    );
  }
}
