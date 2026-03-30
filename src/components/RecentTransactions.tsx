import { transactions } from "@/lib/mock-data";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export default function RecentTransactions() {
  return (
    <div className="glass-card p-6">
      <h3 className="font-heading text-lg font-semibold text-foreground">Recent Transactions</h3>
      <div className="mt-4 space-y-3">
        {transactions.slice(0, 6).map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-1.5 ${tx.type === 'inflow' ? 'bg-inflow-muted' : 'bg-outflow-muted'}`}>
                {tx.type === 'inflow' ? (
                  <ArrowDownLeft className="h-3.5 w-3.5 text-inflow" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5 text-outflow" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{tx.category} · {tx.date}</p>
              </div>
            </div>
            <span className={`font-heading text-sm font-semibold ${tx.type === 'inflow' ? 'text-inflow' : 'text-outflow'}`}>
              {tx.type === 'inflow' ? '+' : '-'}£{tx.amount.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
