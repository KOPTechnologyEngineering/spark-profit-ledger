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

  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error } = await supabase
    .from("tbl_recurring_transactions")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_date", today);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let created = 0;
  for (const r of due ?? []) {
    let runDate: string = r.next_run_date;
    // Generate one transaction per missed occurrence up to today
    while (runDate <= today && (!r.end_date || runDate <= r.end_date)) {
      const { error: insErr } = await supabase
        .from("tbl_transactions")
        .upsert(
          {
            user_id: r.user_id,
            description: r.description,
            amount: r.amount,
            type: r.type,
            category: r.category,
            status: "completed",
            date: runDate,
            created_by_name: r.created_by_name || "Recurring",
            recurring_transaction_id: r.id,
          },
          { onConflict: "recurring_transaction_id,date", ignoreDuplicates: true },
        );
      if (insErr) {
        console.error("insert failed", insErr);
        break;
      }
      created++;
      const next = advance(runDate, r.frequency);
      if (next === runDate) break;
      runDate = next;
    }

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

  return new Response(JSON.stringify({ processed: due?.length ?? 0, created }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
