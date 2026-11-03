"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FileText, Search, Download, Upload, Check, CheckCircle2,
  Clock, AlertCircle, RefreshCw, FileSpreadsheet, Eye, X,
  ChevronLeft, ChevronRight, ExternalLink, RotateCcw,
  Plus, MoreHorizontal, ShieldCheck, Filter
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
  const primaryKeys = ["birth", "transfer", "leaving", "student aadhar", "father", "mother"];

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

export default function StudentDocumentsSection({ students = [], onRefresh }) {
  const [docTypes, setDocTypes] = useState([]);
  const [loadingDocTypes, setLoadingDocTypes] = useState(true);

  // Filters
  const [classFilter, setClassFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "pending" | "done"
  const [docColumnFilter, setDocColumnFilter] = useState("all"); // specific document filter

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25); // 25, 50, 100, -1 (all)

  // Interactive states
  const [localStudents, setLocalStudents] = useState([]);
  const [uploadingKey, setUploadingKey] = useState(null); // `${studentId}_${docTypeId}`
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null); // { url, name, title }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(null); // studentId of open popover

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
    { key: "birth",          title: "Birth Certificate",    shortTitle: "Birth Cert",     matchKey: "birth" },
    { key: "transfer",       title: "Transfer Certificate", shortTitle: "Transfer Cert",  matchKey: "transfer" },
    { key: "student_aadhar", title: "Student Aadhar",       shortTitle: "Student Aadhar", matchKey: "student_aadhar" },
    { key: "father_aadhar",  title: "Father Aadhar",        shortTitle: "Father Aadhar",  matchKey: "father_aadhar" },
    { key: "mother_aadhar",  title: "Mother Aadhar",        shortTitle: "Mother Aadhar",  matchKey: "mother_aadhar" },
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

  // Overall statistics
  const stats = useMemo(() => {
    let totalStudents = localStudents.length;
    let fullyDoneStudents = 0;
    let totalUploadedDocs = 0;
    let totalPendingDocs = 0;

    localStudents.forEach(s => {
      let studentAllDone = true;
      PRIMARY_COLUMNS.forEach(col => {
        const doc = matchDocByCategory(col.matchKey, s.documents);
        if (doc && (doc.uploaded || doc.status === "Uploaded")) {
          totalUploadedDocs++;
        } else {
          totalPendingDocs++;
          studentAllDone = false;
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
    };
  }, [localStudents, PRIMARY_COLUMNS]);

  // Paginated students
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    if (pageSize === -1) return filteredStudents;
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [classFilter, search, statusFilter, docColumnFilter, pageSize]);

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

    // Reset input value so same file can be selected again if needed
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
        // Trigger download via anchor
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
          "ENROLLMENT NO": s.enrollment || "",
          "CLASS": s.std ? `${s.std}${s.section ? ` - ${s.section}` : ""}` : "",
          "STUDENT NAME": s.name || "",
          "GR NO": s.grNo || "",
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

  // Render a single document cell
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
      <div className="flex flex-col gap-1.5 min-w-[135px] max-w-[165px] p-2 rounded-xl bg-white border border-gray-100 shadow-2xs transition-all hover:border-gray-200">
        {isThisUploading ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-school-navy">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Updating...</span>
          </div>
        ) : isUploaded ? (
          <>
            {/* Status Badge: DONE */}
            <div className="flex items-center justify-between gap-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Done
              </span>

              {hasFile && (
                <button
                  onClick={() => handlePreview(student, colConfig.title, doc.file)}
                  className="p-1 text-gray-400 hover:text-school-navy hover:bg-gray-100 rounded transition-colors"
                  title="Quick View Document"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action Buttons: DOWNLOAD if file exists, or ATTACH if marked manually */}
            {hasFile ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <button
                  onClick={() => handleDownload(student, colConfig.title, doc.file)}
                  disabled={isThisDownloading}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-school-navy hover:bg-school-navy-dark rounded-lg transition-colors shadow-2xs disabled:opacity-50"
                  title="Download Document"
                >
                  {isThisDownloading ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>Download</span>
                </button>

                {/* Replace File Option */}
                <label
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                  title="Replace / Re-upload File"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(student, category, e)}
                  />
                </label>
              </div>
            ) : (
              /* Manually Marked Done (no file uploaded yet) */
              <div className="flex items-center gap-1 mt-0.5">
                <label className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-3 h-3 text-gray-500" />
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
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Undo: Mark as Pending"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}
          </>
        ) : (
          /* Status: UPLOAD PENDING */
          <>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>Upload Pending</span>
            </div>

            {/* Buttons: MARK AS DONE & UPLOAD */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <button
                onClick={() => handleMarkDone(student, category)}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-2xs"
                title="Mark as Done"
              >
                <Check className="w-3 h-3" />
                <span>Mark Done</span>
              </button>

              <label
                className="inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-semibold text-school-navy bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
                title="Upload Document"
              >
                <Upload className="w-3 h-3" />
                <span>Upload</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload(student, category, e)}
                />
              </label>
            </div>
          </>
        )}
      </div>
    );
  };

  // Render "OTHER DOCUMENTS" column
  const renderOtherDocsCell = (student) => {
    const { otherDocs, otherDocTypes } = getOtherDocsForStudent(student.documents, docTypes);
    const uploadedOthers = otherDocs.filter(d => d.uploaded || d.status === "Uploaded");
    const hasAnyUploaded = uploadedOthers.length > 0;
    const isOpen = otherDropdownOpen === student._studentId;

    return (
      <div className="flex flex-col gap-1.5 min-w-[170px] max-w-[210px] p-2 rounded-xl bg-white border border-gray-100 shadow-2xs relative">
        {hasAnyUploaded ? (
          <div className="space-y-1.5">
            {uploadedOthers.map((d, idx) => {
              const hasFile = Boolean(d.file);
              const isThisDownloading = downloadingKey === `${student._studentId}_${d.file}`;

              return (
                <div key={d.name || idx} className="flex items-center justify-between gap-1 bg-gray-50/80 p-1.5 rounded-lg border border-gray-100 text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-gray-800 truncate text-[11px]" title={d.name}>{d.name}</span>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Done
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasFile ? (
                      <button
                        onClick={() => handleDownload(student, d.name, d.file)}
                        disabled={isThisDownloading}
                        className="p-1 bg-school-navy hover:bg-school-navy-dark text-white rounded transition-colors"
                        title={`Download ${d.name}`}
                      >
                        {isThisDownloading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      </button>
                    ) : (
                      <label className="p-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded cursor-pointer transition-colors" title={`Attach file for ${d.name}`}>
                        <Upload className="w-3 h-3" />
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
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Upload Pending</span>
          </div>
        )}

        {/* Action Button: Add / Upload Other Document */}
        <div className="relative mt-0.5">
          <button
            onClick={() => setOtherDropdownOpen(isOpen ? null : student._studentId)}
            className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Manage Others</span>
          </button>

          {/* Popover / Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-2.5 z-50 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                <span className="font-bold text-gray-700 text-xs">Other Documents</span>
                <button onClick={() => setOtherDropdownOpen(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {otherDocTypes.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-1">No other document types registered.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {otherDocTypes.map(dt => {
                    const existingDoc = (student.documents || []).find(d => d.documentTypeId === dt.id || d.name === dt.name);
                    const isDone = existingDoc && (existingDoc.uploaded || existingDoc.status === "Uploaded");

                    return (
                      <div key={dt.id} className="p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-800 text-[11px] truncate">{dt.name}</span>
                          {isDone ? (
                            <span className="text-[10px] text-emerald-600 font-bold">✓ Done</span>
                          ) : (
                            <span className="text-[10px] text-amber-600 font-bold">Pending</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          {isDone ? (
                            existingDoc?.file ? (
                              <button
                                onClick={() => {
                                  setOtherDropdownOpen(null);
                                  handleDownload(student, dt.name, existingDoc.file);
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-1 py-0.5 px-1.5 text-[10px] font-semibold bg-school-navy text-white rounded"
                              >
                                <Download className="w-2.5 h-2.5" /> Download
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-400">Marked Done</span>
                            )
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setOtherDropdownOpen(null);
                                  handleMarkDone(student, "other", dt);
                                }}
                                className="flex-1 py-0.5 px-1.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100"
                              >
                                Mark Done
                              </button>
                              <label className="flex-1 inline-flex items-center justify-center gap-1 py-0.5 px-1.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded cursor-pointer hover:bg-blue-100">
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
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── KPI Statistics Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Students</p>
            <p className="text-2xl font-bold text-school-navy mt-1">{stats.totalStudents}</p>
            <p className="text-xs text-gray-400 mt-0.5">Enrolled Students</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-school-navy">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* Fully Completed */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">All Docs Done</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.fullyDoneStudents}</p>
            <p className="text-xs text-emerald-600 mt-0.5">100% verified</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Total Uploaded / Done */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Docs Completed</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalUploadedDocs}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stats.completionRate}% completion rate</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Documents */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Upload Pending</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.totalPendingDocs}</p>
            <p className="text-xs text-amber-600 mt-0.5">Requires submission</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Filters & Search Control Bar ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[220px] max-w-xs flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, GR or enrollment..."
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-school-navy focus:ring-1 focus:ring-school-navy transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white text-gray-700 font-medium focus:outline-none focus:border-school-navy cursor-pointer"
          >
            <option value="All">All Classes ({localStudents.length})</option>
            {CLASSES_LIST.map((cls) => {
              const count = localStudents.filter(s => s.std === cls).length;
              return (
                <option key={cls} value={cls}>
                  {cls} ({count})
                </option>
              );
            })}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white text-gray-700 font-medium focus:outline-none focus:border-school-navy cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Has Pending Docs</option>
            <option value="done">All Docs Completed</option>
          </select>

          {/* Document Specific Filter */}
          <select
            value={docColumnFilter}
            onChange={(e) => setDocColumnFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white text-gray-700 font-medium focus:outline-none focus:border-school-navy cursor-pointer hidden sm:block"
          >
            <option value="all">All Document Types</option>
            <option value="birth">Pending Birth Certificate</option>
            <option value="transfer">Pending Transfer Certificate</option>
            <option value="student_aadhar">Pending Student Aadhar</option>
            <option value="father_aadhar">Pending Father Aadhar</option>
            <option value="mother_aadhar">Pending Mother Aadhar</option>
          </select>
        </div>

        {/* Action Buttons: Excel Export & Refresh */}
        <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            title="Download Excel Document Register"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => onRefresh?.()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
            title="Reload from server"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Main Data Table ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        {/* Table Top Bar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Student Document Registry
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-school-navy/10 text-school-navy">
              {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={-1}>All ({filteredStudents.length})</option>
            </select>
          </div>
        </div>

        {/* Scrollable Table Content */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider select-none">
                <th className="py-3 px-3 text-center w-12">SR NO</th>
                <th className="py-3 px-3 w-28">CLASS</th>
                <th className="py-3 px-3 w-48">NAME</th>
                <th className="py-3 px-3 text-center w-20">GR</th>
                <th className="py-3 px-3">BIRTH CERTIFICATE</th>
                <th className="py-3 px-3">TRANSFER CERTIFICATE</th>
                <th className="py-3 px-3">STUDENT AADHAR</th>
                <th className="py-3 px-3">FATHER AADHAR</th>
                <th className="py-3 px-3">MOTHER AADHAR</th>
                <th className="py-3 px-3">OTHER DOCUMENTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-gray-400">
                    <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="font-medium text-gray-600">No students found matching your filters</p>
                    <p className="text-xs text-gray-400 mt-1">Try resetting search or filter criteria</p>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student, idx) => {
                  const serialNo = pageSize === -1
                    ? idx + 1
                    : (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr
                      key={student._studentId || student.enrollment || idx}
                      className="hover:bg-blue-50/20 transition-colors"
                    >
                      {/* SR NO */}
                      <td className="py-3 px-3 text-center font-bold text-gray-500 text-xs">
                        {serialNo}
                      </td>

                      {/* CLASS */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-school-navy">
                          {student.std || "—"}
                        </span>
                        {student.section && (
                          <span className="text-gray-400 font-normal ml-1">
                            - {student.section}
                          </span>
                        )}
                      </td>

                      {/* NAME */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 leading-tight">
                            {student.name || "—"}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono mt-0.5">
                            #{student.enrollment}
                          </span>
                        </div>
                      </td>

                      {/* GR */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {student.grNo ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-gray-100 text-gray-700 border border-gray-200">
                            {student.grNo}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>

                      {/* BIRTH CERTIFICATE */}
                      <td className="py-2.5 px-3">
                        {renderDocCell(student, "birth", PRIMARY_COLUMNS[0])}
                      </td>

                      {/* TRANSFER CERTIFICATE */}
                      <td className="py-2.5 px-3">
                        {renderDocCell(student, "transfer", PRIMARY_COLUMNS[1])}
                      </td>

                      {/* STUDENT AADHAR */}
                      <td className="py-2.5 px-3">
                        {renderDocCell(student, "student_aadhar", PRIMARY_COLUMNS[2])}
                      </td>

                      {/* FATHER AADHAR */}
                      <td className="py-2.5 px-3">
                        {renderDocCell(student, "father_aadhar", PRIMARY_COLUMNS[3])}
                      </td>

                      {/* MOTHER AADHAR */}
                      <td className="py-2.5 px-3">
                        {renderDocCell(student, "mother_aadhar", PRIMARY_COLUMNS[4])}
                      </td>

                      {/* OTHER DOCUMENTS */}
                      <td className="py-2.5 px-3">
                        {renderOtherDocsCell(student)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Controls ───────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <span className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-bold text-gray-800">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-bold text-gray-800">
                {Math.min(currentPage * pageSize, filteredStudents.length)}
              </span>{" "}
              of{" "}
              <span className="font-bold text-gray-800">
                {filteredStudents.length}
              </span>{" "}
              students
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-semibold text-gray-700 px-2">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Document Preview Modal ─────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-school-navy px-5 py-3.5 flex items-center justify-between text-white">
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
                    title="Open in new window"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50 min-h-[350px]">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-school-navy" />
                  <span className="text-xs font-semibold">Loading document preview...</span>
                </div>
              ) : previewDoc.url ? (
                previewDoc.fileKey?.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.title}
                    className="w-full h-[65vh] rounded-lg border border-gray-200"
                  />
                ) : (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.title}
                    className="max-h-[65vh] max-w-full rounded-lg object-contain shadow-sm"
                  />
                )
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                  <p className="text-sm font-semibold text-gray-600">Preview not available</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-white flex items-center justify-end gap-2">
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
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
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
