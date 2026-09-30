import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Manages admin_users AND its matching Supabase Auth account together.
// admin_users.id must equal the auth.users.id it logs in as (auth.uid()
// is how every admin_* RPC/RLS policy resolves the caller's role) - the
// old admin_create_user RPC never set that id and admin_users.id has no
// default, so "Add User" always failed with a NOT NULL violation
// (confirmed via a rolled-back test insert). Creating/renaming/deleting
// the Auth side needs the Auth Admin API, which only works server-side
// with the service_role key - so this route owns both the Auth call and
// the admin_users write for each operation, instead of splitting the same
// action across a client RPC call and a separate server call.
//
// No hardcoded fallback key here, ever - see REQ-SEC-011 (TODO.md): a
// leaked service_role key bypasses all RLS on every table. It must come
// from environment configuration only, and this route fails loudly (not
// silently) if that configuration is missing.
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

const ROLES = ["normal_admin", "senior_admin", "management"];
const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
const isValidEmail = (v) => isNonEmpty(v) && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

// Re-derives the caller's identity from their own session token (never
// trusts a client-asserted role) and checks it against admin_users - the
// same authorization rule the retired RPCs enforced.
async function requireCaller(request, supabaseAdmin) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { errorResponse: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) return { errorResponse: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: caller } = await supabaseAdmin.from("admin_users").select("id, role").eq("id", user.id).single();
  if (!caller || !["senior_admin", "management"].includes(caller.role)) {
    return { errorResponse: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }
  return { caller };
}

// ── List (admin_users enriched with the real login email from auth.users,
// which admin_users itself doesn't store) ──────────────────────────────
export async function GET(request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
  const { errorResponse } = await requireCaller(request, supabaseAdmin);
  if (errorResponse) return errorResponse;

  const { data: rows, error: rowsErr } = await supabaseAdmin.from("admin_users").select("id, name, initials, role").order("name");
  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 400 });

  const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });
  const emailById = new Map((authList?.users || []).map((u) => [u.id, u.email]));

  return NextResponse.json({ data: (rows || []).map((r) => ({ ...r, email: emailById.get(r.id) || "" })) });
}

// ── Create: new Supabase Auth account (email+password), then the
// matching admin_users row using that same id ──────────────────────────
export async function POST(request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
  const { errorResponse } = await requireCaller(request, supabaseAdmin);
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const name = (body.name || "").trim();
  const initials = (body.initials || "").trim().toUpperCase();
  const role = body.role;
  const email = (body.email || "").trim();
  const password = body.password || "";
  const linkExistingId = body.linkExistingId || null;

  if (!name) return NextResponse.json({ error: "Enter a valid full name." }, { status: 400 });
  if (!initials || initials.length > 3) return NextResponse.json({ error: "Enter 1-3 character initials." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  // A password is only needed when actually creating a new login - linking
  // an existing one keeps its current password untouched.
  if (!linkExistingId && password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  // ── Link an already-confirmed existing Auth account (client resubmits
  // with this after the "needsLink" response below) ──────────────────────
  if (linkExistingId) {
    const { data: alreadyLinked } = await supabaseAdmin.from("admin_users").select("id").eq("id", linkExistingId).single();
    if (alreadyLinked) return NextResponse.json({ error: "This account is already an admin." }, { status: 409 });

    const { data: row, error: insertErr } = await supabaseAdmin
      .from("admin_users")
      .insert({ id: linkExistingId, name, initials, role })
      .select()
      .single();
    if (insertErr) return NextResponse.json({ error: "Failed to save admin: " + insertErr.message }, { status: 400 });

    return NextResponse.json({ data: { ...row, email } });
  }

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr) {
    // "This email is already registered" - offer to link the existing Auth
    // account instead of just failing (REQ-BUG-059: no way to add an admin
    // for an email that already has a login, e.g. a pre-existing account
    // created before this route existed).
    const isDuplicateEmail = createErr.code === "email_exists" || /already.*registered|already.*exists/i.test(createErr.message || "");
    if (isDuplicateEmail) {
      const { data: authList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const existing = listErr ? null : (authList?.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        const { data: alreadyLinked } = await supabaseAdmin.from("admin_users").select("id").eq("id", existing.id).single();
        if (alreadyLinked) {
          return NextResponse.json({ error: "This email is already registered to an admin." }, { status: 409 });
        }
        return NextResponse.json(
          { needsLink: true, existingUserId: existing.id, error: "An account already exists for this email." },
          { status: 409 }
        );
      }
    }
    return NextResponse.json({ error: "Failed to create login: " + createErr.message }, { status: 400 });
  }

  const { data: row, error: insertErr } = await supabaseAdmin
    .from("admin_users")
    .insert({ id: created.user.id, name, initials, role })
    .select()
    .single();
  if (insertErr) {
    // Compensate: don't leave an orphaned Auth account with no admin_users row.
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Failed to save admin: " + insertErr.message }, { status: 400 });
  }

  return NextResponse.json({ data: { ...row, email } });
}

// ── Update: name/initials/role always; email/password only if provided
// (blank password = leave the current one unchanged) ───────────────────
export async function PATCH(request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
  const { caller, errorResponse } = await requireCaller(request, supabaseAdmin);
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const targetId = body.targetId;
  const name = (body.name || "").trim();
  const initials = (body.initials || "").trim().toUpperCase();
  const role = body.role;
  const email = (body.email || "").trim();
  const password = body.password || "";

  if (!targetId) return NextResponse.json({ error: "Missing target user." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Enter a valid full name." }, { status: 400 });
  if (!initials || initials.length > 3) return NextResponse.json({ error: "Enter 1-3 character initials." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password && password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

  const { data: target } = await supabaseAdmin.from("admin_users").select("id, role").eq("id", targetId).single();
  if (!target) return NextResponse.json({ error: "Target user not found." }, { status: 404 });
  if (targetId === caller.id && role !== target.role) {
    return NextResponse.json({ error: "Cannot change your own role." }, { status: 400 });
  }

  const { data: row, error: updateErr } = await supabaseAdmin
    .from("admin_users")
    .update({ name, initials, role })
    .eq("id", targetId)
    .select()
    .single();
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  const authUpdate = {};
  if (email) authUpdate.email = email;
  if (password) authUpdate.password = password;
  if (Object.keys(authUpdate).length) {
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(targetId, authUpdate);
    if (authErr) {
      return NextResponse.json({ error: "Saved name/initials/role, but failed to update login: " + authErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ data: { ...row, email } });
}

// ── Delete: the admin_users row AND the Supabase Auth account - "on DB
// level" means fully removed, not left as an orphaned login nobody can
// see or manage from this screen anymore ────────────────────────────────
export async function DELETE(request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
  const { caller, errorResponse } = await requireCaller(request, supabaseAdmin);
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const targetId = body.targetId;
  if (!targetId) return NextResponse.json({ error: "Missing target user." }, { status: 400 });
  if (targetId === caller.id) return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });

  const { data: target } = await supabaseAdmin.from("admin_users").select("id").eq("id", targetId).single();
  if (!target) return NextResponse.json({ error: "Target user not found." }, { status: 404 });

  const { error: deleteErr } = await supabaseAdmin.from("admin_users").delete().eq("id", targetId);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 400 });

  const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (authDeleteErr) {
    return NextResponse.json({ success: true, warning: "Removed admin access, but failed to delete the login account: " + authDeleteErr.message });
  }

  return NextResponse.json({ success: true });
}
