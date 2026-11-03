"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FileText, Search, Download, Upload, Check, CheckCircle2,
  Clock, AlertCircle, RefreshCw, FileSpreadsheet, Eye, X,
  ExternalLink, RotateCcw, Plus, MoreHorizontal, ShieldCheck,
  Filter, Table, CheckSquare, Sparkles, ChevronDown, Layers
} from "lucide-react";
import {
  getDocumentTypes,
  markDocumentDone,
  markDocumentPending,
  updateStudentDocument
} from "@/lib/studentService";
import { uploadFileToS3, getS3ViewUrl, buildDocDownloadName, slugify, fileExt } from "@/lib/s3Upload";
import { compressFile } from "@/lib/fileCompression";

// Standard classes list matching the documents page
const CLASSES_LIST = [
  "JR.KG", "SR.KG", "Balvatika",
  "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th",
  "11th - Commerce", "12th - Commerce",
];

// Helper to match document by category
function matchDocByCategory(category, docs = []) {
  if (!docs || !Array.isArray(docs)) return null;
  const cat = category.toLowerCase();

  return docs.find(d => {
    const name = (d.name || "").toLowerCase();
    if (cat === "birth") {
      return name.includes("birth");
    }
    if (cat === "transfer") {
      return name.includes("transfer") || name.includes("leaving");
    }
    if (cat === "student_aadhar") {
      return name.includes("student") && name.includes("aadhar");
    }
    if (cat === "father_aadhar") {
      return name.includes("father") && name.includes("aadhar");
    }
    if (cat === "mother_aadhar") {
      return name.includes("mother") && name.includes("aadhar");
    }
    return false;
  }) || null;
}

// Helper to find document_type_id by category
function findDocTypeByCategory(category, docTypes = []) {
  const cat = category.toLowerCase();
  return docTypes.find(dt => {
    const name = (dt.name || "").toLowerCase();
    if (cat === "birth") {
      return name.includes("birth");
    }
    if (cat === "transfer") {
      return name.includes("leaving") || name.includes("transfer");
    }
    if (cat === "student_aadhar") {
      return name.includes("student") && name.includes("aadhar");
    }
    if (cat === "father_aadhar") {
      return name.includes("father") && name.includes("aadhar");
    }
    if (cat === "mother_aadhar") {
      return name.includes("mother") && name.includes("aadhar");
    }
    return false;
  }) || null;
}

// Helper to identify "Other" documents (non-primary 5)
function getOtherDocsForStudent(studentDocs = [], allDocTypes = []) {
  const otherDocs = (studentDocs || []).filter(d => {
    const n = (d.name || "").toLowerCase();
    const isPrimary =
      n.includes("birth") ||
      n.includes("transfer") ||
      n.includes("leaving") ||
      (n.includes("aadhar") && (n.includes("student") || n.includes("father") || n.includes("mother")));
    return !isPrimary;
  });

  const otherDocTypes = (allDocTypes || []).filter(dt => {
    const n = (dt.name || "").toLowerCase();
    const isPrimary =
      n.includes("birth") ||
      n.includes("transfer") ||
      n.includes("leaving") ||
      (n.includes("aadhar") && (n.includes("student") || n.includes("father") || n.includes("mother")));
    return !isPrimary;
  });

  return { otherDocs, otherDocTypes };
}

// Fixed column widths for spreadsheet freeze-panes (in pixels)
const COL_WIDTHS = {
  sr: 52,
  class: 92,
  name: 230,
  gr: 80,
  doc: 172,
  other: 220,
};

// Left offsets for frozen columns
const STICKY_OFFSETS = {
  sr: 0,
  class: COL_WIDTHS.sr,
  name: COL_WIDTHS.sr + COL_WIDTHS.class, // 144
  gr: COL_WIDTHS.sr + COL_WIDTHS.class + COL_WIDTHS.name, // 374
};

export default function StudentDocumentsSection({ students = [], onRefresh }) {
  const [docTypes, setDocTypes] = useState([]);
  const [loadingDocTypes, setLoadingDocTypes] = useState(true);

  // Filters & controls
  const [classFilter, setClassFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "pending" | "done"
  const [docColumnFilter, setDocColumnFilter] = useState("all"); // specific document filter
  const [density, setDensity] = useState("compact"); // "compact" | "normal"

  // Interactive states
  const [localStudents, setLocalStudents] = useState([]);
  const [uploadingKey, setUploadingKey] = useState(null); // `${studentId}_${docTypeId}`
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null); // { url, name, title, fileKey }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(null); // studentId of open popover
  const [activeCellInfo, setActiveCellInfo] = useState(null); // Spreadsheet active cell tooltip

  // Keep localStudents in sync with parent prop
  useEffect(() => {
    if (Array.isArray(students)) {
      setLocalStudents(students);
    }
  }, [students]);

  // Load document types
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoadingDocTypes(true);
        const types = await getDocumentTypes();
        if (!cancelled) setDocTypes(types || []);
      } catch (err) {
        console.error("Failed to fetch document types:", err);
      } finally {
        if (!cancelled) setLoadingDocTypes(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Primary document columns configuration
  const PRIMARY_COLUMNS = useMemo(() => [
    { key: "birth",          colLetter: "E", title: "BIRTH CERTIFICATE",    shortTitle: "Birth Cert",     matchKey: "birth" },
    { key: "transfer",       colLetter: "F", title: "TRANSFER CERTIFICATE", shortTitle: "Transfer Cert",  matchKey: "transfer" },
    { key: "student_aadhar", colLetter: "G", title: "STUDENT AADHAR",       shortTitle: "Student Aadhar", matchKey: "student_aadhar" },
    { key: "father_aadhar",  colLetter: "H", title: "FATHER AADHAR",        shortTitle: "Father Aadhar",  matchKey: "father_aadhar" },
    { key: "mother_aadhar",  colLetter: "I", title: "MOTHER AADHAR",        shortTitle: "Mother Aadhar",  matchKey: "mother_aadhar" },
  ], []);

  // Filtered students computation
  const filteredStudents = useMemo(() => {
    return localStudents.filter(s => {
      // Class filter
      if (classFilter !== "All" && s.std !== classFilter) return false;

      // Search filter (Name, Enrollment, GR)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = (s.name || "").toLowerCase().includes(q);
        const matchesEnroll = (s.enrollment || "").toLowerCase().includes(q);
        const matchesGr = (s.grNo || "").toLowerCase().includes(q);
        if (!matchesName && !matchesEnroll && !matchesGr) return false;
      }

      // Check primary documents status for statusFilter
      const primaryStatuses = PRIMARY_COLUMNS.map(col => {
        const doc = matchDocByCategory(col.matchKey, s.documents);
        return doc && (doc.uploaded || doc.status === "Uploaded");
      });
      const allDone = primaryStatuses.every(Boolean);
      const hasPending = primaryStatuses.some(status => !status);

      if (statusFilter === "pending" && !hasPending) return false;
      if (statusFilter === "done" && !allDone) return false;

      // Specific doc filter
      if (docColumnFilter !== "all") {
        const doc = matchDocByCategory(docColumnFilter, s.documents);
        const isUploaded = doc && (doc.uploaded || doc.status === "Uploaded");
        if (isUploaded) return false; // Show only pending for this specific doc
      }

      return true;
    });
  }, [localStudents, classFilter, search, statusFilter, docColumnFilter, PRIMARY_COLUMNS]);

  // Overall statistics & per-column counts
  const stats = useMemo(() => {
    let totalStudents = localStudents.length;
    let fullyDoneStudents = 0;
    let totalUploadedDocs = 0;
    let totalPendingDocs = 0;

    const columnCounts = {
      birth:          { done: 0, pending: 0 },
      transfer:       { done: 0, pending: 0 },
      student_aadhar: { done: 0, pending: 0 },
      father_aadhar:  { done: 0, pending: 0 },
      mother_aadhar:  { done: 0, pending: 0 },
    };

    localStudents.forEach(s => {
      let studentAllDone = true;
      PRIMARY_COLUMNS.forEach(col => {
        const doc = matchDocByCategory(col.matchKey, s.documents);
        if (doc && (doc.uploaded || doc.status === "Uploaded")) {
          totalUploadedDocs++;
          if (columnCounts[col.key]) columnCounts[col.key].done++;
        } else {
          totalPendingDocs++;
          studentAllDone = false;
          if (columnCounts[col.key]) columnCounts[col.key].pending++;
        }
      });
      if (studentAllDone) fullyDoneStudents++;
    });

    const completionRate = totalStudents > 0
      ? Math.round((totalUploadedDocs / (totalStudents * PRIMARY_COLUMNS.length)) * 100)
      : 0;

    return {
      totalStudents,
      fullyDoneStudents,
      totalUploadedDocs,
      totalPendingDocs,
      completionRate,
      columnCounts,
    };
  }, [localStudents, PRIMARY_COLUMNS]);

  // Handle Mark Done (optimistic update + DB call)
  const handleMarkDone = async (student, category, docTypeOverride = null) => {
    const docType = docTypeOverride || findDocTypeByCategory(category, docTypes);
    if (!docType?.id) {
      alert("Document type not configured in database.");
      return;
    }

    const key = `${student._studentId}_${docType.id}`;
    setUploadingKey(key);

    // Optimistic update
    setLocalStudents(prev => prev.map(s => {
      if (s._studentId !== student._studentId) return s;
      const currentDocs = [...(s.documents || [])];
      const existingIdx = currentDocs.findIndex(d => d.documentTypeId === docType.id || d.name === docType.name);

      const updatedDoc = {
        id: existingIdx > -1 ? currentDocs[existingIdx].id : null,
        name: docType.name,
        documentTypeId: docType.id,
        uploaded: true,
        notRequired: false,
        status: "Uploaded",
        reason: "Marked as Done",
        file: existingIdx > -1 ? currentDocs[existingIdx].file : "",
        uploadedAt: new Date().toISOString(),
      };

      if (existingIdx > -1) {
        currentDocs[existingIdx] = updatedDoc;
      } else {
        currentDocs.push(updatedDoc);
      }
      return { ...s, documents: currentDocs };
    }));

    try {
      await markDocumentDone(student._studentId, docType.id, "Marked as Done");
      onRefresh?.();
    } catch (err) {
      console.error("Mark Done failed:", err);
      alert("Failed to mark document as done: " + (err.message || "Unknown error"));
      onRefresh?.();
    } finally {
      setUploadingKey(null);
    }
  };

  // Handle Mark Pending (Undo)
  const handleMarkPending = async (student, category, docTypeOverride = null) => {
    const docType = docTypeOverride || findDocTypeByCategory(category, docTypes);
    if (!docType?.id) return;

    const key = `${student._studentId}_${docType.id}`;
    setUploadingKey(key);

    // Optimistic update
    setLocalStudents(prev => prev.map(s => {
      if (s._studentId !== student._studentId) return s;
      const currentDocs = (s.documents || []).map(d => {
        if (d.documentTypeId === docType.id || d.name === docType.name) {
          return {
            ...d,
            uploaded: false,
            status: "Pending",
            reason: null,
            file: "",
          };
        }
        return d;
      });
      return { ...s, documents: currentDocs };
    }));

    try {
      await markDocumentPending(student._studentId, docType.id);
      onRefresh?.();
    } catch (err) {
      console.error("Mark Pending failed:", err);
      alert("Failed to revert document: " + (err.message || "Unknown error"));
      onRefresh?.();
    } finally {
      setUploadingKey(null);
    }
  };

  // Handle File Upload from Input
  const handleFileUpload = async (student, category, event, docTypeOverride = null) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";

    const docType = docTypeOverride || findDocTypeByCategory(category, docTypes);
    if (!docType?.id) {
      alert("Document type not configured.");
      return;
    }

    const key = `${student._studentId}_${docType.id}`;
    setUploadingKey(key);

    try {
      // 1. Compress image if applicable
      let fileToUpload = file;
      if (file.type && file.type.startsWith("image/")) {
        try {
          fileToUpload = await compressFile(file);
        } catch (compErr) {
          console.warn("Compression skipped, uploading original:", compErr);
        }
      }

      // 2. Build S3 key
      const ext = fileExt(fileToUpload);
      const docSlug = slugify(docType.name);
      const s3Key = `students/${student._studentId}/documents/${docSlug}-${Date.now()}.${ext}`;

      // 3. Upload to S3
      await uploadFileToS3(fileToUpload, s3Key);

      // 4. Update Supabase
      await updateStudentDocument(student._studentId, docType.id, s3Key);

      // 5. Update local state
      setLocalStudents(prev => prev.map(s => {
        if (s._studentId !== student._studentId) return s;
        const currentDocs = [...(s.documents || [])];
        const existingIdx = currentDocs.findIndex(d => d.documentTypeId === docType.id || d.name === docType.name);

        const updatedDoc = {
          id: existingIdx > -1 ? currentDocs[existingIdx].id : null,
          name: docType.name,
          documentTypeId: docType.id,
          uploaded: true,
          notRequired: false,
          status: "Uploaded",
          reason: null,
          file: s3Key,
          uploadedAt: new Date().toISOString(),
        };

        if (existingIdx > -1) {
          currentDocs[existingIdx] = updatedDoc;
        } else {
          currentDocs.push(updatedDoc);
        }
        return { ...s, documents: currentDocs };
      }));

      onRefresh?.();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Document upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploadingKey(null);
    }
  };

  // Handle Download
  const handleDownload = async (student, docTitle, fileKey) => {
    if (!fileKey) {
      alert("No file uploaded for this document yet.");
      return;
    }

    const key = `${student._studentId}_${fileKey}`;
    setDownloadingKey(key);

    try {
      const downloadName = buildDocDownloadName(student.enrollment, student.name, docTitle, fileKey);
      const url = await getS3ViewUrl(fileKey, downloadName);

      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = downloadName;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert("Could not generate a download link. Please try again.");
      }
    } catch (err) {
      console.error("Download error:", err);
      alert("Download failed: " + err.message);
    } finally {
      setDownloadingKey(null);
    }
  };

  // Handle Preview Document in Modal
  const handlePreview = async (student, docTitle, fileKey) => {
    if (!fileKey) return;
    setPreviewLoading(true);
    setPreviewDoc({ name: student.name, enrollment: student.enrollment, title: docTitle, fileKey, url: null });

    try {
      const downloadName = buildDocDownloadName(student.enrollment, student.name, docTitle, fileKey);
      const url = await getS3ViewUrl(fileKey, downloadName);
      if (url) {
        setPreviewDoc(prev => ({ ...prev, url }));
      } else {
        alert("Could not load preview.");
        setPreviewDoc(null);
      }
    } catch (err) {
      console.error("Preview error:", err);
      alert("Could not open preview: " + err.message);
      setPreviewDoc(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const exportRows = filteredStudents.map((s, idx) => {
        const birthDoc = matchDocByCategory("birth", s.documents);
        const tcDoc = matchDocByCategory("transfer", s.documents);
        const stAadharDoc = matchDocByCategory("student_aadhar", s.documents);
        const faAadharDoc = matchDocByCategory("father_aadhar", s.documents);
        const moAadharDoc = matchDocByCategory("mother_aadhar", s.documents);
        const { otherDocs } = getOtherDocsForStudent(s.documents, docTypes);

        const formatStatus = (doc) => {
          if (!doc) return "Upload Pending";
          if (doc.uploaded || doc.status === "Uploaded") {
            return doc.file ? "Done (File Uploaded)" : "Done (Marked)";
          }
          return "Upload Pending";
        };

        const otherStatusStr = otherDocs.length > 0
          ? otherDocs.map(d => `${d.name}: ${formatStatus(d)}`).join("; ")
          : "None";

        return {
          "SR NO": idx + 1,
          "CLASS": s.std ? `${s.std}${s.section ? ` - ${s.section}` : ""}` : "",
          "STUDENT NAME": s.name || "",
          "GR NO": s.grNo || "",
          "ENROLLMENT NO": s.enrollment || "",
          "BIRTH CERTIFICATE": formatStatus(birthDoc),
          "TRANSFER CERTIFICATE": formatStatus(tcDoc),
          "STUDENT AADHAR": formatStatus(stAadharDoc),
          "FATHER AADHAR": formatStatus(faAadharDoc),
          "MOTHER AADHAR": formatStatus(moAadharDoc),
          "OTHER DOCUMENTS": otherStatusStr,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Student Documents");

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Student_Documents_Register_${dateStr}.xlsx`);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Failed to export Excel: " + err.message);
    }
  };

  // Render a spreadsheet document cell
  const renderDocCell = (student, category, colConfig) => {
    const doc = matchDocByCategory(category, student.documents);
    const docType = findDocTypeByCategory(category, docTypes);
    const docTypeId = docType?.id || doc?.documentTypeId;

    const isUploaded = Boolean(doc && (doc.uploaded || doc.status === "Uploaded"));
    const hasFile = Boolean(doc?.file);
    const cellKey = `${student._studentId}_${docTypeId}`;
    const isThisUploading = uploadingKey === cellKey;
    const isThisDownloading = downloadingKey === `${student._studentId}_${doc?.file}`;

    return (
      <td
        key={category}
        className={`border-r border-b border-slate-200 transition-colors align-middle ${
          density === "compact" ? "p-1.5" : "p-2"
        } ${isUploaded ? "bg-emerald-50/40 hover:bg-emerald-100/60" : "bg-amber-50/30 hover:bg-amber-100/50"}`}
        style={{ width: COL_WIDTHS.doc, minWidth: COL_WIDTHS.doc, maxWidth: COL_WIDTHS.doc }}
        onMouseEnter={() => setActiveCellInfo({
          student: student.name,
          class: student.std,
          gr: student.grNo,
          doc: colConfig.title,
          status: isUploaded ? (hasFile ? "Done (File Uploaded)" : "Done (Manually Marked)") : "Upload Pending"
        })}
      >
        {isThisUploading ? (
          <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-school-navy">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </div>
        ) : isUploaded ? (
          /* State: DONE */
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 tracking-tight">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                Done
              </span>

              {hasFile && (
                <button
                  onClick={() => handlePreview(student, colConfig.title, doc.file)}
                  className="p-0.5 text-slate-400 hover:text-school-navy hover:bg-slate-200/60 rounded transition-colors"
                  title="Quick View"
                >
                  <Eye className="w-3 h-3" />
                </button>
              )}
            </div>

            {hasFile ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDownload(student, colConfig.title, doc.file)}
                  disabled={isThisDownloading}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-1.5 text-[11px] font-semibold text-white bg-school-navy hover:bg-school-navy-dark active:bg-school-navy rounded border border-school-navy-dark shadow-2xs transition-colors disabled:opacity-50"
                  title="Download Document"
                >
                  {isThisDownloading ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>Download</span>
                </button>

                <label
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded cursor-pointer transition-colors"
                  title="Replace / Re-upload"
                >
                  <Upload className="w-3 h-3" />
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(student, category, e)}
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <label className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-1.5 text-[10px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded cursor-pointer shadow-2xs transition-colors">
                  <Upload className="w-2.5 h-2.5 text-slate-500" />
                  <span>Attach File</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(student, category, e)}
                  />
                </label>

                <button
                  onClick={() => handleMarkPending(student, category)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Revert to Pending"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* State: UPLOAD PENDING */
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800 tracking-tight">
              <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
              Upload Pending
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleMarkDone(student, category)}
                className="flex-1 inline-flex items-center justify-center gap-0.5 py-1 px-1 text-[10.5px] font-bold text-emerald-800 bg-white hover:bg-emerald-100/80 active:bg-emerald-200 border border-emerald-300 rounded shadow-2xs transition-colors"
                title="Mark as Done"
              >
                <Check className="w-2.5 h-2.5 text-emerald-700" />
                <span>Mark Done</span>
              </button>

              <label
                className="flex-1 inline-flex items-center justify-center gap-0.5 py-1 px-1 text-[10.5px] font-bold text-school-navy bg-white hover:bg-blue-100/80 active:bg-blue-200 border border-blue-300 rounded cursor-pointer shadow-2xs transition-colors"
                title="Upload Document"
              >
                <Upload className="w-2.5 h-2.5 text-school-navy" />
                <span>Upload</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload(student, category, e)}
                />
              </label>
            </div>
          </div>
        )}
      </td>
    );
  };

  // Render "OTHER DOCUMENTS" column
  const renderOtherDocsCell = (student) => {
    const { otherDocs, otherDocTypes } = getOtherDocsForStudent(student.documents, docTypes);
    const uploadedOthers = otherDocs.filter(d => d.uploaded || d.status === "Uploaded");
    const hasAnyUploaded = uploadedOthers.length > 0;
    const isOpen = otherDropdownOpen === student._studentId;

    return (
      <td
        key="other_docs"
        className={`border-r border-b border-slate-200 transition-colors align-middle relative ${
          density === "compact" ? "p-1.5" : "p-2"
        } ${hasAnyUploaded ? "bg-emerald-50/30 hover:bg-emerald-100/50" : "bg-amber-50/30 hover:bg-amber-100/40"}`}
        style={{ width: COL_WIDTHS.other, minWidth: COL_WIDTHS.other, maxWidth: COL_WIDTHS.other }}
      >
        <div className="flex flex-col gap-1">
          {hasAnyUploaded ? (
            <div className="space-y-1">
              {uploadedOthers.map((d, idx) => {
                const hasFile = Boolean(d.file);
                const isThisDownloading = downloadingKey === `${student._studentId}_${d.file}`;

                return (
                  <div key={d.name || idx} className="flex items-center justify-between gap-1 bg-white/90 p-1 rounded border border-slate-200 shadow-2xs">
                    <span className="font-semibold text-slate-800 truncate text-[10.5px] max-w-[110px]" title={d.name}>
                      {d.name}
                    </span>

                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <span className="text-[9.5px] text-emerald-700 font-bold px-1 py-0.2 rounded bg-emerald-100">
                        ✓
                      </span>

                      {hasFile ? (
                        <button
                          onClick={() => handleDownload(student, d.name, d.file)}
                          disabled={isThisDownloading}
                          className="p-1 bg-school-navy hover:bg-school-navy-dark text-white rounded text-[10px] transition-colors"
                          title={`Download ${d.name}`}
                        >
                          {isThisDownloading ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
                        </button>
                      ) : (
                        <label className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer transition-colors" title={`Attach file for ${d.name}`}>
                          <Upload className="w-2.5 h-2.5" />
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload(student, "other", e, { id: d.documentTypeId, name: d.name })}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800 tracking-tight">
              <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
              Upload Pending
            </span>
          )}

          {/* Manage Others Button */}
          <div className="relative">
            <button
              onClick={() => setOtherDropdownOpen(isOpen ? null : student._studentId)}
              className="w-full inline-flex items-center justify-center gap-1 py-0.5 px-1.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded shadow-2xs transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Manage Others</span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
            </button>

            {/* Popover Menu */}
            {isOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-300 p-2 z-50 space-y-1.5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="font-bold text-slate-800 text-[11px]">Other Documents</span>
                  <button onClick={() => setOtherDropdownOpen(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {otherDocTypes.length === 0 ? (
                  <p className="text-[10px] text-slate-400 py-1">No other document types registered.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {otherDocTypes.map(dt => {
                      const existingDoc = (student.documents || []).find(d => d.documentTypeId === dt.id || d.name === dt.name);
                      const isDone = existingDoc && (existingDoc.uploaded || existingDoc.status === "Uploaded");

                      return (
                        <div key={dt.id} className="p-1.5 bg-slate-50 rounded border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-[10.5px] truncate">{dt.name}</span>
                            {isDone ? (
                              <span className="text-[9.5px] text-emerald-700 font-bold">✓ Done</span>
                            ) : (
                              <span className="text-[9.5px] text-amber-700 font-bold">Pending</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 pt-0.5">
                            {isDone ? (
                              existingDoc?.file ? (
                                <button
                                  onClick={() => {
                                    setOtherDropdownOpen(null);
                                    handleDownload(student, dt.name, existingDoc.file);
                                  }}
                                  className="flex-1 inline-flex items-center justify-center gap-1 py-0.5 px-1 text-[10px] font-semibold bg-school-navy text-white rounded"
                                >
                                  <Download className="w-2.5 h-2.5" /> Download
                                </button>
                              ) : (
                                <span className="text-[9.5px] text-slate-400">Marked Done</span>
                              )
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setOtherDropdownOpen(null);
                                    handleMarkDone(student, "other", dt);
                                  }}
                                  className="flex-1 py-0.5 px-1 text-[9.5px] font-bold bg-white text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-50"
                                >
                                  Mark Done
                                </button>
                                <label className="flex-1 inline-flex items-center justify-center gap-0.5 py-0.5 px-1 text-[9.5px] font-bold bg-white text-school-navy border border-blue-300 rounded cursor-pointer hover:bg-blue-50">
                                  <Upload className="w-2.5 h-2.5" /> Upload
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                      setOtherDropdownOpen(null);
                                      handleFileUpload(student, "other", e, dt);
                                    }}
                                  />
                                </label>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    );
  };

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* ── Spreadsheet KPI Metric Cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Total Students</p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{stats.totalStudents}</p>
            <p className="text-[10px] text-slate-400">Enrolled Roster</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-school-navy">
            <Table className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider">All Docs Done</p>
            <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{stats.fullyDoneStudents}</p>
            <p className="text-[10px] text-emerald-600">100% verified students</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[10.5px] font-bold text-blue-700 uppercase tracking-wider">Docs Completed</p>
            <p className="text-xl font-extrabold text-blue-700 mt-0.5">{stats.totalUploadedDocs}</p>
            <p className="text-[10px] text-blue-600">{stats.completionRate}% completion rate</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[10.5px] font-bold text-amber-700 uppercase tracking-wider">Upload Pending</p>
            <p className="text-xl font-extrabold text-amber-700 mt-0.5">{stats.totalPendingDocs}</p>
            <p className="text-[10px] text-amber-600">Action required</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── Spreadsheet Toolbar ────────────────────────────────────────── */}
      <div className="bg-slate-100 rounded-xl border border-slate-300 p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-2xs">
        {/* Left Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[210px] max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, GR, enrollment..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-school-navy focus:ring-1 focus:ring-school-navy"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Class Selector */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Class:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="text-xs bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="All">All ({localStudents.length})</option>
              {CLASSES_LIST.map((cls) => (
                <option key={cls} value={cls}>
                  {cls} ({localStudents.filter(s => s.std === cls).length})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Rows</option>
              <option value="pending">Pending Only</option>
              <option value="done">Completed Only</option>
            </select>
          </div>

          {/* Missing Document Filter */}
          <div className="hidden lg:flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Missing:</span>
            <select
              value={docColumnFilter}
              onChange={(e) => setDocColumnFilter(e.target.value)}
              className="text-xs bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Any</option>
              <option value="birth">Birth Certificate</option>
              <option value="transfer">Transfer Certificate</option>
              <option value="student_aadhar">Student Aadhar</option>
              <option value="father_aadhar">Father Aadhar</option>
              <option value="mother_aadhar">Mother Aadhar</option>
            </select>
          </div>
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex items-center gap-1.5 self-end md:self-auto flex-shrink-0">
          {/* Density Switch */}
          <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setDensity("compact")}
              className={`px-2 py-1 rounded font-semibold transition-colors ${density === "compact" ? "bg-slate-200 text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"}`}
              title="Compact spreadsheet view"
            >
              Compact
            </button>
            <button
              onClick={() => setDensity("normal")}
              className={`px-2 py-1 rounded font-semibold transition-colors ${density === "normal" ? "bg-slate-200 text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"}`}
              title="Comfortable view"
            >
              Normal
            </button>
          </div>

          {/* Export to Excel (.xlsx) */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
            title="Download Excel Spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>

          {/* Refresh Data */}
          <button
            onClick={() => onRefresh?.()}
            className="p-1.5 bg-white hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 rounded-lg transition-colors"
            title="Refresh from database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Spreadsheet Formula / Active Cell Indicator ───────────────── */}
      <div className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg flex items-center justify-between text-xs text-slate-600 shadow-2xs">
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700">
            fx
          </span>
          {activeCellInfo ? (
            <span className="text-slate-800">
              <strong className="text-school-navy font-bold">{activeCellInfo.student}</strong>
              <span className="text-slate-400 mx-1">|</span>
              Class: <strong>{activeCellInfo.class || "—"}</strong>
              <span className="text-slate-400 mx-1">|</span>
              GR: <strong>{activeCellInfo.gr || "—"}</strong>
              <span className="text-slate-400 mx-1">|</span>
              <span className="text-slate-700">{activeCellInfo.doc}:</span>{" "}
              <strong className={activeCellInfo.status.startsWith("Done") ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                {activeCellInfo.status}
              </strong>
            </span>
          ) : (
            <span className="text-slate-400 italic">
              Hover over any document cell to inspect details
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 flex-shrink-0">
          <span>Rows: <strong className="text-slate-800">{filteredStudents.length}</strong> / {localStudents.length}</span>
          <span className="text-slate-300">|</span>
          <span>Columns: <strong className="text-slate-800">10</strong></span>
        </div>
      </div>

      {/* ── Spreadsheet Grid with Freeze Panes ────────────────────────── */}
      <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs max-h-[76vh] flex flex-col">
        <div className="overflow-auto flex-1 relative">
          <table className="border-separate border-spacing-0 w-full text-left text-xs">
            {/* Table Header (Sticky Top) */}
            <thead className="sticky top-0 z-30 select-none">
              <tr className="bg-slate-200/95 backdrop-blur-xs text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {/* Column A: SR NO (Frozen 1) */}
                <th
                  className="sticky z-40 bg-slate-200 border-r border-b-2 border-slate-300 text-center py-2 px-1 text-slate-700"
                  style={{
                    left: STICKY_OFFSETS.sr,
                    width: COL_WIDTHS.sr,
                    minWidth: COL_WIDTHS.sr,
                    maxWidth: COL_WIDTHS.sr,
                  }}
                >
                  <div className="text-[9px] text-slate-400 font-mono font-normal">A</div>
                  <span>SR NO</span>
                </th>

                {/* Column B: CLASS (Frozen 2) */}
                <th
                  className="sticky z-40 bg-slate-200 border-r border-b-2 border-slate-300 py-2 px-2 text-slate-700"
                  style={{
                    left: STICKY_OFFSETS.class,
                    width: COL_WIDTHS.class,
                    minWidth: COL_WIDTHS.class,
                    maxWidth: COL_WIDTHS.class,
                  }}
                >
                  <div className="text-[9px] text-slate-400 font-mono font-normal">B</div>
                  <span>CLASS</span>
                </th>

                {/* Column C: NAME (Frozen 3) */}
                <th
                  className="sticky z-40 bg-slate-200 border-r border-b-2 border-slate-300 py-2 px-2.5 text-slate-700"
                  style={{
                    left: STICKY_OFFSETS.name,
                    width: COL_WIDTHS.name,
                    minWidth: COL_WIDTHS.name,
                    maxWidth: COL_WIDTHS.name,
                  }}
                >
                  <div className="text-[9px] text-slate-400 font-mono font-normal">C</div>
                  <span>STUDENT NAME</span>
                </th>

                {/* Column D: GR (Frozen 4 - Right Border Separator) */}
                <th
                  className="sticky z-40 bg-slate-200 border-r-2 border-r-slate-400 border-b-2 border-slate-300 text-center py-2 px-1 text-slate-700 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]"
                  style={{
                    left: STICKY_OFFSETS.gr,
                    width: COL_WIDTHS.gr,
                    minWidth: COL_WIDTHS.gr,
                    maxWidth: COL_WIDTHS.gr,
                  }}
                >
                  <div className="text-[9px] text-slate-400 font-mono font-normal">D</div>
                  <span>GR</span>
                </th>

                {/* Columns E to I: Primary Documents */}
                {PRIMARY_COLUMNS.map((col) => {
                  const counts = stats.columnCounts[col.key] || { done: 0, pending: 0 };
                  return (
                    <th
                      key={col.key}
                      className="border-r border-b-2 border-slate-300 py-2 px-2 text-slate-800 bg-slate-100"
                      style={{ width: COL_WIDTHS.doc, minWidth: COL_WIDTHS.doc, maxWidth: COL_WIDTHS.doc }}
                    >
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 font-normal">
                        <span>{col.colLetter}</span>
                        <span className="font-sans font-semibold text-emerald-700">{counts.done} ✓ / <span className="text-amber-700">{counts.pending} ⌛</span></span>
                      </div>
                      <span className="text-[11px] block truncate" title={col.title}>
                        {col.title}
                      </span>
                    </th>
                  );
                })}

                {/* Column J: OTHER DOCUMENTS */}
                <th
                  className="border-r border-b-2 border-slate-300 py-2 px-2 text-slate-800 bg-slate-100"
                  style={{ width: COL_WIDTHS.other, minWidth: COL_WIDTHS.other, maxWidth: COL_WIDTHS.other }}
                >
                  <div className="text-[9px] text-slate-400 font-mono font-normal">J</div>
                  <span className="text-[11px] block">OTHER DOCUMENTS</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center text-slate-400 bg-white">
                    <Table className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700 text-sm">No student records match the active criteria</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting the class or status filter above</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const serialNo = idx + 1;
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={student._studentId || student.enrollment || idx}
                      className={`group transition-colors ${isEven ? "bg-white" : "bg-slate-50/60"} hover:bg-sky-50/60`}
                    >
                      {/* Column A: SR NO (Frozen) */}
                      <td
                        className={`sticky z-20 border-r border-b border-slate-200 text-center font-mono font-bold text-slate-600 transition-colors ${
                          isEven ? "bg-white group-hover:bg-sky-50" : "bg-slate-50 group-hover:bg-sky-50"
                        } ${density === "compact" ? "py-1.5 px-1 text-[11px]" : "py-2 px-1 text-xs"}`}
                        style={{
                          left: STICKY_OFFSETS.sr,
                          width: COL_WIDTHS.sr,
                          minWidth: COL_WIDTHS.sr,
                          maxWidth: COL_WIDTHS.sr,
                        }}
                      >
                        {serialNo}
                      </td>

                      {/* Column B: CLASS (Frozen) */}
                      <td
                        className={`sticky z-20 border-r border-b border-slate-200 whitespace-nowrap transition-colors ${
                          isEven ? "bg-white group-hover:bg-sky-50" : "bg-slate-50 group-hover:bg-sky-50"
                        } ${density === "compact" ? "py-1.5 px-2" : "py-2 px-2"}`}
                        style={{
                          left: STICKY_OFFSETS.class,
                          width: COL_WIDTHS.class,
                          minWidth: COL_WIDTHS.class,
                          maxWidth: COL_WIDTHS.class,
                        }}
                      >
                        <span className="font-bold text-school-navy text-xs">
                          {student.std || "—"}
                        </span>
                        {student.section && (
                          <span className="text-[10px] text-slate-500 font-semibold ml-0.5">
                            -{student.section}
                          </span>
                        )}
                      </td>

                      {/* Column C: NAME (Frozen) */}
                      <td
                        className={`sticky z-20 border-r border-b border-slate-200 transition-colors ${
                          isEven ? "bg-white group-hover:bg-sky-50" : "bg-slate-50 group-hover:bg-sky-50"
                        } ${density === "compact" ? "py-1.5 px-2.5" : "py-2 px-2.5"}`}
                        style={{
                          left: STICKY_OFFSETS.name,
                          width: COL_WIDTHS.name,
                          minWidth: COL_WIDTHS.name,
                          maxWidth: COL_WIDTHS.name,
                        }}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 truncate leading-tight text-xs" title={student.name}>
                            {student.name || "—"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                            #{student.enrollment}
                          </span>
                        </div>
                      </td>

                      {/* Column D: GR (Frozen - Right Border Separator) */}
                      <td
                        className={`sticky z-20 border-r-2 border-r-slate-400 border-b border-slate-200 text-center whitespace-nowrap shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)] transition-colors ${
                          isEven ? "bg-white group-hover:bg-sky-50" : "bg-slate-50 group-hover:bg-sky-50"
                        } ${density === "compact" ? "py-1.5 px-1" : "py-2 px-1"}`}
                        style={{
                          left: STICKY_OFFSETS.gr,
                          width: COL_WIDTHS.gr,
                          minWidth: COL_WIDTHS.gr,
                          maxWidth: COL_WIDTHS.gr,
                        }}
                      >
                        {student.grNo ? (
                          <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-300">
                            {student.grNo}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Columns E to I: Primary Documents */}
                      {PRIMARY_COLUMNS.map(col => renderDocCell(student, col.matchKey, col))}

                      {/* Column J: OTHER DOCUMENTS */}
                      {renderOtherDocsCell(student)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Spreadsheet Status Footer */}
        <div className="px-3 py-1.5 bg-slate-100 border-t-2 border-slate-300 flex items-center justify-between text-[11px] text-slate-600 font-mono select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-sans font-bold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Spreadsheet View Ready
            </span>
            <span className="text-slate-300">|</span>
            <span>Freeze Panes Active: Cols A-D (SR, Class, Name, GR)</span>
          </div>

          <div className="flex items-center gap-3 font-sans">
            <span>Showing all <strong>{filteredStudents.length}</strong> students</span>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => {
                const el = document.querySelector(".max-h-\\[76vh\\] > div");
                if (el) el.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-school-navy font-bold hover:underline"
            >
              Back to Top ↑
            </button>
          </div>
        </div>
      </div>

      {/* ── Document Preview Modal ─────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-school-navy px-5 py-3 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {previewDoc.title}
                </h3>
                <p className="text-xs text-white/70 mt-0.5">
                  {previewDoc.name} (#{previewDoc.enrollment})
                </p>
              </div>

              <div className="flex items-center gap-2">
                {previewDoc.url && (
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50 min-h-[350px]">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-school-navy" />
                  <span className="text-xs font-semibold">Loading document...</span>
                </div>
              ) : previewDoc.url ? (
                previewDoc.fileKey?.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.title}
                    className="w-full h-[65vh] rounded-lg border border-slate-200"
                  />
                ) : (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.title}
                    className="max-h-[65vh] max-w-full rounded-lg object-contain shadow-sm"
                  />
                )
              ) : (
                <div className="text-center text-slate-400 py-8">
                  <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Preview not available</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
              {previewDoc.url && (
                <a
                  href={previewDoc.url}
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-school-navy hover:bg-school-navy-dark text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download File
                </a>
              )}
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
