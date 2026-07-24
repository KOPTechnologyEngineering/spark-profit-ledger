import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Server-side logging for edge functions.
 *
 * `withLogging` wraps a handler and records the request the way a web server
 * access log would (method, path, query, status, time-taken), plus any thrown
 * error with its stack. `logDb` times an individual database call -- the
 * Finacle DBLayer analogue.
 *
 * Writes go straight to tbl_app_log with the service role (no HTTP hop), and
 * respect the configured global log level, cached briefly so we don't hit the
 * settings table on every request.
 */

const LEVELS: Record<string, number> = {
  TRACE: 10, DEBUG: 20, INFO: 30, EVENT: 40, WARN: 50, ERROR: 60, FATAL: 70, OFF: 99,
}

export type EdgeLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'EVENT' | 'WARN' | 'ERROR' | 'FATAL'

export interface EdgeLogEntry {
  level: EdgeLevel
  logger: string
  message: string
  correlation_id?: string | null
  user_id?: string | null
  user_email?: string | null
  http_method?: string | null
  endpoint?: string | null
  query?: string | null
  status_code?: number | null
  duration_ms?: number | null
  request_at?: string | null
  response_at?: string | null
  client_ip?: string | null
  user_agent?: string | null
  error_code?: string | null
  error_detail?: string | null
  context?: Record<string, unknown> | null
}

let _admin: ReturnType<typeof createClient> | null = null
function admin() {
  if (!_admin) {
    _admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  }
  return _admin
}

const LEVEL_TTL_MS = 30_000
let cachedLevel = LEVELS.WARN
let cachedAt = 0

async function effectiveLevel(): Promise<number> {
  const now = Date.now()
  if (now - cachedAt < LEVEL_TTL_MS) return cachedLevel
  try {
    const { data } = await admin()
      .from('tbl_log_settings')
      .select('level, enabled')
      .eq('scope', 'global')
      .maybeSingle()
    const row = data as { level?: string; enabled?: boolean } | null
    cachedLevel = row?.enabled === false ? LEVELS.OFF : (LEVELS[String(row?.level || 'WARN').toUpperCase()] ?? LEVELS.WARN)
    cachedAt = now
  } catch {
    /* keep previous cached level */
  }
  return cachedLevel
}

/** Write one entry. Never throws -- logging must not break the request. */
export async function logEdge(entry: EdgeLogEntry): Promise<void> {
  try {
    const num = LEVELS[entry.level] ?? LEVELS.INFO
    if (num < (await effectiveLevel())) return
    await admin().from('tbl_app_log').insert({
      ts: new Date().toISOString(),
      level: entry.level,
      level_num: num,
      source: 'edge',
      logger: entry.logger,
      message: entry.message,
      correlation_id: entry.correlation_id ?? null,
      user_id: entry.user_id ?? null,
      user_email: entry.user_email ?? null,
      http_method: entry.http_method ?? null,
      endpoint: entry.endpoint ?? null,
      query: entry.query ?? null,
      status_code: entry.status_code ?? null,
      duration_ms: entry.duration_ms ?? null,
      request_at: entry.request_at ?? null,
      response_at: entry.response_at ?? null,
      client_ip: entry.client_ip ?? null,
      user_agent: entry.user_agent ?? null,
      error_code: entry.error_code ?? null,
      error_detail: entry.error_detail ?? null,
      context: entry.context ?? null,
      environment: Deno.env.get('ENVIRONMENT') ?? 'production',
    })
  } catch {
    /* swallow */
  }
}

function ipOf(req: Request): string | null {
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || null
}

/** Wrap a Deno handler so every invocation is logged like an access-log line. */
export function withLogging(
  name: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const startedAt = performance.now()
    const requestAt = new Date().toISOString()
    const url = new URL(req.url)
    const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID()
    const base = {
      logger: name,
      correlation_id: correlationId,
      http_method: req.method,
      endpoint: url.pathname,
      query: url.search ? url.search.slice(1) : null,
      client_ip: ipOf(req),
      user_agent: req.headers.get('user-agent'),
      request_at: requestAt,
    }

    try {
      const res = await handler(req)
      const duration = Math.round(performance.now() - startedAt)
      await logEdge({
        ...base,
        level: res.status >= 500 ? 'ERROR' : res.status >= 400 ? 'WARN' : 'INFO',
        message: `${req.method} ${url.pathname} -> ${res.status}`,
        status_code: res.status,
        duration_ms: duration,
        response_at: new Date().toISOString(),
      })
      return res
    } catch (err) {
      const duration = Math.round(performance.now() - startedAt)
      await logEdge({
        ...base,
        level: 'ERROR',
        message: `${req.method} ${url.pathname} -> unhandled error`,
        status_code: 500,
        duration_ms: duration,
        response_at: new Date().toISOString(),
        error_code: err instanceof Error ? err.name : 'error',
        error_detail: err instanceof Error ? (err.stack ?? err.message) : String(err),
      })
      throw err
    }
  }
}

/** Time a database call and record it at DEBUG (Finacle DBLayer style). */
export async function logDb<T>(
  logger: string,
  operation: string,
  fn: () => Promise<T>,
  meta: Record<string, unknown> = {},
): Promise<T> {
  const startedAt = performance.now()
  try {
    const result = await fn()
    const rows = Array.isArray((result as { data?: unknown })?.data)
      ? ((result as { data: unknown[] }).data).length
      : undefined
    void logEdge({
      level: 'DEBUG',
      logger,
      message: `db ${operation}`,
      duration_ms: Math.round(performance.now() - startedAt),
      context: { operation, rows, ...meta },
    })
    return result
  } catch (err) {
    void logEdge({
      level: 'ERROR',
      logger,
      message: `db ${operation} failed`,
      duration_ms: Math.round(performance.now() - startedAt),
      error_detail: err instanceof Error ? (err.stack ?? err.message) : String(err),
      context: { operation, ...meta },
    })
    throw err
  }
}
