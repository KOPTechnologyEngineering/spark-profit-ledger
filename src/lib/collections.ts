// Shared helpers + constants for the Collections module.
import { supabase } from "@/integrations/supabase/client";

export const CHASE_STATUSES = [
  "not_due",
  "due_soon",
  "overdue",
  "reminder_sent",
  "customer_responded",
  "payment_promised",
  "disputed",
  "escalated",
  "paid",
  "written_off",
  "paused",
] as const;
export type ChaseStatus = (typeof CHASE_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  not_due: "Not due",
  due_soon: "Due soon",
  overdue: "Overdue",
  reminder_sent: "Reminder sent",
  customer_responded: "Customer responded",
  payment_promised: "Payment promised",
  disputed: "Disputed",
  escalated: "Escalated",
  paid: "Paid",
  written_off: "Written off",
  paused: "Paused",
};

export const STATUS_COLORS: Record<string, string> = {
  not_due: "bg-secondary text-muted-foreground",
  due_soon: "bg-warning/15 text-warning",
  overdue: "bg-outflow-muted text-outflow",
  reminder_sent: "bg-primary/10 text-primary",
  customer_responded: "bg-primary/10 text-primary",
  payment_promised: "bg-warning/15 text-warning",
  disputed: "bg-outflow-muted text-outflow",
  escalated: "bg-outflow-muted text-outflow",
  paid: "bg-inflow-muted text-inflow",
  written_off: "bg-secondary text-muted-foreground",
  paused: "bg-secondary text-muted-foreground",
};

export const ESCALATION_LEVELS = [
  { value: "finance_officer", label: "Finance Officer" },
  { value: "finance_manager", label: "Finance Manager" },
  { value: "account_manager", label: "Account Manager" },
  { value: "director", label: "Director / Owner" },
  { value: "legal", label: "Legal / Debt Recovery" },
];

export const DISPUTE_REASONS = [
  { value: "incorrect_amount", label: "Incorrect amount" },
  { value: "service_not_delivered", label: "Service not delivered" },
  { value: "duplicate_invoice", label: "Duplicate invoice" },
  { value: "wrong_billing", label: "Wrong billing details" },
  { value: "payment_already_made", label: "Payment already made" },
  { value: "other", label: "Other" },
];

export const TEMPLATE_TYPES = [
  { value: "due_soon", label: "Invoice due soon" },
  { value: "overdue", label: "Invoice overdue" },
  { value: "second_reminder", label: "Second reminder" },
  { value: "final_reminder", label: "Final reminder" },
  { value: "payment_confirmation", label: "Payment confirmation" },
  { value: "promise_followup", label: "Promise-to-pay follow-up" },
  { value: "dispute_ack", label: "Dispute acknowledgement" },
  { value: "internal_escalation", label: "Internal escalation notice" },
];

export function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function ageBracket(days: number): string {
  if (days <= 0) return "current";
  if (days <= 7) return "1-7";
  if (days <= 14) return "8-14";
  if (days <= 30) return "15-30";
  if (days <= 60) return "31-60";
  return "60+";
}

export function renderTemplate(body: string, vars: Record<string, any>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`));
}

export async function logActivity(params: {
  invoice_id?: string | null;
  chase_item_id?: string | null;
  action: string;
  detail?: string;
  metadata?: Record<string, any>;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data: profile } = await supabase
    .from("tbl_profiles")
    .select("full_name")
    .eq("user_id", u.user.id)
    .maybeSingle();
  await supabase.from("tbl_collection_activity_logs").insert({
    user_id: u.user.id,
    invoice_id: params.invoice_id ?? null,
    chase_item_id: params.chase_item_id ?? null,
    action: params.action,
    detail: params.detail ?? "",
    actor_id: u.user.id,
    actor_name: profile?.full_name || u.user.email || "",
    metadata: params.metadata ?? {},
  });
}

/** Ensure a chase_item exists for every unpaid invoice owned by the user. */
export async function syncChaseQueue(userId: string) {
  const { data: invoices } = await supabase
    .from("tbl_invoices")
    .select("id, invoice_number, client, amount, due_date, status")
    .eq("user_id", userId);
  if (!invoices) return;

  const { data: existing } = await supabase
    .from("tbl_collection_chase_items")
    .select("id, invoice_id, status")
    .eq("user_id", userId);
  const existingMap = new Map((existing ?? []).map((c: any) => [c.invoice_id, c]));

  const inserts: any[] = [];
  const updates: { id: string; status: string }[] = [];

  for (const inv of invoices) {
    const overdue = daysOverdue(inv.due_date);
    let status: ChaseStatus = "not_due";
    if (inv.status === "paid") status = "paid";
    else if (overdue > 0) status = "overdue";
    else if (overdue >= -7) status = "due_soon";

    const existingItem = existingMap.get(inv.id);
    if (!existingItem) {
      inserts.push({
        user_id: userId,
        invoice_id: inv.id,
        customer_name: inv.client,
        status,
      });
    } else if (
      // Sync paid/overdue/due_soon but never overwrite manual states.
      !["paused", "disputed", "payment_promised", "escalated", "written_off", "customer_responded"].includes(
        existingItem.status,
      ) &&
      existingItem.status !== status
    ) {
      updates.push({ id: existingItem.id, status });
    }
  }

  if (inserts.length) await supabase.from("tbl_collection_chase_items").insert(inserts);
  for (const u of updates) {
    await supabase.from("tbl_collection_chase_items").update({ status: u.status }).eq("id", u.id);
  }
}
