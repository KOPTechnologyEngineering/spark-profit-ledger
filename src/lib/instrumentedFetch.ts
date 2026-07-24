import { INGEST_URL, log, newCorrelationId } from "./logger";

/**
 * fetch wrapper handed to supabase-js so every PostgREST / auth / storage /
 * function call is captured with IIS-style request fields: method,
 * endpoint (cs-uri-stem), query (cs-uri-query), status (sc-status),
 * duration (time-taken) and byte counts (cs-bytes / sc-bytes).
 *
 * Severity maps so the default WARN level only records problems:
 *   2xx/3xx -> INFO, 4xx -> WARN, 5xx & network failure -> ERROR.
 */

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  const m = init?.method ?? (input instanceof Request ? input.method : undefined) ?? "GET";
  return m.toUpperCase();
}

function splitUrl(raw: string): { endpoint: string; query: string | undefined } {
  try {
    const u = new URL(raw);
    return { endpoint: u.pathname, query: u.search ? u.search.slice(1) : undefined };
  } catch {
    return { endpoint: raw, query: undefined };
  }
}

function bodySize(body: BodyInit | null | undefined): number | null {
  if (body == null) return null;
  if (typeof body === "string") return body.length;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return null;
}

export const instrumentedFetch: typeof fetch = async (input, init) => {
  const url = urlOf(input);

  // Never instrument the ingest endpoint itself: logging a request would
  // generate a request that logs a request -- infinite recursion.
  if (url.startsWith(INGEST_URL)) return fetch(input, init);

  const method = methodOf(input, init);
  const requestAt = new Date().toISOString();
  const startedAt = performance.now();
  const correlationId = newCorrelationId();
  const csBytes = bodySize(init?.body);

  try {
    const res = await fetch(input, init);
    const durationMs = Math.round(performance.now() - startedAt);
    const { endpoint, query } = splitUrl(url);
    const scHeader = res.headers.get("content-length");

    const fields = {
      logger: "api",
      correlation_id: correlationId,
      http_method: method,
      endpoint,
      query,
      status_code: res.status,
      duration_ms: durationMs,
      cs_bytes: csBytes,
      sc_bytes: scHeader ? Number(scHeader) : null,
      request_at: requestAt,
      response_at: new Date().toISOString(),
    };
    const message = `${method} ${endpoint} -> ${res.status}`;

    if (res.status >= 500) log.error(message, fields);
    else if (res.status >= 400) log.warn(message, fields);
    else log.info(message, fields);

    return res;
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt);
    const { endpoint, query } = splitUrl(url);

    log.error(`${method} ${endpoint} -> network error`, {
      logger: "api",
      correlation_id: correlationId,
      http_method: method,
      endpoint,
      query,
      duration_ms: durationMs,
      cs_bytes: csBytes,
      request_at: requestAt,
      response_at: new Date().toISOString(),
      error_code: "network_error",
      error_detail: err instanceof Error ? err.stack ?? err.message : String(err),
    });

    throw err;
  }
};
