import { useState, useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, Search, Download } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AddTransactionDialog from "@/components/AddTransactionDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase.from("tbl_transactions").select("*").order("date", { ascending: false });
    setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTransactions(); }, []);

  const filtered = transactions
    .filter((t) => typeFilter === "all" || t.type === typeFilter)
    .filter((t) => !search || t.description?.toLowerCase().includes(search.toLowerCase()));

  const totalInflow = transactions.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
  const totalOutflow = transactions.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);

  const downloadAllCSV = () => {
    const header = "Description,Amount,Type,Category,Status,Date,Created By\n";
    const rows = filtered.map((t) => `"${t.description}",${t.amount},${t.type},${t.category},${t.status},${t.date},${t.created_by_name || ""}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground">Track all inflows and outflows</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadAllCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          <AddTransactionDialog onCreated={fetchTransactions} />
        </div>
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
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
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No transactions found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card flex items-center justify-between px-6 py-4 cursor-pointer"
              onClick={() => setSelected(tx)}
            >
              <div className="flex items-center gap-4">
                <div className={`rounded-full p-2 ${tx.type === 'inflow' ? 'bg-inflow-muted' : 'bg-outflow-muted'}`}>
                  {tx.type === 'inflow' ? <ArrowDownLeft className="h-4 w-4 text-inflow" /> : <ArrowUpRight className="h-4 w-4 text-outflow" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{tx.category} · {tx.date} · {tx.created_by_name || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tx.status === 'completed' ? 'bg-inflow-muted text-inflow' : tx.status === 'rejected' ? 'bg-outflow-muted text-outflow' : 'bg-warning/15 text-warning'}`}>
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

      <RecordDetailDialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)} record={selected} type="transaction" onUpdated={fetchTransactions} />
    </div>
  );
}
