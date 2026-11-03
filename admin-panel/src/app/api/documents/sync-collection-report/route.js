import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Initialize Supabase admin client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const rows = [];
  for (const line of lines) {
    const row = [];
    let insideQuote = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        insideQuote = !insideQuote;
      } else if (ch === ',' && !insideQuote) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function cleanStr(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    let csvContent = body.csvText;

    if (!csvContent) {
      // Try reading local project CSV file
      const possiblePaths = [
        path.resolve(process.cwd(), "../Document Collection Report - Classwise - ALL CLASSES.csv"),
        path.resolve(process.cwd(), "Document Collection Report - Classwise - ALL CLASSES.csv"),
        "D:\\Project\\SSIS SCHOOL\\Document Collection Report - Classwise - ALL CLASSES.csv",
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          csvContent = fs.readFileSync(p, "utf8");
          break;
        }
      }
    }

    if (!csvContent) {
      return NextResponse.json({ error: "CSV content not found or provided." }, { status: 400 });
    }

    const csvRows = parseCsv(csvContent);
    // Find header
    let headerIdx = csvRows.findIndex(r => r.some(c => (c || '').toLowerCase().includes("birth certificate")));
    if (headerIdx === -1) headerIdx = 3;
    const dataRows = csvRows.slice(headerIdx + 1).filter(r => r.length >= 10 && r[4]);

    // Fetch enrollments and doc types
    const [enrollmentsRes, docTypesRes] = await Promise.all([
      supabaseAdmin.from('student_enrollments').select(`
        id, enrollment_no, roll_no,
        student:students(id, first_name, last_name, grno, father_name, mother_name, dob, mobile1, mobile2,
          student_documents(id, document_type_id, status, file_url, reason, uploaded_at)
        )
      `),
      supabaseAdmin.from('document_types').select('*'),
    ]);

    if (enrollmentsRes.error) throw enrollmentsRes.error;
    if (docTypesRes.error) throw docTypesRes.error;

    const enrollments = enrollmentsRes.data || [];
    const docTypes = docTypesRes.data || [];

    const dtBirth = docTypes.find(d => (d.name || '').toLowerCase().includes('birth'))?.id;
    const dtTc = docTypes.find(d => (d.name || '').toLowerCase().includes('leaving') || (d.name || '').toLowerCase().includes('transfer'))?.id;
    const dtStAadhar = docTypes.find(d => (d.name || '').toLowerCase().includes('student') && (d.name || '').toLowerCase().includes('aadhar'))?.id;
    const dtFaAadhar = docTypes.find(d => (d.name || '').toLowerCase().includes('father') && (d.name || '').toLowerCase().includes('aadhar'))?.id;
    const dtMoAadhar = docTypes.find(d => (d.name || '').toLowerCase().includes('mother') && (d.name || '').toLowerCase().includes('aadhar'))?.id;

    const docMap = [
      { idx: 10, name: 'Birth Certificate', id: dtBirth },
      { idx: 11, name: 'Transfer Certificate', id: dtTc },
      { idx: 12, name: 'Student Aadhar', id: dtStAadhar },
      { idx: 13, name: 'Father Aadhar', id: dtFaAadhar },
      { idx: 14, name: 'Mother Aadhar', id: dtMoAadhar },
    ];

    const updateMap = new Map();
    let matchedCount = 0;
    let markOkCount = 0;
    let markNotRequiredCount = 0;
    let preservedFilesCount = 0;

    for (const r of dataRows) {
      const [cls, sr, formNo, grNo, name, fName, mName, dob, mobile] = r;
      const normName = cleanStr(name);
      const normFName = cleanStr(fName);
      const csvPhones = (mobile ? mobile.match(/\d{10}/g) || [] : []);

      let match = null;

      if (grNo && cleanStr(grNo)) {
        match = enrollments.find(e => cleanStr(e.student?.grno) === cleanStr(grNo));
      }
      if (!match) {
        match = enrollments.find(e => {
          const full1 = cleanStr(`${e.student?.first_name} ${e.student?.last_name}`);
          const full2 = cleanStr(`${e.student?.last_name} ${e.student?.first_name}`);
          return full1 === normName || full2 === normName;
        });
      }
      if (!match && csvPhones.length > 0) {
        match = enrollments.find(e => {
          const m1 = cleanStr(e.student?.mobile1);
          const m2 = cleanStr(e.student?.mobile2);
          return csvPhones.some(p => (m1 && m1.includes(p)) || (m2 && m2.includes(p)));
        });
      }
      if (!match && fName) {
        match = enrollments.find(e => {
          const sFirst = cleanStr(e.student?.first_name);
          const sFather = cleanStr(e.student?.father_name);
          return (normName.includes(sFirst) || sFirst.includes(normName)) &&
                 (normFName.includes(sFather) || sFather.includes(normFName));
        });
      }
      if (!match && formNo && !isNaN(parseInt(formNo))) {
        match = enrollments.find(e => parseInt(e.enrollment_no) === parseInt(formNo));
      }

      if (!match || !match.student) continue;
      matchedCount++;

      const studentId = match.student.id;
      const existingDocs = match.student.student_documents || [];

      for (const dm of docMap) {
        if (!dm.id) continue;
        const csvVal = (r[dm.idx] || '').trim();
        const existingDoc = existingDocs.find(d => d.document_type_id === dm.id);
        const key = `${studentId}_${dm.id}`;

        if (csvVal === 'OK') {
          markOkCount++;
          if (existingDoc && existingDoc.file_url) preservedFilesCount++;
          updateMap.set(key, {
            student_id: studentId,
            document_type_id: dm.id,
            status: 'Uploaded',
            reason: existingDoc?.reason || 'Verified (Collection Report)',
            file_url: existingDoc?.file_url || null,
            uploaded_at: existingDoc?.uploaded_at || new Date().toISOString(),
          });
        } else if (csvVal === '-') {
          if (!existingDoc || !existingDoc.file_url) {
            markNotRequiredCount++;
            updateMap.set(key, {
              student_id: studentId,
              document_type_id: dm.id,
              status: 'Pending',
              reason: 'Not Required',
              file_url: null,
              uploaded_at: null,
            });
          }
        }
      }
    }

    const updates = Array.from(updateMap.values());
    const chunkSize = 50;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      const { error } = await supabaseAdmin.from('student_documents').upsert(chunk, {
        onConflict: 'student_id,document_type_id'
      });
      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalCsvRows: dataRows.length,
        matchedStudents: matchedCount,
        syncedRecords: updates.length,
        markOkCount,
        markNotRequiredCount,
        preservedFilesCount,
      }
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync collection report" }, { status: 500 });
  }
}
