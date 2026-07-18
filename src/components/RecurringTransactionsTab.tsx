import { useEffect, useState } from "react";
import { Pencil, Trash2, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import RecurringTransactionDialog from "@/components/RecurringTransactionDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatGBP } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from "@/hooks/useUserRoles";

export default function RecurringTransactionsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const { toast } = useToast();
  const { hasEdit, hasAdmin } = useUserRoles();
  const canEdit = hasEdit("transactions");
  const canDelete = hasAdmin("transactions");

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tbl_recurring_transactions")
      .select("*")
      .order("next_run_date", { ascending: true });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

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
