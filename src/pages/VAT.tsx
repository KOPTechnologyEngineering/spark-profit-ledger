import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Clock, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import PeriodSelector from "@/components/PeriodSelector";
import StatusBadge from "@/components/StatusBadge";
import SummaryTile from "@/components/SummaryTile";
import { type Period, filterByPeriod } from "@/lib/date-filters";
import { downloadCSV } from "@/lib/csv";
import { formatGBP, sumAmounts } from "@/lib/format";
import { useTransactionsData, useVatReturnsData } from "@/hooks/useFinancialData";
import type { Tables } from "@/integrations/supabase/types";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function VAT() {
  const [period, setPeriod] = useState<Period>("Monthly");
  const [selected, setSelected] = useState<Tables<"tbl_vat_returns"> | null>(null);
  const { data: allTxns = [] } = useTransactionsData();
  const { data: vatReturns = [] } = useVatReturnsData();

  const filtered = filterByPeriod(allTxns, period);
  const inflow = sumAmounts(filtered.filter((t) => t.type === "inflow"), "amount");
  const outflow = sumAmounts(filtered.filter((t) => t.type === "outflow"), "amount");
  const outputVAT = Math.round(inflow * 0.2);
  const inputVAT = Math.round(outflow * 0.2);
  const netVAT = outputVAT - inputVAT;

  const exportCSV = () => {
    downloadCSV("vat_summary.csv", ["Item", "Amount (£)"], [
      ["Total Sales", inflow],
      ["Output VAT (20%)", outputVAT],
      ["Total Purchases", outflow],
      ["Input VAT (20%)", inputVAT],
      ["Net VAT", netVAT],
    ]);
  };

  return (
    <div className="space-y-8">
      <PageHeader title="VAT Management" subtitle="Track and file your VAT returns">
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export</Button>
        <PeriodSelector value={period} onChange={setPeriod} />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        <SummaryTile label="Output VAT (on sales)" value={formatGBP(outputVAT)} />
        <SummaryTile label="Input VAT (on purchases)" value={formatGBP(inputVAT)} />
        <SummaryTile label="Net VAT Payable" value={formatGBP(netVAT)} tone="outflow" className="glow-red gradient-outflow" />
      </div>

      <div className="glass-card p-0 overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-6 py-4 border-b border-border">
          <h3 className="font-heading text-lg font-semibold text-foreground">VAT Return History</h3>
          <span className="text-xs text-muted-foreground">{vatReturns.length} {vatReturns.length === 1 ? "return" : "returns"}</span>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto">
        {vatReturns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No VAT returns recorded yet. VAT summary above is calculated from transactions at 20% rate.</p>
        ) : (
          <div className="space-y-3">
            {vatReturns.map((q, i) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex flex-col gap-4 rounded-lg bg-secondary/50 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center justify-between gap-3 md:justify-start">
                  <div className="flex items-center gap-3">
                    {q.status === 'filed' ? <CheckCircle className="h-5 w-5 text-inflow" /> : <Clock className="h-5 w-5 text-warning" />}
                    <span className="font-medium text-foreground">{q.quarter}</span>
                  </div>
                  <StatusBadge status={q.status} className="md:hidden" />
                </div>
                <div className="flex items-center gap-4 sm:gap-8 flex-wrap">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Output</p>
                    <p className="font-heading text-sm font-semibold text-foreground">{formatGBP(q.output_vat)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Input</p>
                    <p className="font-heading text-sm font-semibold text-foreground">{formatGBP(q.input_vat)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="font-heading text-sm font-semibold text-outflow">{formatGBP(q.net_vat)}</p>
                  </div>
                  <StatusBadge status={q.status} className="hidden md:inline-flex" />
                  <Button variant="ghost" size="sm" aria-label="View return" onClick={() => setSelected(q)}>
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">View</span>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>VAT Return — {selected?.quarter}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <DetailRow label="Output VAT" value={formatGBP(selected.output_vat)} />
              <DetailRow label="Input VAT" value={formatGBP(selected.input_vat)} />
              <DetailRow label="Net VAT" value={formatGBP(selected.net_vat)} />
              <DetailRow label="Deadline" value={selected.deadline || "—"} />
              <DetailRow label="Filed" value={new Date(selected.created_at).toLocaleDateString("en-GB")} />
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={selected.status} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
