import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ArrowDownUp,
  Receipt,
  Users,
  TrendingUp,
  ClipboardList,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Invoices", icon: FileText, path: "/invoices" },
  { label: "Transactions", icon: ArrowDownUp, path: "/transactions" },
  { label: "Profit & Loss", icon: TrendingUp, path: "/pnl" },
  { label: "VAT", icon: Receipt, path: "/vat" },
  { label: "PAYE", icon: Users, path: "/paye" },
  { label: "Reports", icon: ClipboardList, path: "/reports" },
  { label: "User Management", icon: Shield, path: "/users" },
];

export default function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <TrendingUp className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-heading text-xl font-bold text-foreground">
          LedgerFlow
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-1">
        {user && (
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">
            {user.email}
          </div>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-outflow hover:bg-outflow-muted transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
