"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus, Search, GraduationCap, Phone, Calendar, Edit,
  Trash2, LogOut, Eye, User, ChevronDown, Filter,
} from "lucide-react";

// ── Dummy Data ─────────────────────────────────────────────────
const sessions = ["2025-26", "2024-25", "2023-24"];
const allStandards = [
  "All Classes","JR.KG","SR.KG","Balvatika",
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th - Science","11th - Commerce","11th - Arts",
  "12th - Science","12th - Commerce","12th - Arts",
];

const dummyStudents = [
  {
    enrollment: "1001", name: "Arjun Patel",
    fatherName: "Rajesh Patel", motherName: "Meena Patel",
    std: "10th", section: "A", rollNo: "101",
    mobile: "9876543210", dob: "15 Jan 2010", gender: "Male",
    photo: null, password: "ARJ1001",
    udise: "24180100101", pen: "", apaar: "", aadhar: "1234 5678 9012",
    session: "2025-26", status: "Active",
    address: "12, Shree Society, Varachha, Surat",
  },
  {
    enrollment: "1002", name: "Priya Shah",
    fatherName: "Amit Shah", motherName: "Kavita Shah",
    std: "9th", section: "B", rollNo: "204",
    mobile: "9765432100", dob: "22 Mar 2011", gender: "Female",
    photo: null, password: "PRI1002",
    udise: "", pen: "", apaar: "123456789012", aadhar: "",
    session: "2025-26", status: "Active",
    address: "45, Ganesh Nagar, Adajan, Surat",
  },
  {
    enrollment: "1003", name: "Rohan Mehta",
    fatherName: "Suresh Mehta", motherName: "Asha Mehta",
    std: "11th - Science", section: "A", rollNo: "312",
    mobile: "9654321098", dob: "08 Jul 2009", gender: "Male",
    photo: null, password: "ROH1003",
    udise: "", pen: "12345678901", apaar: "", aadhar: "9876 5432 1098",
    session: "2025-26", status: "Active",
    address: "78, Silver Park, Katargam, Surat",
  },
  {
    enrollment: "1004", name: "Sneha Desai",
    fatherName: "Kishore Desai", motherName: "Hetal Desai",
    std: "8th", section: "C", rollNo: "418",
    mobile: "9543210987", dob: "30 Nov 2011", gender: "Female",
    photo: null, password: "SNE1004",
    udise: "", pen: "", apaar: "", aadhar: "",
    session: "2025-26", status: "Active",
    address: "23, Krishna Society, Piplod, Surat",
  },
  {
    enrollment: "1005", name: "Dev Joshi",
    fatherName: "Prakash Joshi", motherName: "Ruchita Joshi",
    std: "JR.KG", section: "A", rollNo: "501",
    mobile: "9432109876", dob: "14 Sep 2020", gender: "Male",
    photo: null, password: "DEV1005",
    udise: "", pen: "", apaar: "", aadhar: "",
    session: "2025-26", status: "Active",
    address: "5, Swaminarayan Society, Dindoli, Surat",
  },
];

function maskAadhar(aadhar) {
  if (!aadhar) return "N/A";
  const digits = aadhar.replace(/\s/g, "");
  return `${digits.slice(0, 4)} **** ${digits.slice(8)}`;
}

function InfoPill({ label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide whitespace-nowrap">{label}:</span>
      <span className={`text-xs font-semibold ${value === "N/A" ? "text-gray-300" : "text-gray-700"}`}>{value}</span>
    </div>
  );
}

export default function StudentPage() {
  const [session, setSession]   = useState("2025-26");
  const [search, setSearch]     = useState("");
  const [stdFilter, setStdFilter] = useState("All Classes");

  const filtered = dummyStudents.filter((s) => {
    const matchSession = s.session === session;
    const matchSearch  =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollment.includes(search) ||
      s.fatherName.toLowerCase().includes(search.toLowerCase());
    const matchStd =
      stdFilter === "All Classes" || s.std === stdFilter;
    return matchSession && matchSearch && matchStd;
  });

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Student Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} student{filtered.length !== 1 ? "s" : ""} found · Session {session}
          </p>
        </div>
        <Link
          href="/student/add"
          className="inline-flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add New Student
        </Link>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, enrollment no or father's name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-all"
            />
          </div>

          {/* Class filter */}
          <div className="relative">
            <select
              value={stdFilter}
              onChange={(e) => setStdFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer"
            >
              {allStandards.map((s) => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Session filter */}
          <div className="relative">
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer font-medium text-school-navy"
            >
              {sessions.map((s) => <option key={s}>Session {s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-school-navy pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Student Cards ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <GraduationCap className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No students found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or add a new student</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((student) => (
            <div
              key={student.enrollment}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {/* Card Body */}
              <div className="p-5 flex flex-col sm:flex-row gap-4">

                {/* ── Left: Photo + Basic Info ── */}
                <div className="flex gap-4 flex-1 min-w-0">
                  {/* Photo */}
                  <div className="w-16 h-16 rounded-2xl bg-school-navy/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {student.photo ? (
                      <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-school-navy/40" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-800 text-base">{student.name}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        student.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {student.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Father: {student.fatherName}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-school-navy bg-blue-50 px-2 py-0.5 rounded-lg">
                        <GraduationCap className="w-3 h-3" />
                        {student.std}{student.section ? `-${student.section}` : ""}
                      </span>
                      <span className="text-xs text-gray-500">Roll: <b className="text-gray-700">{student.rollNo}</b></span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />{student.mobile}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />{student.dob}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Right: System Info ── */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 flex-shrink-0 sm:min-w-[220px] space-y-1.5">
                  <InfoPill label="Enroll No" value={student.enrollment} />
                  <InfoPill label="App Password" value={student.password} />
                  <InfoPill label="Aadhar" value={maskAadhar(student.aadhar)} />
                  <InfoPill label="UDISE" value={student.udise || "N/A"} />
                  <InfoPill label="PEN No" value={student.pen || "N/A"} />
                  <InfoPill label="APAAR ID" value={student.apaar || "N/A"} />
                </div>
              </div>

              {/* ── Card Footer: Actions ── */}
              <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-2 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/student/${student.enrollment}/edit`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" /> Update
                  </Link>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Leave
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
                <Link
                  href={`/student/${student.enrollment}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-school-navy text-white hover:bg-school-navy-dark transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> View Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
