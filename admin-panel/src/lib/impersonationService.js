import supabase from "./supabase";

// Generates a short-lived, single-use access code for a student/employee's
// account. Restricted server-side to management/senior_admin admin_users
// (see mobile-app/SUPABASE_IMPERSONATION.sql). Returns { code, expires_at,
// target_label }; the code can be redeemed once, inside 10 minutes, from
// the mobile app's "Have an Admin Access Code?" login option.
export async function createImpersonationCode(targetType, targetId) {
  const { data, error } = await supabase.rpc("create_impersonation_code", {
    p_target_type: targetType,
    p_target_id: targetId,
  });
  if (error) throw error;
  return data;
}

export async function getImpersonationAuditLog(limit = 200) {
  const { data, error } = await supabase.rpc("get_impersonation_audit_log", {
    p_limit: limit,
  });
  if (error) throw error;
  return data;
}
