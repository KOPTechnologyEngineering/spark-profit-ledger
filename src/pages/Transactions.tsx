import { useState, useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AddTransactionDialog from "@/components/AddTransactionDialog";

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("tbl_transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
    setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTransactions(); }, [user]);

  const filtered = typeFilter === "all" ? transactions : transactions.filter((t) => t.type === typeFilter);
  const totalInflow = transactions.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
  const totalOutflow = transactions.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground">Track all inflows and outflows</p>
        </div>
        <AddTransactionDialog onCreated={fetchTransactions} />
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No transactions yet. Click "Add Transaction" to create one.</div>
      ) : (
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
                  {tx.type === 'inflow' ? '+' : '-'}£{Number(tx.amount).toLocaleString()}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
