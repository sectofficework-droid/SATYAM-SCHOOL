import supabase from "./supabase";
import { DEFAULT_DOCS } from "./constants";

// ── Class name normalisation (DB stores "JR KG", app uses "JR.KG") ───────────
const CLASS_NAME_MAP = {
  "JR KG":          "JR.KG",
  "SR KG":          "SR.KG",
  "11th Commerce":  "11th - Commerce",
  "12th Commerce":  "12th - Commerce",
};
function normClass(name) {
  return CLASS_NAME_MAP[name] || name || "";
}

// Red Bag is for Balvatika/JR.KG/SR.KG/1st/2nd, Blue Bag is for 3rd and above —
// a student should only ever get the one that matches their class.
const JUNIOR_CLASSES = new Set(["JR.KG", "SR.KG", "Balvatika", "1st", "2nd", "JR KG", "SR KG"]);
export function bagItemAllowedForClass(itemName, std) {
  const isJunior = JUNIOR_CLASSES.has(String(std || "").trim());
  if (itemName === "Red Bag")  return isJunior;
  if (itemName === "Blue Bag") return !isJunior;
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Convert DB row (enrollment + student join) → frontend student shape
export function mapToStudent(enrollment) {
  const s = enrollment.student;
  if (!s) return null;

  const paidAmount = enrollment.fee_payments
    ? enrollment.fee_payments.reduce((sum, p) => sum + (p.amount || 0), 0)
    : 0;

  const uploadedDocNames = new Set(
    (enrollment.student?.student_documents || [])
      .filter(d => d.status === "Uploaded")
      .map(d => d.document_types?.name)
      .filter(Boolean)
  );
  const hasPrevSchool = !!(s.student_previous_school?.[0]?.school_name);
  const notRequired   = hasPrevSchool ? [] : ["Leaving Certificate", "Marksheet"];
  const pendingDocs   = DEFAULT_DOCS.filter(name => !uploadedDocNames.has(name) && !notRequired.includes(name));

  const std = normClass(enrollment.class?.name);
  const applicableAssignments = (enrollment.student_inventory_assignments || [])
    .filter(a => bagItemAllowedForClass(a.inventory_items?.name, std));

  const pendingInventory = applicableAssignments
    .filter(a => a.status === "Pending")
    .map(a => a.inventory_items?.name)
    .filter(Boolean);

  return {
    // Internal DB IDs (needed for updates)
    _studentId:    s.id,
    _enrollmentId: enrollment.id,

    // Core identity
    enrollment:     enrollment.enrollment_no,
    name:           `${s.first_name} ${s.last_name}`.trim(),
    firstName:      s.first_name,
    lastName:       s.last_name,
    photo:          s.photo_url || null,
    grNo:           s.grno || "",

    // Academic placement
    std,
    section:        enrollment.section?.name || "",
    rollNo:         String(enrollment.roll_no || ""),
    session:        enrollment.academic_year?.label || "",
    dateOfJoin:     enrollment.date_of_join || "",
    admissionClass: normClass(enrollment.admission_class?.name),

    // Personal
    dob:            s.dob || "",
    gender:         s.gender || "",
    placeOfBirth:   s.place_of_birth || "",
    birthState:     s.birth_state || "",
    birthDistrict:  s.birth_district || "",
    birthCity:      s.birth_city || "",
    religion:       s.religion || "",
    caste:          s.caste || "General",
    subCaste:       s.sub_caste || "",
    motherTongue:   s.mother_tongue || "",
    height:         s.height_cm || "",
    weight:         s.weight_kg || "",

    // Family
    fatherName:     s.father_name || "",
    motherName:     s.mother_name || "",
    mobile:         s.mobile1 || "",
    mobile2:        s.mobile2 || "",

    // Address
    roomPlotNo:     s.room_plot_no || "",
    society:        s.society || "",
    landmark:       s.landmark || "",
    area:           s.area || "",
    pinCode:        s.pincode || "",
    address:        s.address || "",

    // Govt IDs
    aadhar:            s.aadhar ? s.aadhar.replace(/(\d{4})(?=\d)/g, "$1 ").trim() : "",
    aadharName:        s.aadhar_name || "",
    fatherAadhar:      s.father_aadhar ? s.father_aadhar.replace(/(\d{4})(?=\d)/g, "$1 ").trim() : "",
    fatherAadharName:  s.father_aadhar_name || "",
    motherAadhar:      s.mother_aadhar ? s.mother_aadhar.replace(/(\d{4})(?=\d)/g, "$1 ").trim() : "",
    motherAadharName:  s.mother_aadhar_name || "",
    udise:             s.udise || "",
    pen:               s.pen || "",
    apaar:             s.apaar || "",

    // Birth certificate
    birthCertRegNo:    s.birth_cert_reg_no || "",
    birthCertRegDate:  s.birth_cert_reg_date || "",

    // Status
    status:         s.status || "Active",
    deactivateReason: enrollment.deactivate_reason || "",
    deactivateDate:   enrollment.deactivate_date || "",

    // TC uploaded check (for students who came from another school)
    tcUploaded: s.student_documents
      ? s.student_documents.some(d =>
          d.document_types?.name === "Leaving Certificate" && d.status === "Uploaded"
        )
      : false,

    // Birth Certificate check (for fresh admissions with no previous school)
    birthCertUploaded: s.student_documents
      ? s.student_documents.some(d =>
          d.document_types?.name === "Birth Certificate" && d.status === "Uploaded"
        )
      : false,

    // Fees
    fees: {
      total:          enrollment.fee_total || 0,
      paid:           paidAmount,
      discount:       enrollment.fee_discount || 0,
      discountReason: enrollment.discount_reason || "",
    },

    // Tracking
    pendingDocs,
    pendingInventory,

    // Full documents list (populated when student_documents is loaded)
    documents: s.student_documents
      ? s.student_documents.map(d => ({
          id:       d.id || null,
          name:     d.document_types?.name || "",
          uploaded: d.status === "Uploaded",
          file:     d.file_url || "",
        }))
      : [],

    // Full inventory list (populated when student_inventory_assignments is loaded)
    inventory: applicableAssignments.map(a => ({
      item:          a.inventory_items?.name || "",
      givenDate:     a.given_date
        ? new Date(a.given_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "",
      givenDateRaw:  a.given_date || "",
      given:         a.status === "Given",
      _assignmentId: a.id,
    })),

    // Fee payments (populated when fee_payments is loaded)
    feePayments: enrollment.fee_payments && enrollment.fee_payments.length > 0
      ? enrollment.fee_payments.map((p, i) => ({
          term:    `Payment ${i + 1}`,
          amount:  p.amount || 0,
          paid:    true,
          date:    p.payment_date
            ? new Date(p.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "",
          receipt: p.id ? p.id.slice(-6).toUpperCase() : "",
        }))
      : [],

    // Previous school (if loaded) — Supabase returns this as an array
    lastSchoolName:     s.student_previous_school?.[0]?.school_name || "",
    lastSchoolGrNo:     s.student_previous_school?.[0]?.grno || "",
    lastSchoolClass:    s.student_previous_school?.[0]?.class || "",
    lastSchoolMedium:   s.student_previous_school?.[0]?.medium || "",
    lastSchoolPlace:    s.student_previous_school?.[0]?.place || "",
    prevAttendanceDays: s.student_previous_school?.[0]?.attendance_days || "",
    lastExamGiven:      s.student_previous_school?.[0]?.last_exam_given ? "Yes" : "No",
    prevPercentage:     s.student_previous_school?.[0]?.percentage || "",

    // Siblings (if loaded)
    siblings: s.student_siblings
      ? s.student_siblings.map(sib => ({ id: sib.id, name: sib.sibling_name, cls: sib.sibling_class }))
      : [],
  };
}

// ── Academic Year ─────────────────────────────────────────────────────────────

export async function getCurrentAcademicYear() {
  const { data, error } = await supabase
    .from("academic_years")
    .select("*")
    .eq("is_current", true)
    .single();
  if (error) throw error;
  return data;
}

// ── Classes & Sections ────────────────────────────────────────────────────────

export async function getClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function getSections(classId) {
  const { data, error } = await supabase
    .from("sections")
    .select("id, name")
    .eq("class_id", classId)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getClassByName(name) {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("name", name)
    .single();
  if (error) throw error;
  return data;
}

export async function getSectionByName(classId, sectionName) {
  const { data, error } = await supabase
    .from("sections")
    .select("id, name")
    .eq("class_id", classId)
    .eq("name", sectionName)
    .single();
  if (error) return null;
  return data;
}

// ── Enrollment Numbers ────────────────────────────────────────────────────────

export async function getNextEnrollmentNo() {
  const { data, error } = await supabase
    .from("student_enrollments")
    .select("enrollment_no")
    .order("enrollment_no", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return "0001";
  const last = parseInt(data[0].enrollment_no) || 0;
  return String(last + 1).padStart(4, "0");
}

export async function getNextRollNo(classId, sectionId, yearId) {
  const { data, error } = await supabase
    .from("student_enrollments")
    .select("roll_no")
    .eq("class_id", classId)
    .eq("section_id", sectionId)
    .eq("academic_year_id", yearId)
    .order("roll_no", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return 1;
  return (data[0].roll_no || 0) + 1;
}

// ── Fetch Students (list) ─────────────────────────────────────────────────────

export async function getStudents(yearId = null) {
  let resolvedYearId = yearId;
  if (!resolvedYearId) {
    const year = await getCurrentAcademicYear();
    resolvedYearId = year.id;
  }

  const { data, error } = await supabase
    .from("student_enrollments")
    .select(`
      id, enrollment_no, roll_no, date_of_join,
      fee_total, fee_discount, discount_reason,
      deactivate_reason, deactivate_date,
      student:students(
        id, first_name, last_name, photo_url, grno,
        dob, gender, mobile1, mobile2, status,
        religion, caste, mother_tongue,
        place_of_birth, birth_state, birth_district, birth_city,
        father_name, mother_name,
        aadhar, aadhar_name,
        father_aadhar, father_aadhar_name, mother_aadhar, mother_aadhar_name,
        udise, pen, apaar,
        birth_cert_reg_no, birth_cert_reg_date,
        address, pincode, room_plot_no, society, landmark, area,
        student_documents(status, document_types(name)),
        student_previous_school(school_name)
      ),
      student_inventory_assignments(id, status, given_date, inventory_items(name)),
      class:classes!student_enrollments_class_id_fkey(id, name),
      section:sections(id, name),
      academic_year:academic_years(id, label),
      admission_class:classes!student_enrollments_admission_class_id_fkey(name),
      fee_payments(amount)
    `)
    .eq("academic_year_id", resolvedYearId)
    .order("roll_no", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapToStudent).filter(Boolean);
}

// ── Fetch Single Student (full detail) ───────────────────────────────────────

export async function getStudentByEnrollment(enrollmentNo) {
  const { data, error } = await supabase
    .from("student_enrollments")
    .select(`
      id, enrollment_no, roll_no, date_of_join,
      fee_total, fee_discount, discount_reason,
      deactivate_reason, deactivate_date,
      student:students(
        id, first_name, last_name, photo_url, grno,
        dob, gender, place_of_birth, birth_state, birth_district, birth_city, mobile1, mobile2,
        religion, caste, sub_caste, mother_tongue,
        height_cm, weight_kg, status,
        father_name, mother_name,
        room_plot_no, society, landmark, area, pincode, address,
        aadhar, aadhar_name,
        father_aadhar, father_aadhar_name, mother_aadhar, mother_aadhar_name,
        udise, pen, apaar,
        birth_cert_reg_no, birth_cert_reg_date,
        student_previous_school(
          school_name, grno, class, medium, place,
          attendance_days, last_exam_given, percentage
        ),
        student_siblings(id, sibling_name, sibling_class),
        student_documents(
          id, status, file_url, uploaded_at,
          document_types(id, name)
        )
      ),
      class:classes!student_enrollments_class_id_fkey(id, name),
      section:sections(id, name),
      academic_year:academic_years(id, label),
      admission_class:classes!student_enrollments_admission_class_id_fkey(name),
      fee_payments(id, amount, payment_date, received_by),
      student_inventory_assignments(
        id, status, given_date,
        inventory_items(id, name)
      )
    `)
    .eq("enrollment_no", enrollmentNo)
    .single();

  if (error) throw error;
  return mapToStudent(data);
}

// ── Add Student ───────────────────────────────────────────────────────────────

export async function addStudent(formData) {
  // 1. Get current academic year
  const year = await getCurrentAcademicYear();

  // 2. Get class and section IDs
  const cls = await getClassByName(formData.std);
  if (!cls) throw new Error(`Class "${formData.std}" not found`);

  let section = await getSectionByName(cls.id, formData.section || "A");
  if (!section) {
    // Auto-create section if it doesn't exist
    const { data: newSection, error: secErr } = await supabase
      .from("sections")
      .insert({ class_id: cls.id, name: formData.section || "A" })
      .select()
      .single();
    if (secErr) throw secErr;
    section = newSection;
  }

  const admCls = formData.admissionClass
    ? await getClassByName(formData.admissionClass)
    : cls;

  // 3. Get next enrollment number and roll number
  const enrollmentNo = await getNextEnrollmentNo();
  const rollNo       = formData.rollNo ?? await getNextRollNo(cls.id, section.id, year.id);

  // 4. Insert into students table
  const { data: student, error: studentErr } = await supabase
    .from("students")
    .insert({
      grno:          formData.grNo || null,
      first_name:    formData.firstName,
      last_name:     formData.lastName,
      dob:           formData.dob,
      gender:        formData.gender,
      place_of_birth: formData.placeOfBirth || null,
      birth_state:    formData.birthState || null,
      birth_district: formData.birthDistrict || null,
      birth_city:     formData.birthCity || null,
      photo_url:     formData.photo || null,
      father_name:   formData.fatherName,
      mother_name:   formData.motherName,
      mobile1:       formData.mobile,
      mobile2:       formData.mobile2 || null,
      religion:      formData.religion || null,
      caste:         formData.caste || "General",
      sub_caste:     formData.subCaste || null,
      mother_tongue: formData.motherTongue || null,
      height_cm:     formData.height || null,
      weight_kg:     formData.weight || null,
      room_plot_no:  formData.roomPlotNo || null,
      society:       formData.society || null,
      landmark:      formData.landmark || null,
      area:          formData.area || null,
      pincode:       formData.pinCode || null,
      address:       formData.address || null,
      aadhar:              formData.aadhar ? formData.aadhar.replace(/\s/g, "") : null,
      aadhar_name:         formData.aadharName || null,
      father_aadhar:       formData.fatherAadhar ? formData.fatherAadhar.replace(/\s/g, "") : null,
      father_aadhar_name:  formData.fatherAadharName || null,
      mother_aadhar:       formData.motherAadhar ? formData.motherAadhar.replace(/\s/g, "") : null,
      mother_aadhar_name:  formData.motherAadharName || null,
      udise:               formData.udise || null,
      pen:                 formData.pen || null,
      apaar:               formData.apaar || null,
      birth_cert_reg_no:   formData.birthCertRegNo || null,
      birth_cert_reg_date: formData.birthCertRegDate || null,
      status:              "Active",
    })
    .select()
    .single();
  if (studentErr) throw studentErr;

  // 5. Insert enrollment
  const { data: enrollment, error: enrollErr } = await supabase
    .from("student_enrollments")
    .insert({
      student_id:        student.id,
      academic_year_id:  year.id,
      enrollment_no:     enrollmentNo,
      class_id:          cls.id,
      section_id:        section.id,
      roll_no:           rollNo,
      date_of_join:      formData.dateOfJoin || new Date().toISOString().split("T")[0],
      admission_class_id: admCls?.id || cls.id,
      fee_total:         formData.feeTotal || 0,
      fee_discount:      formData.discountAmount || 0,
      discount_reason:   formData.discountReason || null,
    })
    .select()
    .single();
  if (enrollErr) throw enrollErr;

  // 6. Insert documents
  if (formData.documents?.length > 0) {
    const { data: docTypes } = await supabase.from("document_types").select("*");
    const docRows = formData.documents
      .map(doc => {
        const dt = docTypes.find(d => d.name === doc.name);
        if (!dt) return null;
        return {
          student_id:       student.id,
          document_type_id: dt.id,
          status:           doc.uploaded ? "Uploaded" : "Pending",
          file_url:         doc.fileUrl || null,
          uploaded_at:      doc.uploaded ? new Date().toISOString() : null,
        };
      })
      .filter(Boolean);
    if (docRows.length > 0) {
      await supabase.from("student_documents").insert(docRows);
    }
  }

  // 7. Insert previous school
  if (formData.lastSchoolName) {
    await supabase.from("student_previous_school").insert({
      student_id:      student.id,
      school_name:     formData.lastSchoolName,
      grno:            formData.lastSchoolGrNo || null,
      class:           formData.lastSchoolClass || null,
      medium:          formData.lastSchoolMedium || null,
      place:           formData.lastSchoolPlace || null,
      attendance_days: formData.prevAttendanceDays ? parseInt(formData.prevAttendanceDays) : null,
      last_exam_given: String(formData.lastExamGiven || "").trim().toLowerCase() === "yes",
      percentage:      formData.prevPercentage ? parseFloat(formData.prevPercentage) : null,
    });
  }

  // 8. Insert siblings
  if (formData.siblings?.length > 0) {
    await supabase.from("student_siblings").insert(
      formData.siblings.map(sib => ({
        student_id:    student.id,
        sibling_name:  sib.name,
        sibling_class: sib.cls || null,
      }))
    );
  }

  // 9. Create inventory assignments — only category='student' items,
  // skipping whichever bag colour doesn't match this student's class.
  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, name")
    .eq("category", "student");
  const applicableItems = (inventoryItems || []).filter(item => bagItemAllowedForClass(item.name, formData.std));
  if (applicableItems.length > 0) {
    await supabase.from("student_inventory_assignments").insert(
      applicableItems.map(item => ({
        enrollment_id: enrollment.id,
        item_id:       item.id,
        status:        "Pending",
      }))
    );
  }

  return { student, enrollment, enrollmentNo, rollNo };
}

// ── Update Student ────────────────────────────────────────────────────────────

export async function updateStudent(studentId, formData) {
  const { error } = await supabase
    .from("students")
    .update({
      grno:          formData.grNo || null,
      first_name:    formData.firstName,
      last_name:     formData.lastName,
      dob:           formData.dob || null,
      gender:        formData.gender || null,
      place_of_birth: formData.placeOfBirth || null,
      birth_state:    formData.birthState || null,
      birth_district: formData.birthDistrict || null,
      birth_city:     formData.birthCity || null,
      photo_url:     formData.photo || null,
      father_name:   formData.fatherName,
      mother_name:   formData.motherName,
      mobile1:       formData.mobile,
      mobile2:       formData.mobile2 || null,
      religion:      formData.religion || null,
      caste:         formData.caste || "General",
      sub_caste:     formData.subCaste || null,
      mother_tongue: formData.motherTongue || null,
      height_cm:     formData.height || null,
      weight_kg:     formData.weight || null,
      room_plot_no:  formData.roomPlotNo || null,
      society:       formData.society || null,
      landmark:      formData.landmark || null,
      area:          formData.area || null,
      pincode:       formData.pinCode || null,
      address:       formData.address || null,
      aadhar:              formData.aadhar ? formData.aadhar.replace(/\s/g, "") : null,
      aadhar_name:         formData.aadharName || null,
      father_aadhar:       formData.fatherAadhar ? formData.fatherAadhar.replace(/\s/g, "") : null,
      father_aadhar_name:  formData.fatherAadharName || null,
      mother_aadhar:       formData.motherAadhar ? formData.motherAadhar.replace(/\s/g, "") : null,
      mother_aadhar_name:  formData.motherAadharName || null,
      udise:               formData.udise || null,
      pen:                 formData.pen || null,
      apaar:               formData.apaar || null,
      birth_cert_reg_no:   formData.birthCertRegNo || null,
      birth_cert_reg_date: formData.birthCertRegDate || null,
      updated_at:          new Date().toISOString(),
    })
    .eq("id", studentId);
  if (error) throw error;

  // Update enrollment fields (roll_no, date_of_join) if provided
  if (formData.enrollmentId) {
    const enrollUpdate = {};
    if (formData.rollNo !== undefined) enrollUpdate.roll_no = formData.rollNo;
    if (formData.joinDate)             enrollUpdate.date_of_join = formData.joinDate;
    if (Object.keys(enrollUpdate).length > 0) {
      const { error: enrollErr } = await supabase
        .from("student_enrollments")
        .update(enrollUpdate)
        .eq("id", formData.enrollmentId);
      if (enrollErr) throw enrollErr;
    }
  }

  // Update previous school
  if (formData.lastSchoolName) {
    await supabase
      .from("student_previous_school")
      .upsert({
        student_id:      studentId,
        school_name:     formData.lastSchoolName,
        grno:            formData.lastSchoolGrNo || null,
        class:           formData.lastSchoolClass || null,
        medium:          formData.lastSchoolMedium || null,
        place:           formData.lastSchoolPlace || null,
        attendance_days: formData.prevAttendanceDays ? parseInt(formData.prevAttendanceDays) : null,
        last_exam_given: String(formData.lastExamGiven || "").trim().toLowerCase() === "yes",
        percentage:      formData.prevPercentage ? parseFloat(formData.prevPercentage) : null,
      }, { onConflict: "student_id" });
  }

  // Update siblings
  if (formData.siblings !== undefined) {
    await supabase.from("student_siblings").delete().eq("student_id", studentId);
    if (formData.siblings?.length > 0) {
      await supabase.from("student_siblings").insert(
        formData.siblings.map(sib => ({
          student_id:    studentId,
          sibling_name:  sib.name,
          sibling_class: sib.cls,
        }))
      );
    }
  }
}

// ── Deactivate Student ────────────────────────────────────────────────────────

export async function deactivateStudent(studentId, enrollmentId, reason, date) {
  // Update enrollment
  const { error: enrollErr } = await supabase
    .from("student_enrollments")
    .update({ deactivate_reason: reason, deactivate_date: date })
    .eq("id", enrollmentId);
  if (enrollErr) throw enrollErr;

  // Update student status
  const { error: stuErr } = await supabase
    .from("students")
    .update({ status: "Inactive", updated_at: new Date().toISOString() })
    .eq("id", studentId);
  if (stuErr) throw stuErr;
}

// ── Promote Student ───────────────────────────────────────────────────────────

export async function promoteStudent(studentId, fromEnrollmentId, nextClassName, discountData) {
  const year = await getCurrentAcademicYear();

  const nextClass = await getClassByName(nextClassName);
  if (!nextClass) throw new Error(`Class "${nextClassName}" not found`);

  // Get or create section A for the next class
  let section = await getSectionByName(nextClass.id, "A");
  if (!section) {
    const { data: newSec, error } = await supabase
      .from("sections")
      .insert({ class_id: nextClass.id, name: "A" })
      .select()
      .single();
    if (error) throw error;
    section = newSec;
  }

  const enrollmentNo = await getNextEnrollmentNo();
  const rollNo       = await getNextRollNo(nextClass.id, section.id, year.id);

  const { data: newEnrollment, error: enrollErr } = await supabase
    .from("student_enrollments")
    .insert({
      student_id:        studentId,
      academic_year_id:  year.id,
      enrollment_no:     enrollmentNo,
      class_id:          nextClass.id,
      section_id:        section.id,
      roll_no:           rollNo,
      date_of_join:      new Date().toISOString().split("T")[0],
      admission_class_id: nextClass.id,
      fee_total:         discountData.feeTotal || 0,
      fee_discount:      discountData.totalDiscount || 0,
      discount_reason:   discountData.reason || null,
    })
    .select()
    .single();
  if (enrollErr) throw enrollErr;

  // Record promotion history
  await supabase.from("student_promotions").insert({
    student_id:         studentId,
    from_enrollment_id: fromEnrollmentId,
    to_enrollment_id:   newEnrollment.id,
  });

  // Create inventory assignments for the new enrollment — only category='student' items,
  // skipping whichever bag colour doesn't match the class being promoted into.
  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, name")
    .eq("category", "student");
  const applicableItems = (inventoryItems || []).filter(item => bagItemAllowedForClass(item.name, nextClassName));
  if (applicableItems.length > 0) {
    await supabase.from("student_inventory_assignments").insert(
      applicableItems.map(item => ({
        enrollment_id: newEnrollment.id,
        item_id:       item.id,
        status:        "Pending",
      }))
    );
  }

  // Update student status back to Active
  await supabase
    .from("students")
    .update({ status: "Active", updated_at: new Date().toISOString() })
    .eq("id", studentId);

  return { newEnrollment, enrollmentNo, rollNo };
}

// ── Fee Payments ──────────────────────────────────────────────────────────────

export async function addFeePayment(enrollmentId, studentId, amount, date, receivedBy) {
  const { data, error } = await supabase
    .from("fee_payments")
    .insert({
      enrollment_id: enrollmentId,
      student_id:    studentId,
      amount:        parseFloat(amount),
      payment_date:  date,
      received_by:   receivedBy || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Document Update ───────────────────────────────────────────────────────────

export async function updateStudentDocument(studentId, documentTypeId, fileUrl) {
  const { error } = await supabase
    .from("student_documents")
    .upsert({
      student_id:       studentId,
      document_type_id: documentTypeId,
      status:           "Uploaded",
      file_url:         fileUrl,
      uploaded_at:      new Date().toISOString(),
    }, { onConflict: "student_id,document_type_id" });
  if (error) throw error;
}

// ── Transfer Certificate ──────────────────────────────────────────────────────

export async function saveTransferCertificate(studentId, enrollmentId, tcData) {
  const { data, error } = await supabase
    .from("transfer_certificates")
    .insert({
      student_id:   studentId,
      tc_number:    tcData.tcNumber,
      issue_date:   tcData.tcDate,
      leaving_date: tcData.leavingDate,
      reason:       tcData.reason,
      conduct:      tcData.conduct,
      dues_cleared: tcData.duesCleared,
      remarks:      tcData.remarks || null,
      file_url:     tcData.fileUrl || null,
    })
    .select()
    .single();
  if (error) throw error;

  // Mark student as Left
  await supabase
    .from("students")
    .update({ status: "Left", updated_at: new Date().toISOString() })
    .eq("id", studentId);

  // Deactivate the enrollment so student no longer appears in active fees list
  if (enrollmentId) {
    await supabase
      .from("student_enrollments")
      .update({
        deactivate_reason: tcData.reason || "TC Issued",
        deactivate_date:   tcData.leavingDate,
      })
      .eq("id", enrollmentId);
  }

  return data;
}
