import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Building2, Receipt, Users, TrendingUp, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";
import { sumAmounts } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { calcCorporationTax } from "@/lib/tax";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DateRangePicker, { filterByDateRange } from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";

// Every report below except "Management Accounts" carries a real HMRC/
// Companies House form name, but the export is an internal CSV summary, not
// a compliant filing document (a real CT600 has 50+ boxes, a real P60 needs
// an NI number and tax code, a real CS01 needs registered-office/PSC data,
// none of which this app collects). The disclaimer makes that explicit so
// nobody submits one of these to HMRC/Companies House believing it's
// filing-ready.
const NOT_A_FILING_DISCLAIMER = "Internal summary only — not a substitute for your accountant's official filing.";

const reports = [
  { title: "Annual Financial Statements", description: `Complete P&L, Balance Sheet, and Cash Flow Statement per Companies Act 2006. ${NOT_A_FILING_DISCLAIMER}`, icon: FileText, category: "Statutory", status: "ready", key: "pnl" },
  { title: "Corporation Tax Return (CT600)", description: `HMRC Corporation Tax computation and return. ${NOT_A_FILING_DISCLAIMER}`, icon: Building2, category: "Tax", status: "ready", key: "ct600" },
  { title: "VAT Return (VAT100)", description: `Quarterly VAT return for Making Tax Digital. ${NOT_A_FILING_DISCLAIMER}`, icon: Receipt, category: "Tax", status: "due", key: "vat" },
  { title: "PAYE RTI Submission", description: `Full Payment Submission (FPS) to HMRC. ${NOT_A_FILING_DISCLAIMER}`, icon: Users, category: "Payroll", status: "ready", key: "paye" },
  { title: "Management Accounts", description: "Monthly management accounts with variance analysis", icon: TrendingUp, category: "Internal", status: "ready", key: "mgmt" },
  { title: "Confirmation Statement (CS01)", description: `Annual Companies House confirmation statement. ${NOT_A_FILING_DISCLAIMER}`, icon: ClipboardCheck, category: "Statutory", status: "upcoming", key: "cs01" },
  { title: "Annual Accounts (AA)", description: `Abbreviated or full accounts for Companies House filing. ${NOT_A_FILING_DISCLAIMER}`, icon: FileText, category: "Statutory", status: "upcoming", key: "aa" },
  { title: "P60 End of Year Summary", description: `Employee annual tax and NI summary certificates. ${NOT_A_FILING_DISCLAIMER}`, icon: Users, category: "Payroll", status: "ready", key: "p60" },
];

export default function Reports() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange | undefined>();

  const generate = async (key: string) => {
    setGenerating(key);
    try {
      if (key === "pnl" || key === "mgmt" || key === "aa") {
        const { data, error } = await supabase.from("tbl_transactions").select("amount, type, category, date, description, status");
        if (error) throw error;
        const txns = filterByDateRange(data || [], range, "date");
        downloadCSV(
          `${key}_report.csv`,
          ["Category", "Type", "Description", "Amount", "Date", "Status"],
          txns.map((t) => [t.category, t.type, t.description, t.amount, t.date, t.status]),
        );
      } else if (key === "ct600") {
        const { data, error } = await supabase.from("tbl_transactions").select("amount, type, category, status, date");
        if (error) throw error;
        const txns = filterByDateRange((data || []).filter((t) => t.status === "completed"), range, "date");
        const revenue = sumAmounts(txns.filter((t) => t.type === "inflow"), "amount");
        const expenses = sumAmounts(txns.filter((t) => t.type === "outflow"), "amount");
        const profit = revenue - expenses;
        const tax = calcCorporationTax(profit);
        downloadCSV("ct600_report.csv", ["Item", "Amount (£)"], [
          ["Revenue", revenue],
          ["Expenses", expenses],
          ["Taxable Profit", profit],
          ["Corporation Tax", tax],
        ]);
      } else if (key === "vat") {
        const { data, error } = await supabase.from("tbl_transactions").select("amount, type, date, description, category, vat_treatment");
        if (error) throw error;
        const txns = filterByDateRange(data || [], range, "date");
        const standardRated = txns.filter((t) => (t.vat_treatment ?? "standard") === "standard");
        const inflow = sumAmounts(txns.filter((t) => t.type === "inflow"), "amount");
        const outflow = sumAmounts(txns.filter((t) => t.type === "outflow"), "amount");
        const standardInflow = sumAmounts(standardRated.filter((t) => t.type === "inflow"), "amount");
        const standardOutflow = sumAmounts(standardRated.filter((t) => t.type === "outflow"), "amount");
        const outputVAT = Math.round(standardInflow * 0.2);
        const inputVAT = Math.round(standardOutflow * 0.2);
        downloadCSV("vat100_return.csv", ["Item", "Amount (£)"], [
          ["Total Sales", inflow],
          ["Standard-Rated Sales", standardInflow],
          ["Output VAT (20%)", outputVAT],
          ["Total Purchases", outflow],
          ["Standard-Rated Purchases", standardOutflow],
          ["Input VAT (20%)", inputVAT],
          ["Net VAT Payable", outputVAT - inputVAT],
        ]);
      } else if (key === "paye" || key === "p60") {
        const { data, error } = await supabase.from("tbl_paye_employees").select("name, role, gross_pay, tax, ni, net_pay");
        if (error) throw error;
        downloadCSV(
          `${key}_report.csv`,
          ["Employee", "Role", "Gross Pay", "Income Tax", "NI", "Net Pay"],
          (data || []).map((e) => [e.name, e.role, e.gross_pay, e.tax, e.ni, e.net_pay]),
        );
      } else if (key === "cs01") {
        const { data, error } = await supabase.from("tbl_profiles").select("full_name, email, designation, is_active");
        if (error) throw error;
        downloadCSV(
          "cs01_confirmation.csv",
          ["Name", "Email", "Designation", "Active"],
          (data || []).map((p) => [p.full_name, p.email, p.designation, p.is_active]),
        );
      }
      toast({ title: "Report generated", description: "Your CSV file has been downloaded." });
    } catch (e) {
      toast({
        title: "Couldn't generate report",
        description: friendlyErrorMessage(e, "Please try again in a moment."),
        variant: "destructive",
      });
    }
    setGenerating(null);
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Regulatory & Financial Reports" subtitle="Generate and file statutory reports">
        <DateRangePicker value={range} onChange={setRange} placeholder="Filter by date" />
      </PageHeader>

      <div className="glass-card border-warning/30 bg-warning/5 p-4 text-sm text-muted-foreground">
        These reports are internal summaries generated from your transaction data. They are not compliant HMRC or Companies House filing documents — always have your accountant prepare and submit the official filing.
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
                <StatusBadge status={report.status} />
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
