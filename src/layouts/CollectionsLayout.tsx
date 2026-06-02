import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/collections", label: "Dashboard", end: true },
  { to: "/collections/queue", label: "Chase Queue" },
  { to: "/collections/rules", label: "Automation Rules" },
  { to: "/collections/templates", label: "Email Templates" },
  { to: "/collections/escalations", label: "Escalations" },
  { to: "/collections/promises", label: "Payment Promises" },
  { to: "/collections/disputes", label: "Disputes" },
  { to: "/collections/reports", label: "Reports" },
  { to: "/collections/settings", label: "Settings" },
];

export default function CollectionsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Collections</h1>
        <p className="text-muted-foreground">Automate invoice chasing and accounts receivable follow-up</p>
      </div>
      <div className="-mx-4 sm:mx-0 overflow-x-auto">
        <nav className="flex gap-1 rounded-lg bg-secondary p-1 min-w-max sm:min-w-0 sm:inline-flex mx-4 sm:mx-0">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
