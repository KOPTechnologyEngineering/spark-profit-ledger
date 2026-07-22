import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// One-off admin utility: copies RECURRING_CRON_SECRET from the edge-function
// environment into the pgvault so pg_cron can read it and call
// process-recurring-transactions with the matching header. The secret value
// itself is never returned in the response.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: role } = await supabase
    .from("tbl_user_roles").select("access")
    .eq("user_id", userData.user.id).eq("module", "users").eq("access", "admin").maybeSingle();
  if (!role) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const secret = Deno.env.get("RECURRING_CRON_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "RECURRING_CRON_SECRET not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existing } = await supabase.schema("vault" as any)
    .from("secrets").select("id").eq("name", "recurring_cron_secret").maybeSingle();

  let sql: string;
  if (existing?.id) {
    sql = `select vault.update_secret('${existing.id}'::uuid, $1, 'recurring_cron_secret')`;
  } else {
    sql = `select vault.create_secret($1, 'recurring_cron_secret')`;
  }

  // Use raw postgres via rpc isn't available; instead call a helper we'll create.
  const { error } = await supabase.rpc("set_recurring_cron_secret", { _value: secret });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
