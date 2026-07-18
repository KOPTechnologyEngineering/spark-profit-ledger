import { useState, useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, Search, Download, ArrowRight, FileText, FileSpreadsheet } from "lucide-react";

import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AddTransactionDialog from "@/components/AddTransactionDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";

type TransactionRow = Tables<"tbl_transactions">;

type RunDetailRow = Tables<"tbl_recurring_run_details"> & {
  tbl_recurring_run_log: Pick<Tables<"tbl_recurring_run_log">, "run_at" | "triggered_by" | "error"> | null;
};

const typeFilters = ["all", "inflow", "outflow"] as const;

const TRANSACTION_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "description", label: "Description", required: true, type: "string" },
  { key: "amount", label: "Amount", required: true, type: "number" },
  { key: "type", label: "Type", required: true, type: "enum", enumValues: ["inflow", "outflow"] },
  { key: "category", label: "Category", type: "string", defaultValue: "Other" },
  { key: "status", label: "Status", type: "enum", enumValues: ["completed", "pending", "overdue", "rejected"], defaultValue: "completed" },
  { key: "date", label: "Date", type: "date", defaultValue: new Date().toISOString().split("T")[0] },
  { key: "organization", label: "Organization", type: "string" },
];
const TRANSACTION_IMPORT_SAMPLE = ["Client Payment - Example Ltd", 1500, "inflow", "Revenue", "completed", "2026-01-15", "Example Ltd"];

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("all");
  const [search, setSearch] = useState("");
  const [allTransactions, setAllTransactions] = useState<TransactionRow[]>([]);
  const [recurringList, setRecurringList] = useState<{ id: string; description: string }[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});
  const [recurringFilter, setRecurringFilter] = useState<string>("all"); // "all" | "any" | "<id>"
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [recurringDetail, setRecurringDetail] = useState<Tables<"tbl_recurring_transactions"> | null>(null);
  const [recurringDetailLoading, setRecurringDetailLoading] = useState(false);
  const [recurringRuns, setRecurringRuns] = useState<RunDetailRow[]>([]);
  const [recurringRunsLoading, setRecurringRunsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("transactions");

  const openRecurringDetail = async (id: string) => {
    setRecurringDetailLoading(true);
    setRecurringRunsLoading(true);
    setRecurringDetail({ id } as Tables<"tbl_recurring_transactions">);
    const detailPromise = supabase
      .from("tbl_recurring_transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const runsPromise = canViewRunHistory
      ? supabase
          .from("tbl_recurring_run_details")
          .select("*, tbl_recurring_run_log(run_at, triggered_by, error)")
          .eq("recurring_transaction_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });
    const [detailRes, runsRes] = await Promise.all([detailPromise, runsPromise]);
    setRecurringDetail(detailRes.data ?? null);
    setRecurringRuns((runsRes.data as RunDetailRow[]) || []);
    setRecurringDetailLoading(false);
    setRecurringRunsLoading(false);
  };

  const viewFutureTransactions = (id: string) => {
    setRecurringDetail(null);
    setActiveTab("transactions");
    setRecurringFilter(id);
    setPeriod("All");
    setRange({ from: new Date(), to: undefined });
  };

  const fetchScheduleTransactions = async (id: string) => {
    const { data, error } = await supabase
      .from("tbl_transactions")
      .select("*")
      .eq("recurring_transaction_id", id)
      .is("deleted_at", null)
      .order("date", { ascending: false });
    if (error) throw error;
    return (data || []) as TransactionRow[];
  };

  const exportScheduleCSV = async () => {
    if (!recurringDetail?.id) return;
    const rows = await fetchScheduleTransactions(recurringDetail.id);
    const slug = (recurringDetail.description || "schedule").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadCSV(
      `recurring-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Description", "Type", "Category", "Amount (GBP)", "Status"],
      rows.map((t) => [t.date, t.description, t.type, t.category || "", Number(t.amount).toFixed(2), t.status]),
    );
  };

  const exportSchedulePDF = async () => {
    if (!recurringDetail?.id) return;
    const rows = await fetchScheduleTransactions(recurringDetail.id);
    const r = recurringDetail;
    const total = rows.reduce((s, t) => s + (t.type === "inflow" ? Number(t.amount) : -Number(t.amount)), 0);
    const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Recurring schedule report</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#111;}
  h1{margin:0 0 4px;font-size:20px;}
  .meta{color:#555;font-size:12px;margin-bottom:16px;}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 24px;margin-bottom:20px;font-size:12px;}
  .grid div span{display:block;color:#666;text-transform:uppercase;font-size:10px;letter-spacing:.05em;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th,td{padding:8px 10px;border-bottom:1px solid #ddd;text-align:left;}
  th{background:#f5f5f5;font-size:11px;text-transform:uppercase;letter-spacing:.05em;}
  td.num,th.num{text-align:right;}
  tfoot td{font-weight:600;border-top:2px solid #333;border-bottom:none;}
  .inflow{color:#059669;} .outflow{color:#dc2626;}
</style></head><body>
  <h1>Recurring schedule report</h1>
  <div class="meta">Generated ${new Date().toLocaleString("en-GB")}</div>
  <div class="grid">
    <div><span>Description</span>${esc(r.description)}</div>
    <div><span>Frequency</span>${esc(r.frequency)}</div>
    <div><span>Category</span>${esc(r.category || "—")}</div>
    <div><span>Amount</span>${r.type === "inflow" ? "+" : "-"}£${Number(r.amount).toFixed(2)}</div>
    <div><span>Start</span>${esc(r.start_date || "—")}</div>
    <div><span>End</span>${esc(r.end_date || "No end")}</div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th>Status</th><th class="num">Amount (£)</th></tr></thead>
    <tbody>
      ${rows.map((t) => `<tr>
        <td>${esc(t.date)}</td><td>${esc(t.description)}</td>
        <td class="${t.type}">${esc(t.type)}</td>
        <td>${esc(t.category || "")}</td><td>${esc(t.status)}</td>
        <td class="num">${t.type === "inflow" ? "+" : "-"}${Number(t.amount).toFixed(2)}</td>
      </tr>`).join("")}
      ${rows.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:#666;padding:20px;">No transactions generated yet.</td></tr>` : ""}
    </tbody>
    <tfoot><tr><td colspan="5">Net total</td><td class="num ${total >= 0 ? "inflow" : "outflow"}">${total >= 0 ? "+" : "-"}£${Math.abs(total).toFixed(2)}</td></tr></tfoot>
  </table>
  <script>window.onload=()=>{window.print();};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };



  const [period, setPeriod] = useState<Period>("Monthly");
  const [range, setRange] = useState<DateRange | undefined>();
  const { hasEdit, hasAdmin } = useUserRoles();
  const viewOnly = !hasEdit("transactions");
  const canImport = hasAdmin("transactions");
  const canViewRunHistory = hasAdmin("transactions");
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchRecurring = async () => {
    const { data, error } = await supabase
      .from("tbl_recurring_transactions")
      .select("id, description")
      .order("description", { ascending: true });
    if (error) {
      toast({ title: "Couldn't load recurring transactions", description: friendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    setRecurringList(data || []);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tbl_transactions").select("*").order("date", { ascending: false });
    if (error) {
      toast({ title: "Couldn't load transactions", description: friendlyErrorMessage(error), variant: "destructive" });
      setLoading(false);
      return;
    }
    setAllTransactions(data || []);
    setLoading(false);
  };

  const handleImportTransactions = async (rows: Record<string, string | number>[]) => {
    if (!user) return { error: "Not signed in" };
    const nameToId = new Map<string, string>();
    Object.entries(orgMap).forEach(([id, name]) => nameToId.set(name.trim().toLowerCase(), id));
    const missing: string[] = [];
    const payload = rows.map((r) => {
      let organization_id: string | null = null;
      const orgName = r.organization ? String(r.organization).trim() : "";
      if (orgName) {
        const id = nameToId.get(orgName.toLowerCase());
        if (!id) missing.push(orgName);
        else organization_id = id;
      }
      return {
        user_id: user.id,
        description: String(r.description),
        amount: Number(r.amount),
        type: String(r.type),
        category: String(r.category),
        status: String(r.status),
        date: String(r.date),
        organization_id,
        created_by_name: user.user_metadata?.full_name || user.email || "",
      };
    });
    if (missing.length) {
      const uniq = Array.from(new Set(missing));
      return { error: `Unknown organization${uniq.length > 1 ? "s" : ""}: ${uniq.join(", ")}. Add them in Organizations first.` };
    }
    const { error } = await supabase.from("tbl_transactions").insert(payload as never);
    if (!error) fetchTransactions();
    return { error: error?.message };
  };

  const fetchOrgs = async () => {
    const { data, error } = await supabase.from("tbl_organizations").select("id, name").is("deleted_at", null);
    if (error) {
      toast({ title: "Couldn't load organizations", description: friendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    const m: Record<string, string> = {};
    (data || []).forEach((o: any) => { m[o.id] = o.name; });
    setOrgMap(m);
  };

  useEffect(() => { fetchTransactions(); fetchRecurring(); fetchOrgs(); }, []);

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
      ["Description", "Amount", "Type", "Category", "Status", "Date", "Organization", "Created By"],
      filtered.map((t) => [t.description, t.amount, t.type, t.category, t.status, t.date, (t.organization_id && orgMap[t.organization_id]) || "", t.created_by_name || ""]),
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
            onImported={() => {
              // Reset filters so newly imported (possibly past-dated) rows are visible
              setPeriod("All");
              setRange(undefined);
              setTypeFilter("all");
              setRecurringFilter("all");
              setSearch("");
              fetchTransactions();
            }}
          />
        )}
        <div className={viewOnly ? "opacity-50 pointer-events-none" : ""}><AddTransactionDialog onCreated={fetchTransactions} /></div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                          <button
                            type="button"
                            title="View recurring schedule"
                            onClick={(e) => { e.stopPropagation(); openRecurringDetail(tx.recurring_transaction_id!); }}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors"
                          >
                            ↻ Recurring
                          </button>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.category} · {tx.date} · {tx.created_by_name || "—"}
                        {tx.organization_id && orgMap[tx.organization_id] && ` · ${orgMap[tx.organization_id]}`}
                      </p>
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

      <Dialog open={!!recurringDetail} onOpenChange={(o) => !o && setRecurringDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recurring schedule</DialogTitle>
          </DialogHeader>
          {recurringDetailLoading || !recurringDetail?.description ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="font-medium text-foreground">{recurringDetail.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                  <p className={`font-medium ${recurringDetail.type === 'inflow' ? 'text-inflow' : 'text-outflow'}`}>
                    {recurringDetail.type === 'inflow' ? '+' : '-'}{formatGBP(Number(recurringDetail.amount))}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground">{recurringDetail.category || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Frequency</p>
                  <p className="font-medium text-foreground capitalize">{recurringDetail.frequency}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground">{recurringDetail.is_active ? "Active" : "Paused"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Next due</p>
                  <p className="font-medium text-foreground">{recurringDetail.next_run_date || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">End date</p>
                  <p className="font-medium text-foreground">{recurringDetail.end_date || "No end"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Start date</p>
                  <p className="font-medium text-foreground">{recurringDetail.start_date || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Last run</p>
                  <p className="font-medium text-foreground">{recurringDetail.last_run_date || "—"}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => viewFutureTransactions(recurringDetail.id)}
              >
                View future transactions <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={exportScheduleCSV}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportSchedulePDF}>
                  <FileText className="mr-2 h-4 w-4" /> Export PDF
                </Button>
              </div>


              {canViewRunHistory && (
                <div className="pt-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Run history</p>
                  {recurringRunsLoading ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">Loading run history…</div>
                  ) : recurringRuns.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">No runs recorded for this schedule yet.</div>
                  ) : (
                    <div className="max-h-60 overflow-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Run date</TableHead>
                            <TableHead className="text-xs">Triggered by</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs text-right">Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recurringRuns.map((run) => {
                            const log = run.tbl_recurring_run_log;
                            const runAt = log?.run_at || run.created_at;
                            const failed = !!log?.error;
                            return (
                              <TableRow key={run.id}>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {new Date(runAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                                </TableCell>
                                <TableCell className="text-xs capitalize whitespace-nowrap">{log?.triggered_by || "—"}</TableCell>
                                <TableCell className="text-xs">
                                  {failed ? (
                                    <span className="text-outflow">Failed</span>
                                  ) : (
                                    <span className="text-inflow">Success</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-right">{run.created_count}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
