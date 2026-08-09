import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import 's3_image.dart';

// Shared, year-round "Birthdays" list for both apps - every student and
// staff member with a dob on file, grouped by date and ordered Jun 1 -> May
// 31 (the school year, not the calendar year), scrollable, auto-positioned
// so today sits at the top on open (past dates scrolled above, upcoming
// ones below). Students and staff are always visually distinct - a pink
// accent + no badge for students, navy/gold accent + a "STAFF" badge for
// staff - even though they now share one merged, date-sorted list instead
// of two separate sections.
class BirthdaysView extends StatefulWidget {
  final List<Map<String, dynamic>> students;
  final List<Map<String, dynamic>> staff;
  const BirthdaysView({super.key, required this.students, required this.staff});

  @override
  State<BirthdaysView> createState() => _BirthdaysViewState();
}

typedef _DateGroup = MapEntry<String, List<Map<String, dynamic>>>;

class _BirthdaysViewState extends State<BirthdaysView> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToToday());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _allPeople {
    final people = <Map<String, dynamic>>[];
    for (final s in widget.students) {
      final dob = DateTime.tryParse(s['dob']?.toString() ?? '');
      if (dob == null) continue;
      final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
      final classLabel = [s['class_name'], s['section_name']]
          .where((v) => (v ?? '').toString().isNotEmpty).join(' - ');
      people.add({
        'id': s['id'], 'name': name.isEmpty ? '—' : name, 'photoUrl': s['photo_url'],
        'subtitle': classLabel.isEmpty ? 'Student' : classLabel, 'dob': dob, 'isStaff': false,
      });
    }
    for (final s in widget.staff) {
      final dob = DateTime.tryParse(s['dob']?.toString() ?? '');
      if (dob == null) continue;
      final subtitle = [s['designation'], s['department']]
          .where((v) => (v ?? '').toString().isNotEmpty).join(' · ');
      people.add({
        'id': s['id'], 'name': (s['name'] ?? '—').toString(), 'photoUrl': s['photo_url'],
        'subtitle': subtitle.isEmpty ? 'Staff' : subtitle, 'dob': dob, 'isStaff': true,
      });
    }
    return people;
  }

  // Days since 1 June in a fixed reference span, birth year ignored - sorts
  // Jun 1 -> May 31 (the school year) instead of calendar Jan -> Dec. Feb 29
  // is nudged to Feb 28 for this ordinal only (the Jan-May half's reference
  // year isn't a leap year); the real dob is still what's displayed.
  int _academicOrdinal(DateTime d) {
    final refYear = d.month >= 6 ? 2000 : 2001;
    final day = (d.month == 2 && d.day == 29) ? 28 : d.day;
    return DateTime(refYear, d.month, day).difference(DateTime(2000, 6, 1)).inDays;
  }

  DateTime _keyToDate(String key) {
    final parts = key.split('-');
    return DateTime(2000, int.parse(parts[0]), int.parse(parts[1]));
  }

  String _dateKey(DateTime d) => '${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  List<_DateGroup> get _groupedSorted {
    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _allPeople
        : _allPeople.where((p) =>
            (p['name'] as String).toLowerCase().contains(q) ||
            (p['subtitle'] as String).toLowerCase().contains(q)).toList();

    final groups = <String, List<Map<String, dynamic>>>{};
    for (final p in filtered) {
      groups.putIfAbsent(_dateKey(p['dob'] as DateTime), () => []).add(p);
    }
    final entries = groups.entries.toList()
      ..sort((a, b) => _academicOrdinal(_keyToDate(a.key)).compareTo(_academicOrdinal(_keyToDate(b.key))));
    for (final e in entries) {
      e.value.sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));
    }
    return entries;
  }

  void _scrollToToday() {
    if (!_scrollController.hasClients || _query.isNotEmpty) return;
    final groups = _groupedSorted;
    if (groups.isEmpty) return;
    final todayOrdinal = _academicOrdinal(DateTime.now());
    const headerHeight = 46.0;
    const tileHeight = 78.0;
    double offset = 0;
    for (final g in groups) {
      if (_academicOrdinal(_keyToDate(g.key)) >= todayOrdinal) break;
      offset += headerHeight + g.value.length * tileHeight;
    }
    _scrollController.animateTo(
      offset.clamp(0, _scrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groupedSorted;
    final todayKey = _dateKey(DateTime.now());

    return Column(children: [
      _buildSearchBar(),
      Expanded(
        child: groups.isEmpty
            ? _emptyState()
            : ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                itemCount: groups.length,
                itemBuilder: (_, i) => _buildGroup(groups[i], isToday: groups[i].key == todayKey),
              ),
      ),
    ]);
  }

  Widget _buildSearchBar() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
    child: TextField(
      controller: _searchCtrl,
      onChanged: (v) => setState(() => _query = v),
      decoration: InputDecoration(
        hintText: 'Search by name, class, or designation',
        hintStyle: const TextStyle(fontSize: 13, color: AppColors.textHint),
        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textHint, size: 20),
        suffixIcon: _query.isEmpty ? null : IconButton(
          icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.textHint),
          onPressed: () => setState(() { _searchCtrl.clear(); _query = ''; }),
        ),
        filled: true, fillColor: AppColors.card,
        contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.navy, width: 2)),
      ),
    ),
  );

  Widget _buildGroup(_DateGroup group, {required bool isToday}) {
    final date = _keyToDate(group.key);
    final color = isToday ? AppColors.amber : AppColors.navy;
    final label = isToday ? 'Today · ${DateFormat('d MMMM').format(date)}' : DateFormat('d MMMM').format(date);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(children: [
            Expanded(child: Divider(color: color.withOpacity(.3), thickness: 1)),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
              child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700)),
            ),
          ]),
        ),
        ...group.value.map(_personTile),
      ]),
    );
  }

  Widget _personTile(Map<String, dynamic> p) {
    final isStaff = p['isStaff'] == true;
    final accent = isStaff ? AppColors.navy : AppColors.pink;
    final accentBg = isStaff ? AppColors.amberLight : AppColors.pinkLight;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        boxShadow: AppShadows.card,
        border: Border(left: BorderSide(color: accent, width: 3)),
      ),
      child: Row(children: [
        ClipOval(child: S3Image(
          s3Key: p['photoUrl'] as String?,
          width: 44, height: 44,
          fallback: (_) => Container(
            width: 44, height: 44,
            color: accentBg,
            child: Icon(Icons.person, color: accent, size: 22),
          ),
        )),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(p['name'] as String,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text))),
            if (isStaff) Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: accentBg, borderRadius: BorderRadius.circular(6)),
              child: Text('STAFF', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: accent)),
            ),
          ]),
          Text(p['subtitle'] as String, style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
        ])),
        Icon(Icons.cake_rounded, size: 18, color: accent.withOpacity(.6)),
      ]),
    );
  }

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.pinkLight, shape: BoxShape.circle),
        child: Icon(_query.isEmpty ? Icons.cake_outlined : Icons.search_off_rounded, color: AppColors.pink, size: 38),
      ),
      const SizedBox(height: 16),
      Text(_query.isEmpty ? 'No Birthdays On File' : 'No Matches', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      Text(_query.isEmpty ? 'Nobody has a date of birth on record yet.' : 'Try a different name, class, or designation.',
        textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}
