import { BarChart3 } from "lucide-react";

export const metadata = { title: "Reports | SSIS ERP" };

export default function ReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Reports</h2>
        <p className="text-sm text-gray-500 mt-0.5">Attendance, fee, student & inventory reports</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
          <BarChart3 className="w-10 h-10 text-indigo-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Reports Module</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Attendance, fee collection, student & inventory reports with PDF/Excel export will appear here.
        </p>
        <div className="mt-6">
          <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-full">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
