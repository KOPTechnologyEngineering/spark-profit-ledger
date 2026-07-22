import { supabase } from "@/integrations/supabase/client";

const SHORT_URL_TTL_SECONDS = 300; // 5 minutes

/**
 * Extract the object path from a stored signature_url value.
 * Supports both new format (raw object path like "<uid>/signature.png") and
 * the legacy format (full signed URL that embeds "/storage/v1/object/sign/signatures/<path>?token=...").
 */
export function extractSignaturePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const marker = "/storage/v1/object/sign/signatures/";
  const idx = v.indexOf(marker);
  if (idx >= 0) {
    const rest = v.slice(idx + marker.length);
    const qIdx = rest.indexOf("?");
    return decodeURIComponent(qIdx >= 0 ? rest.slice(0, qIdx) : rest);
  }
  // Any other absolute URL is treated as opaque and cannot be re-signed.
  if (/^https?:\/\//i.test(v)) return null;
  return v;
}

/**
 * Resolve a stored signature_url to a short-lived signed URL suitable for
 * preview or print rendering. Returns empty string when no signature exists
 * or the file is unreachable.
 */
export async function resolveSignatureUrl(value: string | null | undefined): Promise<string> {
  const path = extractSignaturePath(value);
  if (!path) return "";
  const { data, error } = await supabase.storage
    .from("signatures")
    .createSignedUrl(path, SHORT_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}
