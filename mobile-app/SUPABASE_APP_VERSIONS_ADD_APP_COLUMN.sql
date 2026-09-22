-- app_versions had no per-flavor column, so the in-app update checker
-- (fetchLatestAppVersion / app_update.dart) could only ever serve one
-- apk_key to every flavor (Teacher/Student/Attendance) at once. The table
-- was still empty (never actually used) when this was found, while fixing
-- the REQ-SEC-002 Category 3 Group A production regression (2026-09-21) --
-- see governance/planning/TODO.md for that incident.
--
-- Adds a required `app` column so each flavor gets its own latest-version
-- row, matching AppConfig.lockedRole.name ('teacher' | 'student' | 'kiosk',
-- the UserRole enum's own names) as used by fetchLatestAppVersion(app).

ALTER TABLE app_versions
  ADD COLUMN app text;

ALTER TABLE app_versions
  ADD CONSTRAINT app_versions_app_check CHECK (app IN ('teacher','student','kiosk'));

ALTER TABLE app_versions
  ALTER COLUMN app SET NOT NULL;

CREATE INDEX app_versions_app_version_code_idx ON app_versions (app, version_code DESC);
