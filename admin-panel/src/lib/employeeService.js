import supabase from "./supabase";

function mapFromDB(row) {
  return {
    id:              row.id,
    empId:           row.emp_code,
    name:            row.name,
    photo:           row.photo_url || null,
    type:            row.type,
    designation:     row.designation,
    department:      row.department || "",
    gender:          row.gender || "",
    dob:             row.dob || "",
    phone:           row.phone || "",
    altPhone:        row.alt_phone || "",
    email:           row.email || "",
    address:         row.address || "",
    aadhar:          row.aadhar || "",
    pan:             row.pan || "",
    joiningDate:     row.joining_date || "",
    employmentType:  row.employment_type || "Permanent",
    status:          row.status || "Active",
    classTeacherOf:  row.class_teacher_of_section_id || null,
    subjectMappings: row.subject_mappings || [],
    documents:       row.documents || [],
  };
}

function mapToDB(emp) {
  return {
    emp_code:                    emp.empId,
    name:                        emp.name,
    photo_url:                   emp.photo || null,
    type:                        emp.type,
    designation:                 emp.designation,
    department:                  emp.department || null,
    gender:                      emp.gender || null,
    dob:                         emp.dob || null,
    phone:                       emp.phone || null,
    alt_phone:                   emp.altPhone || null,
    email:                       emp.email || null,
    address:                     emp.address || null,
    aadhar:                      emp.aadhar || null,
    pan:                         emp.pan || null,
    joining_date:                emp.joiningDate || null,
    employment_type:             emp.employmentType || null,
    status:                      emp.status || "Active",
    class_teacher_of_section_id: emp.classTeacherOf || null,
    subject_mappings:            emp.subjectMappings || [],
    documents:                   emp.documents || [],
    updated_at:                  new Date().toISOString(),
  };
}

export async function getEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("emp_code");
  if (error) throw error;
  return (data || []).map(mapFromDB);
}

export async function addEmployee(emp) {
  const { data, error } = await supabase
    .from("employees")
    .insert(mapToDB(emp))
    .select()
    .single();
  if (error) throw error;
  return mapFromDB(data);
}

export async function updateEmployee(id, emp) {
  const { error } = await supabase
    .from("employees")
    .update(mapToDB(emp))
    .eq("id", id);
  if (error) throw error;
}
