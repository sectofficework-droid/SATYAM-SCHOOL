import supabase from "./supabase";
import { getS3ViewUrl, uploadFileToS3Presigned } from "./s3Upload";

const CLASS_NAME_MAP = {
  "JR KG": "JR.KG", "SR KG": "SR.KG",
  "11th Commerce": "11th - Commerce", "12th Commerce": "12th - Commerce",
};
function normClass(n) { return CLASS_NAME_MAP[n] || n || ""; }

const DOC_TYPE_NAMES = {
  birthCertificate: "Birth Certificate",
  studentAadhar:    "Student Aadhar Card",
  fatherAadhar:      "Father's Aadhar Card",
  motherAadhar:      "Mother's Aadhar Card",
};

// ── Date of birth, spelled out register-style (e.g. "Twelfth August Two Thousand Fifteen") ──
const ORDINALS = [
  "Zeroth","First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth","Tenth",
  "Eleventh","Twelfth","Thirteenth","Fourteenth","Fifteenth","Sixteenth","Seventeenth","Eighteenth","Nineteenth","Twentieth",
  "Twenty-First","Twenty-Second","Twenty-Third","Twenty-Fourth","Twenty-Fifth","Twenty-Sixth","Twenty-Seventh","Twenty-Eighth","Twenty-Ninth","Thirtieth","Thirty-First",
];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
  "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

function numberToWords(n) {
  if (n === 0) return "Zero";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  return numberToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
}

export function dobToWords(dobStr) {
  if (!dobStr) return "";
  const d = new Date(dobStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return `${ORDINALS[d.getDate()]} ${MONTH_NAMES[d.getMonth()]} ${numberToWords(d.getFullYear())}`;
}

// "Village, City, District, State" - any missing part is skipped (not left as
// a blank/dangling comma), so a village-less record reads "City, District,
// State" and a village+city-less one reads "District, State".
export function composePlaceOfBirth(village, city, district, state) {
  return [village, city, district, state].map(v => (v || "").trim()).filter(Boolean).join(", ");
}

// ── GR Book list: every in-system student (derived, read-only) + every ──────
// standalone historical import row, combined into one 21-field shape.
export async function getGrBookEntries() {
  const [studentsRes, enrollRes, tcRes, importsRes] = await Promise.all([
    supabase.from("students").select(`
      id, grno, first_name, last_name, dob, religion, caste,
      birth_village, birth_city, birth_district, birth_state,
      father_name, mother_name, aadhar, udise, pen, apaar, status,
      student_previous_school(school_name, grno, class)
    `),
    supabase.from("student_enrollments").select(`
      student_id, date_of_join, deactivate_date,
      class:classes!student_enrollments_class_id_fkey(name),
      admission_class:classes!student_enrollments_admission_class_id_fkey(name)
    `).order("date_of_join", { ascending: true }),
    supabase.from("transfer_certificates").select("student_id, tc_number, leaving_date, issue_date")
      .order("issue_date", { ascending: false }),
    supabase.from("gr_book_imports").select("*"),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (enrollRes.error)   throw enrollRes.error;
  if (tcRes.error)       throw tcRes.error;
  if (importsRes.error)  throw importsRes.error;

  // Enrollments come back ordered by date_of_join ascending, so [0] is the
  // student's original admission and [length-1] is their most recent one.
  const enrollByStudent = {};
  for (const e of enrollRes.data || []) (enrollByStudent[e.student_id] ||= []).push(e);

  // TCs come back ordered by issue_date descending - keep only the first
  // (latest) per student.
  const tcByStudent = {};
  for (const t of tcRes.data || []) if (!tcByStudent[t.student_id]) tcByStudent[t.student_id] = t;

  const systemEntries = (studentsRes.data || []).map(s => {
    const enrollments     = enrollByStudent[s.id] || [];
    const firstEnrollment = enrollments[0];
    const leftEnrollment  = enrollments.find(e => e.deactivate_date) || enrollments[enrollments.length - 1];
    const tc              = tcByStudent[s.id];
    const isLeft           = s.status === "Left" || s.status === "Inactive";
    return {
      _source:         "system",
      _studentId:      s.id,
      status:          s.status || "Active",
      grNo:            s.grno || "",
      surname:         s.last_name || "",
      studentName:     s.first_name || "",
      fatherName:      s.father_name || "",
      motherName:      s.mother_name || "",
      religion:        s.religion || "",
      caste:           s.caste || "",
      birthVillage:    s.birth_village || "",
      birthCity:       s.birth_city || "",
      birthDistrict:   s.birth_district || "",
      birthState:      s.birth_state || "",
      placeOfBirth:    composePlaceOfBirth(s.birth_village, s.birth_city, s.birth_district, s.birth_state),
      dob:             s.dob || "",
      dobWords:        dobToWords(s.dob),
      lastSchoolGrNo:  s.student_previous_school?.grno || "",
      lastSchoolName:  s.student_previous_school?.school_name || "",
      dateOfAdmission: firstEnrollment?.date_of_join || "",
      admissionClass:  normClass(firstEnrollment?.admission_class?.name),
      aadharNo:        s.aadhar || "",
      udiseNo:         s.udise || "",
      apaarId:         s.apaar || "",
      penNo:           s.pen || "",
      dateOfLeaving:   isLeft ? (tc?.leaving_date || "") : "",
      classWhenLeft:   isLeft ? normClass(leftEnrollment?.class?.name) : "",
      tcNo:            isLeft ? (tc?.tc_number || "") : "",
    };
  });

  const importEntries = (importsRes.data || []).map(r => ({
    _source:         "import",
    _importId:       r.id,
    status:          "Imported",
    grNo:            r.gr_no || "",
    surname:         r.surname || "",
    studentName:     r.student_name || "",
    fatherName:      r.father_name || "",
    motherName:      r.mother_name || "",
    religion:        r.religion || "",
    caste:           r.caste || "",
    birthVillage:    r.birth_village || "",
    birthCity:       r.birth_city || "",
    birthDistrict:   r.birth_district || "",
    birthState:      r.birth_state || "",
    placeOfBirth:    composePlaceOfBirth(r.birth_village, r.birth_city, r.birth_district, r.birth_state),
    dob:             r.dob || "",
    dobWords:        dobToWords(r.dob),
    lastSchoolGrNo:  r.last_school_gr_no || "",
    lastSchoolName:  r.last_school_name || "",
    dateOfAdmission: r.date_of_admission || "",
    admissionClass:  r.admission_class || "",
    aadharNo:        r.aadhar_no || "",
    udiseNo:         r.udise_no || "",
    apaarId:         r.apaar_id || "",
    penNo:           r.pen_no || "",
    dateOfLeaving:   r.date_of_leaving || "",
    classWhenLeft:   r.class_when_left || "",
    tcNo:            r.tc_no || "",
    _docKeys: {
      birthCertificate: r.birth_cert_key,
      studentAadhar:    r.student_aadhar_key,
      fatherAadhar:     r.father_aadhar_key,
      motherAadhar:     r.mother_aadhar_key,
      tc:               r.tc_key,
    },
  }));

  const all = [...systemEntries, ...importEntries];
  all.sort((a, b) => {
    const an = parseInt(a.grNo, 10), bn = parseInt(b.grNo, 10);
    if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
    return String(a.grNo).localeCompare(String(b.grNo));
  });
  return all;
}

// Lazy-loaded per row (only when its detail panel opens) rather than joined
// into the whole list, to avoid a document fetch per student on every load.
export async function getGrBookDocuments(entry) {
  if (entry._source === "import") {
    const keys = entry._docKeys || {};
    const [birthCertificate, studentAadhar, fatherAadhar, motherAadhar, tc] = await Promise.all([
      getS3ViewUrl(keys.birthCertificate),
      getS3ViewUrl(keys.studentAadhar),
      getS3ViewUrl(keys.fatherAadhar),
      getS3ViewUrl(keys.motherAadhar),
      getS3ViewUrl(keys.tc),
    ]);
    return { birthCertificate, studentAadhar, fatherAadhar, motherAadhar, tc };
  }

  const { data: docs, error } = await supabase
    .from("student_documents")
    .select("file_url, status, document_types(name)")
    .eq("student_id", entry._studentId);
  if (error) throw error;
  const keyFor = (typeName) =>
    (docs || []).find(d => d.document_types?.name === typeName && d.status === "Uploaded")?.file_url;

  const { data: tcRow } = await supabase
    .from("transfer_certificates")
    .select("file_url")
    .eq("student_id", entry._studentId)
    .order("issue_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [birthCertificate, studentAadhar, fatherAadhar, motherAadhar, tc] = await Promise.all([
    getS3ViewUrl(keyFor(DOC_TYPE_NAMES.birthCertificate)),
    getS3ViewUrl(keyFor(DOC_TYPE_NAMES.studentAadhar)),
    getS3ViewUrl(keyFor(DOC_TYPE_NAMES.fatherAadhar)),
    getS3ViewUrl(keyFor(DOC_TYPE_NAMES.motherAadhar)),
    getS3ViewUrl(tcRow?.file_url),
  ]);
  return { birthCertificate, studentAadhar, fatherAadhar, motherAadhar, tc };
}

// ── Historical / not-in-system records ──────────────────────────────────────

export async function createGrBookImportRows(rows) {
  if (!rows.length) return;
  const { error } = await supabase.from("gr_book_imports").insert(rows);
  if (error) throw error;
}

export async function updateGrBookImportRow(id, data) {
  const { error } = await supabase.from("gr_book_imports").update(data).eq("id", id);
  if (error) throw error;
}

// docField is one of the gr_book_imports.*_key columns, e.g. "birth_cert_key".
export async function uploadGrBookDocument(importRowId, docField, file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `gr-book/${importRowId}-${docField}-${Date.now()}.${ext}`;
  await uploadFileToS3Presigned(file, key);
  await updateGrBookImportRow(importRowId, { [docField]: key });
  return key;
}
