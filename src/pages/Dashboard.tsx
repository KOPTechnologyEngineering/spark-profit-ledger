import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Clock } from "lucide-react";
import StatCard from "@/components/StatCard";
import CashflowChart from "@/components/CashflowChart";
import RecentTransactions from "@/components/RecentTransactions";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const periods = ["Daily", "Weekly", "Monthly", "Yearly"] as const;

export default function Dashboard() {
  const [activePeriod, setActivePeriod] = useState<typeof periods[number]>("Monthly");
  const [stats, setStats] = useState({ revenue: 0, expenses: 0, profit: 0, balance: 0, pendingInv: 0, overdueInv: 0, vatDue: 0, payeMonth: 0 });

  useEffect(() => {
    const load = async () => {
      const { data: txns } = await supabase.from("tbl_transactions").select("amount, type, status");
      const { data: invs } = await supabase.from("tbl_invoices").select("amount, status");
      const { data: vat } = await supabase.from("tbl_vat_returns").select("net_vat, status");
      const { data: paye } = await supabase.from("tbl_paye_employees").select("gross_pay");

      const all = txns || [];
      const revenue = all.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
      const expenses = all.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);

      const allInv = invs || [];
      const pendingInv = allInv.filter((i) => i.status === "pending").length;
      const overdueInv = allInv.filter((i) => i.status === "overdue").length;

      const vatDue = (vat || []).filter((v) => v.status === "due").reduce((s, v) => s + Number(v.net_vat), 0);
      const payeMonth = (paye || []).reduce((s, p) => s + Number(p.gross_pay), 0);

      setStats({
        revenue,
        expenses,
        profit: revenue - expenses,
        balance: revenue - expenses,
        pendingInv,
        overdueInv,
        vatDue,
        payeMonth,
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
        <StatCard title="Total Revenue" value={`£${stats.revenue.toLocaleString()}`} changeType="positive" icon={DollarSign} variant="inflow" />
        <StatCard title="Total Expenses" value={`£${stats.expenses.toLocaleString()}`} changeType="negative" icon={TrendingDown} variant="outflow" />
        <StatCard title="Net Profit" value={`£${stats.profit.toLocaleString()}`} changeType={stats.profit >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        <StatCard title="Cash Balance" value={`£${stats.balance.toLocaleString()}`} change="Updated today" changeType="neutral" icon={Wallet} />
      </motion.div>

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
