import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/s3_image.dart';

class StudentProfilePage extends StatelessWidget {
  const StudentProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final profile   = AuthService.to.profile.value ?? {};
    final name      = '${profile['first_name'] ?? ''} ${profile['last_name'] ?? ''}'.trim();
    final photoKey  = profile['photo_url'] as String?;
    final className = profile['class_name']?.toString() ?? '';
    final section   = profile['section_name']?.toString() ?? '';

    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('My Profile'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            buildAvatar(photoKey, name, 54),
            const SizedBox(height: 12),
            Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text)),
            const SizedBox(height: 4),
            if (className.isNotEmpty)
              Text(
                [className, if (section.isNotEmpty) section].join(' · '),
                style: const TextStyle(color: AppColors.navy, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            const SizedBox(height: 4),
            Text('Enrollment No: ${profile['enrollment_no'] ?? '—'}',
              style: const TextStyle(color: AppColors.textLight, fontSize: 13)),
            const SizedBox(height: 24),

            _section('Student Details', [
              _row('Enrollment No.',  profile['enrollment_no']?.toString() ?? '—'),
              _row('Roll No.',        profile['roll_no']?.toString() ?? '—'),
              _row('Class',           [className, if (section.isNotEmpty) section].join(' · ')),
              _row('Date of Birth',   profile['dob'] ?? '—'),
              _row('Gender',          profile['gender'] ?? '—'),
              _row("Father's Name",   profile['father_name'] ?? '—'),
              _row("Mother's Name",   profile['mother_name'] ?? '—'),
              _row('Phone',           profile['mobile1'] ?? '—'),
              _row('Address',         profile['address'] ?? '—'),
            ]),

            const SizedBox(height: 16),

            _section('Settings', [
              InkWell(
                onTap: () => _openChangePassword(context),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(children: [
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.lock_reset_rounded, color: AppColors.navy, size: 18),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Change Password', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
                      Text('Requires your current password', style: TextStyle(fontSize: 11, color: AppColors.textLight)),
                    ])),
                    const Icon(Icons.chevron_right_rounded, color: AppColors.textHint),
                  ]),
                ),
              ),
            ]),

            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.logout),
                label: const Text('Sign Out'),
                onPressed: () => AuthService.to.signOut(),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.red),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget buildAvatar(String? photoKey, String name, double radius) {
    return S3Image(
      s3Key:  photoKey,
      width:  radius * 2,
      height: radius * 2,
      fit:    BoxFit.cover,
      fallback: (_) => _initialsAvatar(name, radius),
    );
  }

  static Widget _initialsAvatar(String name, double radius) {
    final parts    = name.trim().split(' ');
    final initials = parts.length >= 2
        ? '${parts[0][0]}${parts[1][0]}'.toUpperCase()
        : name.isNotEmpty ? name[0].toUpperCase() : '?';
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.blueLight,
      child: Text(initials,
        style: TextStyle(color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: radius * 0.55)),
    );
  }

  Widget _section(String title, List<Widget> rows) => Container(
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Text(title, style: const TextStyle(
            fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.navy))),
        const Divider(height: 1),
        ...rows,
      ],
    ),
  );

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 130, child: Text(label,
          style: const TextStyle(color: AppColors.textLight, fontSize: 13))),
        Expanded(child: Text(value,
          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: AppColors.text))),
      ],
    ),
  );
}

// ── Change Password sheet ───────────────────────────────────────────────────
// Mirrors teacher_profile_page.dart's _openChangePassword: two-step
// verify-then-set flow, since this app also has no self-service password
// reset - a wrong current password is a dead end the admin office resolves.

void _openChangePassword(BuildContext context) {
  final profile   = AuthService.to.profile.value ?? {};
  final studentId = profile['id'] as String?;
  final oldCtrl = TextEditingController();
  final newCtrl = TextEditingController();
  final confirmCtrl = TextEditingController();
  bool saving = false;
  bool obscure = true;
  String? error;
  bool verified = false;

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setS) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(child: Container(
                width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
              )),
              Row(children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppColors.navy, AppColors.navyMid], begin: Alignment.topLeft, end: Alignment.bottomRight),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.lock_reset_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(child: Text('Change Password', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text))),
                IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
              ]),
              const SizedBox(height: 16),

              if (!verified) ...[
                TextField(
                  controller: oldCtrl,
                  obscureText: obscure,
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: 'Current Password',
                    prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.navy, size: 20),
                    suffixIcon: IconButton(
                      icon: Icon(obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 18, color: AppColors.textHint),
                      onPressed: () => setS(() => obscure = !obscure),
                    ),
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: 10),
                  Text(error!, style: const TextStyle(color: AppColors.red, fontSize: 12, fontWeight: FontWeight.w600, height: 1.4)),
                ],
                const SizedBox(height: 20),
                GestureDetector(
                  onTap: saving ? null : () async {
                    final oldPw = oldCtrl.text;
                    if (oldPw.isEmpty) { setS(() => error = 'Enter your current password.'); return; }
                    if (studentId == null) { setS(() => error = 'Session error - please sign in again.'); return; }

                    setS(() { saving = true; error = null; });
                    final ok = await SupabaseService.verifyStudentPassword(studentId: studentId, password: oldPw);
                    if (!ok) {
                      setS(() { saving = false; error = 'Incorrect password. Please contact the admin office.'; });
                      return;
                    }
                    setS(() { saving = false; verified = true; });
                  },
                  child: Container(
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: AppColors.navyGradient,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [BoxShadow(color: AppColors.navy.withValues(alpha: .35), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: Center(child: saving
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                      : const Text('Verify', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins'))),
                  ),
                ),
              ] else ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(color: AppColors.greenLight, borderRadius: BorderRadius.circular(12)),
                  child: const Row(children: [
                    Icon(Icons.check_circle_rounded, color: AppColors.green, size: 18),
                    SizedBox(width: 8),
                    Text('Current password verified', style: TextStyle(color: AppColors.green, fontSize: 13, fontWeight: FontWeight.w600)),
                  ]),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: newCtrl,
                  obscureText: obscure,
                  autofocus: true,
                  decoration: const InputDecoration(labelText: 'New Password', prefixIcon: Icon(Icons.lock_outline_rounded, color: AppColors.navy, size: 20)),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: confirmCtrl,
                  obscureText: obscure,
                  decoration: const InputDecoration(labelText: 'Confirm New Password', prefixIcon: Icon(Icons.lock_outline_rounded, color: AppColors.navy, size: 20)),
                ),
                if (error != null) ...[
                  const SizedBox(height: 10),
                  Text(error!, style: const TextStyle(color: AppColors.red, fontSize: 12, fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 20),
                GestureDetector(
                  onTap: saving ? null : () async {
                    final oldPw = oldCtrl.text;
                    final newPw = newCtrl.text;
                    final confirmPw = confirmCtrl.text;
                    if (newPw.length < 4) { setS(() => error = 'New password must be at least 4 characters.'); return; }
                    if (newPw != confirmPw) { setS(() => error = 'New password and confirmation do not match.'); return; }
                    if (newPw == oldPw) { setS(() => error = 'New password must be different from the current one.'); return; }
                    if (studentId == null) { setS(() => error = 'Session error - please sign in again.'); return; }

                    setS(() { saving = true; error = null; });
                    final ok = await SupabaseService.changeStudentPassword(
                      studentId: studentId, oldPassword: oldPw, newPassword: newPw,
                    );
                    if (!ok) {
                      // Only possible if the password changed elsewhere between
                      // verifying and saving - re-verify from scratch.
                      setS(() { saving = false; verified = false; error = 'Please verify your current password again.'; });
                      return;
                    }
                    if (ctx.mounted) Navigator.pop(ctx);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Password changed successfully'), behavior: SnackBarBehavior.floating,
                        backgroundColor: AppColors.green,
                      ));
                    }
                  },
                  child: Container(
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: AppColors.navyGradient,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [BoxShadow(color: AppColors.navy.withValues(alpha: .35), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: Center(child: saving
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                      : const Text('Update Password', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins'))),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}
