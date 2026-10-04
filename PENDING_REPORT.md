# SATYAM SCHOOL — Pending Tasks & Status Report

**Generated:** 2026-10-04  
**Repository:** `SATYAM-SCHOOL` (`origin/main`)  
**Context:** Post-audit remediation, mobile app resilience hardening, and Teacher Admin Workspace parity.

---

## 1. Executive Summary & Recent Completions

The following major findings from the full-codebase security audit and mobile review have been **resolved and pushed to `origin/main`** (Commits `811d25f`, `8db198c`, `2138dcc`, `ad0649b`, `aaa4660`, `60f4451`):

* **REQ-SEC-012 (Fixed)**: Enforced session auth (`requireAdminSession` / `apiAuth.js` / `authedFetch.js`) on privileged routes (`kiosk-settings`, `staff-attendance/delete`, `staff-attendance/sync-absent`).
* **REQ-SEC-014 (Fixed)**: Required and verified mobile session tokens on all 6 server PDF report routes (`attendance`, `bonafide`, `id-card`, `marksheet`, `salary`, `tc`) in `reportsServerAuth.js`.
* **REQ-SEC-015 (Fixed)**: Closed stored XSS vulnerability in Transfer Certificate generator (`tcGenerator.js`) via HTML escaping.
* **REQ-SEC-016 (Fixed)**: Migrated `fetchEmployeeAttendance` from direct table access to session-gated RPC `fetch_my_employee_attendance`.
* **REQ-BUG-015, 016, 017 (Fixed)**: Purged tokenless cached sessions on boot in `AuthService`, added session error snackbars, and safeguarded route arguments.
* **REQ-BUG-062 (Fixed)**: Restricted staff salary columns and aggregate queries in admin panel reports to the management role only.
* **REQ-BUG-063 (Fixed)**: Added `_firstRow` empty-list guards across all kiosk RPC call sites in `supabase_service.dart` and `staff_admin_service.dart`.
* **REQ-BUG-064 (Fixed)**: Eliminated infinite `RangeError` loops during face enrollment errors in `face_enroll_capture_page.dart`.
* **REQ-BUG-066 (Fixed)**: Blocked silent save failures on missing/stale session tokens in teacher attendance, monthly test marks, and official exams.
* **REQ-BUG-067 (Fixed)**: Resolved memory leaks by explicitly disposing `TextEditingController` maps in marks and exam entry.
* **REQ-BUG-069 & 070 (Fixed)**: Added try/catch and retry UI across all student screens and teacher mutation handlers, rolled back optimistic status changes on failure, and restored notice card expandability.
* **Teacher Admin Workspace Parity (Shipped)**: Built full-screen `AdminAddStudentPage` (~30 profile fields matching web), updated `StaffAdminService.addStudent`, added `AdminFilterBar` chip row component across all workspace modules, and polished adaptive launcher icon safe margins and `#003FA8` background.

---

## 2. 🚨 Critical Security Items Pending

| ID | Issue Description | Location | Action Required |
| :--- | :--- | :--- | :--- |
| **REQ-SEC-013** | **Unauthenticated S3 Storage API Routes**<br>Routes only check prefix strings (`students/`, `employees/`, etc.) with no user session verification. Anyone can generate presigned PUT/GET URLs to upload or read sensitive student/minor photos. `view-url` also has wildcard CORS `*`. | `admin-panel/src/app/api/s3/upload-url/route.js`<br>`admin-panel/src/app/api/s3/upload/route.js`<br>`admin-panel/src/app/api/s3/photo/route.js`<br>`admin-panel/src/app/api/s3/view-url/route.js` | Wrap routes with session authentication (e.g. `requireAdminSession`), validate caller permissions, and remove wildcard CORS. |
| **REQ-SEC-020** | **Vercel Cron Routes Fail-Open**<br>If `CRON_SECRET` is unset or omitted in Vercel environment variables, the auth check is skipped entirely rather than rejecting the request. | `admin-panel/src/app/api/cron/attendance-reminders/route.js`<br>`admin-panel/src/app/api/cron/mark-staff-absent/route.js` | Change condition to fail closed (`if (!process.env.CRON_SECRET \|\| authHeader !== ...) return 401`). |
| **REQ-SEC-017** | **`kiosk_special_day_overrides` RLS Disabled**<br>Table was created with anon/authenticated grants revoked but RLS was never enabled. Live Supabase ERROR advisory. | Supabase Database | Run: `ALTER TABLE kiosk_special_day_overrides ENABLE ROW LEVEL SECURITY;` in SQL Editor. |
| **REQ-SEC-018** | **17 Database RPCs with Mutable `search_path`**<br>Supabase WARN advisory: `get_kiosk_public_settings`, `save_kiosk_special_day`, `record_face_punch`, `auto_close_open_shifts`, etc. are susceptible to search-path poisoning. | Supabase Database Functions | Execute `SET search_path TO 'public','extensions'` across all 17 flagged RPC definitions. |
| **REQ-SEC-019** | **Supabase Auth Leaked Password Protection Disabled**<br>HaveIBeenPwned password check is off project-wide. | Supabase Dashboard | Toggle on under Dashboard → Auth → Policies. |
| **REQ-SEC-002** | **Category 3 Table-Level Grant Revocation (Deferred)**<br>RPCs are deployed, but `REVOKE SELECT ... FROM anon` on Category 3 tables (`employees`, `student_attendance`, etc.) is deferred. | Database Permissions | Run the revocation block once all staff/teachers are confirmed running v7+ builds. |

---

## 3. ⚠️ External Blockers & Distribution Pending

| Item | Status & Blocker | Required Steps |
| :--- | :--- | :--- |
| **REQ-BUG-060: App Update S3 CORS** | **BLOCKED on AWS Console login.**<br>Admin panel's "Publish App Update" direct browser-to-S3 upload fails with 403 preflight `OPTIONS`. S3 bucket `satyam-stars-international-school` lacks CORS for Vercel origin. | Add CORS rule in AWS S3 Console:<br>```json<br>[{<br>  "AllowedHeaders": ["*"],<br>  "AllowedMethods": ["PUT"],<br>  "AllowedOrigins": [<br>    "https://satyam-stars-international-school-a-six.vercel.app",<br>    "https://satyam-stars-international-school-*.vercel.app"<br>  ],<br>  "ExposeHeaders": []<br>}]<br>``` |
| **Teacher App Play Store Closed Testing** | **PENDING Google Review & Tester Period.**<br>Teacher App v7 (`1.0.0+7`) submitted to Closed Testing (Alpha track) with new app name and icon. | 1. Wait for Google review approval.<br>2. Enroll ≥12 external testers.<br>3. Keep testers active for 14 continuous days before Google unlocks production track application. |
| **Student & Attendance Kiosk Store Listings** | **PENDING store setup.**<br>Student and Attendance Kiosk apps currently distributed via direct APK only. | Prepare store listing assets, privacy policies, and release tracks if Play Store publishing is desired. |

---

## 4. 🐛 Functional Bugs & Operational Items

| ID | Issue Description | Location | Proposed Resolution |
| :--- | :--- | :--- | :--- |
| **REQ-BUG-061** | **Diagnostics Download Gated Only on Client-Side**<br>`diagnostics/page.js:91` hides download button for `normal_admin`, but underlying RLS policy is `is_admin_user()`. | `admin-panel/src/app/(dashboard)/diagnostics/page.js` & Supabase RLS | Enforce senior admin/management tier check inside the database policy or API handler. |
| **REQ-BUG-065 / REQ-BUG-014** | **Kiosk Face Recognition Inaccuracy**<br>Nearest-neighbor matching across all historical face vectors has a ~33% false-accept rate, mitigated only by the "Yes/Not Me" confirm dialog. | `face_recognition_service.dart`<br>`face_punch_page.dart`<br>`match_face_embedding` RPC | Tune match threshold (`kMatchThreshold = 0.65`) and update matching algorithm to compute a normalized centroid/prototype per employee. |
| **REQ-BUG-068** | **Kiosk Admin PIN Dialog Brute-Force**<br>Physical kiosk allows unlimited rapid PIN guesses with no backoff or throttling. | `mobile-app/lib/app/modules/attendance_kiosk/admin_pin_dialog.dart` | Introduce exponential delay (e.g. 5 attempts → 30s lockout) on repeated failed PIN inputs. |
| **REQ-BUG-020** | **17 Orphaned Open `employee_shifts`**<br>Shifts from 2026-09-17 test sessions remain open with no checkout time. | Database: `employee_shifts` | Review `mobile-app/STAFF_SHIFT_BACKLOG_REVIEW.sql` and run either synthetic close or delete test punches. |

---

## 5. 📋 HR, Attendance & Schema Enhancements

* **REQ-FEAT-002 — Half-Day Attendance Status**:
  * Constraint `CHECK (status IN ('P','A','L'))` prevents marking half-days.
  * *Needs:* Migration to add `'HD'` status or `half_day BOOLEAN`, plus admin UI radio button.
* **REQ-FEAT-003 — Structured Leave Types**:
  * `leave_requests` table lacks type categorization (Casual, Sick, Earned, Unpaid).
  * *Needs:* DDL migration to add `leave_type` enum/column, updated mobile submission dialog, and approval UI.
* **REQ-FEAT-004 — Staff Holiday Calendar**:
  * Staff attendance reports currently only exclude Sundays and weekends; student holidays do not automatically apply to staff.
  * *Needs:* Policy decision on school-wide vs. student-only holidays and query adjustment in `reportService.js`.
* **REQ-FEAT-005 — Report Lazy-Loading**:
  * Admin panel `report/page.js` loads all 11 reports in one massive `Promise.all`.
  * *Needs:* Refactor to lazy-load report data upon switching tabs to improve initial page load performance.
* **REQ-FEAT-006 — Supabase `pg_cron` Verification**:
  * Confirm whether the 16:00 IST auto-close shift cron is registered:
    `SELECT jobname, schedule, command FROM cron.job;`.
    If absent, run `SUPABASE_PG_CRON_SCHEDULE.sql`.

---

## 6. 🛠️ Code Hygiene & Future Tech Debt

* **REQ-HYG-001 / REQ-HYG-002 (Testing & CI)**:
  * No unit or integration tests exist in `admin-panel/` or `mobile-app/`.
  * No GitHub Actions CI workflow configured (`.github/workflows/` is missing).
* **Payment Gateway (Razorpay)**:
  * SDK installed in codebase but inactive/unwired (Phase 2 scope).
* **Push Notifications (FCM)**:
  * Notifications are currently in-app polling only; Firebase Cloud Messaging is not yet integrated.
* **Large Monolithic Files**:
  * Candidate files for modularization: `report/page.js` (2,200+ lines), `AddStudentForm.js` (1,400+ lines), `supabase_service.dart` (1,300+ lines).

---

## 7. Recommended Next Actions

1. **Immediate (Security)**: Apply the S3 CORS JSON policy in AWS Console (resolves **REQ-BUG-060**).
2. **Immediate (Security)**: Secure S3 API endpoints (**REQ-SEC-013**) and fix cron fail-open logic (**REQ-SEC-020**).
3. **Database Maintenance**: Run `ALTER TABLE kiosk_special_day_overrides ENABLE ROW LEVEL SECURITY;` and set search paths on 17 functions (**REQ-SEC-017, 018**).
4. **Operations**: Check Google Play Console for Teacher App v7 review progress and coordinate testers.
