import { useEffect, useState } from "react";
import { Search, Eye, Mail, Pause, Play, AlertTriangle, MessageSquare, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";
import {
  CHASE_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  daysOverdue,
  syncChaseQueue,
  logActivity,
  renderTemplate,
} from "@/lib/collections";
import ChaseDetailDialog from "@/components/collections/ChaseDetailDialog";

export default function ChaseQueue() {
  const { user } = useAuth();
  const { hasEdit } = useUserRoles();
  const canEdit = hasEdit("invoices");
  const [items, setItems] = useState<any[]>([]);
  const [invMap, setInvMap] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    await syncChaseQueue(user.id);
    const [items, invs, templates] = await Promise.all([
      supabase.from("tbl_collection_chase_items").select("*").order("created_at", { ascending: false }),
      supabase.from("tbl_invoices").select("id, invoice_number, client, amount, due_date, status, notes"),
      supabase.from("tbl_collection_email_templates").select("*").eq("type", "overdue").eq("is_active", true).limit(1),
    ]);
    const firstError = items.error || invs.error || templates.error;
    if (firstError) {
      toast.error(friendlyErrorMessage(firstError, "Couldn't load the chase queue. Please try again."));
      setLoading(false);
      return;
    }
    setItems(items.data || []);
    const map: Record<string, any> = {};
    (invs.data || []).forEach((i) => (map[i.id] = i));
    setInvMap(map);
    (window as any).__defaultTemplate = templates.data?.[0];
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const sendReminder = async (item: any) => {
    if (!canEdit) return toast.error("You don't have permission");
    const inv = invMap[item.invoice_id];
    if (!inv) return toast.error("Invoice not found");
    const recipient = item.customer_email || "";
    if (!recipient) return toast.error("No recipient email on file");
    if (!confirm(`Send reminder email now to ${recipient}?`)) return;

    const tpl = (window as any).__defaultTemplate;
    const dOver = Math.max(0, daysOverdue(inv.due_date));
    const vars = {
      customer_name: inv.client,
      invoice_number: inv.invoice_number,
      invoice_amount: `£${Number(inv.amount).toLocaleString()}`,
      due_date: inv.due_date,
      days_overdue: String(dOver),
      payment_link: "",
      company_name: "KOP Ledger",
      account_manager_name: "",
    };
    const subject = tpl ? renderTemplate(tpl.subject, vars) : `Reminder: Invoice ${inv.invoice_number} is overdue`;
    const body = tpl
      ? renderTemplate(tpl.body, vars)
      : `This is a reminder that invoice ${inv.invoice_number} for £${inv.amount} is overdue by ${dOver} day(s).\n\nPlease arrange payment at your earliest convenience.`;

    const messageId = `chase-reminder-${item.id}-${Date.now()}`;

    // 1. Insert reminder as queued
    const { data: inserted, error: insertErr } = await supabase
      .from("tbl_collection_reminders")
      .insert({
        user_id: user!.id,
        chase_item_id: item.id,
        invoice_id: item.invoice_id,
        template_id: tpl?.id ?? null,
        recipient_email: recipient,
        subject,
        body,
        status: "queued",
        message_id: messageId,
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      toast.error("Failed to queue reminder");
      return;
    }

    // 2. Bump chase item counters
    await supabase
      .from("tbl_collection_chase_items")
      .update({
        last_reminder_at: new Date().toISOString(),
        reminders_sent: (item.reminders_sent ?? 0) + 1,
        status: "reminder_sent",
      })
      .eq("id", item.id);

    await logActivity({
      invoice_id: item.invoice_id,
      chase_item_id: item.id,
      action: "reminder_queued",
      detail: subject,
      metadata: { message_id: messageId, recipient },
    });
    toast.message(`Reminder queued for ${recipient}`);
    load();

    // 3. Invoke the edge function for real delivery
    try {
      const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "chase-reminder",
          recipientEmail: recipient,
          chaseItemId: item.id,
          idempotencyKey: messageId,
          templateData: {
            subject,
            bodyText: body,
            customerName: inv.client,
            invoiceNumber: inv.invoice_number,
            invoiceAmount: vars.invoice_amount,
            daysOverdue: dOver,
          },
        },
      });

      if (sendErr) throw sendErr;

      await supabase
        .from("tbl_collection_reminders")
        .update({ status: "sent", delivered_at: new Date().toISOString() })
        .eq("id", inserted.id);
      await logActivity({
        invoice_id: item.invoice_id,
        chase_item_id: item.id,
        action: "reminder_sent",
        detail: subject,
        metadata: { message_id: messageId, recipient },
      });
      toast.success(`Reminder sent to ${recipient}`);
    } catch (err: any) {
      const msg = friendlyErrorMessage(err, "Sending failed. Please try again.");
      await supabase
        .from("tbl_collection_reminders")
        .update({ status: "failed", failed_at: new Date().toISOString(), error: msg })
        .eq("id", inserted.id);
      await logActivity({
        invoice_id: item.invoice_id,
        chase_item_id: item.id,
        action: "reminder_failed",
        detail: subject,
        metadata: { message_id: messageId, error: msg },
      });
      toast.error(`Reminder failed: ${msg}`);
    } finally {
      load();
    }
  };


  const pauseResume = async (item: any) => {
    if (!canEdit) return;
    const next = item.status === "paused" ? "overdue" : "paused";
    await supabase.from("tbl_collection_chase_items").update({ status: next }).eq("id", item.id);
    await logActivity({
      invoice_id: item.invoice_id,
      chase_item_id: item.id,
      action: next === "paused" ? "chase_paused" : "chase_resumed",
    });
    toast.success(next === "paused" ? "Chasing paused" : "Chasing resumed");
    load();
  };

  const escalate = async (item: any) => {
    if (!canEdit) return;
    if (!confirm("Escalate this invoice?")) return;
    const inv = invMap[item.invoice_id];
    if (!inv) return;
    await supabase.from("tbl_collection_escalations").insert({
      user_id: user!.id,
      invoice_id: item.invoice_id,
      chase_item_id: item.id,
      customer_name: inv.client,
      amount: inv.amount,
      days_overdue: Math.max(0, daysOverdue(inv.due_date)),
      level: "finance_manager",
      reason: "Manual escalation from chase queue",
      status: "open",
    });
    await supabase.from("tbl_collection_chase_items").update({ status: "escalated" }).eq("id", item.id);
    await logActivity({ invoice_id: item.invoice_id, chase_item_id: item.id, action: "invoice_escalated" });
    toast.success("Escalated");
    load();
  };

  const generateDemo = async () => {
    if (!user || !canEdit) return toast.error("You don't have permission");
    if (!confirm("Create 3 demo overdue invoices and seed chase items + timeline activity?")) return;

    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const mkDue = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return iso(d);
    };
    const stamp = Date.now().toString().slice(-5);
    const demos = [
      { client: "Acme Trading Ltd", email: "ap@acme-demo.test", amount: 1250, daysAgo: 5 },
      { client: "Northwind Supplies", email: "billing@northwind-demo.test", amount: 3480, daysAgo: 18 },
      { client: "Globex Manufacturing", email: "finance@globex-demo.test", amount: 6720, daysAgo: 42 },
    ];

    const invoiceRows = demos.map((d, i) => ({
      user_id: user.id,
      invoice_number: `DEMO-${stamp}-${i + 1}`,
      client: d.client,
      amount: d.amount,
      issue_date: iso(new Date(today.getTime() - (d.daysAgo + 30) * 86400000)),
      due_date: mkDue(d.daysAgo),
      status: "sent",
      items: [{ description: "Demo line item", qty: 1, unit_price: d.amount }],
      notes: "Auto-generated demo invoice",
    }));

    const { data: inserted, error: invErr } = await supabase
      .from("tbl_invoices")
      .insert(invoiceRows)
      .select();
    if (invErr || !inserted) {
      toast.error("Failed to create demo invoices");
      return;
    }

    const chaseRows = inserted.map((inv, i) => ({
      user_id: user.id,
      invoice_id: inv.id,
      customer_name: inv.client,
      customer_email: demos[i].email,
      status: "overdue",
    }));
    const { data: chases } = await supabase
      .from("tbl_collection_chase_items")
      .insert(chaseRows)
      .select();

    // Seed timeline activity + a queued reminder on the most overdue one
    if (chases && chases.length) {
      for (const c of chases) {
        await logActivity({
          invoice_id: c.invoice_id,
          chase_item_id: c.id,
          action: "chase_created",
          detail: "Demo chase generated",
        });
      }
      const latest = chases[chases.length - 1];
      const latestInv = inserted[chases.length - 1];
      const messageId = `demo-reminder-${latest.id}`;
      await supabase.from("tbl_collection_reminders").insert({
        user_id: user.id,
        chase_item_id: latest.id,
        invoice_id: latest.invoice_id,
        recipient_email: demos[demos.length - 1].email,
        subject: `Reminder: Invoice ${latestInv.invoice_number} is overdue`,
        body: "Demo reminder body — your invoice is past due.",
        status: "queued",
        message_id: messageId,
      });
      await logActivity({
        invoice_id: latest.invoice_id,
        chase_item_id: latest.id,
        action: "reminder_queued",
        detail: "Demo reminder queued",
        metadata: { message_id: messageId },
      });
    }

    toast.success(`Created ${inserted.length} demo chases`);
    load();
  };

  const filtered = items.filter((it) => {
    const inv = invMap[it.invoice_id];
    if (!inv) return false;
    if (statusFilter !== "all" && it.status !== statusFilter) return false;
    if (search && !inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) && !inv.client?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice or customer..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-secondary px-3 py-2 text-sm text-foreground outline-none"
        >
          <option value="all">All statuses</option>
          {CHASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={generateDemo} title="Create demo overdue invoices + chase items">
            <Sparkles className="h-4 w-4 mr-1.5" />
            Generate demo
          </Button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 hidden md:table-cell">Amount</th>
                <th className="px-4 py-3 hidden lg:table-cell">Due</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 sticky right-0 bg-card">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No invoices in queue. Create an invoice to start chasing.
                  </td>
                </tr>
              )}
              {filtered.map((it) => {
                const inv = invMap[it.invoice_id];
                const dOver = daysOverdue(inv.due_date);
                return (
                  <tr key={it.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-3 font-medium text-foreground">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-foreground">{inv.client}</td>
                    <td className="px-4 py-3 hidden md:table-cell">£{Number(inv.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{inv.due_date}</td>
                    <td className={`px-4 py-3 ${dOver > 0 ? "text-outflow font-medium" : "text-muted-foreground"}`}>
                      {dOver > 0 ? `+${dOver}` : dOver}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[it.status] || "bg-secondary"}`}>
                        {STATUS_LABELS[it.status] || it.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 sticky right-0 bg-card">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setSelected({ item: it, invoice: inv })}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit && it.status !== "paid" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => sendReminder(it)} title="Send reminder">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => pauseResume(it)} title={it.status === "paused" ? "Resume" : "Pause"}>
                              {it.status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => escalate(it)} title="Escalate">
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ChaseDetailDialog
          item={selected.item}
          invoice={selected.invoice}
          open={!!selected}
          onClose={() => setSelected(null)}
          onChange={load}
        />
      )}
    </div>
  );
}
