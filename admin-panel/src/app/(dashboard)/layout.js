import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import AuthGuard from "@/components/AuthGuard";
import { ReminderProvider } from "@/contexts/ReminderContext";
import ReminderPopup from "@/components/ReminderPopup";

export const metadata = {
  title: "Dashboard | Satyam Stars International School ERP",
};

export default function DashboardLayout({ children }) {
  return (
    <AuthGuard>
      <ReminderProvider>
        <div className="flex h-screen bg-gray-50 overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-safe-6">
              {children}
            </main>
          </div>
        </div>
        <ReminderPopup />
      </ReminderProvider>
    </AuthGuard>
  );
}
