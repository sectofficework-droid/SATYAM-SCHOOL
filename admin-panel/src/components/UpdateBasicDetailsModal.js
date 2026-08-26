"use client";

import { useState, useEffect } from "react";
import { X, Plus, Users, Camera } from "lucide-react";
import {
  getStudentByEnrollment, updateStudentBasicDetails, searchStudentsForSibling,
} from "@/lib/studentService";
import { getActiveClasses } from "@/lib/settingsService";
import { isValidUploadFile } from "@/lib/validators";
import { uploadFileToS3, getS3ViewUrl, fileExt } from "@/lib/s3Upload";
import { compressFile, formatFileSize } from "@/lib/fileCompression";
import DateInputDMY from "@/components/DateInputDMY";

// Replaces the old standalone "Update Sibling" modal - widened to cover the
// same handful of fields a Basic Details import actually collects (name,
// parents, DOB, mobile, address) plus photo, alongside the sibling link.
// Deliberately still separate from the full Edit Student page: that form has
// many other native `required` fields (Religion, Aadhar, etc.) that block a
// basic-import "Incomplete" student from submitting at all - this one has no
// such blockers, see updateStudentBasicDetails().

function YesNoToggle({ value, onChange }) {
  return (
    <div className="flex gap-2 max-w-xs">
      {["Yes", "No"].map((opt) => (
        <button
          key={opt} type="button" onClick={() => onChange(opt === "Yes")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
            (opt === "Yes" && value) || (opt === "No" && !value)
              ? "bg-school-navy text-white border-school-navy shadow-sm"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function UpdateBasicDetailsModal({ student, onClose, onSaved }) {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [standards, setStandards] = useState([]);

  const [firstName, setFirstName]   = useState(student.firstName || "");
  const [lastName, setLastName]     = useState(student.lastName || "");
  const [fatherName, setFatherName] = useState(student.fatherName || "");
  const [motherName, setMotherName] = useState(student.motherName || "");
  const [dob, setDob]               = useState(student.dob || "");
  const [mobile, setMobile]         = useState(student.mobile || "");
  const [mobile2, setMobile2]       = useState(student.mobile2 || "");
  const [address, setAddress]       = useState(student.address || "");

  const [photo, setPhoto]                   = useState(null);
  const [photoPreview, setPhotoPreview]     = useState(null);
  const [photoKey, setPhotoKey]             = useState(null);
  const [photoSize, setPhotoSize]           = useState(0);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError]         = useState("");

  const [hasSibling, setHasSibling] = useState(false);
  const [siblings, setSiblings]     = useState([{ id: 1, cls: "", name: "", studentId: "" }]);
  const [optionsByRow, setOptionsByRow] = useState({});

  useEffect(() => {
    getActiveClasses().then(cls => setStandards(cls.map(c => c.name))).catch(() => {});
    if (student.photo) {
      getS3ViewUrl(student.photo).then((url) => { if (url) setPhotoPreview(url); }).catch(() => {});
    }
    getStudentByEnrollment(student.enrollment)
      .then(full => {
        const existing = (full.siblings || []).filter(s => s.name);
        setHasSibling(existing.length > 0);
        setSiblings(existing.length > 0
          ? existing.map((s, i) => ({ id: i + 1, cls: s.cls || "", name: s.name || "", studentId: s.studentId || "" }))
          : [{ id: 1, cls: "", name: "", studentId: "" }]);
      })
      .catch(err => setError(err.message || "Could not load current sibling info."))
      .finally(() => setLoading(false));
  }, [student.enrollment, student.photo]);

  async function loadOptionsFor(rowId, cls) {
    const opts = await searchStudentsForSibling(cls, student._studentId).catch(() => []);
    setOptionsByRow(p => ({ ...p, [rowId]: opts }));
  }

  const addSibling    = () => setSiblings(p => [...p, { id: Date.now(), cls: "", name: "", studentId: "" }]);
  const removeSibling = (id) => setSiblings(p => p.filter(s => s.id !== id));
  const updateCls = (id, cls) => {
    setSiblings(p => p.map(s => s.id === id ? { ...s, cls, name: "", studentId: "" } : s));
    if (cls) loadOptionsFor(id, cls);
  };
  const selectStudent = (id, studentId) => {
    const picked = (optionsByRow[id] || []).find(o => o.studentId === studentId);
    setSiblings(p => p.map(s => s.id === id ? { ...s, studentId, name: picked?.name || "" } : s));
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidUploadFile(file)) {
      setPhotoError("Invalid file — only JPG/PNG/PDF up to 5MB allowed.");
      e.target.value = "";
      return;
    }
    setPhotoError("");
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoKey(null);
    setPhotoSize(0);
    setPhotoUploading(true);
    compressFile(file)
      .then((compressed) => {
        const key = `students/${student._studentId}/photo.${fileExt(compressed)}`;
        setPhotoSize(compressed.size);
        return uploadFileToS3(compressed, key).then(() => setPhotoKey(key));
      })
      .catch((err) => setPhotoError("Photo upload failed: " + (err?.message || "Unknown error")))
      .finally(() => setPhotoUploading(false));
  };

  async function handleSave() {
    if (!firstName.trim()) { setError("First name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await updateStudentBasicDetails(student._studentId, {
        firstName:  firstName.trim(),
        lastName:   lastName.trim(),
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        dob,
        mobile,
        mobile2,
        address:    address.trim(),
        photo:      photoKey || student.photo || null,
        siblings:   hasSibling ? siblings.filter(s => s.name) : [],
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20";

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 sm:my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-school-navy" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Update Basic Details</h3>
              <p className="text-xs text-gray-500">{student.name} · #{student.enrollment}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          ) : (
            <>
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    : <Camera className="w-6 h-6 text-gray-300" />}
                </div>
                <div className="flex-1">
                  <input id="basic-details-photo" type="file" accept="image/jpg,image/jpeg,image/png" className="hidden" onChange={handlePhoto} />
                  <label htmlFor="basic-details-photo"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                    <Camera className="w-3.5 h-3.5" /> {photo ? "Change Photo" : "Upload Photo"}
                  </label>
                  {photoUploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
                  {!photoUploading && photoSize > 0 && <p className="text-xs text-green-600 font-medium mt-1">✓ {formatFileSize(photoSize)}</p>}
                  {photoError && <p className="text-xs text-red-600 mt-1">{photoError}</p>}
                </div>
              </div>

              {/* Basic details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Father Name</label>
                  <input value={fatherName} onChange={(e) => setFatherName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mother Name</label>
                  <input value={motherName} onChange={(e) => setMotherName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
                  <DateInputDMY value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mobile 1</label>
                  <input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mobile 2</label>
                  <input value={mobile2} onChange={(e) => setMobile2(e.target.value.replace(/\D/g, "").slice(0, 10))} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Sibling */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Does this student have a sibling already studying here?
                </label>
                <YesNoToggle
                  value={hasSibling}
                  onChange={(val) => { setHasSibling(val); if (val && siblings.length === 0) setSiblings([{ id: 1, cls: "", name: "", studentId: "" }]); }}
                />
              </div>

              {hasSibling && (
                <div className="space-y-3">
                  {siblings.map((sib, i) => (
                    <div key={sib.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sibling {i + 1}</p>
                        {siblings.length > 1 && (
                          <button type="button" onClick={() => removeSibling(sib.id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Sibling&apos;s Class</label>
                          <select
                            value={sib.cls}
                            onChange={(e) => updateCls(sib.id, e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 bg-white"
                          >
                            <option value="">Select Class</option>
                            {standards.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Sibling&apos;s Name</label>
                          <select
                            value={sib.studentId}
                            onChange={(e) => selectStudent(sib.id, e.target.value)}
                            disabled={!sib.cls}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 bg-white disabled:bg-gray-100"
                          >
                            <option value="">
                              {!sib.cls ? "Select class first" : ((optionsByRow[sib.id]?.length ?? 0) > 0 ? "Select Student" : "No students found in this class")}
                            </option>
                            {(optionsByRow[sib.id] || []).map(o => (
                              <option key={o.studentId} value={o.studentId}>{o.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addSibling}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-school-navy/40 rounded-xl text-sm font-semibold text-school-navy hover:bg-blue-50 hover:border-school-navy transition-colors">
                    <Plus className="w-4 h-4" /> Add Another Sibling
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose}
                  className="flex-1 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || photoUploading}
                  className="flex-1 px-5 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
