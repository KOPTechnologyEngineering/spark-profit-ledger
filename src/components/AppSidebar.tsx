import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ArrowDownUp,
  Receipt,
  Users,
  TrendingUp,
  ClipboardList,
  LogOut,
  Shield,
  Mail,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", module: null },
  { label: "Invoices", icon: FileText, path: "/invoices", module: "invoices" },
  { label: "Collections", icon: Mail, path: "/collections", module: "invoices" },
  { label: "Transactions", icon: ArrowDownUp, path: "/transactions", module: "transactions" },
  { label: "Profit & Loss", icon: TrendingUp, path: "/pnl", module: "pnl" },
  { label: "VAT", icon: Receipt, path: "/vat", module: "vat" },
  { label: "PAYE", icon: Users, path: "/paye", module: "paye" },
  { label: "Reports", icon: ClipboardList, path: "/reports", module: "reports" },
  { label: "User Management", icon: Shield, path: "/users", module: "users" },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { hasNone, loading } = useUserRoles();

  const visibleItems = navItems.filter(
    (item) => !item.module || loading || !hasNone(item.module)
  );

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <TrendingUp className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-heading text-xl font-bold text-foreground">
          KOP Ledger
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => {
          const isActive = item.path === "/"
            ? location.pathname === "/"
            : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
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

      <div className="border-t border-border p-3 space-y-1 shrink-0">
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
    </div>
  );
}

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export default function AppSidebar({ mobileOpen = false, onMobileOpenChange }: AppSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-border lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-border">
          <SidebarContent onNavigate={() => onMobileOpenChange?.(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
