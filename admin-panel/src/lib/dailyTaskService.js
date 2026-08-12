import supabase from "./supabase";

function mapTask(row) {
  const targets = (row.daily_task_targets || [])
    .map(t => ({ id: t.employee?.id, name: t.employee?.name || "" }))
    .filter(t => t.id);
  return {
    id:          row.id,
    title:       row.title,
    description: row.description || "",
    targetType:  row.target_type,
    targetIds:   targets.map(t => t.id),
    targetNames: targets.map(t => t.name),
    createdAt:   row.created_at?.slice(0, 10) || "",
  };
}

export async function getDailyTasks() {
  const { data, error } = await supabase
    .from("daily_tasks")
    .select("*, daily_task_targets(employee:employees(id, name))")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapTask);
}

export async function addDailyTask(form) {
  const { data: task, error: taskErr } = await supabase
    .from("daily_tasks")
    .insert({
      title:       form.title,
      description: form.description || null,
      target_type: form.targetType,
    })
    .select()
    .single();
  if (taskErr) throw taskErr;

  const ids = form.targetType === "specific" ? (form.employeeIds || []) : [];
  if (ids.length) {
    const { error: tErr } = await supabase
      .from("daily_task_targets")
      .insert(ids.map(id => ({ daily_task_id: task.id, employee_id: id })));
    if (tErr) throw tErr;
  }

  return mapTask({ ...task, daily_task_targets: ids.map((id, i) => ({
    employee: { id, name: (form.employeeNames || [])[i] || "" }
  })) });
}

export async function updateDailyTask(id, form) {
  const { error: taskErr } = await supabase
    .from("daily_tasks")
    .update({
      title:       form.title,
      description: form.description || null,
      target_type: form.targetType,
    })
    .eq("id", id);
  if (taskErr) throw taskErr;

  // Diff targets instead of delete-all + reinsert (same pattern as taskService.js).
  const { data: existingRows, error: existErr } = await supabase
    .from("daily_task_targets")
    .select("employee_id")
    .eq("daily_task_id", id);
  if (existErr) throw existErr;
  const existingIds = (existingRows || []).map(r => r.employee_id);
  const newIds       = form.targetType === "specific" ? (form.employeeIds || []) : [];

  const toRemove = existingIds.filter(eid => !newIds.includes(eid));
  const toAdd    = newIds.filter(eid => !existingIds.includes(eid));

  if (toRemove.length) {
    const { error: rErr } = await supabase
      .from("daily_task_targets")
      .delete()
      .eq("daily_task_id", id)
      .in("employee_id", toRemove);
    if (rErr) throw rErr;
  }
  if (toAdd.length) {
    const { error: aErr } = await supabase
      .from("daily_task_targets")
      .insert(toAdd.map(eid => ({ daily_task_id: id, employee_id: eid })));
    if (aErr) throw aErr;
  }

  const { data: fresh, error: freshErr } = await supabase
    .from("daily_tasks")
    .select("*, daily_task_targets(employee:employees(id, name))")
    .eq("id", id)
    .single();
  if (freshErr) throw freshErr;
  return mapTask(fresh);
}

// Soft delete - keeps completion history meaningful after a routine is retired.
export async function deactivateDailyTask(id) {
  const { error } = await supabase.from("daily_tasks").update({ active: false }).eq("id", id);
  if (error) throw error;
}

// A given date's completion board as a matrix: consistent task columns
// across every active employee row, each cell marked not-applicable /
// pending / done-with-time - so the admin table doesn't need to reshape
// itself per employee.
export async function getCompletionStatus(date) {
  const [{ data: tasks, error: tErr }, { data: employees, error: eErr }, { data: completions, error: cErr }] =
    await Promise.all([
      supabase.from("daily_tasks").select("*, daily_task_targets(employee_id)").eq("active", true).order("created_at"),
      supabase.from("employees").select("id, name").eq("status", "Active").order("name"),
      supabase.from("daily_task_completions").select("daily_task_id, employee_id, completed_at").eq("completion_date", date),
    ]);
  if (tErr) throw tErr;
  if (eErr) throw eErr;
  if (cErr) throw cErr;

  const completedAt = new Map(
    (completions || []).map(c => [`${c.daily_task_id}:${c.employee_id}`, c.completed_at])
  );

  const taskList = (tasks || []).map(t => ({
    id:         t.id,
    title:      t.title,
    targetType: t.target_type,
    targetIds:  new Set((t.daily_task_targets || []).map(x => x.employee_id)),
  }));

  const rows = (employees || []).map(emp => ({
    employeeId:   emp.id,
    employeeName: emp.name,
    cells: Object.fromEntries(taskList.map(t => {
      const applicable = t.targetType === "all" || t.targetIds.has(emp.id);
      return [t.id, { applicable, completedAt: applicable ? (completedAt.get(`${t.id}:${emp.id}`) || null) : null }];
    })),
  }));

  return { tasks: taskList.map(t => ({ id: t.id, title: t.title })), rows };
}
