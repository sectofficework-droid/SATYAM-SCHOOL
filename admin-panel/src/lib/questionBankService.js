import supabase from "./supabase";

// Question Bank / Paper Generator - teachers build their own private
// question bank in the teacher app; this service reads a chosen teacher's
// bank (there's no per-teacher login on the admin panel, so "which teacher"
// has to be picked explicitly here) and records the papers generated from
// it. See mobile-app/SUPABASE_QUESTION_BANK.sql.

export async function getQuestionFilters(teacherId) {
  const { data, error } = await supabase
    .from("question_bank")
    .select("class, subject")
    .eq("teacher_id", teacherId);
  if (error) throw error;
  const classes = [...new Set((data || []).map(r => r.class))].sort();
  const subjects = [...new Set((data || []).map(r => r.subject))].sort();
  return { classes, subjects };
}

export async function getChapters(teacherId, className, subject) {
  const { data, error } = await supabase
    .from("question_bank")
    .select("chapter")
    .eq("teacher_id", teacherId)
    .eq("class", className)
    .eq("subject", subject);
  if (error) throw error;
  return [...new Set((data || []).map(r => r.chapter))].sort();
}

export async function getQuestions(teacherId, className, subject, chapters) {
  if (!chapters.length) return [];
  const { data, error } = await supabase
    .from("question_bank")
    .select("*")
    .eq("teacher_id", teacherId)
    .eq("class", className)
    .eq("subject", subject)
    .in("chapter", chapters)
    .order("created_at");
  if (error) throw error;
  return data || [];
}

export async function saveQuestionPaper(paper, questionIds) {
  const { data, error } = await supabase
    .from("question_papers")
    .insert({
      teacher_id: paper.teacherId,
      paper_type: paper.paperType,
      title: paper.title,
      class: paper.class,
      subject: paper.subject,
      duration_minutes: paper.durationMinutes || null,
      full_marks: paper.fullMarks,
      exam_date: paper.examDate || null,
    })
    .select()
    .single();
  if (error) throw error;

  if (questionIds.length) {
    const items = questionIds.map((qId, i) => ({ paper_id: data.id, question_id: qId, order_index: i }));
    const { error: itemsErr } = await supabase.from("question_paper_items").insert(items);
    if (itemsErr) throw itemsErr;
  }
  return data;
}

export async function getSavedPapers() {
  const { data, error } = await supabase
    .from("question_papers")
    .select("*, employees(name)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}
