import supabase from "./supabase";

// SEF (Satyam Education Foundation) — tuition-classes students. Deliberately
// separate from studentService.js: no class/section/academic-year
// enrollment system, just a flat student record (see database/sef_schema.sql).

export async function getStudents() {
  const { data, error } = await supabase
    .from("sef_students")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addStudent(student) {
  const { data, error } = await supabase
    .from("sef_students")
    .insert({
      name:           student.name,
      std:            student.std,
      medium:         student.medium || null,
      school_name:    student.schoolName || null,
      dob:            student.dob || null,
      father_name:    student.fatherName || null,
      mother_name:    student.motherName || null,
      mobile_1:       student.mobile1,
      mobile_2:       student.mobile2 || null,
      address:        student.address || null,
      aadhar_no:      student.aadharNo || null,
      aadhar_name:    student.aadharName || null,
      aadhar_doc_key: student.aadharDocKey || null,
      monthly_fee:    student.monthlyFee || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudent(id, student) {
  const { error } = await supabase
    .from("sef_students")
    .update({
      name:           student.name,
      std:            student.std,
      medium:         student.medium || null,
      school_name:    student.schoolName || null,
      dob:            student.dob || null,
      father_name:    student.fatherName || null,
      mother_name:    student.motherName || null,
      mobile_1:       student.mobile1,
      mobile_2:       student.mobile2 || null,
      address:        student.address || null,
      aadhar_no:      student.aadharNo || null,
      aadhar_name:    student.aadharName || null,
      aadhar_doc_key: student.aadharDocKey || null,
      monthly_fee:    student.monthlyFee || 0,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setStudentStatus(id, status) {
  const { error } = await supabase.from("sef_students").update({ status }).eq("id", id);
  if (error) throw error;
}
