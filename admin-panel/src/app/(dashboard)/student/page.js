import { GraduationCap, Plus, Search, Filter } from "lucide-react";

export const metadata = { title: "Student Management | SSIS ERP" };

export default function StudentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Student Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage student records, admissions & profiles</p>
        </div>
        <button className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
          <GraduationCap className="w-10 h-10 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Student Module</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          This module is under development. Student list, admission forms & profile pages will appear here.
        </p>
        <div className="mt-6 flex gap-2">
          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
