/**
 * Client-side structured logger.
 *
 * Buffers entries in memory and flushes them in batches to the `ingest-log`
 * edge function. Two hard rules:
 *
 *  1. It must NEVER throw or block the UI -- logging failures are swallowed.
 *  2. It must NOT import the supabase client. That would create a cycle
 *     (client -> instrumentedFetch -> logger -> client), so it talks to
 *     Supabase over raw fetch and reads the session token from storage.
 *
 * The configured level is resolved server-side too (see ingest-log), so this
 * is an optimisation to avoid shipping entries that would be dropped anyway.
 */

const LEVELS = {
  TRACE: 10, DEBUG: 20, INFO: 30, EVENT: 40, WARN: 50, ERROR: 60, FATAL: 70, OFF: 99,
} as const;

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "EVENT" | "WARN" | "ERROR" | "FATAL";

const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Exported so instrumentedFetch can exclude it and avoid infinite recursion. */
export const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest-log`;
const LEVEL_RPC_URL = `${SUPABASE_URL}/rest/v1/rpc/get_effective_log_level`;

const LEVEL_CACHE_KEY = "kop_log_level";
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_AT = 25;
const MAX_BUFFER = 200;

// Captured up-front; the instrumented fetch is only handed to supabase-js, so
// globalThis.fetch stays clean, but binding here keeps us independent of it.
const rawFetch: typeof fetch = globalThis.fetch.bind(globalThis);

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const sessionId = newId();

export interface LogFields {
  logger?: string;
  source?: "client" | "edge" | "db";
  correlation_id?: string;
  http_method?: string;
  endpoint?: string;
  query?: string;
  status_code?: number | null;
  duration_ms?: number | null;
  cs_bytes?: number | null;
  sc_bytes?: number | null;
  request_at?: string;
  response_at?: string;
  error_code?: string;
  error_detail?: string;
  context?: Record<string, unknown>;
}

function levelNum(name: string | null | undefined): number {
  const key = String(name || "").toUpperCase() as keyof typeof LEVELS;
  return LEVELS[key] ?? LEVELS.WARN;
}

// Start from the cached level so there's no verbose/silent window on boot.
let effectiveLevel: number = (() => {
  try {
    return levelNum(localStorage.getItem(LEVEL_CACHE_KEY));
  } catch {
    return LEVELS.WARN;
  }
})();

let buffer: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

function projectRef(): string {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0];
  } catch {
    return "";
  }
}

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(`sb-${projectRef()}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Push a batch to the ingest endpoint. Fire-and-forget; failures are dropped. */
function flush(): void {
  if (buffer.length === 0) return;
  const entries = buffer.splice(0, buffer.length);
  const payload = JSON.stringify({ entries });

  try {
    const token = getAccessToken();
    // keepalive lets this survive page unload while still allowing the
    // Authorization header (sendBeacon cannot set headers, which would cost
    // us user attribution).
    void rawFetch(INGEST_URL, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload,
    }).catch(() => {
      /* logging must never surface an error */
    });
  } catch {
    try {
      navigator.sendBeacon?.(INGEST_URL, new Blob([payload], { type: "application/json" }));
    } catch {
      /* give up silently */
    }
  }
}

function enqueue(level: LogLevel, message: string, fields: LogFields = {}): void {
  try {
    if (LEVELS[level] < effectiveLevel) return;
    if (buffer.length >= MAX_BUFFER) buffer.shift(); // drop oldest rather than grow unbounded

    buffer.push({
      ts: new Date().toISOString(),
      level,
      source: fields.source ?? "client",
      session_id: sessionId,
      environment: import.meta.env.MODE,
      ...fields,
      message,
    });

    if (buffer.length >= FLUSH_AT) flush();
  } catch {
    /* never throw from logging */
  }
}

export const log = {
  trace: (m: string, f?: LogFields) => enqueue("TRACE", m, f),
  debug: (m: string, f?: LogFields) => enqueue("DEBUG", m, f),
  info: (m: string, f?: LogFields) => enqueue("INFO", m, f),
  event: (m: string, f?: LogFields) => enqueue("EVENT", m, f),
  warn: (m: string, f?: LogFields) => enqueue("WARN", m, f),
  error: (m: string, f?: LogFields) => enqueue("ERROR", m, f),
  fatal: (m: string, f?: LogFields) => enqueue("FATAL", m, f),
};

export const newCorrelationId = newId;
export const getSessionId = () => sessionId;

/** Re-read the configured level (call on load and whenever auth changes). */
export async function refreshLogLevel(): Promise<void> {
  try {
    const token = getAccessToken();
    if (!token) return; // anonymous: keep the cached/default level
    const res = await rawFetch(LEVEL_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: "{}",
    });
    if (!res.ok) return;
    const value = await res.json();
    if (typeof value === "string") {
      effectiveLevel = levelNum(value);
      try {
        localStorage.setItem(LEVEL_CACHE_KEY, value.toUpperCase());
      } catch {
        /* storage may be unavailable */
      }
    }
  } catch {
    /* keep current level */
  }
}

/** Wire up periodic flushing, unload flushing, and global error capture. */
export function initLogging(): void {
  if (started) return;
  started = true;

  timer = setInterval(flush, FLUSH_INTERVAL_MS);

  const flushNow = () => flush();
  window.addEventListener("pagehide", flushNow);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  window.addEventListener("error", (e: ErrorEvent) => {
    log.fatal(e.message || "Uncaught error", {
      logger: "window.onerror",
      error_detail: e.error?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`,
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
    flush();
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    log.error(
      reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection"),
      {
        logger: "unhandledrejection",
        error_detail: reason instanceof Error ? reason.stack : undefined,
      },
    );
    flush();
  });

  void refreshLogLevel();
}

/** Test/teardown helper. */
export function stopLogging(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
