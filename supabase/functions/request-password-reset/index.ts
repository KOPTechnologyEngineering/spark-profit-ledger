import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_LIMIT = 3; // per email per hour
const IP_LIMIT = 10; // per IP per hour
const WINDOW_MINUTES = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, redirectTo } = await req.json();
    if (!email || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Invalid email" }, 400);
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "unknown";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const normalizedEmail = email.trim().toLowerCase();

    const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
      admin
        .from("tbl_password_reset_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", normalizedEmail)
        .gte("attempted_at", since),
      admin
        .from("tbl_password_reset_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("attempted_at", since),
    ]);

    if ((emailCount ?? 0) >= EMAIL_LIMIT || (ipCount ?? 0) >= IP_LIMIT) {
      return json(
        {
          error: "Too many password reset requests. Please try again in an hour.",
        },
        429,
      );
    }

    await admin.from("tbl_password_reset_attempts").insert({ email: normalizedEmail, ip });

    // Always respond success to avoid email enumeration
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || undefined,
    });
    if (error) console.warn("resetPasswordForEmail error:", error.message);

    return json({ ok: true });
  } catch (e) {
    console.error("request-password-reset error", e);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
