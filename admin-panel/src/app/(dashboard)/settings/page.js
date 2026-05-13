import { Settings } from "lucide-react";

export const metadata = { title: "Settings | SSIS ERP" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">System configuration, roles & preferences</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Settings className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Settings Module</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          School configuration, user roles, academic year settings & system preferences will appear here.
        </p>
        <div className="mt-6">
          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
