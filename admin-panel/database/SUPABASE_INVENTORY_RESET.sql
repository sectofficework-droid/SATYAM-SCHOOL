-- Inventory reset feature: lets a "management"-role admin wipe core
-- inventory data to start fresh, after snapshotting it for recovery.
-- Applied directly to the live DB via Supabase MCP on 2026-11-18.

CREATE TABLE IF NOT EXISTS inventory_reset_backups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ DEFAULT now(),
  created_by   UUID REFERENCES admin_users(id),
  items_count  INT NOT NULL,
  snapshot     JSONB NOT NULL
);

ALTER TABLE inventory_reset_backups ENABLE ROW LEVEL SECURITY;
-- No policies: this table is reachable only through the SECURITY DEFINER
-- function below (or manual SQL), never directly from the client. Matches
-- this project's existing RPC-only-table pattern (see
-- mobile-app/SUPABASE_LOCK_RPC_ONLY_TABLES.sql) - RLS with no policies
-- already blocks anon/authenticated from every row, and this project's
-- default privileges grant table access to anon on every new table, so
-- anon is revoked explicitly too, for defense in depth.
REVOKE ALL ON public.inventory_reset_backups FROM anon;

CREATE OR REPLACE FUNCTION public.reset_core_inventory_data(p_confirm TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot    JSONB;
  v_items_count INT;
  v_backup_id   UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid() AND role = 'management'
  ) THEN
    RAISE EXCEPTION 'Only management can reset inventory data';
  END IF;

  IF p_confirm IS DISTINCT FROM 'RESET' THEN
    RAISE EXCEPTION 'Confirmation phrase mismatch';
  END IF;

  SELECT count(*) INTO v_items_count FROM inventory_items;

  v_snapshot := jsonb_build_object(
    'inventory_items',               (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM inventory_items t),
    'inventory_batches',             (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM inventory_batches t),
    'inventory_usages',              (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM inventory_usages t),
    'student_inventory_assignments', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM student_inventory_assignments t)
  );

  INSERT INTO inventory_reset_backups (created_by, items_count, snapshot)
  VALUES (auth.uid(), v_items_count, v_snapshot)
  RETURNING id INTO v_backup_id;

  -- student_inventory_assignments.item_id has no ON DELETE action, so it
  -- must be cleared before inventory_items or this hits a 23503 FK
  -- violation (same constraint deleteInventoryItem() works around today).
  DELETE FROM student_inventory_assignments
  WHERE item_id IN (SELECT id FROM inventory_items);

  -- inventory_batches/inventory_usages cascade via their own FK.
  DELETE FROM inventory_items;

  RETURN jsonb_build_object('backup_id', v_backup_id, 'items_deleted', v_items_count);
END;
$$;

-- A bare "REVOKE ... FROM PUBLIC" was not enough here - this project grants
-- EXECUTE on new public functions to anon by default (ALTER DEFAULT
-- PRIVILEGES), so anon must be revoked explicitly too. Not exploitable
-- either way (the admin_users/role check inside the function still blocks
-- anon, which has no auth.uid()), but keep the grant itself tight.
REVOKE ALL ON FUNCTION public.reset_core_inventory_data(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_core_inventory_data(TEXT) TO authenticated;
