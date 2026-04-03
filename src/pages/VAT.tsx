import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import PeriodSelector from "@/components/PeriodSelector";
import { type Period, filterByPeriod, downloadCSV } from "@/lib/date-filters";

export default function VAT() {
  const [period, setPeriod] = useState<Period>("Monthly");
  const [allTxns, setAllTxns] = useState<any[]>([]);
  const [vatReturns, setVatReturns] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("tbl_transactions").select("amount, type, date").then(({ data }) => setAllTxns(data || []));
    supabase.from("tbl_vat_returns").select("*").order("created_at", { ascending: false }).then(({ data }) => setVatReturns(data || []));
  }, []);

  const filtered = filterByPeriod(allTxns, period);
  const inflow = filtered.filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
  const outflow = filtered.filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);
  const outputVAT = Math.round(inflow * 0.2);
  const inputVAT = Math.round(outflow * 0.2);
  const netVAT = outputVAT - inputVAT;

  const exportCSV = () => {
    const header = "Item,Amount (£)\n";
    const rows = [`Total Sales,${inflow}`, `Output VAT (20%),${outputVAT}`, `Total Purchases,${outflow}`, `Input VAT (20%),${inputVAT}`, `Net VAT,${netVAT}`];
    downloadCSV("vat_summary.csv", header, rows);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">VAT Management</h1>
          <p className="text-muted-foreground">Track and file your VAT returns</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Output VAT (on sales)</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">£{outputVAT.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Input VAT (on purchases)</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">£{inputVAT.toLocaleString()}</p>
        </div>
        <div className="glass-card glow-red gradient-outflow p-6">
          <p className="text-sm text-muted-foreground">Net VAT Payable</p>
          <p className="mt-1 font-heading text-2xl font-bold text-outflow">£{netVAT.toLocaleString()}</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="font-heading text-lg font-semibold text-foreground mb-4">VAT Return History</h3>
        {vatReturns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No VAT returns recorded yet. VAT summary above is calculated from transactions at 20% rate.</p>
        ) : (
          <div className="space-y-3">
            {vatReturns.map((q, i) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg bg-secondary/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  {q.status === 'filed' ? <CheckCircle className="h-5 w-5 text-inflow" /> : <Clock className="h-5 w-5 text-warning" />}
                  <span className="font-medium text-foreground">{q.quarter}</span>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Output</p>
                    <p className="font-heading text-sm font-semibold text-foreground">£{Number(q.output_vat).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Input</p>
                    <p className="font-heading text-sm font-semibold text-foreground">£{Number(q.input_vat).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="font-heading text-sm font-semibold text-outflow">£{Number(q.net_vat).toLocaleString()}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${q.status === 'filed' ? 'bg-inflow-muted text-inflow' : 'bg-warning/15 text-warning'}`}>{q.status}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
