"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, UserPlus, X, Pencil, Trash2, Save, Smartphone } from "lucide-react";
import supabase from "@/lib/supabase";
import useStore from "@/lib/store";
import { isValidName, isNonEmpty, hasNoErrors } from "@/lib/validators";

// Standalone file (not defined inside settings/page.js) so it can be
// imported from both the school's Settings and SEF's Settings
// (sef/settings/page.js) without one page.js importing another - Next.js's
// dev compiler hangs indefinitely on a page.js-to-page.js import, so this
// has to live in its own module. Manages admin_users, the same shared
// admin-panel login for both orgs (decided in SEF Phase 1), so the data is
// identical either place this is rendered.

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy w-full";
const sel = inp + " cursor-pointer";

function EditBar({ editMode, saved, onEdit, onSave, onCancel }) {
  if (!editMode) {
    return (
      <div className="flex justify-end">
        <button onClick={onEdit}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-school-navy text-white hover:bg-school-navy/90 transition-colors shadow-sm">
          <Pencil className="w-4 h-4"/> Edit
        </button>
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
        <X className="w-4 h-4"/> Cancel
      </button>
      <button onClick={onSave}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${saved ? "bg-green-500 text-white" : "bg-school-navy hover:bg-school-navy/90 text-white"}`}>
        {saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
        {saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}

const ROLE_LABELS = {
  management:   "Management Head",
  senior_admin: "Senior Admin",
  normal_admin: "Admin",
};
const ROLE_COLORS = {
  management:   "bg-red-100 text-red-700",
  senior_admin: "bg-purple-100 text-purple-700",
  normal_admin: "bg-blue-100 text-blue-700",
};
const DB_ROLES = ["management", "senior_admin", "normal_admin"];

export default function UsersRolesTab() {
  const authUser = useStore(s => s.authUser);
  // Linking an admin_users row to an employees row is what makes the Staff
  // App's mobile Admin Workspace reachable for that person (Staff App
  // Unification, STAFF-APP-DESIGN-FIXED.md §1). REQ-SEC-005 originally
  // restricted this - and creating/editing/deleting senior_admin+
  // management accounts - to management only; the user asked 2026-09-22
  // to give senior_admin full parity with management for all Users & Roles
  // management, so this now matches the server-side rule (admin_create_
  // user/admin_update_user/admin_delete_user/admin_set_employee_link all
  // allow senior_admin+management alike). Server-enforced regardless of
  // what this flag hides/shows.
  const isManagement = authUser?.role === "management" || authUser?.role === "senior_admin";

  // ── Users (real DB data) ──
  const [users,    setUsers]    = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [saved,    setSaved]    = useState(false);
  const [userSaveErr, setUserSaveErr] = useState("");

  // ── Employee links (mobile Admin Workspace) ──
  const [employeeLinks, setEmployeeLinks] = useState({}); // admin_user_id -> {employee_id, employee_name, emp_code}
  const [linkingFor, setLinkingFor] = useState(null); // admin_user_id currently showing the search box
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState([]);
  const [linkBusy, setLinkBusy] = useState(false);

  const loadEmployeeLinks = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_employee_links");
    if (error) return; // non-management callers get a permission error here - fine, just shows nothing
    const map = {};
    for (const row of data || []) map[row.admin_user_id] = row;
    setEmployeeLinks(map);
  }, []);

  useEffect(() => { if (isManagement) loadEmployeeLinks(); }, [isManagement, loadEmployeeLinks]);

  async function searchEmployeesForLink(q) {
    setLinkQuery(q);
    if (q.trim().length < 2) { setLinkResults([]); return; }
    const { data } = await supabase
      .from("employees")
      .select("id, name, emp_code")
      .or(`name.ilike.%${q.trim()}%,emp_code.ilike.%${q.trim()}%`)
      .limit(10);
    setLinkResults(data || []);
  }

  async function setLink(adminUserId, employeeId) {
    setLinkBusy(true);
    const { error } = await supabase.rpc("admin_set_employee_link", { p_admin_user_id: adminUserId, p_employee_id: employeeId });
    setLinkBusy(false);
    if (error) { alert("Failed to update link: " + error.message); return; }
    setLinkingFor(null); setLinkQuery(""); setLinkResults([]);
    loadEmployeeLinks();
  }

  const blank = { name:"", initials:"", role:"normal_admin" };
  const [form, setForm] = useState(blank);
  const [userErrors, setUserErrors] = useState({});
  const setF = k => e => { setForm(p => ({ ...p, [k]: e.target.value })); setUserErrors(p => ({ ...p, [k]: "" })); };

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const { data } = await supabase.from("admin_users").select("id, name, initials, role").order("name");
    setUsers(data || []);
    setUsersLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function startEdit() { setEditMode(true); }
  function doneEdit()  { setShowForm(false); setEditId(null); setEditMode(false); setUserSaveErr(""); }
  function cancel()    { setShowForm(false); setEditId(null); setEditMode(false); setUserSaveErr(""); }

  function openAdd()   { setForm(blank); setEditId(null); setUserErrors({}); setUserSaveErr(""); setShowForm(true); }
  function openEdit(u) { setForm({ name: u.name, initials: u.initials || "", role: u.role }); setEditId(u.id); setUserErrors({}); setUserSaveErr(""); setShowForm(true); }

  async function saveUser() {
    const e = {};
    if (!isValidName(form.name, { max: 80 })) e.name = "Enter a valid full name.";
    if (!isNonEmpty(form.initials) || form.initials.trim().length > 3) e.initials = "Enter 1-3 character initials.";
    setUserErrors(e);
    if (!hasNoErrors(e)) return;

    setUserSaveErr("");
    if (editId) {
      const { data, error } = await supabase.rpc("admin_update_user", {
        p_target_id: editId,
        p_name: form.name.trim(),
        p_initials: form.initials.trim().toUpperCase(),
        p_role: form.role,
      });
      if (error) { setUserSaveErr("Failed to update: " + error.message); return; }
      setUsers(prev => prev.map(u => u.id === editId ? data : u));
    } else {
      const { data, error } = await supabase.rpc("admin_create_user", {
        p_name: form.name.trim(),
        p_initials: form.initials.trim().toUpperCase(),
        p_role: form.role,
      });
      if (error) { setUserSaveErr("Failed to add: " + error.message); return; }
      setUsers(prev => [...prev, data]);
    }
    setShowForm(false);
    setEditId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function deleteUser(id) {
    if (!confirm("Remove this user's admin access? Their Supabase Auth account will remain.")) return;
    const { error } = await supabase.rpc("admin_delete_user", { p_target_id: id });
    if (error) { alert("Failed to remove user: " + error.message); return; }
    setUsers(prev => prev.filter(u => u.id !== id));
  }

  return (
    <div className="space-y-5">

      {/* ── Users List ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700">Admin Users</h3>
            <p className="text-xs text-gray-400 mt-0.5">{usersLoading ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""} registered`}</p>
          </div>
          <div className="flex items-center gap-2">
            {editMode && (
              <button onClick={openAdd}
                className="flex items-center gap-2 bg-school-navy hover:bg-school-navy/90 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                <UserPlus className="w-4 h-4"/> Add User
              </button>
            )}
            <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={doneEdit} onCancel={cancel}/>
          </div>
        </div>

        {editMode && showForm && (
          <div className="px-5 py-4 bg-blue-50/50 border-b border-blue-100">
            <p className="text-xs font-bold text-school-navy uppercase tracking-wide mb-4">
              {editId ? "Edit User" : "Add New User"}
            </p>
            {!editId && (
              <div className="mb-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <b>Note:</b> To add a new admin, first create them in Supabase Auth (Authentication → Users → Add User), then edit their name, initials &amp; role here.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Full Name">
                <input className={inp} placeholder="Enter name" value={form.name} onChange={setF("name")}/>
                <FieldError msg={userErrors.name}/>
              </Field>
              <Field label="Initials (1-3 chars)">
                <input className={inp} placeholder="e.g. RB" maxLength={3} value={form.initials} onChange={setF("initials")}/>
                <FieldError msg={userErrors.initials}/>
              </Field>
              <Field label="Role">
                <select className={sel} value={form.role} onChange={setF("role")}>
                  {DB_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </Field>
            </div>
            {userSaveErr && <p className="text-xs text-red-500 mt-2">{userSaveErr}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={saveUser}
                className="flex items-center gap-1.5 bg-school-navy text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-school-navy/90 transition-colors">
                <Check className="w-3.5 h-3.5"/>{editId ? "Update" : "Add User"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
                <X className="w-3.5 h-3.5"/>Cancel
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {usersLoading && (
            <div className="px-5 py-8 text-center text-xs text-gray-400">Loading admin users…</div>
          )}
          {!usersLoading && users.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-gray-400">No admin users found.</div>
          )}
          {users.map(u => (
            <div key={u.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-school-navy flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {u.initials || u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{u.id.slice(0, 8)}…</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                  {editMode && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5"/>
                      </button>
                      <button onClick={() => deleteUser(u.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Admin Workspace link - management only (server-enforced too) */}
              {isManagement && (
                <div className="mt-2 pl-12 flex items-center gap-2 text-xs">
                  <Smartphone className="w-3.5 h-3.5 text-gray-400"/>
                  {employeeLinks[u.id] ? (
                    <>
                      <span className="text-gray-500">Staff App: linked to <b className="text-gray-700">{employeeLinks[u.id].employee_name}</b> ({employeeLinks[u.id].emp_code})</span>
                      <button disabled={linkBusy} onClick={() => setLink(u.id, null)}
                        className="text-red-500 hover:underline disabled:opacity-50">Unlink</button>
                    </>
                  ) : linkingFor === u.id ? (
                    <div className="flex-1 relative">
                      <input autoFocus value={linkQuery} onChange={e => searchEmployeesForLink(e.target.value)}
                        placeholder="Search employee by name or code…"
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-school-navy"/>
                      <button onClick={() => { setLinkingFor(null); setLinkQuery(""); setLinkResults([]); }}
                        className="ml-2 text-gray-400 hover:text-gray-600">Cancel</button>
                      {linkResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {linkResults.map(e => (
                            <button key={e.id} disabled={linkBusy} onClick={() => setLink(u.id, e.id)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs disabled:opacity-50">
                              {e.name} <span className="text-gray-400">({e.emp_code})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="text-gray-400">Staff App: not linked</span>
                      <button onClick={() => setLinkingFor(u.id)} className="text-school-navy hover:underline">Link to employee</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {saved && (
        <div className="fixed bottom-6 right-6 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-pulse">
          <Check className="w-4 h-4"/> User saved successfully
        </div>
      )}
    </div>
  );
}
