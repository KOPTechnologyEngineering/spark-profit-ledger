import { useState } from "react";
import { Search, Download, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import NewInvoiceDialog from "@/components/NewInvoiceDialog";
import ImportDialog, { type ImportColumn } from "@/components/ImportDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";
import PageHeader from "@/components/PageHeader";
import FilterPills from "@/components/FilterPills";
import LoadingSpinner from "@/components/LoadingSpinner";
import StatusBadge from "@/components/StatusBadge";
import DateRangePicker, { filterByDateRange } from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";
import { downloadCSV } from "@/lib/csv";
import { formatGBP } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { useInvoicesData, useInvalidateFinancialData } from "@/hooks/useFinancialData";

type InvoiceRow = Tables<"tbl_invoices">;

const statusFilters = ["all", "paid", "pending", "overdue", "draft", "rejected"] as const;

const INVOICE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "invoice_number", label: "Invoice Number", required: true, type: "string" },
  { key: "client", label: "Client", required: true, type: "string" },
  { key: "amount", label: "Amount", required: true, type: "number" },
  { key: "status", label: "Status", type: "enum", enumValues: ["paid", "pending", "overdue", "draft", "rejected"], defaultValue: "paid" },
  { key: "issue_date", label: "Issue Date", type: "date", defaultValue: new Date().toISOString().split("T")[0] },
  { key: "due_date", label: "Due Date", type: "date" },
  { key: "description", label: "Description", type: "string", defaultValue: "Imported invoice" },
];
const INVOICE_IMPORT_SAMPLE = ["INV-101", "Example Ltd", 5000, "paid", "2026-01-01", "2026-01-31", "Consulting services"];

export default function Invoices() {
  const [filter, setFilter] = useState<(typeof statusFilters)[number]>("all");
  const [search, setSearch] = useState("");
  const { data: invoices = [], isLoading: loading } = useInvoicesData();
  const { invalidateInvoices } = useInvalidateFinancialData();
  const [selected, setSelected] = useState<InvoiceRow | null>(null);
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [range, setRange] = useState<DateRange | undefined>();
  const { hasEdit, hasAdmin } = useUserRoles();
  const viewOnly = !hasEdit("invoices");
  const canImport = hasAdmin("invoices");
  const { user } = useAuth();
  const { toast } = useToast();

  const handleImportInvoices = async (rows: Record<string, string | number>[]) => {
    if (!user) return { error: "Not signed in" };
    const payload = rows.map((r) => {
      const amount = Number(r.amount);
      const issueDate = String(r.issue_date);
      return {
        user_id: user.id,
        invoice_number: String(r.invoice_number),
        client: String(r.client),
        amount,
        status: String(r.status),
        issue_date: issueDate,
        due_date: r.due_date ? String(r.due_date) : issueDate,
        items: [{ description: String(r.description), quantity: 1, rate: amount, discount: 0, discount_amount: 0 }],
        created_by_name: user.user_metadata?.full_name || user.email || "",
      };
    });
    const { error } = await supabase.from("tbl_invoices").insert(payload as never);
    if (!error) invalidateInvoices();
    return { error: error?.message };
  };

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
        {canImport && (
          <ImportDialog
            title="Import Invoices"
            columns={INVOICE_IMPORT_COLUMNS}
            sampleRow={INVOICE_IMPORT_SAMPLE}
            onImport={handleImportInvoices}
            onImported={invalidateInvoices}
          />
        )}
        <div className={viewOnly ? "opacity-50 pointer-events-none" : ""}><NewInvoiceDialog onCreated={invalidateInvoices} /></div>
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

      <RecordDetailDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        record={selected}
        type="invoice"
        onUpdated={invalidateInvoices}
        onEdit={!viewOnly ? () => { setEditing(selected); setSelected(null); } : undefined}
      />
      {editing && (
        <NewInvoiceDialog
          key={editing.id}
          record={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onCreated={invalidateInvoices}
        />
      )}
    </div>
  );
}
