import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Clock, AlertCircle } from "lucide-react";
import StatCard from "@/components/StatCard";
import CashflowChart from "@/components/CashflowChart";
import RecentTransactions from "@/components/RecentTransactions";
import PageHeader from "@/components/PageHeader";
import PeriodSelector from "@/components/PeriodSelector";
import DateRangePicker, { filterByDateRange } from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { type Period, filterByPeriod } from "@/lib/date-filters";
import { formatGBP, sumAmounts } from "@/lib/format";

type TxnSummary = Pick<Tables<"tbl_transactions">, "amount" | "type" | "status" | "date">;
type InvoiceSummary = Pick<Tables<"tbl_invoices">, "amount" | "status" | "created_at">;

export default function Dashboard() {
  const [activePeriod, setActivePeriod] = useState<Period>("Monthly");
  const [range, setRange] = useState<DateRange | undefined>();
  const [allTxns, setAllTxns] = useState<TxnSummary[]>([]);
  const [allInvs, setAllInvs] = useState<InvoiceSummary[]>([]);
  const [vatDue, setVatDue] = useState(0);
  const [payeMonth, setPayeMonth] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [{ data: txns }, { data: invs }, { data: vat }, { data: paye }] = await Promise.all([
        supabase.from("tbl_transactions").select("amount, type, status, date"),
        supabase.from("tbl_invoices").select("amount, status, created_at"),
        supabase.from("tbl_vat_returns").select("net_vat, status"),
        supabase.from("tbl_paye_employees").select("gross_pay"),
      ]);
      setAllTxns(txns || []);
      setAllInvs(invs || []);
      setVatDue(sumAmounts((vat || []).filter((v) => v.status === "due"), "net_vat"));
      setPayeMonth(sumAmounts(paye || [], "gross_pay"));
    };
    load();
  }, []);

  const filtered = filterByDateRange(filterByPeriod(allTxns, activePeriod), range, "date");
  const approved = filtered.filter((t) => t.status === "completed");
  const pending = filtered.filter((t) => t.status === "pending");

  const revenue = sumAmounts(approved.filter((t) => t.type === "inflow"), "amount");
  const expenses = sumAmounts(approved.filter((t) => t.type === "outflow"), "amount");
  const pendingRevenue = sumAmounts(pending.filter((t) => t.type === "inflow"), "amount");
  const pendingExpenses = sumAmounts(pending.filter((t) => t.type === "outflow"), "amount");
  const profit = revenue - expenses;

  const filteredInvs = filterByDateRange(filterByPeriod(allInvs, activePeriod), range, "created_at");
  const pendingInv = filteredInvs.filter((i) => i.status === "pending").length;
  const overdueInv = filteredInvs.filter((i) => i.status === "overdue").length;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" subtitle="Financial overview for your business">
        <PeriodSelector value={activePeriod} onChange={setActivePeriod} />
        <DateRangePicker value={range} onChange={setRange} />
      </PageHeader>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Approved Revenue" value={formatGBP(revenue)} change={pendingRevenue > 0 ? `${formatGBP(pendingRevenue)} pending` : undefined} changeType="positive" icon={DollarSign} variant="inflow" />
        <StatCard title="Approved Expenses" value={formatGBP(expenses)} change={pendingExpenses > 0 ? `${formatGBP(pendingExpenses)} pending` : undefined} changeType="negative" icon={TrendingDown} variant="outflow" />
        <StatCard title="Net Profit" value={formatGBP(profit)} changeType={profit >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        <StatCard title="Cash Balance" value={formatGBP(profit)} change="Approved only" changeType="neutral" icon={Wallet} />
      </motion.div>

      {(pendingRevenue > 0 || pendingExpenses > 0 || pendingInv > 0) && (
        <div className="glass-card border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Pending Approvals</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingInv > 0 && `${pendingInv} invoice(s) pending. `}
              {pendingRevenue > 0 && `${formatGBP(pendingRevenue)} inflow pending. `}
              {pendingExpenses > 0 && `${formatGBP(pendingExpenses)} outflow pending. `}
              Values above reflect only fully approved records.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashflowChart period={activePeriod} />
        </div>
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-heading text-lg font-semibold text-foreground">Quick Stats</h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> Pending Invoices</div>
                <span className="font-heading font-semibold text-warning">{pendingInv}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Overdue Invoices</div>
                <span className="font-heading font-semibold text-outflow">{overdueInv}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" /> VAT Due</div>
                <span className="font-heading font-semibold text-foreground">{formatGBP(vatDue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" /> PAYE This Month</div>
                <span className="font-heading font-semibold text-foreground">{formatGBP(payeMonth)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RecentTransactions />
    </div>
  );
}
