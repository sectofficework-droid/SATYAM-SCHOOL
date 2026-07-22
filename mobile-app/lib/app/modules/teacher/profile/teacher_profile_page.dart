import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/s3_image.dart';

class TeacherProfilePage extends StatelessWidget {
  const TeacherProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final profile     = AuthService.to.profile.value ?? {};
    final name        = profile['name'] as String? ?? '—';
    final empId       = profile['emp_code'] as String? ?? '—';
    final designation = profile['designation'] as String? ?? profile['type'] as String? ?? '—';
    final photoKey    = profile['photo_url'] as String?;
    final className   = profile['class_name'] as String? ?? '';
    final sectionName = profile['section_name'] as String? ?? '';
    final classLabel  = className.isEmpty ? '—' : (sectionName.isEmpty ? className : '$className - $sectionName');

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            backgroundColor: AppColors.navyDark,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(gradient: AppColors.navyGradient),
                child: SafeArea(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(height: 8),
                      // Profile photo
                      Container(
                        width: 88, height: 88,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withOpacity(.4), width: 3),
                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(.2), blurRadius: 16, offset: const Offset(0, 6))],
                        ),
                        child: ClipOval(
                          child: S3Image(
                            s3Key: photoKey,
                            width: 88, height: 88,
                            fallback: (_) => Container(
                              color: Colors.white.withOpacity(.15),
                              child: const Icon(Icons.person_rounded, color: Colors.white, size: 44),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(name,
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
                      const SizedBox(height: 4),
                      Text(designation,
                        style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Poppins')),
                    ],
                  ),
                ),
              ),
            ),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(delegate: SliverChildListDelegate([
              // Class badge
              if (className.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.blue.withOpacity(.08), AppColors.blue.withOpacity(.02)],
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.blue.withOpacity(.2)),
                  ),
                  child: Row(children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [AppColors.blue, AppColors.navy], begin: Alignment.topLeft, end: Alignment.bottomRight),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.class_rounded, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Class Teacher', style: TextStyle(fontSize: 12, color: AppColors.textLight, fontWeight: FontWeight.w500)),
                      Text(classLabel, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
                    ]),
                  ]),
                ),
                const SizedBox(height: 16),
              ],

              // Employee details
              _Section(title: 'Employee Details', icon: Icons.badge_rounded, children: [
                _Row(label: 'Employee Code',  value: empId),
                _Row(label: 'Designation',    value: designation),
                _Row(label: 'Department',     value: profile['department'] as String? ?? '—'),
              ]),
              const SizedBox(height: 12),
              _Section(title: 'Contact', icon: Icons.contact_phone_rounded, children: [
                _Row(label: 'Phone', value: profile['phone'] as String? ?? '—'),
                _Row(label: 'Email', value: profile['email'] as String? ?? '—'),
              ]),
              const SizedBox(height: 12),

              _Section(title: 'Settings', icon: Icons.settings_rounded, children: [
                _ActionRow(
                  icon: Icons.edit_rounded, label: 'Edit Profile',
                  subtitle: 'Name, mobile number and email',
                  onTap: () => _openEditProfile(context),
                ),
                _ActionRow(
                  icon: Icons.lock_reset_rounded, label: 'Change Password',
                  subtitle: 'Requires your current password',
                  onTap: () => _openChangePassword(context),
                ),
              ]),
              const SizedBox(height: 24),

              // Sign out
              GestureDetector(
                onTap: () => AuthService.to.signOut(),
                child: Container(
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.redLight,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.red.withOpacity(.3)),
                  ),
                  child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.logout_rounded, color: AppColors.red, size: 20),
                    SizedBox(width: 8),
                    Text('Sign Out', style: TextStyle(color: AppColors.red, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
                  ]),
                ),
              ),
              const SizedBox(height: 24),
            ])),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;
  const _Section({required this.title, required this.icon, required this.children});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(16),
      boxShadow: AppShadows.card,
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
        child: Row(children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: AppColors.navy, size: 16),
          ),
          const SizedBox(width: 10),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text)),
        ]),
      ),
      const Divider(height: 1, color: AppColors.border),
      ...children,
    ]),
  );
}

class _ActionRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;
  const _ActionRow({required this.icon, required this.label, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: AppColors.navy, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
        ])),
        const Icon(Icons.chevron_right_rounded, color: AppColors.textHint),
      ]),
    ),
  );
}

// ── Edit Profile sheet ──────────────────────────────────────────────────────

void _openEditProfile(BuildContext context) {
  final profile   = AuthService.to.profile.value ?? {};
  final employeeId = profile['id'] as String?;
  final nameCtrl  = TextEditingController(text: profile['name'] as String? ?? '');
  final phoneCtrl = TextEditingController(text: profile['phone'] as String? ?? '');
  final emailCtrl = TextEditingController(text: profile['email'] as String? ?? '');
  bool saving = false;
  String? error;

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
                    gradient: LinearGradient(colors: [AppColors.navy, AppColors.navyMid], begin: Alignment.topLeft, end: Alignment.bottomRight),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.edit_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(child: Text('Edit Profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text))),
                IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
              ]),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.person_outline_rounded, color: AppColors.navy, size: 20)),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Mobile Number', prefixIcon: Icon(Icons.phone_outlined, color: AppColors.navy, size: 20)),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined, color: AppColors.navy, size: 20)),
              ),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!, style: const TextStyle(color: AppColors.red, fontSize: 12, fontWeight: FontWeight.w600)),
              ],
              const SizedBox(height: 20),
              GestureDetector(
                onTap: saving ? null : () async {
                  final name  = nameCtrl.text.trim();
                  final phone = phoneCtrl.text.trim();
                  final email = emailCtrl.text.trim();
                  if (name.isEmpty) { setS(() => error = 'Name cannot be empty.'); return; }
                  if (phone.isNotEmpty && !RegExp(r'^\d{10}$').hasMatch(phone)) {
                    setS(() => error = 'Enter a valid 10-digit mobile number.');
                    return;
                  }
                  if (email.isNotEmpty && !email.contains('@')) { setS(() => error = 'Enter a valid email address.'); return; }
                  if (employeeId == null) { setS(() => error = 'Session error - please sign in again.'); return; }

                  setS(() { saving = true; error = null; });
                  final updated = await SupabaseService.updateTeacherProfile(
                    employeeId: employeeId, name: name, phone: phone, email: email,
                  );
                  if (updated == null) {
                    setS(() { saving = false; error = 'Could not save changes. Please try again.'; });
                    return;
                  }
                  await AuthService.to.updateProfileFields(updated);
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Profile updated'), behavior: SnackBarBehavior.floating,
                      backgroundColor: AppColors.green,
                    ));
                  }
                },
                child: Container(
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: AppColors.navyGradient,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6))],
                  ),
                  child: Center(child: saving
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                    : const Text('Save Changes', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins'))),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

// ── Change Password sheet ───────────────────────────────────────────────────

void _openChangePassword(BuildContext context) {
  final profile    = AuthService.to.profile.value ?? {};
  final employeeId = profile['id'] as String?;
  final oldCtrl = TextEditingController();
  final newCtrl = TextEditingController();
  final confirmCtrl = TextEditingController();
  bool saving = false;
  bool obscure = true;
  String? error;
  // Two-step flow: the current password must verify correctly before the
  // new-password fields even appear, and a wrong password sends the teacher
  // to the admin office rather than letting them keep guessing here.
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
                    gradient: LinearGradient(colors: [AppColors.navy, AppColors.navyMid], begin: Alignment.topLeft, end: Alignment.bottomRight),
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
                    if (employeeId == null) { setS(() => error = 'Session error - please sign in again.'); return; }

                    setS(() { saving = true; error = null; });
                    final ok = await SupabaseService.verifyTeacherPassword(employeeId: employeeId, password: oldPw);
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
                      boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6))],
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
                    if (employeeId == null) { setS(() => error = 'Session error - please sign in again.'); return; }

                    setS(() { saving = true; error = null; });
                    final ok = await SupabaseService.changeTeacherPassword(
                      employeeId: employeeId, oldPassword: oldPw, newPassword: newPw,
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
                      boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6))],
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

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 130, child: Text(label, style: const TextStyle(color: AppColors.textLight, fontSize: 13))),
      Expanded(child: Text(value.isEmpty ? '—' : value,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.text))),
    ]),
  );
}
