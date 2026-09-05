import supabase from "./supabase";

// SEF Task Management — assignee status is admin-settable (no SEF staff
// app to self-report progress from, unlike the school's version).

export async function getTasks() {
  const { data, error } = await supabase
    .from("sef_tasks")
    .select("*, sef_task_assignees(status, employee:sef_employees(id, name))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addTask(form) {
  const { data, error } = await supabase.from("sef_tasks").insert({
    title: form.title, description: form.description || null,
    deadline_date: form.deadlineDate, deadline_time: form.deadlineTime || null,
    priority: form.priority, status: form.status || "Pending",
    show_on_dashboard: !!form.showOnDashboard,
  }).select().single();
  if (error) throw error;

  if (form.assigneeIds?.length) {
    const rows = form.assigneeIds.map(employee_id => ({ task_id: data.id, employee_id }));
    const { error: aErr } = await supabase.from("sef_task_assignees").insert(rows);
    if (aErr) throw aErr;
  }
  return data;
}

export async function updateTask(id, form) {
  const { error } = await supabase.from("sef_tasks").update({
    title: form.title, description: form.description || null,
    deadline_date: form.deadlineDate, deadline_time: form.deadlineTime || null,
    priority: form.priority, status: form.status, show_on_dashboard: !!form.showOnDashboard,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;

  const { data: existing } = await supabase.from("sef_task_assignees").select("employee_id").eq("task_id", id);
  const existingIds = new Set((existing || []).map(r => r.employee_id));
  const nextIds = new Set(form.assigneeIds || []);

  const toAdd = [...nextIds].filter(x => !existingIds.has(x));
  const toRemove = [...existingIds].filter(x => !nextIds.has(x));

  if (toAdd.length) await supabase.from("sef_task_assignees").insert(toAdd.map(employee_id => ({ task_id: id, employee_id })));
  if (toRemove.length) await supabase.from("sef_task_assignees").delete().eq("task_id", id).in("employee_id", toRemove);
}

export async function deleteTask(id) {
  const { error } = await supabase.from("sef_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function updateAssigneeStatus(taskId, employeeId, status) {
  const { error } = await supabase.from("sef_task_assignees").update({ status }).eq("task_id", taskId).eq("employee_id", employeeId);
  if (error) throw error;
}
