import { useEffect, useState } from "react";
import { Pencil, Trash2, Pause, Play, RefreshCw, PlayCircle, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import RecurringTransactionDialog from "@/components/RecurringTransactionDialog";
import RecurringRunHistoryDialog from "@/components/RecurringRunHistoryDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatGBP } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useRecurringTransactionsData, useOrganizationsData, useInvalidateFinancialData } from "@/hooks/useFinancialData";

type RunLog = {
  id: string;
  run_at: string;
  triggered_by: string;
  processed: number;
  created: number;
  error: string | null;
};

export default function RecurringTransactionsTab() {
  const { data: items = [], isLoading: loading } = useRecurringTransactionsData();
  const { data: organizations = [] } = useOrganizationsData();
  const { invalidateRecurringTransactions, invalidateTransactions } = useInvalidateFinancialData();
  const orgMap: Record<string, string> = {};
  organizations.forEach((o) => { orgMap[o.id] = o.name; });
  const [editing, setEditing] = useState<any | null>(null);
  const [lastRun, setLastRun] = useState<RunLog | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { toast } = useToast();
  const { hasEdit, hasAdmin } = useUserRoles();
  const canEdit = hasEdit("transactions");
  const canDelete = hasAdmin("transactions");
  const canRun = hasAdmin("transactions");

  const fetchLastRun = async () => {
    const { data, error } = await supabase
      .from("tbl_recurring_run_log")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      toast({ title: "Couldn't load last run details", description: friendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    setLastRun((data as RunLog) || null);
  };

  useEffect(() => { if (canRun) fetchLastRun(); }, [canRun]);

  const runNow = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-recurring-transactions", {
        body: { triggered_by: "manual" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Recurring processor ran",
        description: `Processed ${data?.processed ?? 0} schedule(s); created ${data?.created ?? 0} transaction(s).`,
      });
      // A run can both advance schedules' next_run_date AND create real
      // transactions -- invalidate both caches so the main Transactions tab
      // (a sibling component that doesn't remount when you switch tabs)
      // reflects new entries immediately instead of only after a refresh.
      invalidateRecurringTransactions();
      invalidateTransactions();
      await fetchLastRun();
    } catch (err: any) {
      toast({ title: "Recurring processor didn't run", description: friendlyErrorMessage(err), variant: "destructive" });
      await fetchLastRun();
    } finally {
      setTriggering(false);
    }
  };

  const toggleActive = async (item: any) => {
    const { error } = await supabase
      .from("tbl_recurring_transactions")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast({ title: "Couldn't update schedule", description: friendlyErrorMessage(error), variant: "destructive" });
    else invalidateRecurringTransactions();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this recurring transaction?")) return;
    const { error } = await supabase.from("tbl_recurring_transactions").delete().eq("id", id);
    if (error) toast({ title: "Couldn't delete recurring transaction", description: friendlyErrorMessage(error), variant: "destructive" });
    else invalidateRecurringTransactions();
  };

  return (
    <div className="space-y-4">
      {canRun && (
        <div className="glass-card flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Recurring processor</p>
            {lastRun ? (
              <p className="text-xs text-muted-foreground">
                Last run: {new Date(lastRun.run_at).toLocaleString()} · {lastRun.triggered_by} · processed {lastRun.processed}, created {lastRun.created}
                {lastRun.error && (
                  <span className="ml-2 text-outflow">· Error: {lastRun.error}</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No runs recorded yet.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4 mr-1" /> History
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchLastRun} disabled={triggering}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={runNow} disabled={triggering}>
              <PlayCircle className="h-4 w-4 mr-1" /> {triggering ? "Running..." : "Run now"}
            </Button>
          </div>
        </div>
      )}
      <RecurringRunHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />

      <div className="flex justify-end">
        {canEdit && <RecurringTransactionDialog onSaved={invalidateRecurringTransactions} />}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No recurring transactions yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="glass-card flex items-center justify-between px-6 py-4 flex-wrap gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{r.description}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {r.frequency} · {r.category} · Next: {r.next_run_date}
                  {r.end_date && ` · Ends: ${r.end_date}`}
                  {r.organization_id && orgMap[r.organization_id] && ` · ${orgMap[r.organization_id]}`}
                  {!r.is_active && " · Paused"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-heading text-sm font-bold ${r.type === "inflow" ? "text-inflow" : "text-outflow"}`}>
                  {r.type === "inflow" ? "+" : "-"}{formatGBP(r.amount)}
                </span>
                {canEdit && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => toggleActive(r)} title={r.is_active ? "Pause" : "Resume"}>
                      {r.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {canDelete && (
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-outflow" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RecurringTransactionDialog
        record={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={invalidateRecurringTransactions}
      />
    </div>
  );
}
