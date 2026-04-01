import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Clock } from "lucide-react";

export default function VAT() {
  const [vatReturns, setVatReturns] = useState<any[]>([]);
  const [summary, setSummary] = useState({ outputVAT: 0, inputVAT: 0, netVAT: 0 });

  useEffect(() => {
    const load = async () => {
      // Calculate VAT from transactions (20% standard rate)
      const { data: txns } = await supabase.from("tbl_transactions").select("amount, type");
      const inflow = (txns || []).filter((t) => t.type === "inflow").reduce((s, t) => s + Number(t.amount), 0);
      const outflow = (txns || []).filter((t) => t.type === "outflow").reduce((s, t) => s + Number(t.amount), 0);
      const outputVAT = Math.round(inflow * 0.2);
      const inputVAT = Math.round(outflow * 0.2);
      setSummary({ outputVAT, inputVAT, netVAT: outputVAT - inputVAT });

      // Load VAT returns from DB
      const { data: returns } = await supabase.from("tbl_vat_returns").select("*").order("created_at", { ascending: false });
      setVatReturns(returns || []);
    };
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">VAT Management</h1>
        <p className="text-muted-foreground">Track and file your VAT returns</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Output VAT (on sales)</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">£{summary.outputVAT.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Input VAT (on purchases)</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">£{summary.inputVAT.toLocaleString()}</p>
        </div>
        <div className="glass-card glow-red gradient-outflow p-6">
          <p className="text-sm text-muted-foreground">Net VAT Payable</p>
          <p className="mt-1 font-heading text-2xl font-bold text-outflow">£{summary.netVAT.toLocaleString()}</p>
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
