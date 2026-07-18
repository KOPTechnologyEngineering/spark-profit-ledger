import { useState, useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, Search, Download } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddTransactionDialog from "@/components/AddTransactionDialog";
import ImportDialog, { type ImportColumn } from "@/components/ImportDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";
import PageHeader from "@/components/PageHeader";
import PeriodSelector from "@/components/PeriodSelector";
import FilterPills from "@/components/FilterPills";
import LoadingSpinner from "@/components/LoadingSpinner";
import StatusBadge from "@/components/StatusBadge";
import SummaryTile from "@/components/SummaryTile";
import DateRangePicker, { filterByDateRange } from "@/components/DateRangePicker";
import RecurringTransactionsTab from "@/components/RecurringTransactionsTab";
import type { DateRange } from "react-day-picker";
import { type Period, filterByPeriod } from "@/lib/date-filters";
import { downloadCSV } from "@/lib/csv";
import { formatGBP, sumAmounts } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";

type TransactionRow = Tables<"tbl_transactions">;

const typeFilters = ["all", "inflow", "outflow"] as const;

const TRANSACTION_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "description", label: "Description", required: true, type: "string" },
  { key: "amount", label: "Amount", required: true, type: "number" },
  { key: "type", label: "Type", required: true, type: "enum", enumValues: ["inflow", "outflow"] },
  { key: "category", label: "Category", type: "string", defaultValue: "Other" },
  { key: "status", label: "Status", type: "enum", enumValues: ["completed", "pending", "overdue", "rejected"], defaultValue: "completed" },
  { key: "date", label: "Date", type: "date", defaultValue: new Date().toISOString().split("T")[0] },
];
const TRANSACTION_IMPORT_SAMPLE = ["Client Payment - Example Ltd", 1500, "inflow", "Revenue", "completed", "2026-01-15"];

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("all");
  const [search, setSearch] = useState("");
  const [allTransactions, setAllTransactions] = useState<TransactionRow[]>([]);
  const [recurringList, setRecurringList] = useState<{ id: string; description: string }[]>([]);
  const [recurringFilter, setRecurringFilter] = useState<string>("all"); // "all" | "any" | "<id>"
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [period, setPeriod] = useState<Period>("Monthly");
  const [range, setRange] = useState<DateRange | undefined>();
  const { hasEdit, hasAdmin } = useUserRoles();
  const viewOnly = !hasEdit("transactions");
  const canImport = hasAdmin("transactions");
  const { user } = useAuth();

  const fetchRecurring = async () => {
    const { data } = await supabase
      .from("tbl_recurring_transactions")
      .select("id, description")
      .order("description", { ascending: true });
    setRecurringList(data || []);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase.from("tbl_transactions").select("*").order("date", { ascending: false });
    setAllTransactions(data || []);
    setLoading(false);
  };

  const handleImportTransactions = async (rows: Record<string, string | number>[]) => {
    if (!user) return { error: "Not signed in" };
    const payload = rows.map((r) => ({
      user_id: user.id,
      description: String(r.description),
      amount: Number(r.amount),
      type: String(r.type),
      category: String(r.category),
      status: String(r.status),
      date: String(r.date),
      created_by_name: user.user_metadata?.full_name || user.email || "",
    }));
    const { error } = await supabase.from("tbl_transactions").insert(payload as never);
    if (!error) fetchTransactions();
    return { error: error?.message };
  };

  useEffect(() => { fetchTransactions(); fetchRecurring(); }, []);

  const periodFiltered = filterByDateRange(filterByPeriod(allTransactions, period), range, "date");
  const filtered = periodFiltered
    .filter((t) => typeFilter === "all" || t.type === typeFilter)
    .filter((t) => {
      if (recurringFilter === "all") return true;
      if (recurringFilter === "any") return !!t.recurring_transaction_id;
      return t.recurring_transaction_id === recurringFilter;
    })
    .filter((t) => !search || t.description?.toLowerCase().includes(search.toLowerCase()));

  const totalInflow = sumAmounts(periodFiltered.filter((t) => t.type === "inflow"), "amount");
  const totalOutflow = sumAmounts(periodFiltered.filter((t) => t.type === "outflow"), "amount");
  const netFlow = totalInflow - totalOutflow;

  const downloadAllCSV = () => {
    downloadCSV(
      "transactions.csv",
      ["Description", "Amount", "Type", "Category", "Status", "Date", "Created By"],
      filtered.map((t) => [t.description, t.amount, t.type, t.category, t.status, t.date, t.created_by_name || ""]),
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Transactions" subtitle="Track all inflows and outflows">
        <Button variant="outline" size="sm" onClick={downloadAllCSV} disabled={viewOnly}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
        {canImport && (
          <ImportDialog
            title="Import Transactions"
            columns={TRANSACTION_IMPORT_COLUMNS}
            sampleRow={TRANSACTION_IMPORT_SAMPLE}
            onImport={handleImportTransactions}
            onImported={fetchTransactions}
          />
        )}
        <div className={viewOnly ? "opacity-50 pointer-events-none" : ""}><AddTransactionDialog onCreated={fetchTransactions} /></div>
      </PageHeader>

      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <PeriodSelector value={period} onChange={setPeriod} />
            <DateRangePicker value={range} onChange={setRange} />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <SummaryTile label="Total Inflow" value={`+${formatGBP(totalInflow)}`} tone="inflow" className="glow-green gradient-inflow" />
            <SummaryTile label="Total Outflow" value={`-${formatGBP(totalOutflow)}`} tone="outflow" className="glow-red gradient-outflow" />
            <SummaryTile label="Net Flow" value={formatGBP(netFlow)} tone={netFlow >= 0 ? "inflow" : "outflow"} />
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-1 items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
            </div>
            <FilterPills options={typeFilters} value={typeFilter} onChange={(v) => setTypeFilter(v)} />
            <Select value={recurringFilter} onValueChange={setRecurringFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Recurring" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All transactions</SelectItem>
                <SelectItem value="any">↻ Recurring only</SelectItem>
                {recurringList.length > 0 && (
                  <div className="my-1 border-t border-border" />
                )}
                {recurringList.map((r) => (
                  <SelectItem key={r.id} value={r.id}>From: {r.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No transactions found.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card flex items-center justify-between px-6 py-4 cursor-pointer"
                  onClick={() => setSelected(tx)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-full p-2 ${tx.type === 'inflow' ? 'bg-inflow-muted' : 'bg-outflow-muted'}`}>
                      {tx.type === 'inflow' ? <ArrowDownLeft className="h-4 w-4 text-inflow" /> : <ArrowUpRight className="h-4 w-4 text-outflow" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        {tx.description}
                        {tx.recurring_transaction_id && (
                          <span title="Generated from a recurring schedule" className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            ↻ Recurring
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{tx.category} · {tx.date} · {tx.created_by_name || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={tx.status} />
                    <span className={`font-heading text-sm font-bold ${tx.type === 'inflow' ? 'text-inflow' : 'text-outflow'}`}>
                      {tx.type === 'inflow' ? '+' : '-'}{formatGBP(tx.amount)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringTransactionsTab />
        </TabsContent>
      </Tabs>


      <RecordDetailDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        record={selected}
        type="transaction"
        onUpdated={fetchTransactions}
        onEdit={!viewOnly ? () => { setEditing(selected); setSelected(null); } : undefined}
      />
      {editing && (
        <AddTransactionDialog
          key={editing.id}
          record={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onCreated={fetchTransactions}
        />
      )}
    </div>
  );
}
