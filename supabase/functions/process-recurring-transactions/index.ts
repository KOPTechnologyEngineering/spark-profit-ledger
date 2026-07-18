import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function advance(date: string, frequency: string): string {
  const d = new Date(date + "T00:00:00Z");
  switch (frequency) {
    case "daily": d.setUTCDate(d.getUTCDate() + 1); break;
    case "weekly": d.setUTCDate(d.getUTCDate() + 7); break;
    case "monthly": d.setUTCMonth(d.getUTCMonth() + 1); break;
    case "quarterly": d.setUTCMonth(d.getUTCMonth() + 3); break;
    case "yearly": d.setUTCFullYear(d.getUTCFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // AuthZ: this function has verify_jwt=false (so it can run as a scheduled/
  // cron job in future without a user session), so without an explicit check
  // any anonymous caller who finds the URL could trigger it repeatedly,
  // creating duplicate transactions. Today the only real caller is the
  // "Run Now" button in RecurringTransactionsTab.tsx, gated client-side on
  // hasAdmin("transactions") — accept either that (a real user session with
  // the transactions-admin role) or the service-role key (for a future
  // server-to-server/cron trigger, e.g. via pg_cron's net.http_post, which
  // presents the service key rather than a user session).
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (token !== serviceRoleKey) {
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
      .eq("module", "transactions")
      .eq("access", "admin")
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

  const today = new Date().toISOString().slice(0, 10);
  let processed = 0;
  let created = 0;
  let errorMessage: string | null = null;
  const perSchedule = new Map<string, number>();

  try {
    const { data: due, error } = await supabase
      .from("tbl_recurring_transactions")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (error) throw error;
    processed = due?.length ?? 0;

    for (const r of due ?? []) {
      let scheduleCreated = 0;
      perSchedule.set(r.id, 0);
      let runDate: string = r.next_run_date;
      while (runDate <= today && (!r.end_date || runDate <= r.end_date)) {
        const { data: existing, error: lookupErr } = await supabase
          .from("tbl_transactions")
          .select("id")
          .eq("recurring_transaction_id", r.id)
          .eq("date", runDate)
          .maybeSingle();

        // If the lookup itself failed, don't fall through to "not found" --
        // that would insert a duplicate transaction on a merely transient
        // DB error instead of skipping this run and retrying next time.
        if (lookupErr) throw lookupErr;

        if (!existing) {
          const { error: insErr } = await supabase.from("tbl_transactions").insert({
            user_id: r.user_id,
            description: r.description,
            amount: r.amount,
            type: r.type,
            category: r.category,
            status: "completed",
            date: runDate,
            created_by_name: r.created_by_name || "Recurring",
            recurring_transaction_id: r.id,
            organization_id: r.organization_id ?? null,
          });
          if (insErr) throw insErr;
          created++;
          scheduleCreated++;
        }

        const next = advance(runDate, r.frequency);
        if (next === runDate) break;
        runDate = next;
      }

      perSchedule.set(r.id, (perSchedule.get(r.id) ?? 0) + scheduleCreated);

      const shouldDeactivate = r.end_date && runDate > r.end_date;
      await supabase
        .from("tbl_recurring_transactions")
        .update({
          next_run_date: runDate,
          last_run_date: today,
          is_active: shouldDeactivate ? false : r.is_active,
        })
        .eq("id", r.id);
    }
  } catch (e: any) {
    errorMessage = e?.message || String(e);
    console.error("process-recurring-transactions failed", e);
  }

  const { data: logRow } = await supabase
    .from("tbl_recurring_run_log")
    .insert({
      triggered_by: triggeredBy,
      processed,
      created,
      error: errorMessage,
    })
    .select("id")
    .single();

  if (logRow?.id && perSchedule.size > 0) {
    const details = [];
    for (const [recId, count] of perSchedule.entries()) {
      details.push({
        run_log_id: logRow.id,
        recurring_transaction_id: recId,
        created_count: count,
      });
    }
    const { error: detailsErr } = await supabase
      .from("tbl_recurring_run_details")
      .insert(details);
    if (detailsErr) {
      console.error("Failed to insert recurring run details", detailsErr);
    }
  }

  return new Response(
    JSON.stringify({ processed, created, error: errorMessage }),
    {
      status: errorMessage ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
