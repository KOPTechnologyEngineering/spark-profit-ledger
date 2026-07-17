import { useState, useEffect } from "react";
import { Search, Download, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import NewInvoiceDialog from "@/components/NewInvoiceDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";
import PageHeader from "@/components/PageHeader";
import FilterPills from "@/components/FilterPills";
import LoadingSpinner from "@/components/LoadingSpinner";
import StatusBadge from "@/components/StatusBadge";
import DateRangePicker, { filterByDateRange } from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";
import { downloadCSV } from "@/lib/csv";
import { formatGBP } from "@/lib/format";
import { useUserRoles } from "@/hooks/useUserRoles";

type InvoiceRow = Tables<"tbl_invoices">;

const statusFilters = ["all", "paid", "pending", "overdue", "draft", "rejected"] as const;

export default function Invoices() {
  const [filter, setFilter] = useState<(typeof statusFilters)[number]>("all");
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InvoiceRow | null>(null);
  const [range, setRange] = useState<DateRange | undefined>();
  const { hasEdit } = useUserRoles();
  const viewOnly = !hasEdit("invoices");

  const fetchInvoices = async () => {
    setLoading(true);
    const { data } = await supabase.from("tbl_invoices").select("*").order("created_at", { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, []);

  const filtered = filterByDateRange(invoices, range, "due_date")
    .filter((i) => filter === "all" || i.status === filter)
    .filter((i) => !search || i.invoice_number?.toLowerCase().includes(search.toLowerCase()) || i.client?.toLowerCase().includes(search.toLowerCase()));

  const downloadAllCSV = () => {
    downloadCSV(
      "invoices.csv",
      ["Invoice Number", "Client", "Amount", "Status", "Due Date", "Created By"],
      filtered.map((i) => [i.invoice_number, i.client, i.amount, i.status, i.due_date, i.created_by_name || ""]),
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Invoices" subtitle="Manage and track your invoices">
        <Button variant="outline" size="sm" onClick={downloadAllCSV} disabled={viewOnly}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
        <div className={viewOnly ? "opacity-50 pointer-events-none" : ""}><NewInvoiceDialog onCreated={fetchInvoices} /></div>
      </PageHeader>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
        <FilterPills options={statusFilters} value={filter} onChange={(v) => setFilter(v)} />
        <DateRangePicker value={range} onChange={setRange} placeholder="Due date range" />
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <LoadingSpinner />
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
                  <td className="px-4 sm:px-6 py-4 font-heading text-sm font-semibold text-foreground whitespace-nowrap">{formatGBP(invoice.amount)}</td>
                  <td className="px-4 sm:px-6 py-4">
                    <StatusBadge status={invoice.status} />
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
