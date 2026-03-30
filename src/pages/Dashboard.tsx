import { useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Clock } from "lucide-react";
import StatCard from "@/components/StatCard";
import CashflowChart from "@/components/CashflowChart";
import RecentTransactions from "@/components/RecentTransactions";
import { motion } from "framer-motion";

const periods = ["Daily", "Weekly", "Monthly", "Yearly"] as const;

export default function Dashboard() {
  const [activePeriod, setActivePeriod] = useState<typeof periods[number]>("Monthly");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Financial overview for your business</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                activePeriod === period
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard title="Total Revenue" value="£377,000" change="+12.5% from last period" changeType="positive" icon={DollarSign} variant="inflow" />
        <StatCard title="Total Expenses" value="£270,200" change="+8.2% from last period" changeType="negative" icon={TrendingDown} variant="outflow" />
        <StatCard title="Net Profit" value="£106,800" change="+18.3% from last period" changeType="positive" icon={TrendingUp} />
        <StatCard title="Cash Balance" value="£284,500" change="Updated today" changeType="neutral" icon={Wallet} />
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" /> Pending Invoices
                </div>
                <span className="font-heading font-semibold text-warning">3</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> Overdue Invoices
                </div>
                <span className="font-heading font-semibold text-outflow">1</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" /> VAT Due
                </div>
                <span className="font-heading font-semibold text-foreground">£33,300</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> PAYE This Month
                </div>
                <span className="font-heading font-semibold text-foreground">£48,100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RecentTransactions />
    </div>
  );
}
