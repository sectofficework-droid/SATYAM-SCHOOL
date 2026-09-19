import supabase from "./supabase";

const RETENTION_DAYS = 90;

export async function getDiagnosticReports() {
  // Lazy retention cleanup (REQ-HYG-006) — no cron job (this project's two
  // existing Vercel Cron slots are already used, and Hobby-tier projects
  // cap at 2), so cleanup instead piggybacks on someone actually opening
  // this page. Best-effort: never blocks or fails the page load.
  cleanupOldReports().catch(() => {});

  // Routed through admin_get_diagnostic_reports (TODO.md REQ-SEC-007 item
  // 3, fixed 2026-09-19) instead of a direct select - normal_admin now
  // gets summary rows only (no log_entries/stack traces), senior_admin/
  // management get full content, matching the decision recorded when this
  // gap was found.
  const { data, error } = await supabase.rpc("admin_get_diagnostic_reports");
  if (error) throw error;
  return data || [];
}

async function cleanupOldReports() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("diagnostic_reports").delete().lt("created_at", cutoff);
}

export async function markDiagnosticReport(id, status, reviewedBy) {
  const { error } = await supabase
    .from("diagnostic_reports")
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Logging on/off switch (diagnostic_settings, single row) ──────────────────

export async function getDiagnosticsEnabled() {
  const { data, error } = await supabase.from("diagnostic_settings").select("enabled").eq("id", 1).single();
  if (error) throw error;
  return !!data?.enabled;
}

export async function setDiagnosticsEnabled(enabled, updatedBy) {
  const { error } = await supabase
    .from("diagnostic_settings")
    .update({ enabled, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}
