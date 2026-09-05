import supabase from "./supabase";

// Read-only admin view of the teacher app's Question Bank module - teachers
// upload documents (Assignment / Exam Paper / Question Bank sections) via
// the mobile app; this just browses what's already there. See
// mobile-app/SUPABASE_TEACHER_DOCUMENTS.sql for the table this reads, and
// s3Upload.js's getS3ViewUrl for how a document is actually opened
// (question-bank/ is already in both S3 API routes' allowed-key prefixes).

export async function getTeacherDocuments(section) {
  const { data, error } = await supabase
    .from("teacher_documents")
    .select("*, teacher:employees(name)")
    .eq("section", section)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
