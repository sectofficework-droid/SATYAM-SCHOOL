import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Full-screen Add Student form - 2026-10-04, user: "shows very less field
// (only basic details) but i want all student related field available in
// admin panel web also should be available in application". Mirrors the
// admin-panel web's AddStudentForm.js field set and required-ness exactly
// (the authoritative source of truth for this project's student data
// model) - previously this was a 9-field bottom sheet. A bottom sheet
// doesn't fit this many fields, so this replaces it with a dedicated page,
// matching the weight already given to AdminStudentDetailPage/
// AdminEmployeeDetailPage elsewhere in this module.
class AdminAddStudentPage extends StatefulWidget {
  const AdminAddStudentPage({super.key});
  @override
  State<AdminAddStudentPage> createState() => _AdminAddStudentPageState();
}

class _AdminAddStudentPageState extends State<AdminAddStudentPage> {
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  bool _saving = false;

  // Class / Section
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _sections = [];
  String? _classId;
  String? _sectionId;

  // Basic info
  final _firstCtrl = TextEditingController();
  final _lastCtrl = TextEditingController();
  DateTime? _dob;
  String _gender = 'Male';
  final _placeOfBirthCtrl = TextEditingController();

  // Parents
  final _fatherCtrl = TextEditingController();
  final _motherCtrl = TextEditingController();
  final _mobile1Ctrl = TextEditingController();
  final _mobile2Ctrl = TextEditingController();

  // Address
  final _roomPlotCtrl = TextEditingController();
  final _societyCtrl = TextEditingController();
  final _landmarkCtrl = TextEditingController();
  final _areaCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  // Birth details
  final _birthCityCtrl = TextEditingController();
  final _birthVillageCtrl = TextEditingController();
  final _birthDistrictCtrl = TextEditingController();
  final _birthStateCtrl = TextEditingController();
  final _birthCertRegNoCtrl = TextEditingController();
  DateTime? _birthCertRegDate;

  // Identity documents
  final _aadharCtrl = TextEditingController();
  final _aadharNameCtrl = TextEditingController();
  final _fatherAadharCtrl = TextEditingController();
  final _fatherAadharNameCtrl = TextEditingController();
  final _motherAadharCtrl = TextEditingController();
  final _motherAadharNameCtrl = TextEditingController();
  final _udiseCtrl = TextEditingController();
  final _penCtrl = TextEditingController();
  final _apaarCtrl = TextEditingController();

  // Other
  final _religionCtrl = TextEditingController();
  final _casteCtrl = TextEditingController();
  final _subCasteCtrl = TextEditingController();
  final _motherTongueCtrl = TextEditingController();
  final _heightCtrl = TextEditingController();
  final _weightCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    StaffAdminService.classListWithIds(_employeeId).then((c) { if (mounted) setState(() => _classes = c); }).catchError((_) {});
  }

  @override
  void dispose() {
    for (final c in [
      _firstCtrl, _lastCtrl, _placeOfBirthCtrl, _fatherCtrl, _motherCtrl, _mobile1Ctrl, _mobile2Ctrl,
      _roomPlotCtrl, _societyCtrl, _landmarkCtrl, _areaCtrl, _pincodeCtrl, _addressCtrl,
      _birthCityCtrl, _birthVillageCtrl, _birthDistrictCtrl, _birthStateCtrl, _birthCertRegNoCtrl,
      _aadharCtrl, _aadharNameCtrl, _fatherAadharCtrl, _fatherAadharNameCtrl, _motherAadharCtrl, _motherAadharNameCtrl,
      _udiseCtrl, _penCtrl, _apaarCtrl, _religionCtrl, _casteCtrl, _subCasteCtrl, _motherTongueCtrl, _heightCtrl, _weightCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String _fmtDate(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pickDob() async {
    final d = await showDatePicker(context: context, initialDate: DateTime(2015, 1, 1), firstDate: DateTime(1990), lastDate: DateTime.now());
    if (d != null) setState(() => _dob = d);
  }

  Future<void> _pickBirthCertDate() async {
    final d = await showDatePicker(context: context, initialDate: _dob ?? DateTime(2015, 1, 1), firstDate: DateTime(1990), lastDate: DateTime.now());
    if (d != null) setState(() => _birthCertRegDate = d);
  }

  Future<void> _onClassChanged(String? v) async {
    setState(() { _classId = v; _sectionId = null; _sections = []; });
    if (v != null) {
      try {
        final s = await StaffAdminService.sectionList(_employeeId, v);
        if (mounted) setState(() => _sections = s);
      } catch (_) {}
    }
  }

  Future<void> _save() async {
    if (_firstCtrl.text.trim().isEmpty ||
        _dob == null ||
        _fatherCtrl.text.trim().isEmpty ||
        _motherCtrl.text.trim().isEmpty ||
        _mobile1Ctrl.text.trim().isEmpty ||
        _roomPlotCtrl.text.trim().isEmpty ||
        _societyCtrl.text.trim().isEmpty ||
        _areaCtrl.text.trim().isEmpty ||
        _pincodeCtrl.text.trim().isEmpty ||
        _birthCityCtrl.text.trim().isEmpty ||
        _classId == null ||
        _sectionId == null) {
      showAdminSnack(context, 'Fill in all required fields (marked *).', isError: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await StaffAdminService.addStudent(
        _employeeId,
        firstName: _firstCtrl.text.trim(),
        lastName: _lastCtrl.text.trim(),
        dob: _fmtDate(_dob!),
        gender: _gender,
        fatherName: _fatherCtrl.text.trim(),
        motherName: _motherCtrl.text.trim(),
        mobile1: _mobile1Ctrl.text.trim(),
        classId: _classId!,
        sectionId: _sectionId!,
        address: _addressCtrl.text.trim().isEmpty ? null : _addressCtrl.text.trim(),
        mobile2: _mobile2Ctrl.text.trim().isEmpty ? null : _mobile2Ctrl.text.trim(),
        religion: _religionCtrl.text.trim().isEmpty ? null : _religionCtrl.text.trim(),
        caste: _casteCtrl.text.trim().isEmpty ? null : _casteCtrl.text.trim(),
        subCaste: _subCasteCtrl.text.trim().isEmpty ? null : _subCasteCtrl.text.trim(),
        motherTongue: _motherTongueCtrl.text.trim().isEmpty ? null : _motherTongueCtrl.text.trim(),
        heightCm: num.tryParse(_heightCtrl.text.trim()),
        weightKg: num.tryParse(_weightCtrl.text.trim()),
        roomPlotNo: _roomPlotCtrl.text.trim(),
        society: _societyCtrl.text.trim(),
        landmark: _landmarkCtrl.text.trim().isEmpty ? null : _landmarkCtrl.text.trim(),
        area: _areaCtrl.text.trim(),
        pincode: _pincodeCtrl.text.trim(),
        aadhar: _aadharCtrl.text.trim().isEmpty ? null : _aadharCtrl.text.trim(),
        aadharName: _aadharNameCtrl.text.trim().isEmpty ? null : _aadharNameCtrl.text.trim(),
        fatherAadhar: _fatherAadharCtrl.text.trim().isEmpty ? null : _fatherAadharCtrl.text.trim(),
        fatherAadharName: _fatherAadharNameCtrl.text.trim().isEmpty ? null : _fatherAadharNameCtrl.text.trim(),
        motherAadhar: _motherAadharCtrl.text.trim().isEmpty ? null : _motherAadharCtrl.text.trim(),
        motherAadharName: _motherAadharNameCtrl.text.trim().isEmpty ? null : _motherAadharNameCtrl.text.trim(),
        placeOfBirth: _placeOfBirthCtrl.text.trim().isEmpty ? null : _placeOfBirthCtrl.text.trim(),
        birthCity: _birthCityCtrl.text.trim(),
        birthVillage: _birthVillageCtrl.text.trim().isEmpty ? null : _birthVillageCtrl.text.trim(),
        birthDistrict: _birthDistrictCtrl.text.trim().isEmpty ? null : _birthDistrictCtrl.text.trim(),
        birthState: _birthStateCtrl.text.trim().isEmpty ? null : _birthStateCtrl.text.trim(),
        birthCertRegNo: _birthCertRegNoCtrl.text.trim().isEmpty ? null : _birthCertRegNoCtrl.text.trim(),
        birthCertRegDate: _birthCertRegDate == null ? null : _fmtDate(_birthCertRegDate!),
        udise: _udiseCtrl.text.trim().isEmpty ? null : _udiseCtrl.text.trim(),
        pen: _penCtrl.text.trim().isEmpty ? null : _penCtrl.text.trim(),
        apaar: _apaarCtrl.text.trim().isEmpty ? null : _apaarCtrl.text.trim(),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showAdminSnack(context, 'Failed to add student.', isError: true);
      }
    }
  }

  Widget _section(String title) => Padding(
    padding: const EdgeInsets.only(top: 20, bottom: 10),
    child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.navy)),
  );

  Widget _field(TextEditingController ctrl, String label, {bool required = false, TextInputType? type, List<TextInputFormatter>? formatters, int maxLines = 1}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          controller: ctrl,
          keyboardType: type,
          inputFormatters: formatters,
          maxLines: maxLines,
          decoration: InputDecoration(labelText: required ? '$label *' : label, border: const OutlineInputBorder(), isDense: true),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AdminAppBar(title: 'Add Student', actions: [
        TextButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Save', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ),
      ]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _section('Class & Section'),
          Row(children: [
            Expanded(child: DropdownButtonFormField<String>(
              initialValue: _classId,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Class *', border: OutlineInputBorder(), isDense: true),
              items: _classes.map((c) => DropdownMenuItem(value: c['id'] as String, child: Text(c['name'] as String, overflow: TextOverflow.ellipsis))).toList(),
              onChanged: _onClassChanged,
            )),
            const SizedBox(width: 10),
            Expanded(child: DropdownButtonFormField<String>(
              initialValue: _sectionId,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Section *', border: OutlineInputBorder(), isDense: true),
              items: _sections.map((s) => DropdownMenuItem(value: s['id'] as String, child: Text(s['name'] as String, overflow: TextOverflow.ellipsis))).toList(),
              onChanged: (v) => setState(() => _sectionId = v),
            )),
          ]),

          _section('Basic Info'),
          _field(_firstCtrl, 'First Name', required: true),
          _field(_lastCtrl, 'Last Name'),
          Row(children: [
            Expanded(child: Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: OutlinedButton(
                onPressed: _pickDob,
                child: Text(_dob == null ? 'Date of Birth *' : _fmtDate(_dob!)),
              ),
            )),
            const SizedBox(width: 10),
            Expanded(child: Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: DropdownButtonFormField<String>(
                initialValue: _gender,
                decoration: const InputDecoration(labelText: 'Gender *', border: OutlineInputBorder(), isDense: true),
                items: const ['Male', 'Female', 'Other'].map((g) => DropdownMenuItem(value: g, child: Text(g))).toList(),
                onChanged: (v) => setState(() => _gender = v ?? _gender),
              ),
            )),
          ]),
          _field(_placeOfBirthCtrl, 'Place of Birth'),

          _section('Parents'),
          _field(_fatherCtrl, "Father's Name", required: true),
          _field(_motherCtrl, "Mother's Name", required: true),
          _field(_mobile1Ctrl, 'Primary Mobile', required: true, type: TextInputType.phone, formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)]),
          _field(_mobile2Ctrl, 'Alternate Mobile', type: TextInputType.phone, formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)]),

          _section('Address'),
          _field(_roomPlotCtrl, 'Room / Plot No', required: true),
          _field(_societyCtrl, 'Society', required: true),
          _field(_landmarkCtrl, 'Landmark'),
          _field(_areaCtrl, 'Area', required: true),
          _field(_pincodeCtrl, 'PIN Code', required: true, type: TextInputType.number, formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)]),
          _field(_addressCtrl, 'Full Address (optional summary)', maxLines: 2),

          _section('Birth Details'),
          _field(_birthCityCtrl, 'Birth City', required: true),
          _field(_birthVillageCtrl, 'Birth Village'),
          _field(_birthDistrictCtrl, 'Birth District'),
          _field(_birthStateCtrl, 'Birth State'),
          _field(_birthCertRegNoCtrl, 'Birth Certificate Reg. No'),
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: OutlinedButton(
              onPressed: _pickBirthCertDate,
              child: Text(_birthCertRegDate == null ? 'Birth Certificate Reg. Date' : _fmtDate(_birthCertRegDate!)),
            ),
          ),

          _section('Identity Documents'),
          _field(_aadharCtrl, "Student's Aadhar No", type: TextInputType.number, formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(12)]),
          _field(_aadharNameCtrl, 'Name on Aadhar'),
          _field(_fatherAadharCtrl, "Father's Aadhar No", type: TextInputType.number, formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(12)]),
          _field(_fatherAadharNameCtrl, "Name on Father's Aadhar"),
          _field(_motherAadharCtrl, "Mother's Aadhar No", type: TextInputType.number, formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(12)]),
          _field(_motherAadharNameCtrl, "Name on Mother's Aadhar"),
          _field(_udiseCtrl, 'U-DISE Number'),
          _field(_penCtrl, 'PEN'),
          _field(_apaarCtrl, 'APAAR ID'),

          _section('Other'),
          _field(_religionCtrl, 'Religion'),
          _field(_casteCtrl, 'Caste / Category'),
          _field(_subCasteCtrl, 'Sub-Caste'),
          _field(_motherTongueCtrl, 'Mother Tongue'),
          Row(children: [
            Expanded(child: _field(_heightCtrl, 'Height (cm)', type: const TextInputType.numberWithOptions(decimal: true))),
            const SizedBox(width: 10),
            Expanded(child: _field(_weightCtrl, 'Weight (kg)', type: const TextInputType.numberWithOptions(decimal: true))),
          ]),

          const SizedBox(height: 20),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, minimumSize: const Size.fromHeight(50)),
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Add Student'),
          ),
          const SizedBox(height: 20),
        ]),
      ),
    );
  }
}
