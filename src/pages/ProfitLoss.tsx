import { pnlData } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function ProfitLoss() {
  const totalRevenue = pnlData.revenue.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = pnlData.expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const chartData = [
    ...pnlData.revenue.map((r) => ({ name: r.label, amount: r.amount, type: "revenue" })),
  ];
  const expenseChart = [
    ...pnlData.expenses.map((e) => ({ name: e.label, amount: e.amount, type: "expense" })),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Profit & Loss</h1>
        <p className="text-muted-foreground">Financial year 2025/2026</p>
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
          <p className="mt-1 text-xs text-muted-foreground">Margin: {((netProfit / totalRevenue) * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6">
          <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Revenue Breakdown</h3>
          <div className="space-y-3">
            {pnlData.revenue.map((item) => (
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
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="glass-card p-6">
          <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Expense Breakdown</h3>
          <div className="space-y-3">
            {pnlData.expenses.map((item) => (
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
          <div className="flex justify-between border-b border-border py-2">
            <span className="font-medium text-foreground">EBITDA</span>
            <span className={`font-heading font-bold ${netProfit + 9600 >= 0 ? 'text-inflow' : 'text-outflow'}`}>£{(netProfit + 9600).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b border-border py-2">
            <span className="text-muted-foreground">Less: Depreciation</span>
            <span className="font-heading text-outflow">(£9,600)</span>
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
