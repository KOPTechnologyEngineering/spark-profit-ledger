import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export default function ProfitLoss() {
  const [revenue, setRevenue] = useState<{ label: string; amount: number }[]>([]);
  const [expenses, setExpenses] = useState<{ label: string; amount: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("tbl_transactions").select("amount, type, category");
      if (!data) return;

      const revMap: Record<string, number> = {};
      const expMap: Record<string, number> = {};
      data.forEach((t) => {
        if (t.type === "inflow") {
          revMap[t.category] = (revMap[t.category] || 0) + Number(t.amount);
        } else {
          expMap[t.category] = (expMap[t.category] || 0) + Number(t.amount);
        }
      });
      setRevenue(Object.entries(revMap).map(([label, amount]) => ({ label, amount })));
      setExpenses(Object.entries(expMap).map(([label, amount]) => ({ label, amount })));
    };
    load();
  }, []);

  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Profit & Loss</h1>
        <p className="text-muted-foreground">Calculated from all transactions</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="glass-card glow-green gradient-inflow p-6">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="mt-1 font-heading text-2xl font-bold text-inflow">£{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="glass-card glow-red gradient-outflow p-6">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="mt-1 font-heading text-2xl font-bold text-outflow">£{totalExpenses.toLocaleString()}</p>
        </div>
        <div className={`glass-card p-6 ${netProfit >= 0 ? 'glow-green' : 'glow-red'}`}>
          <p className="text-sm text-muted-foreground">Net Profit</p>
          <p className={`mt-1 font-heading text-2xl font-bold ${netProfit >= 0 ? 'text-inflow' : 'text-outflow'}`}>
            £{netProfit.toLocaleString()}
          </p>
          {totalRevenue > 0 && <p className="mt-1 text-xs text-muted-foreground">Margin: {((netProfit / totalRevenue) * 100).toFixed(1)}%</p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6">
          <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Revenue Breakdown</h3>
          {revenue.length === 0 ? <p className="text-sm text-muted-foreground">No revenue data</p> : (
            <div className="space-y-3">
              {revenue.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-inflow" style={{ width: `${(item.amount / totalRevenue) * 100}%` }} />
                    </div>
                    <span className="font-heading text-sm font-semibold text-inflow">£{item.amount.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="glass-card p-6">
          <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Expense Breakdown</h3>
          {expenses.length === 0 ? <p className="text-sm text-muted-foreground">No expense data</p> : (
            <div className="space-y-3">
              {expenses.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-outflow" style={{ width: `${(item.amount / totalExpenses) * 100}%` }} />
                    </div>
                    <span className="font-heading text-sm font-semibold text-outflow">£{item.amount.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="glass-card p-6">
        <h3 className="font-heading text-lg font-semibold text-foreground mb-4">P&L Summary Statement</h3>
        <div className="space-y-2">
          <div className="flex justify-between border-b border-border py-2">
            <span className="font-medium text-foreground">Gross Revenue</span>
            <span className="font-heading font-bold text-inflow">£{totalRevenue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b border-border py-2">
            <span className="font-medium text-foreground">Total Operating Expenses</span>
            <span className="font-heading font-bold text-outflow">(£{totalExpenses.toLocaleString()})</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-lg font-bold text-foreground">Net Profit / (Loss)</span>
            <span className={`font-heading text-lg font-bold ${netProfit >= 0 ? 'text-inflow' : 'text-outflow'}`}>£{netProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
