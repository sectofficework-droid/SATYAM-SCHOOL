# SATYAM SCHOOL — Pending Tasks & Status Report

**Generated:** 2026-10-04, **corrected 2026-10-05**  
**Repository:** `SATYAM-SCHOOL` (`origin/main`)  
**Context:** Post-audit remediation, mobile app resilience hardening, and Teacher Admin Workspace parity.

> **2026-10-05 correction notice:** this report was originally generated from
> `git log` alone, which can't see work applied directly to the live
> Supabase database via MCP (no corresponding commit). REQ-SEC-017, 018,
> the kiosk-RPC portion of REQ-SEC-012, REQ-BUG-061, and REQ-BUG-068 were
> already fixed/already-correct at the time this report was first written —
> corrected below, each with its live-verification evidence. See
> `governance/planning/TODO.md` for the authoritative, fully-detailed
> record; this file stays as a quick top-level summary.

---

## 1. Executive Summary & Recent Completions

The following major findings from the full-codebase security audit and mobile review have been **resolved and pushed to `origin/main`** (Commits `811d25f`, `8db198c`, `2138dcc`, `ad0649b`, `aaa4660`, `60f4451`):

* **REQ-SEC-012 (Fixed)**: Enforced session auth (`requireAdminSession` / `apiAuth.js` / `authedFetch.js`) on privileged routes (`kiosk-settings`, `staff-attendance/delete`, `staff-attendance/sync-absent`). **Also found+fixed deeper**: 5 kiosk RPCs reachable via a direct-RPC fallback path had zero auth inside the function body itself — gating the route alone wouldn't have closed this. See `mobile-app/SUPABASE_FIX_KIOSK_ADMIN_RPC_AUTH.sql`.
* **REQ-SEC-017 (Fixed 2026-10-04)**: `kiosk_special_day_overrides` RLS enabled (was previously mis-listed as pending below — see correction notice above). `mobile-app/SUPABASE_FIX_KIOSK_SEARCH_PATH_AND_RLS.sql`.
* **REQ-SEC-018 (Fixed 2026-10-04)**: `search_path` pinned on all 17 flagged functions (same migration as REQ-SEC-017 above).
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
* **REQ-FEAT-007 (Shipped 2026-10-04)** — Teacher Admin Workspace student-field parity: built full-screen `AdminAddStudentPage` (~30 fields matching the web's `AddStudentForm.js` exactly, required-ness included), expanded `staff_admin_student_add` RPC to a new 39-arg overload (`mobile-app/SUPABASE_EXPAND_STUDENT_ADD_FULL_FIELDS.sql`, old 11-arg shape still works for any not-yet-updated app instance), updated `StaffAdminService.addStudent`. Verified live via a rolled-back test insert covering all 27 new fields. **Not yet visually confirmed on-device** (BlueStacks closed mid-session). Also shipped same session: `AdminFilterBar` chip-row filters across every admin workspace list screen, and the adaptive launcher icon safe-margin/background fix.

---

## 2. 🚨 Critical Security Items Pending

| ID | Issue Description | Location | Action Required |
| :--- | :--- | :--- | :--- |
| **REQ-SEC-013** | **Unauthenticated S3 Storage API Routes**<br>Routes only check prefix strings (`students/`, `employees/`, etc.) with no user session verification. Anyone can generate presigned PUT/GET URLs to upload or read sensitive student/minor photos. `view-url` also has wildcard CORS `*`. | `admin-panel/src/app/api/s3/upload-url/route.js`<br>`admin-panel/src/app/api/s3/upload/route.js`<br>`admin-panel/src/app/api/s3/photo/route.js`<br>`admin-panel/src/app/api/s3/view-url/route.js` | Wrap routes with session authentication (e.g. `requireAdminSession`), validate caller permissions, and remove wildcard CORS. |
| **REQ-SEC-020** | **Vercel Cron Routes Fail-Open**<br>If `CRON_SECRET` is unset or omitted in Vercel environment variables, the auth check is skipped entirely rather than rejecting the request. | `admin-panel/src/app/api/cron/attendance-reminders/route.js`<br>`admin-panel/src/app/api/cron/mark-staff-absent/route.js` | Change condition to fail closed (`if (!process.env.CRON_SECRET \|\| authHeader !== ...) return 401`). |
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
| **REQ-BUG-065 / REQ-BUG-014** | **Kiosk Face Recognition Inaccuracy**<br>Nearest-neighbor matching across all historical face vectors has a ~33% false-accept rate, mitigated only by the "Yes/Not Me" confirm dialog. | `face_recognition_service.dart`<br>`face_punch_page.dart`<br>`match_face_embedding` RPC | Tune match threshold (`kMatchThreshold = 0.65`) and update matching algorithm to compute a normalized centroid/prototype per employee. |
| **REQ-BUG-020** | **17 Orphaned Open `employee_shifts`**<br>Shifts from 2026-09-17 test sessions remain open with no checkout time. | Database: `employee_shifts` | Review `mobile-app/STAFF_SHIFT_BACKLOG_REVIEW.sql` and run either synthetic close or delete test punches. |

**Checked and found NOT to need action (corrected 2026-10-05):**
* **REQ-BUG-061** — `admin_get_diagnostic_reports()` RPC already correctly omits `log_entries` for `normal_admin` server-side (verified live). The client-side `canDownload` gate this item originally flagged is cosmetic on top of an already-real server restriction.
* **REQ-BUG-068** — `verify_kiosk_admin_pin` already enforces server-side lockout (5 failed attempts → 15-minute lock, tracked in `kiosk_settings.pin_fail_count`/`pin_locked_until`) — confirmed by reading the live function body. The only real gap is UX: a locked-out attempt shows the same "Incorrect PIN" message as a wrong guess, not "Locked out, try again in N minutes." Cosmetic, not security.

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
2. **Immediate (Security)**: Secure S3 API endpoints (**REQ-SEC-013** — needs a design decision first: these routes are called by both the admin-panel web *and* mobile with no real session, so the fix isn't a drop-in `requireAdminSession` the way the other routes were) and fix cron fail-open logic (**REQ-SEC-020**).
3. **Operations**: Check Google Play Console for Teacher App v7 review progress and coordinate testers.
4. **Verification**: Install the latest Teacher debug APK on a device and visually confirm the new full-field Add Student form (**REQ-FEAT-007**) — not yet done, BlueStacks was closed mid-session.
