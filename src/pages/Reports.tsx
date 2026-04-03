import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Building2, Receipt, Users, TrendingUp, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/date-filters";
import { useToast } from "@/hooks/use-toast";

const reports = [
  { title: "Annual Financial Statements", description: "Complete P&L, Balance Sheet, and Cash Flow Statement per Companies Act 2006", icon: FileText, category: "Statutory", status: "ready", key: "pnl" },
  { title: "Corporation Tax Return (CT600)", description: "HMRC Corporation Tax computation and return", icon: Building2, category: "Tax", status: "ready", key: "ct600" },
  { title: "VAT Return (VAT100)", description: "Quarterly VAT return for Making Tax Digital", icon: Receipt, category: "Tax", status: "due", key: "vat" },
  { title: "PAYE RTI Submission", description: "Full Payment Submission (FPS) to HMRC", icon: Users, category: "Payroll", status: "ready", key: "paye" },
  { title: "Management Accounts", description: "Monthly management accounts with variance analysis", icon: TrendingUp, category: "Internal", status: "ready", key: "mgmt" },
  { title: "Confirmation Statement (CS01)", description: "Annual Companies House confirmation statement", icon: ClipboardCheck, category: "Statutory", status: "upcoming", key: "cs01" },
  { title: "Annual Accounts (AA)", description: "Abbreviated or full accounts for Companies House filing", icon: FileText, category: "Statutory", status: "upcoming", key: "aa" },
  { title: "P60 End of Year Summary", description: "Employee annual tax and NI summary certificates", icon: Users, category: "Payroll", status: "ready", key: "p60" },
];

const statusColors = {
  ready: "bg-inflow-muted text-inflow",
  due: "bg-warning/15 text-warning",
  upcoming: "bg-secondary text-muted-foreground",
};

export default function Reports() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState<string | null>(null);

  const generate = async (key: string) => {
    setGenerating(key);
    try {
      if (key === "pnl" || key === "mgmt" || key === "aa") {
        const { data } = await supabase.from("tbl_transactions").select("amount, type, category, date, description, status");
        const txns = data || [];
        const header = "Category,Type,Description,Amount,Date,Status\n";
        const rows = txns.map((t) => `"${t.category}","${t.type}","${t.description}",${t.amount},${t.date},${t.status}`);
        downloadCSV(`${key}_report.csv`, header, rows);
      } else if (key === "ct600") {
        const { data } = await supabase.from("tbl_transactions").select("amount, type, category, status");
        const txns = (data || []).filter((t) => t.status === "completed");
        const revenue = txns.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
        const expenses = txns.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);
        const profit = revenue - expenses;
        const tax = Math.max(0, Math.round(profit * 0.19));
        const header = "Item,Amount (£)\n";
        const rows = [`Revenue,${revenue}`, `Expenses,${expenses}`, `Taxable Profit,${profit}`, `Corporation Tax (19%),${tax}`];
        downloadCSV("ct600_report.csv", header, rows);
      } else if (key === "vat") {
        const { data } = await supabase.from("tbl_transactions").select("amount, type, date, description, category");
        const txns = data || [];
        const inflow = txns.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
        const outflow = txns.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);
        const outputVAT = Math.round(inflow * 0.2);
        const inputVAT = Math.round(outflow * 0.2);
        const header = "Item,Amount (£)\n";
        const rows = [`Total Sales,${inflow}`, `Output VAT (20%),${outputVAT}`, `Total Purchases,${outflow}`, `Input VAT (20%),${inputVAT}`, `Net VAT Payable,${outputVAT - inputVAT}`];
        downloadCSV("vat100_return.csv", header, rows);
      } else if (key === "paye" || key === "p60") {
        const { data } = await supabase.from("tbl_paye_employees").select("name, role, gross_pay, tax, ni, net_pay");
        const emps = data || [];
        const header = "Employee,Role,Gross Pay,Income Tax,NI,Net Pay\n";
        const rows = emps.map((e) => `"${e.name}","${e.role}",${e.gross_pay},${e.tax},${e.ni},${e.net_pay}`);
        downloadCSV(`${key}_report.csv`, header, rows);
      } else if (key === "cs01") {
        const { data } = await supabase.from("tbl_profiles").select("full_name, email, designation, is_active");
        const profs = data || [];
        const header = "Name,Email,Designation,Active\n";
        const rows = profs.map((p: any) => `"${p.full_name}","${p.email}","${p.designation}",${p.is_active}`);
        downloadCSV("cs01_confirmation.csv", header, rows);
      }
      toast({ title: "Report generated", description: "CSV file downloaded." });
    } catch {
      toast({ title: "Error generating report", variant: "destructive" });
    }
    setGenerating(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Regulatory & Financial Reports</h1>
        <p className="text-muted-foreground">Generate and file statutory reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report, i) => (
          <motion.div key={report.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card flex items-start gap-4 p-6">
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
                <button
                  onClick={() => generate(report.key)}
                  disabled={generating === report.key}
                  className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  <Download className="h-3 w-3" /> {generating === report.key ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
