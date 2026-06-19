import supabase from "./supabase";

function mapTask(row) {
  const assignees = (row.task_assignees || [])
    .map(a => ({ id: a.employee?.id, name: a.employee?.name || "" }))
    .filter(a => a.id);
  return {
    id:              row.id,
    title:           row.title,
    description:     row.description   || "",
    deadline:        row.deadline_date  || "",
    deadlineTime:    row.deadline_time  ? String(row.deadline_time).slice(0, 5) : "",
    priority:        row.priority      || "Medium",
    status:          row.status        || "Pending",
    createdAt:       row.created_at?.slice(0, 10) || "",
    assignedTo:      assignees.map(a => a.name),
    assigneeIds:     assignees.map(a => a.id),
    showOnDashboard: row.show_on_dashboard || false,
  };
}

export async function getTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, task_assignees(employee:employees(id, name))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapTask);
}

export async function addTask(form) {
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .insert({
      title:         form.title,
      description:   form.description  || null,
      deadline_date: form.deadline     || null,
      deadline_time: form.deadlineTime || null,
      priority:      form.priority,
      status:        "Pending",
    })
    .select()
    .single();
  if (taskErr) throw taskErr;

  const ids = form.assigneeIds || [];
  if (ids.length) {
    const { error: aErr } = await supabase
      .from("task_assignees")
      .insert(ids.map(id => ({ task_id: task.id, employee_id: id })));
    if (aErr) throw aErr;
  }

  if (form.showOnDashboard) {
    await supabase.from("tasks").update({ show_on_dashboard: true }).eq("id", task.id);
  }

  return mapTask({ ...task, task_assignees: (form.assigneeIds || []).map((id, i) => ({
    employee: { id, name: (form.assignedTo || [])[i] || "" }
  })), show_on_dashboard: form.showOnDashboard || false });
}

export async function updateTask(id, form) {
  const { error: taskErr } = await supabase
    .from("tasks")
    .update({
      title:         form.title,
      description:   form.description  || null,
      deadline_date: form.deadline     || null,
      deadline_time: form.deadlineTime || null,
      priority:      form.priority,
      status:        form.status,
    })
    .eq("id", id);
  if (taskErr) throw taskErr;

  await supabase.from("tasks").update({ show_on_dashboard: form.showOnDashboard || false }).eq("id", id);

  await supabase.from("task_assignees").delete().eq("task_id", id);
  const ids = form.assigneeIds || [];
  if (ids.length) {
    const { error: aErr } = await supabase
      .from("task_assignees")
      .insert(ids.map(eid => ({ task_id: id, employee_id: eid })));
    if (aErr) throw aErr;
  }

  return { ...form, id };
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function updateTaskStatus(id, status) {
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function getDashboardTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, task_assignees(employee:employees(id, name))")
    .eq("show_on_dashboard", true)
    .neq("status", "Completed")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map(mapTask);
}

export async function getEmployeesForTasks() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, name")
    .eq("status", "Active")
    .order("name");
  if (error) throw error;
  return data || [];
}
