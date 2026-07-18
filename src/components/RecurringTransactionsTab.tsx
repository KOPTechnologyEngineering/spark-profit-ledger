import { useEffect, useState } from "react";
import { Pencil, Trash2, Pause, Play, RefreshCw, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import RecurringTransactionDialog from "@/components/RecurringTransactionDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatGBP } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from "@/hooks/useUserRoles";

type RunLog = {
  id: string;
  run_at: string;
  triggered_by: string;
  processed: number;
  created: number;
  error: string | null;
};

export default function RecurringTransactionsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [lastRun, setLastRun] = useState<RunLog | null>(null);
  const [triggering, setTriggering] = useState(false);
  const { toast } = useToast();
  const { hasEdit, hasAdmin } = useUserRoles();
  const canEdit = hasEdit("transactions");
  const canDelete = hasAdmin("transactions");
  const canRun = hasAdmin("transactions");

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tbl_recurring_transactions")
      .select("*")
      .order("next_run_date", { ascending: true });
    setItems(data || []);
    setLoading(false);
  };

  const fetchLastRun = async () => {
    const { data } = await supabase
      .from("tbl_recurring_run_log")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastRun((data as RunLog) || null);
  };

  const fetchOrgs = async () => {
    const { data } = await supabase.from("tbl_organizations").select("id, name").is("deleted_at", null);
    const m: Record<string, string> = {};
    (data || []).forEach((o: any) => { m[o.id] = o.name; });
    setOrgMap(m);
  };

  useEffect(() => { fetchItems(); fetchOrgs(); if (canRun) fetchLastRun(); }, [canRun]);

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
      await Promise.all([fetchItems(), fetchLastRun()]);
    } catch (err: any) {
      toast({ title: "Run failed", description: err.message, variant: "destructive" });
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
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchItems();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this recurring transaction?")) return;
    const { error } = await supabase.from("tbl_recurring_transactions").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchItems();
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
            <Button variant="ghost" size="sm" onClick={fetchLastRun} disabled={triggering}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={runNow} disabled={triggering}>
              <PlayCircle className="h-4 w-4 mr-1" /> {triggering ? "Running..." : "Run now"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        {canEdit && <RecurringTransactionDialog onSaved={fetchItems} />}
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
        onSaved={fetchItems}
      />
    </div>
  );
}
