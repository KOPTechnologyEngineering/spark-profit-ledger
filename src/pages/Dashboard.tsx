import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Clock, AlertCircle } from "lucide-react";
import StatCard from "@/components/StatCard";
import CashflowChart from "@/components/CashflowChart";
import RecentTransactions from "@/components/RecentTransactions";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const periods = ["Daily", "Weekly", "Monthly", "Yearly"] as const;

export default function Dashboard() {
  const [activePeriod, setActivePeriod] = useState<typeof periods[number]>("Monthly");
  const [stats, setStats] = useState({
    revenue: 0, expenses: 0, profit: 0, balance: 0,
    pendingInv: 0, overdueInv: 0, vatDue: 0, payeMonth: 0,
    pendingRevenue: 0, pendingExpenses: 0,
  });

  useEffect(() => {
    const load = async () => {
      const { data: txns } = await supabase.from("tbl_transactions").select("amount, type, status");
      const { data: invs } = await supabase.from("tbl_invoices").select("amount, status");
      const { data: vat } = await supabase.from("tbl_vat_returns").select("net_vat, status");
      const { data: paye } = await supabase.from("tbl_paye_employees").select("gross_pay");

      const all = txns || [];

      // Only fully approved (completed) transactions count at full value
      const approved = all.filter((t) => t.status === "completed");
      const revenue = approved.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
      const expenses = approved.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);

      // Pending amounts
      const pending = all.filter((t) => t.status === "pending");
      const pendingRevenue = pending.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
      const pendingExpenses = pending.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);

      const allInv = invs || [];
      const pendingInv = allInv.filter((i) => i.status === "pending").length;
      const overdueInv = allInv.filter((i) => i.status === "overdue").length;

      const vatDue = (vat || []).filter((v) => v.status === "due").reduce((s, v) => s + Number(v.net_vat), 0);
      const payeMonth = (paye || []).reduce((s, p) => s + Number(p.gross_pay), 0);

      setStats({
        revenue, expenses,
        profit: revenue - expenses,
        balance: revenue - expenses,
        pendingInv, overdueInv, vatDue, payeMonth,
        pendingRevenue, pendingExpenses,
      });
    };
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Financial overview for your business</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {periods.map((period) => (
            <button key={period} onClick={() => setActivePeriod(period)} className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${activePeriod === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {period}
            </button>
          ))}
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Approved Revenue" value={`£${stats.revenue.toLocaleString()}`} change={stats.pendingRevenue > 0 ? `£${stats.pendingRevenue.toLocaleString()} pending` : undefined} changeType="positive" icon={DollarSign} variant="inflow" />
        <StatCard title="Approved Expenses" value={`£${stats.expenses.toLocaleString()}`} change={stats.pendingExpenses > 0 ? `£${stats.pendingExpenses.toLocaleString()} pending` : undefined} changeType="negative" icon={TrendingDown} variant="outflow" />
        <StatCard title="Net Profit" value={`£${stats.profit.toLocaleString()}`} changeType={stats.profit >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        <StatCard title="Cash Balance" value={`£${stats.balance.toLocaleString()}`} change="Approved only" changeType="neutral" icon={Wallet} />
      </motion.div>

      {(stats.pendingRevenue > 0 || stats.pendingExpenses > 0 || stats.pendingInv > 0) && (
        <div className="glass-card border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Pending Approvals</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingInv > 0 && `${stats.pendingInv} invoice(s) pending. `}
              {stats.pendingRevenue > 0 && `£${stats.pendingRevenue.toLocaleString()} inflow pending. `}
              {stats.pendingExpenses > 0 && `£${stats.pendingExpenses.toLocaleString()} outflow pending. `}
              Values above reflect only fully approved records.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashflowChart />
        </div>
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-heading text-lg font-semibold text-foreground">Quick Stats</h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> Pending Invoices</div>
                <span className="font-heading font-semibold text-warning">{stats.pendingInv}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Overdue Invoices</div>
                <span className="font-heading font-semibold text-outflow">{stats.overdueInv}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" /> VAT Due</div>
                <span className="font-heading font-semibold text-foreground">£{stats.vatDue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" /> PAYE This Month</div>
                <span className="font-heading font-semibold text-foreground">£{stats.payeMonth.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RecentTransactions />
    </div>
  );
}
