import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import PeriodSelector from "@/components/PeriodSelector";
import SummaryTile from "@/components/SummaryTile";
import { type Period, filterByPeriod } from "@/lib/date-filters";
import { downloadCSV } from "@/lib/csv";
import { formatGBP } from "@/lib/format";

type TxnSummary = Pick<Tables<"tbl_transactions">, "amount" | "type" | "category" | "date">;

interface BreakdownItem {
  label: string;
  amount: number;
}

function CategoryBreakdown({ title, items, total, tone }: { title: string; items: BreakdownItem[]; total: number; tone: "inflow" | "outflow" }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tone === "outflow" ? { delay: 0.1 } : undefined} className="glass-card p-6">
      <h3 className="font-heading text-lg font-semibold text-foreground mb-4">{title}</h3>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No {tone === "inflow" ? "revenue" : "expense"} data</p> : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="text-sm text-muted-foreground truncate sm:max-w-[40%]">{item.label}</span>
              <div className="flex items-center gap-3 sm:flex-1 sm:justify-end">
                <div className="h-2 flex-1 sm:w-24 sm:flex-none overflow-hidden rounded-full bg-secondary">
                  <div className={`h-full rounded-full ${tone === "inflow" ? "bg-inflow" : "bg-outflow"}`} style={{ width: `${(item.amount / total) * 100}%` }} />
                </div>
                <span className={`font-heading text-sm font-semibold whitespace-nowrap ${tone === "inflow" ? "text-inflow" : "text-outflow"}`}>{formatGBP(item.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function ProfitLoss() {
  const [period, setPeriod] = useState<Period>("Monthly");
  const [allTxns, setAllTxns] = useState<TxnSummary[]>([]);

  useEffect(() => {
    supabase.from("tbl_transactions").select("amount, type, category, date").then(({ data }) => setAllTxns(data || []));
  }, []);

  const filtered = filterByPeriod(allTxns, period);

  const revMap: Record<string, number> = {};
  const expMap: Record<string, number> = {};
  filtered.forEach((t) => {
    const map = t.type === "inflow" ? revMap : expMap;
    map[t.category] = (map[t.category] || 0) + Number(t.amount);
  });

  const revenue: BreakdownItem[] = Object.entries(revMap).map(([label, amount]) => ({ label, amount }));
  const expenses: BreakdownItem[] = Object.entries(expMap).map(([label, amount]) => ({ label, amount }));
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const exportCSV = () => {
    downloadCSV("profit_loss.csv", ["Category", "Type", "Amount"], [
      ...revenue.map((r) => [r.label, "Revenue", r.amount]),
      ...expenses.map((e) => [e.label, "Expense", e.amount]),
      ["Net Profit", "", netProfit],
    ]);
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Profit & Loss" subtitle="Calculated from all transactions">
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export</Button>
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        <SummaryTile label="Total Revenue" value={formatGBP(totalRevenue)} tone="inflow" className="glow-green gradient-inflow" />
        <SummaryTile label="Total Expenses" value={formatGBP(totalExpenses)} tone="outflow" className="glow-red gradient-outflow" />
        <SummaryTile
          label="Net Profit"
          value={formatGBP(netProfit)}
          tone={netProfit >= 0 ? "inflow" : "outflow"}
          className={netProfit >= 0 ? "glow-green" : "glow-red"}
          footnote={totalRevenue > 0 ? `Margin: ${((netProfit / totalRevenue) * 100).toFixed(1)}%` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBreakdown title="Revenue Breakdown" items={revenue} total={totalRevenue} tone="inflow" />
        <CategoryBreakdown title="Expense Breakdown" items={expenses} total={totalExpenses} tone="outflow" />
      </div>

      <div className="glass-card p-6">
        <h3 className="font-heading text-lg font-semibold text-foreground mb-4">P&L Summary Statement</h3>
        <div className="space-y-2">
          <div className="flex justify-between border-b border-border py-2">
            <span className="font-medium text-foreground">Gross Revenue</span>
            <span className="font-heading font-bold text-inflow">{formatGBP(totalRevenue)}</span>
          </div>
          <div className="flex justify-between border-b border-border py-2">
            <span className="font-medium text-foreground">Total Operating Expenses</span>
            <span className="font-heading font-bold text-outflow">({formatGBP(totalExpenses)})</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-lg font-bold text-foreground">Net Profit / (Loss)</span>
            <span className={`font-heading text-lg font-bold ${netProfit >= 0 ? 'text-inflow' : 'text-outflow'}`}>{formatGBP(netProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
