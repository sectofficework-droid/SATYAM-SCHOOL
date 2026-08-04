-- ─────────────────────────────────────────────────────────────────────────────
-- In-app "update available" check for the sideloaded (non-Play-Store) mobile
-- app. Admin publishes a new APK (uploaded to S3 under app/) with an
-- incrementing version_code; the app compares its own installed build number
-- (via package_info_plus) against the newest row here on every launch.
-- Same convention as every table added this session: RLS disabled, anon grants.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name  TEXT NOT NULL,               -- shown to users, e.g. '1.4.0'
  version_code  INTEGER NOT NULL,            -- must be > pubspec's build number for an update to be offered
  apk_key       TEXT NOT NULL,               -- S3 object key, e.g. 'app/satyam-school-1.4.0.apk'
  release_notes TEXT,
  force_update  BOOLEAN NOT NULL DEFAULT false, -- true = dialog can't be dismissed with "Later"
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_versions_version_code ON app_versions(version_code DESC);

ALTER TABLE app_versions DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_versions TO anon;
