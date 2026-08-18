import supabase from "./supabase";

// SEF Syllabus — admin-authored directly (no SEF tutor app writes here),
// so unlike the school's syllabus there's no lock/edit-request workflow.

export async function getSyllabus(std, subject) {
  let query = supabase.from("sef_syllabus").select("*, tutor:sef_employees(id, name)").order("created_at");
  if (std) query = query.eq("std", std);
  if (subject) query = query.eq("subject", subject);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getSubtopicsForChapters(chapterIds) {
  if (!chapterIds.length) return [];
  const { data, error } = await supabase.from("sef_syllabus_subtopics").select("*").in("chapter_id", chapterIds).order("sort_order");
  if (error) throw error;
  return data || [];
}

export async function addChapters(std, subject, chapterNames, tutorId) {
  const rows = chapterNames.map(chapter => ({ std, subject, chapter, tutor_id: tutorId || null }));
  const { error } = await supabase.from("sef_syllabus").insert(rows);
  if (error) throw error;
}

export async function updateChapterStatus(id, status) {
  const { error } = await supabase.from("sef_syllabus").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteChapter(id) {
  const { error } = await supabase.from("sef_syllabus").delete().eq("id", id);
  if (error) throw error;
}

export async function addSubtopics(chapterId, names) {
  const rows = names.map((name, i) => ({ chapter_id: chapterId, name, sort_order: i }));
  const { error } = await supabase.from("sef_syllabus_subtopics").insert(rows);
  if (error) throw error;
}

export async function updateSubtopicStatus(id, status) {
  const { error } = await supabase.from("sef_syllabus_subtopics").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteSubtopic(id) {
  const { error } = await supabase.from("sef_syllabus_subtopics").delete().eq("id", id);
  if (error) throw error;
}
