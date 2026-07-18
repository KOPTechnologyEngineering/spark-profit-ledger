import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import NotificationBell from "@/components/NotificationBell";
import ProfileMenu from "@/components/ProfileMenu";
import PageMeta from "@/components/PageMeta";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";

const ROUTE_META: Record<string, { title: string; description: string }> = {
  "/": { title: "Dashboard | KOP Ledger", description: "Overview of cashflow, receivables and key financial KPIs." },
  "/invoices": { title: "Invoices | KOP Ledger", description: "Create, send and track customer invoices." },
  "/transactions": { title: "Transactions | KOP Ledger", description: "Record and review inflows, outflows and recurring transactions." },
  "/pnl": { title: "Profit & Loss | KOP Ledger", description: "Profit and loss statement with revenue and expense breakdowns." },
  "/vat": { title: "VAT Returns | KOP Ledger", description: "Prepare and file UK VAT returns." },
  "/paye": { title: "PAYE | KOP Ledger", description: "Manage staff, PAYE and NI calculations." },
  "/approvals": { title: "Approvals | KOP Ledger", description: "Review and approve pending invoices and transactions." },
  "/reports": { title: "Reports | KOP Ledger", description: "Financial reports and exports." },
  "/users": { title: "User Management | KOP Ledger", description: "Manage user access, roles and approvers." },
  "/organizations": { title: "Organizations | KOP Ledger", description: "Manage customers and vendors you do business with." },
  "/collections": { title: "Collections Dashboard | KOP Ledger", description: "Track receivables ageing and chase performance." },
  "/collections/queue": { title: "Chase Queue | KOP Ledger", description: "Outstanding invoices queued for chasing." },
  "/collections/rules": { title: "Automation Rules | KOP Ledger", description: "Automate chase reminders and escalations." },
  "/collections/templates": { title: "Email Templates | KOP Ledger", description: "Manage chase and reminder email templates." },
  "/collections/escalations": { title: "Escalations | KOP Ledger", description: "Escalated overdue accounts." },
  "/collections/promises": { title: "Payment Promises | KOP Ledger", description: "Track promised payment dates from customers." },
  "/collections/disputes": { title: "Disputes | KOP Ledger", description: "Track invoice disputes." },
  "/collections/reports": { title: "Collections Reports | KOP Ledger", description: "Collections performance reports." },
  "/collections/settings": { title: "Collections Settings | KOP Ledger", description: "Configure collections behaviour." },
};

export default function AppLayout() {
  useInactivityTimeout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const meta = ROUTE_META[location.pathname] ?? {
    title: "KOP Ledger",
    description: "Accounting and finance for startups and SMEs.",
  };

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title={meta.title} description={meta.description} path={location.pathname} />
      <AppSidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <div className="min-h-screen lg:ml-64">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 lg:px-8 lg:justify-end">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
