import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { withLogging } from "../_shared/logger.ts";

// Server-side, all-users port of syncChaseQueue() in src/lib/collections.ts.
// That function only reconciles the CURRENTLY LOGGED-IN user's invoices, and
// only runs when someone opens CollectionsDashboard.tsx or ChaseQueue.tsx --
// so an invoice never reaches Collections unless its owner happens to visit
// one of those two pages. This job does the same reconciliation for every
// user on a schedule (see the cron migration), so chase items get created
// and their derived status (due_soon/overdue/paid) stays current regardless
// of whether anyone opens Collections. The client-side syncChaseQueue() call
// is kept as-is for immediate feedback right after creating an invoice --
// this job is the backstop, not a replacement.
//
// Keep the status-derivation rules below in sync with daysOverdue() and the
// inline logic in syncChaseQueue() (src/lib/collections.ts) -- they are
// intentionally duplicated rather than shared across the Deno/browser
// boundary (matching this repo's existing convention, e.g.
// process-recurring-transactions doesn't import frontend code either).

const MANUAL_STATUSES = [
  "paused",
  "disputed",
  "payment_promised",
  "escalated",
  "written_off",
  "customer_responded",
];

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function deriveStatus(invStatus: string, dueDate: string): string {
  const overdue = daysOverdue(dueDate);
  if (invStatus === "paid") return "paid";
  if (overdue > 0) return "overdue";
  if (overdue >= -7) return "due_soon";
  return "not_due";
}

// tbl_invoices.status has its own 'overdue' value (CHECK constraint allows
// paid/pending/overdue/draft/rejected), separate from the chase item's
// derived status above -- but nothing was ever setting it, so it sat
// permanently at 'pending' and every "overdue invoices" count/filter reading
// tbl_invoices.status directly (Dashboard.tsx, Invoices.tsx) was silently
// always empty. Only pending/overdue are ever toggled here: paid, draft, and
// rejected are terminal/not-applicable and must never be touched.
function correctedInvoiceStatus(invStatus: string, dueDate: string): string | null {
  if (invStatus !== "pending" && invStatus !== "overdue") return null;
  const shouldBeOverdue = daysOverdue(dueDate) > 0;
  const correct = shouldBeOverdue ? "overdue" : "pending";
  return invStatus === correct ? null : correct;
}

Deno.serve(withLogging("sync-collections-chase-queue", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Same auth shape as process-recurring-transactions: the pg_cron job calls
  // this with X-Cron-Secret set to the same 'recurring_cron_secret' vault
  // secret already used by that job and by process-email-queue, so no new
  // Supabase secret needs to be provisioned. Also accept the service-role
  // key directly, or a real session with invoices view/admin access (mirrors
  // who can already see the Collections pages client-side).
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const cronSecret = Deno.env.get("RECURRING_CRON_SECRET") || "";
  const cronHeader = req.headers.get("X-Cron-Secret") || "";
  const isCron = !!cronSecret && (cronHeader === cronSecret || token === cronSecret);
  const isServiceRole = !!serviceRoleKey && token === serviceRoleKey;

  if (!isCron && !isServiceRole) {
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: role } = await supabase
      .from("tbl_user_roles")
      .select("access")
      .eq("user_id", userData.user.id)
      .eq("module", "invoices")
      .in("access", ["view", "edit", "admin"])
      .maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let triggeredBy = "cron";
  try {
    const body = await req.json();
    if (body?.triggered_by) triggeredBy = String(body.triggered_by);
  } catch (_) { /* no body */ }

  let processed = 0;
  let created = 0;
  let updated = 0;
  let invoicesCorrected = 0;
  let errorMessage: string | null = null;

  try {
    const { data: invoices, error: invErr } = await supabase
      .from("tbl_invoices")
      .select("id, user_id, client, due_date, status");
    if (invErr) throw invErr;
    processed = invoices?.length ?? 0;

    const invoiceStatusUpdates: { id: string; status: string }[] = [];
    for (const inv of invoices ?? []) {
      const corrected = correctedInvoiceStatus(inv.status, inv.due_date);
      if (corrected) invoiceStatusUpdates.push({ id: inv.id, status: corrected });
    }
    for (const u of invoiceStatusUpdates) {
      const { error: invUpdErr } = await supabase
        .from("tbl_invoices")
        .update({ status: u.status })
        .eq("id", u.id);
      if (invUpdErr) throw invUpdErr;
    }
    invoicesCorrected = invoiceStatusUpdates.length;

    const { data: existing, error: existErr } = await supabase
      .from("tbl_collection_chase_items")
      .select("id, invoice_id, status");
    if (existErr) throw existErr;
    const existingMap = new Map((existing ?? []).map((c: any) => [c.invoice_id, c]));

    const inserts: any[] = [];
    const updates: { id: string; status: string }[] = [];

    for (const inv of invoices ?? []) {
      const status = deriveStatus(inv.status, inv.due_date);
      const item = existingMap.get(inv.id);
      if (!item) {
        inserts.push({
          user_id: inv.user_id,
          invoice_id: inv.id,
          customer_name: inv.client,
          status,
        });
      } else if (!MANUAL_STATUSES.includes(item.status) && item.status !== status) {
        updates.push({ id: item.id, status });
      }
    }

    if (inserts.length) {
      // onConflict guards against a race with a user's own client-side
      // syncChaseQueue() inserting the same invoice_id between our SELECT
      // and this INSERT -- tbl_collection_chase_items.invoice_id is unique.
      const { error: insErr } = await supabase
        .from("tbl_collection_chase_items")
        .upsert(inserts, { onConflict: "invoice_id", ignoreDuplicates: true });
      if (insErr) throw insErr;
      created = inserts.length;
    }

    for (const u of updates) {
      const { error: updErr } = await supabase
        .from("tbl_collection_chase_items")
        .update({ status: u.status })
        .eq("id", u.id);
      if (updErr) throw updErr;
    }
    updated = updates.length;
  } catch (e: any) {
    errorMessage = e?.message || String(e);
    console.error("sync-collections-chase-queue failed", e);
  }

  console.log("sync-collections-chase-queue run", { triggeredBy, processed, created, updated, invoicesCorrected, errorMessage });

  return new Response(
    JSON.stringify({ processed, created, updated, invoicesCorrected, error: errorMessage }),
    {
      status: errorMessage ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}));
