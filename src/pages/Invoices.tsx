import { useState, useEffect } from "react";
import { Search, Download, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import NewInvoiceDialog from "@/components/NewInvoiceDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";
import DateRangePicker, { filterByDateRange } from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";
import { useUserRoles } from "@/hooks/useUserRoles";

const statusColors: Record<string, string> = {
  paid: "bg-inflow-muted text-inflow",
  pending: "bg-warning/15 text-warning",
  overdue: "bg-outflow-muted text-outflow",
  draft: "bg-secondary text-muted-foreground",
  rejected: "bg-outflow-muted text-outflow",
};

export default function Invoices() {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const { hasEdit } = useUserRoles();
  const viewOnly = !hasEdit("invoices");

  const fetchInvoices = async () => {
    setLoading(true);
    const { data } = await supabase.from("tbl_invoices").select("*").order("created_at", { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, []);

  const filtered = invoices
    .filter((i) => filter === "all" || i.status === filter)
    .filter((i) => !search || i.invoice_number?.toLowerCase().includes(search.toLowerCase()) || i.client?.toLowerCase().includes(search.toLowerCase()));

  const downloadAllCSV = () => {
    const header = "Invoice Number,Client,Amount,Status,Due Date,Created By\n";
    const rows = filtered.map((i) => `${i.invoice_number},${i.client},${i.amount},${i.status},${i.due_date},${i.created_by_name || ""}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage and track your invoices</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadAllCSV} disabled={viewOnly}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          <div className={viewOnly ? "opacity-50 pointer-events-none" : ""}><NewInvoiceDialog onCreated={fetchInvoices} /></div>
        </div>
      </div>


      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1 flex-wrap">
          {["all", "paid", "pending", "overdue", "draft", "rejected"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${filter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>


      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No invoices found.</div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[640px]">


            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <tr className="border-b border-border">
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Invoice</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">Due Date</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Created By</th>
                <th className="px-4 sm:px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sticky right-0 bg-card/95 backdrop-blur">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice, i) => (
                <motion.tr
                  key={invoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer group"
                  onClick={() => setSelected(invoice)}
                >
                  <td className="px-4 sm:px-6 py-4 font-heading text-sm font-semibold text-foreground">{invoice.invoice_number}</td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-foreground">{invoice.client}</td>
                  <td className="px-4 sm:px-6 py-4 font-heading text-sm font-semibold text-foreground whitespace-nowrap">£{Number(invoice.amount).toLocaleString()}</td>
                  <td className="px-4 sm:px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[invoice.status] || ""}`}>{invoice.status}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-muted-foreground hidden md:table-cell whitespace-nowrap">{invoice.due_date}</td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-muted-foreground hidden lg:table-cell">{invoice.created_by_name || "—"}</td>
                  <td className="px-2 sm:px-4 py-4 text-right sticky right-0 bg-card/95 backdrop-blur group-hover:bg-secondary/60">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setSelected(invoice); }}
                      aria-label="View invoice"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">View</span>
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>


      <RecordDetailDialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} record={selected} type="invoice" onUpdated={fetchInvoices} />
    </div>
  );
}
