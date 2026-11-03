"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FileText, Search, Download, Upload, Check, CheckCircle2,
  Clock, AlertCircle, RefreshCw, FileSpreadsheet, Eye, X,
  ExternalLink, RotateCcw, Plus, MoreHorizontal, ShieldCheck,
  Filter, Table, CheckSquare, Sparkles, ChevronDown, Layers,
  Phone, Users, MapPin, Calendar, HelpCircle, ArrowUpDown,
  CheckCircle, MinusCircle, FileCheck, Edit3, AlertTriangle,
  Maximize2, Minimize2
} from "lucide-react";
import {
  getDocumentTypes,
  markDocumentDone,
  markDocumentPending,
  markDocumentNotRequired,
  updateStudentDocument,
  updateStudentGrNo
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

// Column widths for spreadsheet freeze-panes
const COL_WIDTHS = {
  sr: 46,
  class: 82,
  gr: 76,
  name: 220,
  fatherName: 160,
  motherName: 160,
  dob: 95,
  mobile: 145,
  address: 200,
  doc: 165,
  other: 195,
};

// Left offsets for frozen columns
const STICKY_OFFSETS = {
  sr: 0,
  class: COL_WIDTHS.sr,
  gr: COL_WIDTHS.sr + COL_WIDTHS.class,
  name: COL_WIDTHS.sr + COL_WIDTHS.class + COL_WIDTHS.gr,
};

export default function StudentDocumentsSection({ students = [], onRefresh }) {
  const [docTypes, setDocTypes] = useState([]);
  const [loadingDocTypes, setLoadingDocTypes] = useState(true);

  // Filters & controls
  const [classFilter, setClassFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "pending" | "done" | "not_required"
  const [docColumnFilter, setDocColumnFilter] = useState("all"); // specific document filter
  const [showContactDetails, setShowContactDetails] = useState(false); // Toggle parent & contact info

  // Interactive states
  const [localStudents, setLocalStudents] = useState([]);
  const [uploadingKey, setUploadingKey] = useState(null); // `${studentId}_${docTypeId}`
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null); // { url, name, title, fileKey }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(null); // studentId of open popover
  const [activeCellInfo, setActiveCellInfo] = useState(null); // Spreadsheet active cell tooltip
  const [cellMenuOpen, setCellMenuOpen] = useState(null); // `${studentId}_${category}`

  // GR Inline Editing & Confirmation States
  const [editingGrStudentId, setEditingGrStudentId] = useState(null);
  const [editingGrValue, setEditingGrValue] = useState("");
  const [confirmGrModal, setConfirmGrModal] = useState(null); // { student, newGr, oldGr }
  const [savingGr, setSavingGr] = useState(false);

  // Sync Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [customCsvFile, setCustomCsvFile] = useState(null);

  // Full Screen Mode State & Table Scroll Ref
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tableScrollRef = useRef(null);

  // Toggle Full Screen mode
  const toggleFullScreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // Handle Fullscreen escape key & body scroll lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        // If a modal is open, let modal close first
        if (confirmGrModal || isSyncModalOpen || previewDoc) return;
        if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };

    if (isFullscreen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, confirmGrModal, isSyncModalOpen, previewDoc]);

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
    { key: "birth",          title: "BIRTH CERTIFICATE",    shortTitle: "Birth Cert",     matchKey: "birth" },
    { key: "transfer",       title: "TRANSFER CERTIFICATE", shortTitle: "Transfer Cert",  matchKey: "transfer" },
    { key: "student_aadhar", title: "STUDENT AADHAR",       shortTitle: "Student Aadhar", matchKey: "student_aadhar" },
    { key: "father_aadhar",  title: "FATHER AADHAR",        shortTitle: "Father Aadhar",  matchKey: "father_aadhar" },
    { key: "mother_aadhar",  title: "MOTHER AADHAR",        shortTitle: "Mother Aadhar",  matchKey: "mother_aadhar" },
  ], []);

  // Filtered students computation
  const filteredStudents = useMemo(() => {
    return localStudents.filter(s => {
      // Class filter
      if (classFilter !== "All" && s.std !== classFilter) return false;

      // Search filter (Name, Enrollment, GR, Father, Phone)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = (s.name || "").toLowerCase().includes(q);
        const matchesEnroll = (s.enrollment || "").toLowerCase().includes(q);
        const matchesGr = (s.grNo || "").toLowerCase().includes(q);
        const matchesFather = (s.fatherName || "").toLowerCase().includes(q);
        const matchesMobile = (s.mobile || "").includes(q) || (s.mobile2 || "").includes(q);
        if (!matchesName && !matchesEnroll && !matchesGr && !matchesFather && !matchesMobile) return false;
      }

      // Check primary documents status for statusFilter
      const primaryStatuses = PRIMARY_COLUMNS.map(col => {
        const doc = matchDocByCategory(col.matchKey, s.documents);
        const isUploaded = Boolean(doc && (doc.uploaded || doc.status === "Uploaded"));
        const isNotReq = Boolean(doc && (doc.notRequired || (doc.reason && doc.reason.toLowerCase().includes("not required")) || doc.reason === "-" || (col.key === "transfer" && s.hasPrevSchool === false)));
        return { isUploaded, isNotReq, isPending: !isUploaded && !isNotReq };
      });

      const allDone = primaryStatuses.every(st => st.isUploaded || st.isNotReq);
      const hasPending = primaryStatuses.some(st => st.isPending);
      const hasNotRequired = primaryStatuses.some(st => st.isNotReq);

      if (statusFilter === "pending" && !hasPending) return false;
      if (statusFilter === "done" && !allDone) return false;
      if (statusFilter === "not_required" && !hasNotRequired) return false;

      // Specific doc filter
      if (docColumnFilter !== "all") {
        const doc = matchDocByCategory(docColumnFilter, s.documents);
        const isUploaded = Boolean(doc && (doc.uploaded || doc.status === "Uploaded"));
        if (isUploaded) return false; // Show only pending/missing for this specific doc
      }

      return true;
    });
  }, [localStudents, classFilter, search, statusFilter, docColumnFilter, PRIMARY_COLUMNS]);

  // Overall statistics & per-column counts
  const stats = useMemo(() => {
    let totalStudents = localStudents.length;
    let fullyDoneStudents = 0;
    let totalUploadedDocs = 0;
    let totalNotRequiredDocs = 0;
    let totalPendingDocs = 0;

    const columnCounts = {
      birth:          { ok: 0, notRequired: 0, pending: 0 },
      transfer:       { ok: 0, notRequired: 0, pending: 0 },
      student_aadhar: { ok: 0, notRequired: 0, pending: 0 },
      father_aadhar:  { ok: 0, notRequired: 0, pending: 0 },
      mother_aadhar:  { ok: 0, notRequired: 0, pending: 0 },
    };

    localStudents.forEach(s => {
      let studentAllDone = true;
      PRIMARY_COLUMNS.forEach(col => {
        const doc = matchDocByCategory(col.matchKey, s.documents);
        const isUploaded = Boolean(doc && (doc.uploaded || doc.status === "Uploaded"));
        const isNotReq = Boolean(doc && (doc.notRequired || (doc.reason && doc.reason.toLowerCase().includes("not required")) || doc.reason === "-" || (col.key === "transfer" && s.hasPrevSchool === false)));

        if (isUploaded) {
          totalUploadedDocs++;
          if (columnCounts[col.key]) columnCounts[col.key].ok++;
        } else if (isNotReq) {
          totalNotRequiredDocs++;
          if (columnCounts[col.key]) columnCounts[col.key].notRequired++;
        } else {
          totalPendingDocs++;
          studentAllDone = false;
          if (columnCounts[col.key]) columnCounts[col.key].pending++;
        }
      });
      if (studentAllDone) fullyDoneStudents++;
    });

    const completionRate = totalStudents > 0
      ? Math.round(((totalUploadedDocs + totalNotRequiredDocs) / (totalStudents * PRIMARY_COLUMNS.length)) * 100)
      : 0;

    return {
      totalStudents,
      fullyDoneStudents,
      totalUploadedDocs,
      totalNotRequiredDocs,
      totalPendingDocs,
      completionRate,
      columnCounts,
    };
  }, [localStudents, PRIMARY_COLUMNS]);

  // Handle Request Save GR (opens confirmation modal)
  const handleRequestSaveGr = (student, value) => {
    const clean = (value || "").trim().toUpperCase();
    if (!clean) {
      alert("Please enter a valid GR Number.");
      return;
    }
    if (student.grNo && student.grNo.trim().toUpperCase() === clean) {
      setEditingGrStudentId(null);
      return;
    }
    setConfirmGrModal({
      student,
      newGr: clean,
      oldGr: student.grNo || "",
    });
  };

  // Handle Confirm Save GR (writes to Supabase)
  const handleConfirmSaveGr = async () => {
    if (!confirmGrModal || !confirmGrModal.student) return;
    const { student, newGr } = confirmGrModal;

    setSavingGr(true);
    try {
      await updateStudentGrNo(student._studentId, newGr);

      // Optimistically update localStudents state
      setLocalStudents(prev => prev.map(s => {
        if (s._studentId === student._studentId) {
          return { ...s, grNo: newGr };
        }
        return s;
      }));

      setConfirmGrModal(null);
      setEditingGrStudentId(null);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to update GR:", err);
      alert("Failed to save GR Number: " + (err.message || "Unknown error"));
    } finally {
      setSavingGr(false);
    }
  };

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
        reason: "Verified (Done)",
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
      await markDocumentDone(student._studentId, docType.id, "Verified (Done)");
      onRefresh?.();
    } catch (err) {
      console.error("Mark Done failed:", err);
      alert("Failed to mark document as done: " + (err.message || "Unknown error"));
      onRefresh?.();
    } finally {
      setUploadingKey(null);
    }
  };

  // Handle Mark as Not Required ("-")
  const handleMarkNotRequired = async (student, category, docTypeOverride = null) => {
    const docType = docTypeOverride || findDocTypeByCategory(category, docTypes);
    if (!docType?.id) return;

    const key = `${student._studentId}_${docType.id}`;
    setUploadingKey(key);
    setCellMenuOpen(null);

    // Optimistic update
    setLocalStudents(prev => prev.map(s => {
      if (s._studentId !== student._studentId) return s;
      const currentDocs = [...(s.documents || [])];
      const existingIdx = currentDocs.findIndex(d => d.documentTypeId === docType.id || d.name === docType.name);

      const updatedDoc = {
        id: existingIdx > -1 ? currentDocs[existingIdx].id : null,
        name: docType.name,
        documentTypeId: docType.id,
        uploaded: false,
        notRequired: true,
        status: "Pending",
        reason: "Not Required",
        file: "",
        uploadedAt: null,
      };

      if (existingIdx > -1) {
        currentDocs[existingIdx] = updatedDoc;
      } else {
        currentDocs.push(updatedDoc);
      }
      return { ...s, documents: currentDocs };
    }));

    try {
      await markDocumentNotRequired(student._studentId, docType.id, "Not Required");
      onRefresh?.();
    } catch (err) {
      console.error("Mark Not Required failed:", err);
      alert("Failed to update status: " + (err.message || "Unknown error"));
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
    setCellMenuOpen(null);

    // Optimistic update
    setLocalStudents(prev => prev.map(s => {
      if (s._studentId !== student._studentId) return s;
      const currentDocs = (s.documents || []).map(d => {
        if (d.documentTypeId === docType.id || d.name === docType.name) {
          return {
            ...d,
            uploaded: false,
            notRequired: false,
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
    setPreviewDoc({ name: student.name, grNo: student.grNo, title: docTitle, fileKey, url: null });

    try {
      const downloadName = buildDocDownloadName(student.grNo || student.enrollment, student.name, docTitle, fileKey);
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

  // Export to Excel / CSV in the EXACT format of "Document Collection Report - Classwise - ALL CLASSES.csv"
  const handleExportSchoolReport = () => {
    try {
      const exportRows = filteredStudents.map((s, idx) => {
        const birthDoc = matchDocByCategory("birth", s.documents);
        const tcDoc = matchDocByCategory("transfer", s.documents);
        const stAadharDoc = matchDocByCategory("student_aadhar", s.documents);
        const faAadharDoc = matchDocByCategory("father_aadhar", s.documents);
        const moAadharDoc = matchDocByCategory("mother_aadhar", s.documents);

        const getStatusSymbol = (doc, isTc = false) => {
          if (!doc) {
            if (isTc && s.hasPrevSchool === false) return "-";
            return "";
          }
          if (doc.uploaded || doc.status === "Uploaded") return "OK";
          if (doc.notRequired || (doc.reason && doc.reason.toLowerCase().includes("not required")) || doc.reason === "-") return "-";
          if (isTc && s.hasPrevSchool === false) return "-";
          return "";
        };

        return {
          "Class": s.std || "",
          "Sr": idx + 1,
          "GR No": s.grNo || "",
          "Name": (s.name || "").toUpperCase(),
          "Father Name": (s.fatherName || "").toUpperCase(),
          "Mother Name": (s.motherName || "").toUpperCase(),
          "DOB": s.dob || "",
          "Mobile No": s.mobile ? (s.mobile2 ? `${s.mobile} / ${s.mobile2}` : s.mobile) : "",
          "Address": s.address || "",
          "Birth Certificate": getStatusSymbol(birthDoc),
          "Transfer Certificate": getStatusSymbol(tcDoc, true),
          "Student Aadhar": getStatusSymbol(stAadharDoc),
          "Father Aadhar": getStatusSymbol(faAadharDoc),
          "Mother Aadhar": getStatusSymbol(moAadharDoc),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Document Collection Report");

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Document_Collection_Report_Classwise_${dateStr}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export: " + err.message);
    }
  };

  // Perform Sync from CSV (either official project file or custom uploaded CSV)
  const handlePerformSync = async (useCustom = false) => {
    try {
      setSyncLoading(true);
      setSyncResult(null);

      let payload = { syncDefault: true };

      if (useCustom && customCsvFile) {
        const text = await customCsvFile.text();
        payload = { csvText: text };
      }

      const res = await fetch("/api/documents/sync-collection-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Sync request failed");
      }

      setSyncResult(data.stats);
      onRefresh?.();
    } catch (err) {
      console.error("Sync error:", err);
      alert("Sync failed: " + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // Render a spreadsheet document cell
  const renderDocCell = (student, category, colConfig) => {
    const doc = matchDocByCategory(category, student.documents);
    const docType = findDocTypeByCategory(category, docTypes);
    const docTypeId = docType?.id || doc?.documentTypeId;

    const isUploaded = Boolean(doc && (doc.uploaded || doc.status === "Uploaded"));
    const isNotRequired = Boolean(
      !isUploaded && (
        (doc && (doc.notRequired || (doc.reason && doc.reason.toLowerCase().includes("not required")) || doc.reason === "-")) ||
        (category === "transfer" && student.hasPrevSchool === false)
      )
    );
    const hasFile = Boolean(doc?.file);
    const cellKey = `${student._studentId}_${docTypeId || category}`;
    const isThisUploading = uploadingKey === `${student._studentId}_${docTypeId}`;
    const isThisDownloading = downloadingKey === `${student._studentId}_${doc?.file}`;
    const isMenuOpen = cellMenuOpen === `${student._studentId}_${category}`;

    return (
      <td
        key={category}
        className={`border-r border-b border-slate-200 transition-colors align-middle relative p-1.5 ${
          isUploaded
            ? "bg-emerald-50/40 hover:bg-emerald-100/60"
            : isNotRequired
            ? "bg-slate-50 hover:bg-slate-100/80"
            : "bg-amber-50/30 hover:bg-amber-100/50"
        }`}
        style={{ width: COL_WIDTHS.doc, minWidth: COL_WIDTHS.doc, maxWidth: COL_WIDTHS.doc }}
        onMouseEnter={() => setActiveCellInfo({
          student: student.name,
          class: student.std,
          gr: student.grNo,
          father: student.fatherName,
          mobile: student.mobile,
          doc: colConfig.title,
          status: isUploaded
            ? (hasFile ? "OK (File Uploaded)" : `OK (${doc?.reason || "Verified"})`)
            : isNotRequired
            ? "— Not Required (Exempt)"
            : "Upload Pending"
        })}
      >
        {isThisUploading ? (
          <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-school-navy">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </div>
        ) : isUploaded ? (
          /* State 1: OK / DONE - OK ENLARGED BIG, ACTIONS FULLY RESTORED, DOWNLOAD SMALL LIKE UPLOAD */
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-emerald-800 tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-black">OK</span>
                {!hasFile && <span className="text-[9.5px] font-semibold text-emerald-700 font-sans ml-0.5">(Verified)</span>}
              </span>

              <div className="flex items-center gap-0.5">
                {hasFile && (
                  <button
                    onClick={() => handlePreview(student, colConfig.title, doc.file)}
                    className="p-1 text-slate-400 hover:text-school-navy hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                    title="Quick Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setCellMenuOpen(isMenuOpen ? null : `${student._studentId}_${category}`)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  title="More actions"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {hasFile ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDownload(student, colConfig.title, doc.file)}
                  disabled={isThisDownloading}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-1 text-[10.5px] font-bold text-white bg-school-navy hover:bg-school-navy-dark active:bg-school-navy rounded border border-school-navy shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
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
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-1 text-[10.5px] font-bold text-school-navy bg-white hover:bg-blue-50 border border-blue-300 rounded cursor-pointer shadow-2xs transition-colors"
                  title="Replace / Re-upload File"
                >
                  <Upload className="w-3 h-3 text-school-navy" />
                  <span>Upload</span>
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
                <label className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-1 text-[10.5px] font-bold text-school-navy bg-white hover:bg-blue-50 border border-blue-300 rounded cursor-pointer shadow-2xs transition-colors">
                  <Upload className="w-3 h-3 text-slate-500" />
                  <span>Attach File</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(student, category, e)}
                  />
                </label>
              </div>
            )}

            {/* Cell Context Menu */}
            {isMenuOpen && (
              <div className="absolute right-1 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-300 p-1.5 z-50 space-y-1 text-xs">
                <button
                  onClick={() => handleMarkPending(student, category)}
                  className="w-full text-left px-2 py-1 hover:bg-red-50 text-red-700 font-semibold rounded text-[11px] flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" /> Mark as Pending
                </button>
                <button
                  onClick={() => handleMarkNotRequired(student, category)}
                  className="w-full text-left px-2 py-1 hover:bg-slate-100 text-slate-700 font-medium rounded text-[11px] flex items-center gap-1.5"
                >
                  <MinusCircle className="w-3 h-3 text-slate-400" /> Mark as Not Required (—)
                </button>
              </div>
            )}
          </div>
        ) : isNotRequired ? (
          /* State 2: NOT REQUIRED / EXEMPT (—) */
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 tracking-tight">
                <span className="font-mono text-slate-400 font-bold text-xs">—</span>
                <span>Not Required</span>
              </span>

              <button
                onClick={() => setCellMenuOpen(isMenuOpen ? null : `${student._studentId}_${category}`)}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                title="Change status"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleMarkDone(student, category)}
                className="flex-1 inline-flex items-center justify-center gap-0.5 py-1 px-1 text-[10.5px] font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 rounded shadow-2xs transition-colors cursor-pointer"
                title="Mark as OK / Submitted"
              >
                <Check className="w-2.5 h-2.5 text-emerald-700" />
                <span>Mark OK</span>
              </button>

              <label
                className="flex-1 inline-flex items-center justify-center gap-0.5 py-1 px-1 text-[10.5px] font-semibold text-school-navy bg-white hover:bg-blue-50 border border-blue-300 rounded cursor-pointer shadow-2xs transition-colors"
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

            {/* Cell Context Menu */}
            {isMenuOpen && (
              <div className="absolute right-1 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-300 p-1.5 z-50 space-y-1 text-xs">
                <button
                  onClick={() => handleMarkPending(student, category)}
                  className="w-full text-left px-2 py-1 hover:bg-amber-50 text-amber-800 font-semibold rounded text-[11px] flex items-center gap-1.5"
                >
                  <Clock className="w-3 h-3 text-amber-600" /> Mark as Required (Pending)
                </button>
              </div>
            )}
          </div>
        ) : (
          /* State 3: UPLOAD PENDING */
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800 tracking-tight">
                <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                Upload Pending
              </span>

              <button
                onClick={() => setCellMenuOpen(isMenuOpen ? null : `${student._studentId}_${category}`)}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                title="Change status"
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleMarkDone(student, category)}
                className="flex-1 inline-flex items-center justify-center gap-0.5 py-1 px-1 text-[10.5px] font-bold text-emerald-800 bg-white hover:bg-emerald-100/80 active:bg-emerald-200 border border-emerald-300 rounded shadow-2xs transition-colors"
                title="Mark as Done / OK"
              >
                <Check className="w-2.5 h-2.5 text-emerald-700" />
                <span>Mark OK</span>
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

            {/* Cell Context Menu */}
            {isMenuOpen && (
              <div className="absolute right-1 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-300 p-1.5 z-50 space-y-1 text-xs">
                <button
                  onClick={() => handleMarkNotRequired(student, category)}
                  className="w-full text-left px-2 py-1 hover:bg-slate-100 text-slate-700 font-medium rounded text-[11px] flex items-center gap-1.5"
                >
                  <MinusCircle className="w-3 h-3 text-slate-400" /> Mark as Not Required (—)
                </button>
              </div>
            )}
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
        className={`border-r border-b border-slate-200 transition-colors align-middle relative p-1.5 ${hasAnyUploaded ? "bg-emerald-50/30 hover:bg-emerald-100/50" : "bg-amber-50/30 hover:bg-amber-100/40"}`}
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
                    <span className="font-semibold text-slate-800 truncate text-[10.5px] max-w-[105px]" title={d.name}>
                      {d.name}
                    </span>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10.5px] text-emerald-800 font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-300 shadow-2xs">
                        OK
                      </span>

                      {hasFile ? (
                        <button
                          onClick={() => handleDownload(student, d.name, d.file)}
                          disabled={isThisDownloading}
                          className="p-1 bg-school-navy hover:bg-school-navy-dark text-white rounded text-[10px] transition-colors cursor-pointer"
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
                              <span className="text-[9.5px] text-emerald-700 font-bold">✓ OK</span>
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
                                <span className="text-[9.5px] text-slate-400">Marked OK</span>
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
                                  Mark OK
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
    <div
      className={`font-sans transition-all duration-200 ${
        isFullscreen
          ? "fixed inset-0 z-[50] bg-slate-100 flex flex-col h-screen w-screen p-3 sm:p-4 overflow-hidden gap-2.5"
          : "flex flex-col gap-3"
      }`}
    >
      {/* ── Dedicated Full Screen Header Bar (Only in Full Screen) ─────── */}
      {isFullscreen && (
        <div className="bg-white rounded-xl border border-slate-300 px-3.5 py-2 flex items-center justify-between shadow-2xs flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-school-navy text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Document Collection Spreadsheet
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  FULL SCREEN MODE
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Clean and distraction-free view • Press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-300 text-[9.5px]">Esc</kbd> to exit full screen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Metrics Strip */}
            <div className="hidden lg:flex items-center gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 font-medium">
              <span><strong>{stats.totalStudents}</strong> Students</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-700 font-bold">{stats.totalUploadedDocs} OK</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 font-semibold">{stats.totalNotRequiredDocs} Exempt (—)</span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-700 font-bold">{stats.totalPendingDocs} Pending</span>
              <span className="text-slate-300">•</span>
              <span className="text-school-navy font-bold">{stats.completionRate}% Done</span>
            </div>

            {/* Exit Full Screen Button */}
            <button
              onClick={toggleFullScreen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Exit Full Screen (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit Full Screen (Esc)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Spreadsheet KPI Metric Cards (Only in Normal Embedded Mode) ─── */}
      {!isFullscreen && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Students</p>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">{stats.totalStudents}</p>
              <p className="text-[10px] text-slate-400">Enrolled Roster</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-school-navy">
              <Table className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Fully Collected</p>
              <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{stats.fullyDoneStudents}</p>
              <p className="text-[10px] text-emerald-600">All docs verified</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Documents OK</p>
              <p className="text-xl font-extrabold text-blue-700 mt-0.5">{stats.totalUploadedDocs}</p>
              <p className="text-[10px] text-blue-600">{stats.completionRate}% completion rate</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Not Required (—)</p>
              <p className="text-xl font-extrabold text-slate-700 mt-0.5">{stats.totalNotRequiredDocs}</p>
              <p className="text-[10px] text-slate-500">Exempt (e.g. TC pre-pri)</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <MinusCircle className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs col-span-2 sm:col-span-1">
            <div>
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Upload Pending</p>
              <p className="text-xl font-extrabold text-amber-700 mt-0.5">{stats.totalPendingDocs}</p>
              <p className="text-[10px] text-amber-600">Action required</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* ── Spreadsheet Toolbar ────────────────────────────────────────── */}
      <div className="bg-slate-100 rounded-xl border border-slate-300 p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-2xs">
        {/* Left Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, GR, father, phone..."
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
              <option value="done">Completed (OK) Only</option>
              <option value="not_required">Not Required (—) Only</option>
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
        <div className="flex flex-wrap items-center gap-1.5 self-end md:self-auto flex-shrink-0">
          {/* Toggle Parent & Contact Info Columns */}
          <button
            onClick={() => setShowContactDetails(!showContactDetails)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showContactDetails
                ? "bg-school-navy text-white border-school-navy shadow-2xs"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-200"
            }`}
            title="Toggle Father, Mother, DOB, Mobile, Address columns"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{showContactDetails ? "Hide Contact Info" : "Show Contact Info"}</span>
          </button>

          {/* Sync from CSV Modal Trigger */}
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-school-navy hover:bg-blue-100 border border-blue-300 rounded-lg text-xs font-bold transition-colors shadow-2xs"
            title="Synchronize from Document Collection Report CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-school-navy" />
            <span>Sync CSV</span>
          </button>

          {/* Export to Excel (.xlsx) matching School Report */}
          <button
            onClick={handleExportSchoolReport}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
            title="Download Document Collection Report (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>

          {/* Refresh Data */}
          <button
            onClick={() => onRefresh?.()}
            className="p-1.5 bg-white hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 rounded-lg transition-colors"
            title="Refresh from database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Full Screen Mode Toggle */}
          <button
            onClick={toggleFullScreen}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${
              isFullscreen
                ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                : "bg-white hover:bg-slate-200 active:bg-slate-300 text-school-navy border border-slate-300"
            }`}
            title={isFullscreen ? "Exit Full Screen Mode (Esc)" : "Open Clean & Clear Full Screen Spreadsheet"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Full Screen</span>
              </>
            )}
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
              {activeCellInfo.father && (
                <>
                  <span className="text-slate-400 mx-1">|</span>
                  Father: <strong>{activeCellInfo.father}</strong>
                </>
              )}
              {activeCellInfo.mobile && (
                <>
                  <span className="text-slate-400 mx-1">|</span>
                  Mobile: <strong>{activeCellInfo.mobile}</strong>
                </>
              )}
              <span className="text-slate-400 mx-1">|</span>
              <span className="text-slate-700">{activeCellInfo.doc}:</span>{" "}
              <strong className={
                activeCellInfo.status.startsWith("OK")
                  ? "text-emerald-700 font-bold"
                  : activeCellInfo.status.includes("Not Required")
                  ? "text-slate-600 font-bold"
                  : "text-amber-700 font-bold"
              }>
                {activeCellInfo.status}
              </strong>
            </span>
          ) : (
            <span className="text-slate-400 italic">
              Hover over or click any document cell to inspect details
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 flex-shrink-0">
          <span>Rows: <strong className="text-slate-800">{filteredStudents.length}</strong> / {localStudents.length}</span>
          <span className="text-slate-300">|</span>
          <span>Columns: <strong className="text-slate-800">{showContactDetails ? "15 (Full)" : "10 (Standard)"}</strong></span>
        </div>
      </div>

      {/* ── Spreadsheet Grid with Freeze Panes ────────────────────────── */}
      <div
        className={`border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs flex flex-col ${
          isFullscreen ? "flex-1 min-h-0" : "max-h-[76vh]"
        }`}
      >
        <div ref={tableScrollRef} className="overflow-auto flex-1 relative">
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
                  <span>SR</span>
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

                {/* Column C: GR NO (Frozen 3) */}
                <th
                  className="sticky z-40 bg-slate-200 border-r border-b-2 border-slate-300 text-center py-2 px-1.5 text-slate-700"
                  style={{
                    left: STICKY_OFFSETS.gr,
                    width: COL_WIDTHS.gr,
                    minWidth: COL_WIDTHS.gr,
                    maxWidth: COL_WIDTHS.gr,
                  }}
                >
                  <div className="text-[9px] text-slate-400 font-mono font-normal">C</div>
                  <span>GR NO</span>
                </th>

                {/* Column D: NAME (Frozen 4 - Right Border Separator) */}
                <th
                  className="sticky z-40 bg-slate-200 border-r-2 border-r-slate-400 border-b-2 border-slate-300 py-2 px-2.5 text-slate-700 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]"
                  style={{
                    left: STICKY_OFFSETS.name,
                    width: COL_WIDTHS.name,
                    minWidth: COL_WIDTHS.name,
                    maxWidth: COL_WIDTHS.name,
                  }}
                >
                  <div className="text-[9px] text-slate-400 font-mono font-normal">D</div>
                  <span>STUDENT NAME</span>
                </th>

                {/* Optional Contact Detail Columns (E to I) */}
                {showContactDetails && (
                  <>
                    <th
                      className="border-r border-b-2 border-slate-300 py-2 px-2 text-slate-800 bg-slate-100"
                      style={{ width: COL_WIDTHS.fatherName, minWidth: COL_WIDTHS.fatherName, maxWidth: COL_WIDTHS.fatherName }}
                    >
                      <div className="text-[9px] text-slate-400 font-mono font-normal">E</div>
                      <span className="text-[11px] block">FATHER NAME</span>
                    </th>
                    <th
                      className="border-r border-b-2 border-slate-300 py-2 px-2 text-slate-800 bg-slate-100"
                      style={{ width: COL_WIDTHS.motherName, minWidth: COL_WIDTHS.motherName, maxWidth: COL_WIDTHS.motherName }}
                    >
                      <div className="text-[9px] text-slate-400 font-mono font-normal">F</div>
                      <span className="text-[11px] block">MOTHER NAME</span>
                    </th>
                    <th
                      className="border-r border-b-2 border-slate-300 py-2 px-1 text-center text-slate-800 bg-slate-100"
                      style={{ width: COL_WIDTHS.dob, minWidth: COL_WIDTHS.dob, maxWidth: COL_WIDTHS.dob }}
                    >
                      <div className="text-[9px] text-slate-400 font-mono font-normal">G</div>
                      <span className="text-[11px] block">DOB</span>
                    </th>
                    <th
                      className="border-r border-b-2 border-slate-300 py-2 px-2 text-slate-800 bg-slate-100"
                      style={{ width: COL_WIDTHS.mobile, minWidth: COL_WIDTHS.mobile, maxWidth: COL_WIDTHS.mobile }}
                    >
                      <div className="text-[9px] text-slate-400 font-mono font-normal">H</div>
                      <span className="text-[11px] block">MOBILE NO</span>
                    </th>
                    <th
                      className="border-r border-b-2 border-slate-300 py-2 px-2 text-slate-800 bg-slate-100"
                      style={{ width: COL_WIDTHS.address, minWidth: COL_WIDTHS.address, maxWidth: COL_WIDTHS.address }}
                    >
                      <div className="text-[9px] text-slate-400 font-mono font-normal">I</div>
                      <span className="text-[11px] block">ADDRESS</span>
                    </th>
                  </>
                )}

                {/* Primary Documents Columns */}
                {PRIMARY_COLUMNS.map((col, idx) => {
                  const counts = stats.columnCounts[col.key] || { ok: 0, notRequired: 0, pending: 0 };
                  const colLetter = String.fromCharCode(65 + 4 + (showContactDetails ? 5 : 0) + idx);

                  return (
                    <th
                      key={col.key}
                      className="border-r border-b-2 border-slate-300 py-2 px-2 text-slate-800 bg-slate-100"
                      style={{ width: COL_WIDTHS.doc, minWidth: COL_WIDTHS.doc, maxWidth: COL_WIDTHS.doc }}
                    >
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 font-normal">
                        <span>{colLetter}</span>
                        <span className="font-sans font-semibold text-emerald-700">
                          {counts.ok} OK
                          {counts.notRequired > 0 && <span className="text-slate-500 font-normal ml-1">({counts.notRequired} —)</span>}
                          <span className="text-amber-700 ml-1">/ {counts.pending} ⌛</span>
                        </span>
                      </div>
                      <span className="text-[11px] block truncate font-bold text-slate-900" title={col.title}>
                        {col.title}
                      </span>
                    </th>
                  );
                })}

                {/* OTHER DOCUMENTS Column */}
                <th
                  className="border-r border-b-2 border-slate-300 py-2 px-2 text-slate-800 bg-slate-100"
                  style={{ width: COL_WIDTHS.other, minWidth: COL_WIDTHS.other, maxWidth: COL_WIDTHS.other }}
                >
                  <div className="text-[9px] text-slate-400 font-mono font-normal">
                    {String.fromCharCode(65 + 4 + (showContactDetails ? 5 : 0) + 5)}
                  </div>
                  <span className="text-[11px] block font-bold text-slate-900">OTHER DOCUMENTS</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={showContactDetails ? 15 : 10} className="py-20 text-center text-slate-400 bg-white">
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
                        className={`sticky z-20 border-r border-b border-slate-200 text-center font-mono font-bold text-slate-600 transition-colors py-1.5 px-1 text-[11px] ${
                          isEven ? "bg-white group-hover:bg-sky-50" : "bg-slate-50 group-hover:bg-sky-50"
                        }`}
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
                        className={`sticky z-20 border-r border-b border-slate-200 whitespace-nowrap transition-colors py-1.5 px-2 ${
                          isEven ? "bg-white group-hover:bg-sky-50" : "bg-slate-50 group-hover:bg-sky-50"
                        }`}
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

                      {/* Column C: GR NO (Frozen - Editable if not already saved, with confirmation) */}
                      <td
                        className={`sticky z-20 border-r border-b border-slate-200 text-center whitespace-nowrap transition-colors py-1 px-1 ${
                          isEven ? "bg-white group-hover:bg-sky-50" : "bg-slate-50 group-hover:bg-sky-50"
                        }`}
                        style={{
                          left: STICKY_OFFSETS.gr,
                          width: COL_WIDTHS.gr,
                          minWidth: COL_WIDTHS.gr,
                          maxWidth: COL_WIDTHS.gr,
                        }}
                      >
                        {editingGrStudentId === student._studentId ? (
                          <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              autoFocus
                              value={editingGrValue}
                              onChange={(e) => setEditingGrValue(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleRequestSaveGr(student, editingGrValue);
                                } else if (e.key === "Escape") {
                                  setEditingGrStudentId(null);
                                }
                              }}
                              placeholder="GR..."
                              className="w-14 px-1 py-0.5 text-[10.5px] font-mono font-bold text-center border border-school-navy rounded bg-white shadow-2xs focus:outline-none focus:ring-1 focus:ring-school-navy"
                            />
                            <button
                              onClick={() => handleRequestSaveGr(student, editingGrValue)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] shadow-2xs transition-colors"
                              title="Save GR (Enter)"
                            >
                              <Check className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={() => setEditingGrStudentId(null)}
                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] transition-colors"
                              title="Cancel (Esc)"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : student.grNo ? (
                          <div className="inline-flex items-center gap-0.5 group/gr justify-center">
                            <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-300">
                              {student.grNo}
                            </span>
                            <button
                              onClick={() => {
                                setEditingGrStudentId(student._studentId);
                                setEditingGrValue(student.grNo);
                              }}
                              className="opacity-0 group-hover/gr:opacity-100 p-0.5 text-slate-400 hover:text-school-navy hover:bg-slate-200 rounded transition-all cursor-pointer"
                              title="Edit GR Number"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingGrStudentId(student._studentId);
                              setEditingGrValue("");
                            }}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-dashed border-amber-400 hover:border-amber-600 shadow-2xs transition-all cursor-pointer group/add"
                            title="GR not saved — click to enter and save with confirmation"
                          >
                            <Plus className="w-2.5 h-2.5 text-amber-600 group-hover/add:scale-110 transition-transform" />
                            <span>+ Set GR</span>
                          </button>
                        )}
                      </td>

                      {/* Column D: NAME (Frozen - Right Border Separator) */}
                      <td
                        className={`sticky z-20 border-r-2 border-r-slate-400 border-b border-slate-200 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)] transition-colors py-1.5 px-2.5 ${
                          isEven ? "bg-white group-hover:bg-sky-50" : "bg-slate-50 group-hover:bg-sky-50"
                        }`}
                        style={{
                          left: STICKY_OFFSETS.name,
                          width: COL_WIDTHS.name,
                          minWidth: COL_WIDTHS.name,
                          maxWidth: COL_WIDTHS.name,
                        }}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 truncate leading-tight text-xs uppercase" title={student.name}>
                            {student.name || "—"}
                          </span>
                          {student.fatherName && !showContactDetails && (
                            <span className="text-[10px] text-slate-500 truncate mt-0.5" title={`Father: ${student.fatherName}`}>
                              C/O {student.fatherName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Optional Contact Detail Columns (F to J) */}
                      {showContactDetails && (
                        <>
                          <td
                            className="border-r border-b border-slate-200 transition-colors py-1.5 px-2 text-[11px]"
                            style={{ width: COL_WIDTHS.fatherName, minWidth: COL_WIDTHS.fatherName, maxWidth: COL_WIDTHS.fatherName }}
                          >
                            <span className="font-medium text-slate-800 truncate block uppercase" title={student.fatherName}>
                              {student.fatherName || "—"}
                            </span>
                          </td>

                          <td
                            className="border-r border-b border-slate-200 transition-colors py-1.5 px-2 text-[11px]"
                            style={{ width: COL_WIDTHS.motherName, minWidth: COL_WIDTHS.motherName, maxWidth: COL_WIDTHS.motherName }}
                          >
                            <span className="font-medium text-slate-800 truncate block uppercase" title={student.motherName}>
                              {student.motherName || "—"}
                            </span>
                          </td>

                          <td
                            className="border-r border-b border-slate-200 text-center font-mono transition-colors py-1.5 px-1 text-[10.5px]"
                            style={{ width: COL_WIDTHS.dob, minWidth: COL_WIDTHS.dob, maxWidth: COL_WIDTHS.dob }}
                          >
                            {student.dob || "—"}
                          </td>

                          <td
                            className="border-r border-b border-slate-200 font-mono transition-colors py-1.5 px-2 text-[10.5px]"
                            style={{ width: COL_WIDTHS.mobile, minWidth: COL_WIDTHS.mobile, maxWidth: COL_WIDTHS.mobile }}
                          >
                            <div className="flex flex-col">
                              <span>{student.mobile || "—"}</span>
                              {student.mobile2 && <span className="text-[9.5px] text-slate-400">{student.mobile2}</span>}
                            </div>
                          </td>

                          <td
                            className="border-r border-b border-slate-200 transition-colors py-1.5 px-2 text-[10px]"
                            style={{ width: COL_WIDTHS.address, minWidth: COL_WIDTHS.address, maxWidth: COL_WIDTHS.address }}
                          >
                            <span className="truncate block text-slate-700" title={student.address}>
                              {student.address || "—"}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Primary Document Columns */}
                      {PRIMARY_COLUMNS.map(col => renderDocCell(student, col.matchKey, col))}

                      {/* Column: OTHER DOCUMENTS */}
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
              Aligned with School Document Collection Report
            </span>
            <span className="text-slate-300">|</span>
            <span>Freeze Panes Active: Cols A-D (SR, Class, GR, Name)</span>
          </div>

          <div className="flex items-center gap-3 font-sans">
            <span>Showing all <strong>{filteredStudents.length}</strong> students</span>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => {
                tableScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-school-navy font-bold hover:underline cursor-pointer"
            >
              Back to Top ↑
            </button>
          </div>
        </div>
      </div>

      {/* ── Document Preview Modal ─────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-school-navy px-5 py-3 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {previewDoc.title}
                </h3>
                <p className="text-xs text-white/70 mt-0.5">
                  {previewDoc.name} {previewDoc.grNo ? `(GR: ${previewDoc.grNo})` : ""}
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

      {/* ── Sync from CSV Modal ────────────────────────────────────────── */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
            <div className="bg-school-navy px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-sm">Sync with Document Collection Report</h3>
              </div>
              <button
                onClick={() => {
                  setIsSyncModalOpen(false);
                  setSyncResult(null);
                  setCustomCsvFile(null);
                }}
                className="p-1 text-white/80 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-1.5">
                <p className="font-bold text-school-navy text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Aligned to Official School Collection Report
                </p>
                <p className="text-slate-600 leading-relaxed text-[11.5px]">
                  Matches all students by <strong>GR No</strong>, <strong>Student Name</strong>, or <strong>Parent Mobile</strong>. Synchronizes the 5 core documents:
                </p>
                <ul className="list-disc list-inside text-slate-600 text-[11px] space-y-0.5 ml-1">
                  <li><strong>OK</strong> marks updated to <em>Verified / Uploaded</em> (preserves existing file uploads)</li>
                  <li><strong>—</strong> marks updated to <em>Not Required (Exempt)</em></li>
                  <li>Blanks retained as <em>Upload Pending</em></li>
                </ul>
              </div>

              {/* Option 1: Quick Sync System CSV */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">Option 1: One-Click Sync with System Report</h4>
                <p className="text-slate-500 text-[11px]">
                  Synchronize directly from <code>Document Collection Report - Classwise - ALL CLASSES.csv</code> on the server.
                </p>
                <button
                  onClick={() => handlePerformSync(false)}
                  disabled={syncLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-school-navy hover:bg-school-navy-dark text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {syncLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>{syncLoading ? "Synchronizing Records..." : "Quick Sync System Report"}</span>
                </button>
              </div>

              {/* Option 2: Upload Custom CSV */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">Option 2: Upload Updated CSV File</h4>
                <p className="text-slate-500 text-[11px]">
                  Select an updated Document Collection Report CSV to import new changes.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCustomCsvFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300 cursor-pointer"
                  />
                  {customCsvFile && (
                    <button
                      onClick={() => handlePerformSync(true)}
                      disabled={syncLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                    >
                      {syncLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>Sync Uploaded File</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sync Results Display */}
              {syncResult && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 space-y-1.5 animate-in fade-in">
                  <p className="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Sync Completed Successfully!
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-900 pt-1">
                    <div>Total Report Students: <strong>{syncResult.totalCsvRows}</strong></div>
                    <div>Matched in Database: <strong>{syncResult.matchedStudents}</strong></div>
                    <div>Marked OK (Verified): <strong>{syncResult.markOkCount}</strong></div>
                    <div>Marked Not Required (—): <strong>{syncResult.markNotRequiredCount}</strong></div>
                    <div className="col-span-2">Existing Files Preserved: <strong>{syncResult.preservedFilesCount}</strong></div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => {
                  setIsSyncModalOpen(false);
                  setSyncResult(null);
                  setCustomCsvFile(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm GR Assignment Modal ─────────────────────────────────── */}
      {confirmGrModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-school-navy px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Confirm GR Number Assignment</h3>
              </div>
              <button
                onClick={() => setConfirmGrModal(null)}
                className="p-1 text-white/80 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Student Name:</span>
                  <span className="font-bold text-slate-900 text-sm uppercase">{confirmGrModal.student.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Class / Section:</span>
                  <span className="font-bold text-school-navy">
                    {confirmGrModal.student.std} {confirmGrModal.student.section ? `(${confirmGrModal.student.section})` : ""}
                  </span>
                </div>
                {confirmGrModal.student.fatherName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Father Name:</span>
                    <span className="font-semibold text-slate-800 uppercase">{confirmGrModal.student.fatherName}</span>
                  </div>
                )}
                {confirmGrModal.oldGr && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="text-amber-700 font-semibold">Previous GR:</span>
                    <span className="font-mono font-bold text-amber-800 line-through">{confirmGrModal.oldGr}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-emerald-700 font-bold">New GR to Save:</span>
                  <span className="px-2.5 py-1 rounded-md font-mono font-extrabold text-sm bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {confirmGrModal.newGr}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-[11.5px] leading-relaxed">
                <strong>Confirmation Notice:</strong> Are you sure you want to save GR No <strong>{confirmGrModal.newGr}</strong> for <strong>{confirmGrModal.student.name}</strong>? This GR Number will be updated in the school records.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmGrModal(null)}
                disabled={savingGr}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveGr}
                disabled={savingGr}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
              >
                {savingGr ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving GR...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Save GR</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
