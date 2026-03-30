import { useState } from "react";
import { transactions } from "@/lib/mock-data";
import { ArrowDownLeft, ArrowUpRight, Plus, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = typeFilter === "all" ? transactions : transactions.filter((t) => t.type === typeFilter);
  const totalInflow = transactions.filter((t) => t.type === "inflow").reduce((s, t) => s + t.amount, 0);
  const totalOutflow = transactions.filter((t) => t.type === "outflow").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground">Track all inflows and outflows</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Transaction
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="glass-card glow-green gradient-inflow p-6">
          <p className="text-sm text-muted-foreground">Total Inflow</p>
          <p className="mt-1 font-heading text-2xl font-bold text-inflow">+£{totalInflow.toLocaleString()}</p>
        </div>
        <div className="glass-card glow-red gradient-outflow p-6">
          <p className="text-sm text-muted-foreground">Total Outflow</p>
          <p className="mt-1 font-heading text-2xl font-bold text-outflow">-£{totalOutflow.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Net Flow</p>
          <p className={`mt-1 font-heading text-2xl font-bold ${totalInflow - totalOutflow >= 0 ? 'text-inflow' : 'text-outflow'}`}>
            £{(totalInflow - totalOutflow).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-secondary px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Search transactions..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {["all", "inflow", "outflow"].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${typeFilter === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((tx, i) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass-card flex items-center justify-between px-6 py-4"
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-2 ${tx.type === 'inflow' ? 'bg-inflow-muted' : 'bg-outflow-muted'}`}>
                {tx.type === 'inflow' ? <ArrowDownLeft className="h-4 w-4 text-inflow" /> : <ArrowUpRight className="h-4 w-4 text-outflow" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{tx.category} · {tx.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tx.status === 'completed' ? 'bg-inflow-muted text-inflow' : 'bg-warning/15 text-warning'}`}>
                {tx.status}
              </span>
              <span className={`font-heading text-sm font-bold ${tx.type === 'inflow' ? 'text-inflow' : 'text-outflow'}`}>
                {tx.type === 'inflow' ? '+' : '-'}£{tx.amount.toLocaleString()}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
