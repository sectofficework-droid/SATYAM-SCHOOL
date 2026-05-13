import { Users, Plus } from "lucide-react";

export const metadata = { title: "Employee Management | SSIS ERP" };

export default function EmployeePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Employee Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Staff records, subject & class assignments</p>
        </div>
        <button className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
          <Users className="w-10 h-10 text-purple-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Employee Module</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Staff profiles, document management & class assignments will appear here.
        </p>
        <div className="mt-6">
          <span className="px-3 py-1 bg-purple-50 text-purple-600 text-xs font-medium rounded-full">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
