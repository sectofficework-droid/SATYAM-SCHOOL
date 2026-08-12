import supabase from "./supabase";

// Question Bank / Paper Generator - teachers build their own private
// question bank in the teacher app (still scoped by teacher_id there); the
// admin panel used to require picking that teacher first, but admin rarely
// remembers which teacher owns which class+subject, so this instead
// searches question_bank across every teacher once Class + Subject are
// picked. A generated paper can therefore mix questions from more than one
// teacher, which is why question_papers.teacher_id is now nullable (see
// SUPABASE_QUESTION_BANK_V3.sql) and saveQuestionPaper no longer sets it.

export async function getClassesWithQuestions() {
  const { data, error } = await supabase.from("question_bank").select("class");
  if (error) throw error;
  return [...new Set((data || []).map(r => r.class))].sort();
}

export async function getSubjectsForClass(className) {
  const { data, error } = await supabase
    .from("question_bank")
    .select("subject")
    .eq("class", className);
  if (error) throw error;
  return [...new Set((data || []).map(r => r.subject))].sort();
}

export async function getChapters(className, subject) {
  const { data, error } = await supabase
    .from("question_bank")
    .select("chapter")
    .eq("class", className)
    .eq("subject", subject);
  if (error) throw error;
  return [...new Set((data || []).map(r => r.chapter))].sort();
}

// Includes the contributing teacher's name per question - since the whole
// point of dropping the teacher-first picker is that admin doesn't track
// who owns what, it's worth surfacing that as context once questions from
// possibly-different teachers are mixed together in one list.
export async function getQuestions(className, subject, chapters) {
  if (!chapters.length) return [];
  const { data, error } = await supabase
    .from("question_bank")
    .select("*, teacher:employees(name)")
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
