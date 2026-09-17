-- ─────────────────────────────────────────────────────────────────────────────
-- Server-side 1-to-many face match for the attendance kiosk.
--
-- What this replaces: the kiosk (face_punch_page.dart) used to call
-- fetchAllFaceEmbeddings(), downloading EVERY enrolled staff member's full
-- set of reference vectors (up to ~25 shots x 192 floats each, from
-- SUPABASE_FACE_PUNCH.sql's face_embedding jsonb column) to the phone on
-- EVERY single scan attempt, then looped over all of it client-side to find
-- the best cosine-similarity match. That was the original, deliberate
-- design (see face_embedding's own doc comment in SUPABASE_FACE_PUNCH.sql:
-- "stored as jsonb rather than a pgvector column since there's no
-- server-side similarity search here") - fine for the teacher app's 1-to-1
-- self-punch (matching against one row), but the kiosk's 1-to-many
-- identification downloads the WHOLE enrolled population every attempt.
-- Measured taking 6-11+ seconds on real kiosk network conditions
-- (SESSION-2026-09-15), sometimes timing out outright, and only gets worse
-- as more staff enroll.
--
-- match_face_embedding does the same comparison the client used to do, but
-- server-side: the phone sends its one live 192-float embedding, Postgres
-- compares it against every enrolled person's references itself, and
-- returns just the result - a name and two similarity scores, a few dozen
-- bytes instead of potentially hundreds of KB. No pgvector dependency (kept
-- as plain jsonb/plpgsql, matching the column's existing type exactly, so
-- this doesn't need an extension enabled or a data migration).
--
-- SECURITY DEFINER + a pinned search_path, matching record_face_punch's
-- convention (SUPABASE_MULTI_SHIFT_MIGRATION.sql) and the search_path-
-- hijacking concern documented in SUPABASE_FIX_CRYPT_SEARCHPATH.sql -
-- this function doesn't need pgcrypto so `public` alone is enough.
--
-- REQ-BUG-014 (governance/planning/TODO.md, 2026-09-17): the original
-- version of this function took the BEST OF EVERY INDIVIDUAL STORED SHOT
-- across every enrolled person (a nearest-neighbor search over N people x
-- ~22-25 shots each) rather than one stable reference per person. With 5
-- people enrolled (~116 raw vectors total, confirmed via direct query that
-- day), that let a single noisy/badly-lit/badly-angled shot from the WRONG
-- person occasionally outscore the true match - kMatchThreshold/
-- _matchMargin (face_punch_page.dart) were tuned with only ONE enrolled
-- person and never validated against real impostor attempts, so this was
-- the expected failure mode as headcount grew, not a random bug.
--
-- Fixed by averaging each person's shots into ONE L2-normalized centroid
-- (mean vector, renormalized) before comparing - collapses ~22-25 noisy
-- individual samples per person into a single stable "reference face",
-- removing the per-shot-outlier effect at its source instead of just
-- moving the accept threshold around. Comparison is now against 1 vector
-- per person (5 total, not ~116) - cheaper too, not just more robust.
-- Purely a function body change: same input/output signature, no schema
-- change, no client rebuild needed for any of the 3 mobile flavors.
--
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.match_face_embedding(p_embedding JSONB)
RETURNS TABLE (
  o_employee_id       UUID,
  o_employee_name     TEXT,
  o_best_similarity   DOUBLE PRECISION,
  o_second_similarity DOUBLE PRECISION,
  o_enrolled_count    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live        DOUBLE PRECISION[];
  v_dim         INT;
  v_ref         DOUBLE PRECISION[];
  v_emp         RECORD;
  v_ref_json    JSONB;
  v_sum         DOUBLE PRECISION[];
  v_shot_count  INT;
  v_centroid    DOUBLE PRECISION[];
  v_norm        DOUBLE PRECISION;
  v_dot         DOUBLE PRECISION;
  v_norm_a      DOUBLE PRECISION;
  v_norm_b      DOUBLE PRECISION;
  v_sim         DOUBLE PRECISION;
  v_i           INT;
  v_top_sim     DOUBLE PRECISION := -1;
  v_top_id      UUID;
  v_top_name    TEXT;
  v_second_sim  DOUBLE PRECISION := -1;
  v_count       INT := 0;
BEGIN
  SELECT ARRAY(SELECT jsonb_array_elements_text(p_embedding)::DOUBLE PRECISION) INTO v_live;
  v_dim := array_length(v_live, 1);

  FOR v_emp IN
    SELECT id, name, face_embedding
    FROM employees
    WHERE face_embedding IS NOT NULL
      AND status <> 'Inactive'
  LOOP
    -- Average THIS person's several reference shots into one centroid,
    -- rather than keeping each as a separate nearest-neighbor candidate
    -- (see the header comment / REQ-BUG-014) - a shot that doesn't match
    -- this person's own dimension count (shouldn't happen, but matches the
    -- old code's defensive IS NOT DISTINCT FROM check) is skipped rather
    -- than corrupting the running sum.
    v_sum := array_fill(0::DOUBLE PRECISION, ARRAY[v_dim]);
    v_shot_count := 0;

    FOR v_ref_json IN SELECT * FROM jsonb_array_elements(v_emp.face_embedding)
    LOOP
      SELECT ARRAY(SELECT jsonb_array_elements_text(v_ref_json)::DOUBLE PRECISION) INTO v_ref;
      IF array_length(v_ref, 1) IS NOT DISTINCT FROM v_dim THEN
        FOR v_i IN 1..v_dim LOOP
          v_sum[v_i] := v_sum[v_i] + v_ref[v_i];
        END LOOP;
        v_shot_count := v_shot_count + 1;
      END IF;
    END LOOP;

    IF v_shot_count = 0 THEN
      CONTINUE; -- no usable shots for this person - can't build a centroid
    END IF;

    v_centroid := array_fill(0::DOUBLE PRECISION, ARRAY[v_dim]);
    v_norm := 0;
    FOR v_i IN 1..v_dim LOOP
      v_centroid[v_i] := v_sum[v_i] / v_shot_count;
      v_norm := v_norm + v_centroid[v_i] * v_centroid[v_i];
    END LOOP;
    v_norm := sqrt(v_norm);
    IF v_norm > 0 THEN
      FOR v_i IN 1..v_dim LOOP
        v_centroid[v_i] := v_centroid[v_i] / v_norm;
      END LOOP;
    END IF;

    v_dot := 0; v_norm_a := 0; v_norm_b := 0;
    FOR v_i IN 1..v_dim LOOP
      v_dot    := v_dot    + v_live[v_i] * v_centroid[v_i];
      v_norm_a := v_norm_a + v_live[v_i] * v_live[v_i];
      v_norm_b := v_norm_b + v_centroid[v_i] * v_centroid[v_i];
    END LOOP;
    IF v_norm_a > 0 AND v_norm_b > 0 THEN
      v_sim := v_dot / (sqrt(v_norm_a) * sqrt(v_norm_b));
    ELSE
      v_sim := -1;
    END IF;

    -- Tracks best AND second-best ACROSS people - the client's
    -- match_margin check (face_punch_page.dart) needs the runner-up's
    -- score to confirm the winner is distinctively closer, not just barely
    -- ahead of a near-tie.
    v_count := v_count + 1;
    IF v_sim > v_top_sim THEN
      v_second_sim := v_top_sim;
      v_top_sim    := v_sim;
      v_top_id     := v_emp.id;
      v_top_name   := v_emp.name;
    ELSIF v_sim > v_second_sim THEN
      v_second_sim := v_sim;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_top_id, v_top_name, v_top_sim, v_second_sim, v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_face_embedding(JSONB) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running: SELECT * FROM match_face_embedding(
--   (SELECT face_embedding->0 FROM employees WHERE face_embedding IS NOT NULL LIMIT 1)
-- );
-- should return that same person as o_employee_id. o_best_similarity will
-- NOT be ~1.0 any more (that was the old best-of-raw-shots version matching
-- a shot against an identical copy of itself) - it's now that single shot
-- compared against this person's AVERAGED centroid, so expect something
-- noticeably lower but still clearly the highest-scoring person and well
-- separated from o_second_similarity.
-- ─────────────────────────────────────────────────────────────────────────────
