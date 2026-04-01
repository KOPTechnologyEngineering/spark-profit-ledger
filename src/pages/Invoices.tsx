import { useState, useEffect } from "react";
import { Search, Download } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import NewInvoiceDialog from "@/components/NewInvoiceDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage and track your invoices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadAllCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          <NewInvoiceDialog onCreated={fetchInvoices} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-secondary px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Due Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Created By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice, i) => (
                <motion.tr
                  key={invoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => setSelected(invoice)}
                >
                  <td className="px-6 py-4 font-heading text-sm font-semibold text-foreground">{invoice.invoice_number}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{invoice.client}</td>
                  <td className="px-6 py-4 font-heading text-sm font-semibold text-foreground">£{Number(invoice.amount).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[invoice.status] || ""}`}>{invoice.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.due_date}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.created_by_name || "—"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RecordDetailDialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} record={selected} type="invoice" onUpdated={fetchInvoices} />
    </div>
  );
}
