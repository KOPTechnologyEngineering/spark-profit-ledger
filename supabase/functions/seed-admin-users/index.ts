import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const users = [
    { email: "lfadmin@koptechnology.co.uk", name: "LFADMIN" },
    { email: "lfroot@koptechnology.co.uk", name: "LFROOT" },
    { email: "lfmig@koptechnology.co.uk", name: "LFMIG" },
  ];

  const results = [];

  for (const u of users) {
    // Check if user already exists
    const { data: existing } = await supabaseAdmin.from("tbl_profiles").select("user_id").eq("email", u.email).maybeSingle();
    if (existing) {
      // Just ensure hidden + admin
      await supabaseAdmin.from("tbl_profiles").update({ is_hidden: true } as any).eq("user_id", existing.user_id);
      results.push({ email: u.email, status: "already exists, marked hidden" });
      continue;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: "123456",
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });

    if (error) {
      results.push({ email: u.email, error: error.message });
      continue;
    }

    // Mark as hidden
    await supabaseAdmin.from("tbl_profiles").update({ is_hidden: true } as any).eq("user_id", data.user.id);

    // Set all modules to admin
    const modules = ["invoices", "transactions", "pnl", "vat", "paye", "reports", "users"];
    for (const mod of modules) {
      await supabaseAdmin.from("tbl_user_roles").update({ access: "admin" }).eq("user_id", data.user.id).eq("module", mod);
    }

    results.push({ email: u.email, status: "created" });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
