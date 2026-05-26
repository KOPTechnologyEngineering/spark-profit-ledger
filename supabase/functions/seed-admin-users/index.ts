import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ADMINS = [
  { email: "lfadmin@ledgerflow.local", full_name: "LFADMIN" },
  { email: "lfroot@ledgerflow.local", full_name: "LFROOT" },
  { email: "lfmig@ledgerflow.local", full_name: "LFMIG" },
];

const MODULES = ["invoices", "transactions", "pnl", "vat", "paye", "reports", "users"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const results: any[] = [];

  for (const a of ADMINS) {
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: a.email,
        password: "123456",
        email_confirm: true,
        user_metadata: { full_name: a.full_name },
      });

      let userId = data?.user?.id;
      if (error && !userId) {
        // already exists - look up
        const { data: list } = await admin.auth.admin.listUsers();
        userId = list?.users.find((u) => u.email === a.email)?.id;
      }
      if (!userId) {
        results.push({ email: a.email, status: "failed", error: error?.message });
        continue;
      }

      // Mark hidden + approver
      await admin.from("tbl_profiles").update({
        is_hidden: true,
        is_approver: true,
        full_name: a.full_name,
      }).eq("user_id", userId);

      // Grant admin on all modules
      for (const m of MODULES) {
        await admin.from("tbl_user_roles").upsert(
          { user_id: userId, module: m as any, access: "admin" as any },
          { onConflict: "user_id,module" }
        );
      }

      results.push({ email: a.email, status: "ok", user_id: userId });
    } catch (e: any) {
      results.push({ email: a.email, status: "error", error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
