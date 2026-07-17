import { useState, useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, Search, Download } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import AddTransactionDialog from "@/components/AddTransactionDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";
import PageHeader from "@/components/PageHeader";
import PeriodSelector from "@/components/PeriodSelector";
import FilterPills from "@/components/FilterPills";
import LoadingSpinner from "@/components/LoadingSpinner";
import StatusBadge from "@/components/StatusBadge";
import SummaryTile from "@/components/SummaryTile";
import DateRangePicker, { filterByDateRange } from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";
import { type Period, filterByPeriod } from "@/lib/date-filters";
import { downloadCSV } from "@/lib/csv";
import { formatGBP, sumAmounts } from "@/lib/format";
import { useUserRoles } from "@/hooks/useUserRoles";

type TransactionRow = Tables<"tbl_transactions">;

const typeFilters = ["all", "inflow", "outflow"] as const;

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("all");
  const [search, setSearch] = useState("");
  const [allTransactions, setAllTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [period, setPeriod] = useState<Period>("Monthly");
  const [range, setRange] = useState<DateRange | undefined>();
  const { hasEdit } = useUserRoles();
  const viewOnly = !hasEdit("transactions");

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase.from("tbl_transactions").select("*").order("date", { ascending: false });
    setAllTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTransactions(); }, []);

  const periodFiltered = filterByDateRange(filterByPeriod(allTransactions, period), range, "date");
  const filtered = periodFiltered
    .filter((t) => typeFilter === "all" || t.type === typeFilter)
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
        <div className={viewOnly ? "opacity-50 pointer-events-none" : ""}><AddTransactionDialog onCreated={fetchTransactions} /></div>
      </PageHeader>

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
                  <p className="text-sm font-medium text-foreground">{tx.description}</p>
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

      <RecordDetailDialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} record={selected} type="transaction" onUpdated={fetchTransactions} />
    </div>
  );
}
