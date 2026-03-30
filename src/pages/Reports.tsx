import { motion } from "framer-motion";
import { FileText, Download, Calendar, Building2, Receipt, Users, TrendingUp, ClipboardCheck } from "lucide-react";

const reports = [
  { title: "Annual Financial Statements", description: "Complete P&L, Balance Sheet, and Cash Flow Statement per Companies Act 2006", icon: FileText, category: "Statutory", status: "ready" },
  { title: "Corporation Tax Return (CT600)", description: "HMRC Corporation Tax computation and return", icon: Building2, category: "Tax", status: "ready" },
  { title: "VAT Return (VAT100)", description: "Quarterly VAT return for Making Tax Digital", icon: Receipt, category: "Tax", status: "due" },
  { title: "PAYE RTI Submission", description: "Full Payment Submission (FPS) to HMRC", icon: Users, category: "Payroll", status: "ready" },
  { title: "Management Accounts", description: "Monthly management accounts with variance analysis", icon: TrendingUp, category: "Internal", status: "ready" },
  { title: "Confirmation Statement (CS01)", description: "Annual Companies House confirmation statement", icon: ClipboardCheck, category: "Statutory", status: "upcoming" },
  { title: "Annual Accounts (AA)", description: "Abbreviated or full accounts for Companies House filing", icon: FileText, category: "Statutory", status: "upcoming" },
  { title: "P60 End of Year Summary", description: "Employee annual tax and NI summary certificates", icon: Users, category: "Payroll", status: "ready" },
];

const statusColors = {
  ready: "bg-inflow-muted text-inflow",
  due: "bg-warning/15 text-warning",
  upcoming: "bg-secondary text-muted-foreground",
};

export default function Reports() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Regulatory & Financial Reports</h1>
        <p className="text-muted-foreground">Generate and file statutory reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report, i) => (
          <motion.div
            key={report.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card flex items-start gap-4 p-6"
          >
            <div className="rounded-lg bg-secondary p-3">
              <report.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-heading text-sm font-semibold text-foreground">{report.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{report.description}</p>
                </div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[report.status as keyof typeof statusColors]}`}>
                  {report.status}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex rounded-md bg-accent px-2 py-0.5 text-xs text-muted-foreground">{report.category}</span>
                <button className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  <Download className="h-3 w-3" /> Generate
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
