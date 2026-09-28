-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron schedule for auto-close-shifts.
--
-- SEPARATE from SUPABASE_AUTO_CLOSE_SHIFTS.sql so the core migration can be
-- applied even if pg_cron is unavailable (e.g. free tier limitations).
--
-- If this fails, the auto_close_open_shifts() RPC still works — it just needs
-- to be called manually or via an external scheduler (e.g. Vercel cron).
--
-- Run this in Supabase Dashboard → SQL Editor AFTER the main migration
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Unschedule first if already exists (idempotent)
SELECT cron.unschedule('auto-close-shifts') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-close-shifts'
);

SELECT cron.schedule(
  'auto-close-shifts',
  '*/15 * * * *',
  $$SELECT auto_close_open_shifts()$$
);
