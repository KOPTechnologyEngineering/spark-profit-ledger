import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DISPUTE_REASONS, logActivity } from "@/lib/collections";
import { friendlyErrorMessage } from "@/lib/errors";

const STATUSES = ["open", "under_review", "awaiting_customer", "resolved", "rejected", "cancelled"];

export default function Disputes() {
  const { hasEdit } = useUserRoles();
  const canEdit = hasEdit("invoices");
  const [list, setList] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    const { data, error } = await supabase.from("tbl_collection_disputes").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error(friendlyErrorMessage(error, "Couldn't load disputes. Please try again."));
      return;
    }
    setList(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (form: any) => {
    await supabase
      .from("tbl_collection_disputes")
      .update({ status: form.status, reason: form.reason, description: form.description, internal_notes: form.internal_notes })
      .eq("id", editing.id);
    // If resolved/rejected/cancelled, resume chasing
    if (["resolved", "rejected", "cancelled"].includes(form.status) && editing.chase_item_id) {
      await supabase.from("tbl_collection_chase_items").update({ status: "overdue" }).eq("id", editing.chase_item_id);
    }
    await logActivity({ invoice_id: editing.invoice_id, action: "dispute_updated", detail: form.status });
    toast.success("Dispute updated");
    setEditing(null);
    load();
  };

  const filtered = list.filter((d) => filter === "all" || d.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-lg bg-secondary p-1 flex-wrap">
        {["all", ...STATUSES].map((s) => (
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

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.length === 0 && (
          <div className="glass-card p-6 col-span-full text-center text-sm text-muted-foreground">
            No disputes.
          </div>
        )}
        {filtered.map((d) => (
          <div key={d.id} className="glass-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-foreground">{d.customer_name}</h3>
                <p className="text-xs text-muted-foreground">
                  {DISPUTE_REASONS.find((r) => r.value === d.reason)?.label || d.reason}
                </p>
              </div>
              <span className="rounded bg-secondary px-2 py-0.5 text-xs capitalize">{d.status.replace("_", " ")}</span>
            </div>
            {d.description && <p className="text-xs text-foreground">{d.description}</p>}
            <p className="text-xs text-muted-foreground">Raised {new Date(d.created_at).toLocaleDateString()}</p>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditing(d)}>
                Update
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Dispute</DialogTitle>
          </DialogHeader>
          {editing && <DisputeForm row={editing} onSave={update} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DisputeForm({ row, onSave }: { row: any; onSave: (f: any) => void }) {
  const [form, setForm] = useState({
    status: row.status,
    reason: row.reason,
    description: row.description,
    internal_notes: row.internal_notes || "",
  });
  return (
    <div className="space-y-3">
      <div>
        <Label>Reason</Label>
        <select
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {DISPUTE_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <Label>Status</Label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Internal notes</Label>
        <Textarea rows={3} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
      </div>
      <Button onClick={() => onSave(form)} className="w-full">
        Save
      </Button>
    </div>
  );
}
