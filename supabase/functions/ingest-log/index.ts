import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Ordered severities -- must mirror public.log_level_num().
const LEVELS: Record<string, number> = {
  TRACE: 10, DEBUG: 20, INFO: 30, EVENT: 40, WARN: 50, ERROR: 60, FATAL: 70, OFF: 99,
}

const MAX_ENTRIES = 100
const MAX_TEXT = 8000
const MAX_CONTEXT_DEPTH = 6
const IP_RATE_LIMIT_PER_MIN = 600 // generous: entries are batched

// Never persist credentials that may ride along in a context payload.
const REDACT_KEYS = [
  'authorization', 'apikey', 'api_key', 'password', 'token', 'access_token',
  'refresh_token', 'secret', 'cookie', 'set-cookie', 'service_role_key',
]

function levelNum(level: unknown): number {
  return LEVELS[String(level || '').toUpperCase()] ?? 30
}

function clamp(v: unknown, max = MAX_TEXT): string | null {
  if (v === null || v === undefined) return null
  const s = typeof v === 'string' ? v : String(v)
  return s.length > max ? s.slice(0, max) : s
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_CONTEXT_DEPTH) return '[truncated]'
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => redact(v, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.includes(k.toLowerCase()) ? '[redacted]' : redact(v, depth + 1)
    }
    return out
  }
  if (typeof value === 'string' && value.length > MAX_TEXT) return value.slice(0, MAX_TEXT)
  return value
}

// Accept a client-supplied timestamp only when it's plausible; otherwise use
// server time. Entries are batched, so the client time is the more accurate
// record of *when* the event happened.
function safeTs(raw: unknown): string {
  const now = Date.now()
  if (typeof raw === 'string') {
    const t = Date.parse(raw)
    if (!Number.isNaN(t) && Math.abs(now - t) < 24 * 60 * 60 * 1000) return new Date(t).toISOString()
  }
  return new Date(now).toISOString()
}

const asInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const body = await req.json().catch(() => null) as { entries?: unknown[] } | null
    const rawEntries = Array.isArray(body?.entries) ? body!.entries! : []
    if (rawEntries.length === 0) return json({ ok: true, accepted: 0 })
    if (rawEntries.length > MAX_ENTRIES) return json({ ok: false, error: 'Too many entries in batch' }, 413)

    const ip = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
      || null
    const userAgent = req.headers.get('user-agent') || null

    // Resolve the caller when a real session token is present.
    let userId: string | null = null
    let userEmail: string | null = null
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (token) {
      const { data } = await admin.auth.getUser(token)
      if (data?.user) {
        userId = data.user.id
        userEmail = (data.user.email || '').toLowerCase() || null
      }
    }

    // Re-resolve the effective level server-side. A tampered client cannot
    // flood the table with TRACE when the configured level is WARN.
    const { data: settings } = await admin
      .from('tbl_log_settings')
      .select('scope, user_id, level, enabled')
      .or(userId ? `scope.eq.global,user_id.eq.${userId}` : 'scope.eq.global')

    const globalRow = (settings || []).find((s: any) => s.scope === 'global')
    const userRow = userId ? (settings || []).find((s: any) => s.scope === 'user' && s.user_id === userId) : null
    const enabled = globalRow?.enabled ?? true
    const effective = enabled ? levelNum(userRow?.level ?? globalRow?.level ?? 'WARN') : LEVELS.OFF

    if (!enabled) return json({ ok: true, accepted: 0, skipped: 'logging_disabled' })

    // Per-IP flood guard.
    if (ip) {
      const since = new Date(Date.now() - 60_000).toISOString()
      const { count } = await admin
        .from('tbl_app_log')
        .select('id', { count: 'exact', head: true })
        .eq('client_ip', ip)
        .gte('ts', since)
      if ((count ?? 0) > IP_RATE_LIMIT_PER_MIN) return json({ ok: true, accepted: 0, skipped: 'rate_limited' })
    }

    const rows = rawEntries
      .map((raw) => {
        const e = (raw ?? {}) as Record<string, unknown>
        const lvl = String(e.level || 'INFO').toUpperCase()
        const num = levelNum(lvl)
        if (num < effective) return null // below configured level -- drop
        return {
          ts: safeTs(e.ts),
          level: lvl,
          level_num: num,
          source: ['client', 'edge', 'db'].includes(String(e.source)) ? String(e.source) : 'client',
          logger: clamp(e.logger, 200),
          message: clamp(e.message) ?? '',
          correlation_id: clamp(e.correlation_id, 100),
          session_id: clamp(e.session_id, 100),
          user_id: userId,
          user_email: userEmail,
          http_method: clamp(e.http_method, 10),
          endpoint: clamp(e.endpoint, 500),
          query: clamp(e.query, 2000),
          status_code: asInt(e.status_code),
          duration_ms: asInt(e.duration_ms),
          cs_bytes: asInt(e.cs_bytes),
          sc_bytes: asInt(e.sc_bytes),
          request_at: e.request_at ? safeTs(e.request_at) : null,
          response_at: e.response_at ? safeTs(e.response_at) : null,
          client_ip: ip,
          user_agent: userAgent,
          error_code: clamp(e.error_code, 100),
          error_detail: clamp(e.error_detail),
          context: e.context ? redact(e.context) : null,
          app_version: clamp(e.app_version, 50),
          environment: clamp(e.environment, 50),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rows.length === 0) return json({ ok: true, accepted: 0, skipped: 'below_level' })

    const { error } = await admin.from('tbl_app_log').insert(rows)
    if (error) return json({ ok: false, error: error.message }, 500)

    return json({ ok: true, accepted: rows.length })
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500)
  }
})
