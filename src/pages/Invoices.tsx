import { useState } from "react";
import { invoices } from "@/lib/mock-data";
import { Plus, Search, Filter } from "lucide-react";
import { motion } from "framer-motion";

const statusColors = {
  paid: "bg-inflow-muted text-inflow",
  pending: "bg-warning/15 text-warning",
  overdue: "bg-outflow-muted text-outflow",
  draft: "bg-secondary text-muted-foreground",
};

export default function Invoices() {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage and track your invoices</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-secondary px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Search invoices..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {["all", "paid", "pending", "overdue", "draft"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${filter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Invoice</th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Client</th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((invoice, i) => (
              <motion.tr
                key={invoice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
              >
                <td className="px-6 py-4 font-heading text-sm font-semibold text-foreground">{invoice.invoiceNumber}</td>
                <td className="px-6 py-4 text-sm text-foreground">{invoice.client}</td>
                <td className="px-6 py-4 font-heading text-sm font-semibold text-foreground">£{invoice.amount.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[invoice.status]}`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.dueDate}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
