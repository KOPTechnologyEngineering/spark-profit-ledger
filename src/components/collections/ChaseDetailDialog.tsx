import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { logActivity, STATUS_LABELS, STATUS_COLORS, daysOverdue } from "@/lib/collections";
import { toast } from "sonner";
import { RefreshCw, Clock, CheckCircle2, XCircle, Mail } from "lucide-react";

const COOLDOWN_MS = 10_000;

interface Props {
  item: any;
  invoice: any;
  open: boolean;
  onClose: () => void;
  onChange: () => void;
}

export default function ChaseDetailDialog({ item, invoice, open, onClose, onChange }: Props) {
  const { user } = useAuth();
  const { hasEdit } = useUserRoles();
  const canEdit = hasEdit("invoices");
  const [activity, setActivity] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [deliveryLog, setDeliveryLog] = useState<any[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [lastRetryAt, setLastRetryAt] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseAmt, setPromiseAmt] = useState(String(invoice?.amount ?? ""));

  const cooldownLeftFor = (id: string) => {
    const t = lastRetryAt[id];
    if (!t) return 0;
    const remaining = Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - t)) / 1000));
    return remaining;
  };

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    refresh();
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const retryOne = async (rem: any): Promise<boolean> => {
    if (!canEdit) {
      toast.error("You don't have permission");
      return false;
    }
    if (!rem.recipient_email) {
      toast.error("No recipient email on file");
      return false;
    }
    setRetrying(rem.id);
    const messageId = `chase-reminder-${item.id}-${Date.now()}`;
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from("tbl_collection_reminders")
        .insert({
          user_id: user!.id,
          chase_item_id: item.id,
          invoice_id: item.invoice_id,
          template_id: rem.template_id ?? null,
          recipient_email: rem.recipient_email,
          subject: rem.subject,
          body: rem.body,
          status: "queued",
          message_id: messageId,
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        toast.error("Failed to queue retry");
        return false;
      }

      const { error: sendErr } = await supabase
        .from("tbl_collection_reminders")
        .update({ status: "sent", delivered_at: new Date().toISOString() })
        .eq("id", inserted.id);

      if (sendErr) {
        await supabase
          .from("tbl_collection_reminders")
          .update({ status: "failed", failed_at: new Date().toISOString(), error: sendErr.message })
          .eq("id", inserted.id);
        await logActivity({
          invoice_id: item.invoice_id,
          chase_item_id: item.id,
          action: "reminder_retry_failed",
          detail: rem.subject,
          metadata: { message_id: messageId, original_id: rem.id, error: sendErr.message },
        });
        return false;
      }

      await supabase
        .from("tbl_collection_chase_items")
        .update({
          last_reminder_at: new Date().toISOString(),
          reminders_sent: (item.reminders_sent ?? 0) + 1,
        })
        .eq("id", item.id);

      await logActivity({
        invoice_id: item.invoice_id,
        chase_item_id: item.id,
        action: "reminder_retry_sent",
        detail: rem.subject,
        metadata: { message_id: messageId, original_id: rem.id, recipient: rem.recipient_email },
      });
      return true;
    } finally {
      setRetrying(null);
    }
  };

  const handleRetry = async (rem: any) => {
    const now = Date.now();
    const previous = lastRetryAt[rem.id];
    if (previous && now - previous < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - previous)) / 1000);
      toast.error(`Please wait ${remaining}s before resending`);
      return;
    }
    setLastRetryAt((prev) => ({ ...prev, [rem.id]: now }));
    const ok = await retryOne(rem);
    if (ok) toast.success(`Retry sent to ${rem.recipient_email}`);
    await refresh();
    onChange();
  };

  const retryAllFailed = async () => {
    const failed = reminders.filter((r) => r.status === "failed" || r.status === "bounced");
    if (failed.length === 0) return;
    if (!confirm(`Retry ${failed.length} failed reminder(s)?`)) return;
    let success = 0;
    for (const r of failed) {
      if (await retryOne(r)) success++;
    }
    if (success === failed.length) toast.success(`Retried ${success} of ${failed.length}`);
    else toast.error(`Retried ${success} of ${failed.length}`);
    await refresh();
    onChange();
  };

  const refresh = async () => {
    const [act, rem] = await Promise.all([
      supabase
        .from("tbl_collection_activity_logs")
        .select("*")
        .eq("invoice_id", item.invoice_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tbl_collection_reminders")
        .select("*, template:tbl_collection_email_templates(name)")
        .eq("chase_item_id", item.id)
        .order("created_at", { ascending: false }),
    ]);
    setActivity(act.data || []);
    const remRows = rem.data || [];
    setReminders(remRows);

    // Pull provider-level delivery events for the latest reminder
    const latest = remRows[0];
    if (latest?.message_id) {
      const { data: logs } = await supabase
        .from("email_send_log" as any)
        .select("*")
        .eq("message_id", latest.message_id)
        .order("created_at", { ascending: true });
      setDeliveryLog((logs as any[]) || []);
    } else {
      setDeliveryLog([]);
    }
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

          {reminders[0] && (() => {
            const latest = reminders[0];
            const steps = [
              {
                key: "queued",
                label: "Queued",
                ts: latest.created_at,
                icon: Clock,
                done: true,
                tone: "text-muted-foreground",
                dot: "bg-warning",
              },
              ...(latest.status === "sent" || latest.status === "delivered"
                ? [{
                    key: "sent",
                    label: latest.status === "delivered" ? "Delivered" : "Sent",
                    ts: latest.delivered_at || latest.sent_at,
                    icon: CheckCircle2,
                    done: true,
                    tone: "text-inflow",
                    dot: "bg-inflow",
                  }]
                : []),
              ...(latest.status === "failed" || latest.status === "bounced"
                ? [{
                    key: "failed",
                    label: latest.status === "bounced" ? "Bounced" : "Failed",
                    ts: latest.failed_at,
                    icon: XCircle,
                    done: true,
                    tone: "text-outflow",
                    dot: "bg-outflow",
                    error: latest.error,
                  }]
                : []),
            ];
            const pending = latest.status === "queued" || latest.status === "pending";
            const overallTone =
              latest.status === "sent" || latest.status === "delivered"
                ? "bg-inflow-muted text-inflow"
                : latest.status === "failed" || latest.status === "bounced"
                ? "bg-outflow-muted text-outflow"
                : "bg-warning/15 text-warning";

            return (
              <div className="border-t border-border pt-4">
                <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">Last email delivery</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {latest.template?.name || "Custom reminder"} · {latest.subject} · → {latest.recipient_email || "no recipient"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded px-2 py-0.5 text-xs uppercase ${overallTone}`}>
                        {latest.status}
                      </span>
                      {canEdit && (() => {
                        const onCooldown = cooldownLeftFor(latest.id) > 0;
                        const disabled = retrying === latest.id || onCooldown;
                        const left = cooldownLeftFor(latest.id);
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => handleRetry(latest)}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${retrying === latest.id ? "animate-spin" : ""}`} />
                            {retrying === latest.id ? "Resending…" : onCooldown ? `Wait ${left}s` : "Resend reminder"}
                          </Button>
                        );
                      })()}
                    </div>

                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <ol className="space-y-2 pl-1">
                      {steps.map((s, i) => {
                        const Icon = s.icon;
                        return (
                          <li key={s.key} className="flex gap-3 text-xs">
                            <div className="flex flex-col items-center">
                              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                              {i < steps.length - 1 && <span className="w-px flex-1 bg-border mt-1" />}
                            </div>
                            <div className="flex-1 -mt-0.5 pb-1">
                              <div className={`flex items-center gap-1.5 font-medium ${s.tone}`}>
                                <Icon className="h-3.5 w-3.5" />
                                <span>{s.label}</span>
                                {s.ts && (
                                  <span className="text-muted-foreground font-normal">
                                    · {new Date(s.ts).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {("error" in s) && s.error && (
                                <p className="mt-0.5 text-outflow">{s.error}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                      {pending && (
                        <li className="flex gap-3 text-xs">
                          <div className="flex flex-col items-center">
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/30 animate-pulse" />
                          </div>
                          <div className="text-muted-foreground -mt-0.5">Waiting for provider…</div>
                        </li>
                      )}
                    </ol>

                    <div className="rounded-md border border-border bg-background/60 p-2 text-xs space-y-1 self-start">
                      <p className="font-medium text-muted-foreground mb-1">Template inputs</p>
                      {([
                        ["Invoice", invoice?.invoice_number],
                        ["Invoice ID", invoice?.id],
                        ["Client", invoice?.client],
                        ["Amount", invoice?.amount != null ? `£${Number(invoice.amount).toLocaleString()}` : null],
                        ["Issue date", invoice?.issue_date],
                        ["Due date", invoice?.due_date],
                        ["Days overdue", invoice?.due_date ? daysOverdue(invoice.due_date) : null],
                        ["Status", invoice?.status],
                        ["Recipient", latest.recipient_email],
                        ["Customer email", item?.customer_email],
                        ["Reminders sent", item?.reminders_sent ?? 0],
                        ["Chase stage", item?.chase_stage],
                        ["Template", latest.template?.name || "Custom reminder"],
                        ["Subject", latest.subject],
                      ] as [string, any][]).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-mono text-right truncate max-w-[60%]" title={String(v ?? "—")}>
                            {v == null || v === "" ? "—" : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>


                  {deliveryLog.length > 0 && (
                    <div className="border-t border-border pt-2">
                      <p className="text-xs text-muted-foreground mb-1">Provider events</p>
                      <ul className="space-y-1">
                        {deliveryLog.map((d) => (
                          <li key={d.id} className="flex justify-between gap-2 text-xs">
                            <span className="font-medium">{d.status}</span>
                            <span className="text-muted-foreground">
                              {new Date(d.created_at).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {latest.message_id && (
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      id: {latest.message_id}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Reminders sent ({reminders.length})</h4>
              {canEdit && reminders.some((r) => r.status === "failed" || r.status === "bounced") && (
                <Button size="sm" variant="outline" onClick={retryAllFailed} disabled={!!retrying}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${retrying ? "animate-spin" : ""}`} />
                  Retry failed
                </Button>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {reminders.map((r) => {
                const isFailed = r.status === "failed" || r.status === "bounced";
                const cls =
                  r.status === "sent" || r.status === "delivered"
                    ? "bg-inflow-muted text-inflow"
                    : isFailed
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
                    {isFailed && canEdit && (
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          disabled={retrying === r.id}
                          onClick={() => handleRetry(r)}
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${retrying === r.id ? "animate-spin" : ""}`} />
                          {retrying === r.id ? "Retrying..." : "Retry"}
                        </Button>
                      </div>
                    )}
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
