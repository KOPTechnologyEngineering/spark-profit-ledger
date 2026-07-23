import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Records a login/logout event into tbl_login_audit. verify_jwt is false
// because FAILED logins have no valid session -- the caller is unauthenticated
// at that point. When a valid user token IS present (successful login, or
// logout) we resolve and trust the user_id/email from it; otherwise we record
// the attempt with just the supplied email. A light per-IP flood guard keeps
// the table from being spammed.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const event = body.event === 'logout' ? 'logout' : 'login'
    const status = body.status === 'failed' ? 'failed' : 'success'
    let email = String(body.email || '').trim().toLowerCase()

    const ip = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
      || null
    const userAgent = req.headers.get('user-agent') || null

    // Resolve user_id from a valid session token when present.
    let userId: string | null = null
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (token) {
      const { data } = await admin.auth.getUser(token)
      if (data?.user) {
        userId = data.user.id
        if (!email) email = (data.user.email || '').toLowerCase()
      }
    }

    // Light flood guard: skip if this IP recorded > 40 events in the last minute.
    if (ip) {
      const since = new Date(Date.now() - 60_000).toISOString()
      const { count } = await admin
        .from('tbl_login_audit')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since)
      if ((count ?? 0) > 40) return json({ ok: true, skipped: 'rate_limited' })
    }

    const { error } = await admin.from('tbl_login_audit').insert({
      user_id: userId,
      email,
      event,
      status,
      ip,
      user_agent: userAgent,
    })
    if (error) return json({ ok: false, error: error.message }, 500)

    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500)
  }
})
