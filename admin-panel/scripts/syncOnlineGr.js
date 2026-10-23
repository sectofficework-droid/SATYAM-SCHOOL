const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envText.match(/NEXT_PUBLIC_SUPABASE_URL=["']?([^"'\r\n]+)["']?/)?.[1]?.trim();
const supabaseServiceKey = envText.match(/SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\r\n]+)["']?/)?.[1]?.trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const excelPath = 'D:/Project/SSIS SCHOOL/ONLINE GENERAL REGISTER.xlsx';

async function runSync() {
  console.log("Reading Excel file:", excelPath);
  const wb = XLSX.readFile(excelPath);

  console.log("Fetching students from Supabase...");
  const { data: students, error } = await supabase
    .from('students')
    .select('id, grno, first_name, last_name, father_name, dob, mobile1, mobile2, aadhar, udise, pen, apaar');

  if (error) {
    console.error("Supabase error:", error);
    process.exit(1);
  }

  console.log(`Loaded ${students.length} students from database.`);

  const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const byName = new Map();
  const byAadhar = new Map();
  const byMobile = new Map();
  const byFirstNameDob = new Map();

  for (const s of students) {
    byName.set(clean(s.first_name + s.last_name), s);
    if (s.aadhar && clean(s.aadhar)) byAadhar.set(clean(s.aadhar), s);
    if (s.mobile1 && clean(s.mobile1)) byMobile.set(clean(s.mobile1), s);
    if (s.first_name && s.dob) byFirstNameDob.set(clean(s.first_name) + '_' + clean(s.dob), s);
  }

  let updatedCount = 0;
  let grUpdated = 0;
  let udiseUpdated = 0;
  let penUpdated = 0;
  let apaarUpdated = 0;

  for (const sheetName of wb.SheetNames) {
    const isPrimary = sheetName.toUpperCase().includes('PRIMARY');
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]).filter(r => r.NAME);
    console.log(`Processing sheet "${sheetName}" (${rows.length} rows with names)...`);

    for (const r of rows) {
      const cleanName = clean(r.NAME);
      const regNo = isPrimary ? (r.PR ? String(r.PR).trim() : null) : (r.GR ? String(r.GR).trim() : null);
      const aadhar = (r.AADHAR && r.AADHAR !== '-') ? String(r.AADHAR).trim() : null;
      const mobile = (r['MOBILE 1'] && r['MOBILE 1'] !== '-') ? String(r['MOBILE 1']).trim() : null;
      const uid = (r.UID && r.UID !== '-') ? String(r.UID).trim() : null;
      const pen = (r.PEN && r.PEN !== '-') ? String(r.PEN).trim() : null;
      const apaar = (r.APAAR && r.APAAR !== '-') ? String(r.APAAR).trim() : null;

      let match = byName.get(cleanName);
      if (!match && aadhar) match = byAadhar.get(clean(aadhar));
      if (!match && mobile) match = byMobile.get(clean(mobile));
      if (!match && r.DOB && r.NAME) {
        const parts = String(r.DOB).split('/');
        if (parts.length === 3) {
          const isoDob = clean(parts[2] + '-' + parts[1] + '-' + parts[0]);
          const fn = clean(String(r.NAME).split(' ')[0]);
          match = byFirstNameDob.get(fn + '_' + isoDob);
        }
      }

      if (match) {
        const patch = { updated_at: new Date().toISOString() };
        let hasChanges = false;

        if (regNo && (!match.grno || match.grno !== regNo)) {
          patch.grno = regNo;
          match.grno = regNo;
          grUpdated++;
          hasChanges = true;
        }
        if (uid && (!match.udise || match.udise !== uid)) {
          patch.udise = uid;
          match.udise = uid;
          udiseUpdated++;
          hasChanges = true;
        }
        if (pen && (!match.pen || match.pen !== pen)) {
          patch.pen = pen;
          match.pen = pen;
          penUpdated++;
          hasChanges = true;
        }
        if (apaar && (!match.apaar || match.apaar !== apaar)) {
          patch.apaar = apaar;
          match.apaar = apaar;
          apaarUpdated++;
          hasChanges = true;
        }

        if (hasChanges) {
          const { error: updErr } = await supabase.from('students').update(patch).eq('id', match.id);
          if (updErr) {
            console.error(`Failed to update student ${match.id}:`, updErr);
          } else {
            updatedCount++;
          }
        }
      }
    }
  }

  console.log("=== SYNC COMPLETED ===");
  console.log(`Total students updated: ${updatedCount}`);
  console.log(`GR/PR numbers updated: ${grUpdated}`);
  console.log(`UID/UDISE numbers updated: ${udiseUpdated}`);
  console.log(`PEN numbers updated: ${penUpdated}`);
  console.log(`APAAR IDs updated: ${apaarUpdated}`);
}

runSync().catch(console.error);
