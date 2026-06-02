import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity, STATUS_LABELS, STATUS_COLORS, daysOverdue } from "@/lib/collections";
import { toast } from "sonner";

interface Props {
  item: any;
  invoice: any;
  open: boolean;
  onClose: () => void;
  onChange: () => void;
}

export default function ChaseDetailDialog({ item, invoice, open, onClose, onChange }: Props) {
  const { user } = useAuth();
  const [activity, setActivity] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseAmt, setPromiseAmt] = useState(String(invoice?.amount ?? ""));

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [act, rem] = await Promise.all([
        supabase
          .from("tbl_collection_activity_logs")
          .select("*")
          .eq("invoice_id", item.invoice_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("tbl_collection_reminders")
          .select("*")
          .eq("chase_item_id", item.id)
          .order("created_at", { ascending: false }),
      ]);
      setActivity(act.data || []);
      setReminders(rem.data || []);
    })();
  }, [open, item]);

  const addNote = async () => {
    if (!note.trim()) return;
    await supabase.from("tbl_collection_chase_items").update({ notes: note }).eq("id", item.id);
    await logActivity({ invoice_id: item.invoice_id, chase_item_id: item.id, action: "note_added", detail: note });
    toast.success("Note added");
    setNote("");
    onChange();
  };

  const recordPromise = async () => {
    if (!promiseDate) return toast.error("Pick a date");
    await supabase.from("tbl_collection_payment_promises").insert({
      user_id: user!.id,
      invoice_id: item.invoice_id,
      chase_item_id: item.id,
      customer_name: invoice.client,
      promised_date: promiseDate,
      amount_promised: Number(promiseAmt),
      status: "active",
    });
    await supabase.from("tbl_collection_chase_items").update({ status: "payment_promised" }).eq("id", item.id);
    await logActivity({ invoice_id: item.invoice_id, chase_item_id: item.id, action: "payment_promise_created" });
    toast.success("Promise recorded");
    setPromiseDate("");
    onChange();
    onClose();
  };

  const markDisputed = async () => {
    if (!confirm("Mark this invoice as disputed? Automated chasing will pause.")) return;
    await supabase.from("tbl_collection_disputes").insert({
      user_id: user!.id,
      invoice_id: item.invoice_id,
      chase_item_id: item.id,
      customer_name: invoice.client,
      reason: "other",
      raised_by: user!.id,
      status: "open",
    });
    await supabase.from("tbl_collection_chase_items").update({ status: "disputed" }).eq("id", item.id);
    await logActivity({ invoice_id: item.invoice_id, chase_item_id: item.id, action: "dispute_opened" });
    toast.success("Dispute opened");
    onChange();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {invoice.invoice_number} · {invoice.client}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-medium">£{Number(invoice.amount).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due date</p>
              <p className="font-medium">{invoice.due_date}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days overdue</p>
              <p className="font-medium">{daysOverdue(invoice.due_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLORS[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label>Add note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Internal note..." />
            <Button size="sm" onClick={addNote}>
              Save note
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label>Record payment promise</Label>
            <div className="flex gap-2 flex-wrap">
              <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} className="flex-1 min-w-[150px]" />
              <Input type="number" value={promiseAmt} onChange={(e) => setPromiseAmt(e.target.value)} className="w-32" />
              <Button size="sm" onClick={recordPromise}>
                Record
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <Button size="sm" variant="outline" onClick={markDisputed}>
              Mark as disputed
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="font-medium mb-2">Reminders sent ({reminders.length})</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {reminders.map((r) => {
                const cls =
                  r.status === "sent" || r.status === "delivered"
                    ? "bg-inflow-muted text-inflow"
                    : r.status === "failed" || r.status === "bounced"
                    ? "bg-outflow-muted text-outflow"
                    : "bg-warning/15 text-warning";
                const ts = r.delivered_at || r.failed_at || r.sent_at || r.created_at;
                return (
                  <div key={r.id} className="rounded bg-secondary p-2 text-xs space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium truncate">{r.subject}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 ${cls}`}>{r.status}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span className="truncate">→ {r.recipient_email || "no recipient"}</span>
                      <span className="shrink-0">{new Date(ts).toLocaleString()}</span>
                    </div>
                    {r.error && <div className="text-outflow">{r.error}</div>}
                  </div>
                );
              })}
              {reminders.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="font-medium mb-2">Activity timeline</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activity.map((a) => (
                <div key={a.id} className="text-xs flex justify-between gap-2">
                  <span className="text-foreground truncate">
                    {a.action.replace(/_/g, " ")} {a.detail && `— ${a.detail}`}
                  </span>
                  <span className="text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
              {activity.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
