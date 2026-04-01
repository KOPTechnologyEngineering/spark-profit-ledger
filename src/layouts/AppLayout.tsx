import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import NotificationBell from "@/components/NotificationBell";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-64 min-h-screen">
        <header className="flex items-center justify-end border-b border-border px-8 py-3">
          <NotificationBell />
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
