import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Clock, AlertCircle } from "lucide-react";
import StatCard from "@/components/StatCard";
import CashflowChart from "@/components/CashflowChart";
import RecentTransactions from "@/components/RecentTransactions";
import PeriodSelector from "@/components/PeriodSelector";
import DateRangePicker, { filterByDateRange } from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { type Period, filterByPeriod } from "@/lib/date-filters";

export default function Dashboard() {
  const [activePeriod, setActivePeriod] = useState<Period>("Monthly");
  const [range, setRange] = useState<DateRange | undefined>();
  const [allTxns, setAllTxns] = useState<any[]>([]);
  const [allInvs, setAllInvs] = useState<any[]>([]);
  const [vatDue, setVatDue] = useState(0);
  const [payeMonth, setPayeMonth] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: txns } = await supabase.from("tbl_transactions").select("amount, type, status, date");
      const { data: invs } = await supabase.from("tbl_invoices").select("amount, status, created_at");
      const { data: vat } = await supabase.from("tbl_vat_returns").select("net_vat, status");
      const { data: paye } = await supabase.from("tbl_paye_employees").select("gross_pay");
      setAllTxns(txns || []);
      setAllInvs(invs || []);
      setVatDue((vat || []).filter((v) => v.status === "due").reduce((s, v) => s + Number(v.net_vat), 0));
      setPayeMonth((paye || []).reduce((s, p) => s + Number(p.gross_pay), 0));
    };
    load();
  }, []);

  const filtered = filterByDateRange(filterByPeriod(allTxns, activePeriod), range, "date");
  const approved = filtered.filter((t) => t.status === "completed");
  const pending = filtered.filter((t) => t.status === "pending");

  const revenue = approved.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = approved.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);
  const pendingRevenue = pending.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
  const pendingExpenses = pending.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);
  const profit = revenue - expenses;

  const filteredInvs = filterByDateRange(filterByPeriod(allInvs, activePeriod), range, "created_at");
  const pendingInv = filteredInvs.filter((i) => i.status === "pending").length;
  const overdueInv = filteredInvs.filter((i) => i.status === "overdue").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Financial overview for your business</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelector value={activePeriod} onChange={setActivePeriod} />
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Approved Revenue" value={`£${revenue.toLocaleString()}`} change={pendingRevenue > 0 ? `£${pendingRevenue.toLocaleString()} pending` : undefined} changeType="positive" icon={DollarSign} variant="inflow" />
        <StatCard title="Approved Expenses" value={`£${expenses.toLocaleString()}`} change={pendingExpenses > 0 ? `£${pendingExpenses.toLocaleString()} pending` : undefined} changeType="negative" icon={TrendingDown} variant="outflow" />
        <StatCard title="Net Profit" value={`£${profit.toLocaleString()}`} changeType={profit >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        <StatCard title="Cash Balance" value={`£${(revenue - expenses).toLocaleString()}`} change="Approved only" changeType="neutral" icon={Wallet} />
      </motion.div>

      {(pendingRevenue > 0 || pendingExpenses > 0 || pendingInv > 0) && (
        <div className="glass-card border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Pending Approvals</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingInv > 0 && `${pendingInv} invoice(s) pending. `}
              {pendingRevenue > 0 && `£${pendingRevenue.toLocaleString()} inflow pending. `}
              {pendingExpenses > 0 && `£${pendingExpenses.toLocaleString()} outflow pending. `}
              Values above reflect only fully approved records.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashflowChart period={activePeriod} />
        </div>
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-heading text-lg font-semibold text-foreground">Quick Stats</h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> Pending Invoices</div>
                <span className="font-heading font-semibold text-warning">{pendingInv}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Overdue Invoices</div>
                <span className="font-heading font-semibold text-outflow">{overdueInv}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" /> VAT Due</div>
                <span className="font-heading font-semibold text-foreground">£{vatDue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" /> PAYE This Month</div>
                <span className="font-heading font-semibold text-foreground">£{payeMonth.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RecentTransactions />
    </div>
  );
}
