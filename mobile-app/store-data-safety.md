# Play Console — Data Safety & Content Rating draft

Drafted from the actual code paths (auth_service.dart, s3_upload_service.dart,
SUPABASE_*.sql, pubspec.yaml dependency list — no analytics/ads/crash SDKs
present), not guessed. Covers both the **Teacher** and **Student** listings;
differences between the two are called out inline. Paste these into Play
Console's Data Safety form and Content Rating questionnaire — don't take them
as final without your own read, since only you can attest to this on Google's
behalf.

## Does the app collect or share any of the required user data types?
**Yes** (both apps).

## Data types collected

| Category | Type | Collected? | Shared with 3rd parties? | Purpose |
|---|---|---|---|---|
| Personal info | Name | Yes | No | App functionality (account identity) |
| Personal info | Phone number | Yes (parent/guardian mobile shown to staff; teacher's own number in profile) | No | App functionality |
| Personal info | User IDs | Yes (enrollment no. / employee code) | No | App functionality (login) |
| Personal info | Address | No | — | — |
| Personal info | Email address | No — login is by enrollment no./employee code, not email | — | — |
| Financial info | Other financial info (fee dues/payment status) | Yes — **student app only**, view-only, no in-app payment | No | App functionality |
| Photos/videos or Files/docs | Files and docs (question-bank attachments, syllabus files) | Yes — **teacher app only**, via `s3_upload_service.dart` | No | App functionality |
| Messages | In-app messages (help-desk queries/replies) | Yes | No | App functionality |
| App activity | App interactions (attendance marks, homework, task completion, exam marks entered) | Yes | No | App functionality |
| App info and performance | Crash logs / diagnostics | **No** — no Crashlytics/Firebase/analytics SDK in `pubspec.yaml` | — | — |
| Location | Any | No | — | — |
| Health & fitness | Any | No | — | — |
| Contacts / Calendar / Web browsing / Audio | Any | No | — | — |
| Device or other IDs | Any | No — no ad/analytics SDK reads an advertising or device ID | — | — |

## Follow-up questions Play Console will ask per data type
- **Is this data processed ephemerally?** No — it's persisted in Supabase (Postgres).
- **Is collection required or optional?** Required — the app is unusable without a
  school-issued login; there's no anonymous/guest mode.
- **Is data encrypted in transit?** Yes — Supabase and the S3 bucket are both
  accessed over HTTPS/TLS.
- **Can users request data deletion?** Not self-service in-app today — there's
  no account-deletion flow in the UI. Answer honestly as "no in-app deletion,
  contact the school office" (a support contact still satisfies the
  requirement) **unless** you add a deletion request path before submitting —
  your call. If you go with "contact us," Play Console will ask for a
  support URL/email; use the school office contact from the store listings.

## Permission cleanup — done vs. still open
Removed the plain `CAMERA` permission from the student build via
`android/app/src/student/AndroidManifest.xml` (`tools:node="remove"` — safe,
it was declared directly in `main/AndroidManifest.xml` and the student flavor
has zero camera-using code reachable from `main_student.dart`).

**Still present in the built student AAB, not touched:** `RECORD_AUDIO`,
`READ_PHONE_STATE`, and a `android.hardware.camera.any` `<uses-feature>`.
These aren't from this app's own manifest — they're auto-declared by the
native Android side of the `camera` / `mobile_scanner` /
`google_mlkit_face_detection` plugins, which `pubspec.yaml` lists once for
the whole project (not per-flavor), so their AARs get bundled into every
flavor's build regardless of whether that flavor's Dart entry point ever
reaches the code that uses them. `READ_PHONE_STATE` in particular is a
Play-flagged "sensitive permission" that requires a declared-use
justification in Play Console — worth a decision before submitting the
student app:
- **Leave as-is and justify in Play Console** (fastest — the permission
  question there accepts "bundled by a dependency, not used by this app
  variant" style answers, though Google review may push back), or
- **Strip the extra permissions/feature via manifest `tools:node="remove"`
  too** (same technique as the CAMERA fix) — mechanically simple, but should
  get an on-device smoke test of the student app afterward before trusting it
  release-wide, since it's touching permissions a bundled native plugin
  declared for itself, and
- **Longer-term real fix:** split the camera/ML-kit/tflite dependencies out
  of the shared `pubspec.yaml` so only the flavors that use them (teacher:
  `mobile_scanner`; attendance: `camera`+`google_mlkit_face_detection`+
  `tflite_flutter`) bundle them at all — a bigger change (per-flavor Flutter
  modules or package restructuring), not a same-session fix.

## Two things worth fixing/checking before you answer "encrypted"/"secure" honestly
1. `SUPABASE_APP_AUTH.sql` stores `app_password` as **plaintext**, compared
   with `=` (see `governance/BOOTSTRAP.md` — known, tracked, not fixed). This
   doesn't appear on the Data Safety form directly (that form is about data
   types, not encryption-at-rest specifics), but if Google's review ever asks
   about it, don't claim passwords are hashed — they aren't, today.
2. The Supabase anon key is hardcoded in `lib/app_bootstrap.dart` (intentionally
   public per Supabase's model — RLS is supposed to be the real gate) but RLS
   is disabled on 73 tables per the live advisor check. Not a Data Safety form
   question, but if you want this genuinely locked down before wider exposure
   via the Play Store, that's REQ-SEC-002 in `governance/planning/TODO.md` —
   flagging again since publishing increases the app's reach.

## Content rating questionnaire
This is a school-internal admin/utility app — no user-generated public content,
no chat between strangers (help-desk is student/teacher ↔ school office only),
no violence, gambling, or mature themes. Expect the mildest rating tier
(equivalent to "Everyone" / IARC "3+") on every category question — answer "No"
to violence, sexual content, profanity, controlled substances, gambling, and
user-generated-content-shared-publicly.

## Target audience & "Designed for Families" — needs your decision, not mine
The **student** app is used by actual school children (ages vary by grade,
plausibly including under-13). That does **not** automatically make it subject
to Google Play's Families Policy — the deciding factor is whether the app is
*designed for or primarily appeals to* children, vs. a restricted-access
utility that happens to be used by some. Points in favor of "not primarily
child-directed": login is school-issued (no open registration), the UI is
administrative (attendance/marks/fees/notices, not games or child-oriented
content), and it isn't discoverable/marketed to children directly. Points
against: real users under 13 exist.

**Get this one right before submitting** — ticking "primarily child-directed"
triggers Families Policy requirements (stricter ad/SDK rules, no behavioral
ads, COPPA-aligned consent flows) that this app doesn't currently implement
anything for; ticking the wrong way on the other side risks a policy strike
if Google disagrees on review. If you're unsure, Play Console's own help
center has a decision tree for "Is my app child-directed" — worth reading
before answering, this isn't something to guess on my end.
