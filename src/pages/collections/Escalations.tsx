import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ESCALATION_LEVELS, logActivity } from "@/lib/collections";

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "cancelled"];

export default function Escalations() {
  const { hasEdit } = useUserRoles();
  const canEdit = hasEdit("invoices");
  const [list, setList] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    const { data, error } = await supabase.from("tbl_collection_escalations").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setList(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (form: any) => {
    await supabase
      .from("tbl_collection_escalations")
      .update({ status: form.status, level: form.level, resolution_notes: form.resolution_notes })
      .eq("id", editing.id);
    await logActivity({ invoice_id: editing.invoice_id, action: "escalation_updated", detail: form.status });
    toast.success("Updated");
    setEditing(null);
    load();
  };

  const filtered = list.filter((e) => filter === "all" || e.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-lg bg-secondary p-1 flex-wrap">
        {["all", ...STATUS_OPTIONS].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${
              filter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3 hidden sm:table-cell">Days Overdue</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3 hidden md:table-cell">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No escalations.
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">{e.customer_name}</td>
                  <td className="px-4 py-3">£{Number(e.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-outflow">{e.days_overdue}</td>
                  <td className="px-4 py-3 text-xs">{ESCALATION_LEVELS.find((l) => l.value === e.level)?.label || e.level}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground truncate max-w-xs">{e.reason}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs capitalize">{e.status.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => setEditing(e)}>
                        Update
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Escalation</DialogTitle>
          </DialogHeader>
          {editing && <EscalationForm row={editing} onSave={update} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EscalationForm({ row, onSave }: { row: any; onSave: (f: any) => void }) {
  const [form, setForm] = useState({
    status: row.status,
    level: row.level,
    resolution_notes: row.resolution_notes || "",
  });
  return (
    <div className="space-y-3">
      <div>
        <Label>Level</Label>
        <select
          value={form.level}
          onChange={(e) => setForm({ ...form, level: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {ESCALATION_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Status</Label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Resolution notes</Label>
        <Textarea rows={3} value={form.resolution_notes} onChange={(e) => setForm({ ...form, resolution_notes: e.target.value })} />
      </div>
      <Button onClick={() => onSave(form)} className="w-full">
        Save
      </Button>
    </div>
  );
}
