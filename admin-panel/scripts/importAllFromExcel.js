const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envText.match(/NEXT_PUBLIC_SUPABASE_URL=["']?([^"'\r\n]+)["']?/)?.[1]?.trim();
const supabaseServiceKey = envText.match(/SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\r\n]+)["']?/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const excelPath = 'D:/Project/SSIS SCHOOL/ONLINE GENERAL REGISTER.xlsx';

function excelDateToIso(val) {
  if (!val || val === '-' || val === 'null' || val === 'undefined') return null;
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const cleanY = y.length === 2 ? '20' + y : y;
    return `${cleanY}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str.length === 10 && str.includes('-') ? str : null;
}

function clean(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function runImport() {
  console.log("Loading metadata from Supabase...");
  const [classesRes, yearsRes, sectionsRes, studentsRes, enrollmentsRes] = await Promise.all([
    supabase.from('classes').select('id, name'),
    supabase.from('academic_years').select('id, label, is_current'),
    supabase.from('sections').select('id, class_id, name'),
    supabase.from('students').select('id, grno, first_name, last_name, aadhar, mobile1, udise, pen, apaar'),
    supabase.from('student_enrollments').select('enrollment_no, roll_no, student_id, academic_year_id'),
  ]);

  const classes = classesRes.data || [];
  const years = yearsRes.data || [];
  const sections = sectionsRes.data || [];
  const students = studentsRes.data || [];
  const enrollments = enrollmentsRes.data || [];

  const yearMap = new Map();
  years.forEach(y => yearMap.set(y.label.trim(), y.id));
  const defaultYearId = years.find(y => y.is_current)?.id || years[0]?.id;

  const classMap = new Map();
  classes.forEach(c => {
    classMap.set(c.name.toUpperCase().trim(), c.id);
    classMap.set(clean(c.name), c.id);
  });
  // Map standard variations
  classMap.set('1', classMap.get('1ST'));
  classMap.set('2', classMap.get('2ND'));
  classMap.set('3', classMap.get('3RD'));
  classMap.set('4', classMap.get('4TH'));
  classMap.set('5', classMap.get('5TH'));
  classMap.set('6', classMap.get('6TH'));
  classMap.set('7', classMap.get('7TH'));
  classMap.set('BALVATIKA', classMap.get('BALVATIKA'));
  classMap.set('JR KG', classMap.get('JR.KG'));
  classMap.set('SR KG', classMap.get('SR.KG'));

  const sectionByClass = new Map();
  sections.forEach(s => sectionByClass.set(s.class_id, s.id));

  // Build maps of existing students
  const byGr = new Map();
  const byName = new Map();
  const byAadhar = new Map();

  students.forEach(s => {
    if (s.grno) byGr.set(clean(s.grno), s);
    byName.set(clean(s.first_name + s.last_name), s);
    if (s.aadhar && clean(s.aadhar)) byAadhar.set(clean(s.aadhar), s);
  });

  // Calculate highest existing enrollment number
  let maxEnroll = 0;
  enrollments.forEach(e => {
    const num = parseInt(e.enrollment_no, 10);
    if (!isNaN(num) && num > maxEnroll) maxEnroll = num;
  });

  const wb = XLSX.readFile(excelPath);
  let totalRows = 0;
  let updatedExisting = 0;
  let insertedNew = 0;

  for (const sheetName of wb.SheetNames) {
    const isPrimary = sheetName.toUpperCase().includes('PRIMARY');
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]).filter(r => r.NAME && String(r.NAME).trim() !== '-');
    console.log(`Processing sheet "${sheetName}": ${rows.length} student rows`);

    for (const r of rows) {
      totalRows++;
      const rawName = String(r.NAME).trim();
      const cleanName = clean(rawName);
      const regNo = isPrimary ? (r.PR ? String(r.PR).trim() : null) : (r.GR ? String(r.GR).trim() : null);
      const cleanReg = regNo ? clean(regNo) : null;
      const aadhar = (r.AADHAR && r.AADHAR !== '-') ? String(r.AADHAR).trim().replace(/[^\d]/g, '') : null;
      const mobile1 = (r['MOBILE 1'] && r['MOBILE 1'] !== '-') ? String(r['MOBILE 1']).trim().replace(/[^\d]/g, '') : null;
      const mobile2 = (r['MOBILE 2'] && r['MOBILE 2'] !== '-') ? String(r['MOBILE 2']).trim().replace(/[^\d]/g, '') : null;
      const uid = (r.UID && r.UID !== '-') ? String(r.UID).trim() : null;
      const pen = (r.PEN && r.PEN !== '-') ? String(r.PEN).trim() : null;
      const apaar = (r.APAAR && r.APAAR !== '-') ? String(r.APAAR).trim() : null;
      const remarks = (r.REMARK && r.REMARK !== '-') ? String(r.REMARK).trim() : null;
      const tc = (r.TC && r.TC !== '-') ? String(r.TC).trim().toUpperCase() : null;

      const dobIso = excelDateToIso(r.DOB) || '2015-01-01';
      const doaIso = excelDateToIso(r.DOA) || '2024-06-13';
      const doeIso = excelDateToIso(r.DOE);

      // Find match
      let match = null;
      if (cleanReg && byGr.has(cleanReg)) match = byGr.get(cleanReg);
      if (!match && aadhar && byAadhar.has(clean(aadhar))) match = byAadhar.get(clean(aadhar));
      if (!match && cleanName && byName.has(cleanName)) match = byName.get(cleanName);

      if (match) {
        // Update existing student
        const patch = { updated_at: new Date().toISOString() };
        let hasChanges = false;
        if (regNo && match.grno !== regNo) { patch.grno = regNo; hasChanges = true; }
        if (uid && match.udise !== uid) { patch.udise = uid; hasChanges = true; }
        if (pen && match.pen !== pen) { patch.pen = pen; hasChanges = true; }
        if (apaar && match.apaar !== apaar) { patch.apaar = apaar; hasChanges = true; }
        if (aadhar && (!match.aadhar || match.aadhar !== aadhar)) { patch.aadhar = aadhar; hasChanges = true; }
        if (hasChanges) {
          await supabase.from('students').update(patch).eq('id', match.id);
          updatedExisting++;
        }
      } else {
        // Insert NEW student
        const nameParts = rawName.split(/\s+/);
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || firstName;
        const status = tc === 'ISSUED' ? 'Left' : 'Active';

        const newStudent = {
          grno: regNo || null,
          first_name: firstName,
          last_name: lastName,
          father_name: lastName, // fallback
          mother_name: 'Mother',
          dob: dobIso,
          gender: 'Other',
          mobile1: mobile1 || '0000000000',
          mobile2: mobile2 || null,
          aadhar: aadhar || null,
          udise: uid || null,
          pen: pen || null,
          apaar: apaar || null,
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: insertedStu, error: insErr } = await supabase.from('students').insert(newStudent).select().single();
        if (insErr) {
          console.error(`Error inserting student ${rawName}:`, insErr.message);
          continue;
        }

        // Determine class
        let rawStd = String(r.STD || '').trim();
        if (!rawStd || rawStd === '-') rawStd = isPrimary ? 'Balvatika' : '1st';
        let classId = classMap.get(rawStd.toUpperCase()) || classMap.get(clean(rawStd));
        if (!classId) classId = isPrimary ? classMap.get('BALVATIKA') : classMap.get('1ST');

        // Determine section
        let sectionId = sectionByClass.get(classId);
        if (!sectionId) {
          const { data: newSec } = await supabase.from('sections').insert({ class_id: classId, name: 'A' }).select().single();
          sectionId = newSec?.id;
          if (sectionId) sectionByClass.set(classId, sectionId);
        }

        // Determine year
        const yearId = yearMap.get(String(r.AY || '').trim()) || defaultYearId;

        // Generate enrollment number
        maxEnroll++;
        const enrollNo = String(maxEnroll).padStart(4, '0');
        const rollNo = parseInt(String(regNo || '').replace(/\D/g, ''), 10) || (maxEnroll % 50 + 1);

        const newEnrollment = {
          student_id: insertedStu.id,
          academic_year_id: yearId,
          enrollment_no: enrollNo,
          class_id: classId,
          section_id: sectionId,
          roll_no: rollNo,
          date_of_join: doaIso,
          deactivate_date: doeIso,
          deactivate_reason: remarks,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: enrollErr } = await supabase.from('student_enrollments').insert(newEnrollment);
        if (enrollErr) {
          console.error(`Error enrolling ${rawName}:`, enrollErr.message);
        } else {
          insertedNew++;
        }

        // If TC issued, record transfer certificate
        if (tc === 'ISSUED') {
          await supabase.from('transfer_certificates').insert({
            student_id: insertedStu.id,
            tc_number: `TC-${regNo || enrollNo}`,
            issue_date: doeIso || doaIso,
            leaving_date: doeIso || doaIso,
            reason: 'School Transfer',
            conduct: 'Good',
            dues_cleared: true,
            remarks: remarks || 'Issued per Online General Register',
          });
        }

        // Add to local cache
        if (regNo) byGr.set(cleanReg, insertedStu);
        byName.set(cleanName, insertedStu);
        if (aadhar) byAadhar.set(clean(aadhar), insertedStu);
      }
    }
  }

  console.log("=========================================");
  console.log(`IMPORT COMPLETED`);
  console.log(`Total Excel student rows processed: ${totalRows}`);
  console.log(`Existing students updated: ${updatedExisting}`);
  console.log(`New students imported: ${insertedNew}`);
  console.log("=========================================");
}

runImport().catch(console.error);
