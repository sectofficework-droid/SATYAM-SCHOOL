import supabase from "./supabase";

// SEF Question Bank + Papers. Unlike the school (where teachers populate
// the bank from their phone), there's no SEF tutor app yet, so admin adds
// questions here directly. Paper generation mirrors the school's
// Std/Class -> Subject flow (questionBankService.js), just std-keyed.

// ── Question Bank management (admin-authored) ────────────────────
export async function addQuestion(q) {
  const { error } = await supabase.from("sef_question_bank").insert({
    std: q.std, subject: q.subject, chapter: q.chapter,
    question_format: q.questionFormat || "Written", marks: q.marks || 1,
    question_text: q.questionText, options: q.options || null, correct_option: q.correctOption || null,
  });
  if (error) throw error;
}

export async function deleteQuestion(id) {
  const { error } = await supabase.from("sef_question_bank").delete().eq("id", id);
  if (error) throw error;
}

export async function getQuestionsForChapter(std, subject, chapter) {
  const { data, error } = await supabase.from("sef_question_bank").select("*")
    .eq("std", std).eq("subject", subject).eq("chapter", chapter).order("created_at");
  if (error) throw error;
  return data || [];
}

// ── Paper generation (Std -> Subject -> Chapters -> Questions) ─────
export async function getStdsWithQuestions() {
  const { data, error } = await supabase.from("sef_question_bank").select("std");
  if (error) throw error;
  return [...new Set((data || []).map(r => r.std))].sort();
}

export async function getSubjectsForStd(std) {
  const { data, error } = await supabase.from("sef_question_bank").select("subject").eq("std", std);
  if (error) throw error;
  return [...new Set((data || []).map(r => r.subject))].sort();
}

export async function getChapters(std, subject) {
  const { data, error } = await supabase.from("sef_question_bank").select("chapter").eq("std", std).eq("subject", subject);
  if (error) throw error;
  return [...new Set((data || []).map(r => r.chapter))].sort();
}

export async function getQuestions(std, subject, chapters) {
  if (!chapters.length) return [];
  const { data, error } = await supabase.from("sef_question_bank").select("*")
    .eq("std", std).eq("subject", subject).in("chapter", chapters).order("created_at");
  if (error) throw error;
  return data || [];
}

export async function saveQuestionPaper(paper, questionIds) {
  const { data, error } = await supabase.from("sef_question_papers").insert({
    paper_type: paper.paperType, title: paper.title, std: paper.std, subject: paper.subject,
    duration_minutes: paper.durationMinutes || null, full_marks: paper.fullMarks, exam_date: paper.examDate || null,
  }).select().single();
  if (error) throw error;

  if (questionIds.length) {
    const items = questionIds.map((qId, i) => ({ paper_id: data.id, question_id: qId, order_index: i }));
    const { error: itemsErr } = await supabase.from("sef_question_paper_items").insert(items);
    if (itemsErr) throw itemsErr;
  }
  return data;
}

export async function getSavedPapers() {
  const { data, error } = await supabase.from("sef_question_papers").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}
