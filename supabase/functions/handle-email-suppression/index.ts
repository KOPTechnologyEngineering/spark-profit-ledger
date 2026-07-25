import { createClient } from 'npm:@supabase/supabase-js@2'

// Inbound webhook for Brevo transactional email events (bounces, spam
// complaints, unsubscribes). Replaces the former Lovable/Mailgun pipeline,
// which delivered events via @lovable.dev/webhooks-js + LOVABLE_API_KEY.
//
// Brevo does NOT sign its webhooks, so we authenticate with a shared secret
// sent as a custom header (configured on the Brevo webhook). Set the same
// value as the BREVO_WEBHOOK_SECRET edge-function secret and as a custom
// header named X-Webhook-Secret on the webhook in the Brevo dashboard.
const SECRET_HEADER = 'x-webhook-secret'

// Brevo transactional event names → our internal suppression reason.
// Only permanent-failure / complaint / opt-out events suppress; transient
// events (soft_bounce, deferred, error) and informational ones (delivered,
// opened, clicked, request) are acknowledged but never suppress an address.
const SUPPRESSING_EVENTS: Record<string, 'bounce' | 'complaint' | 'unsubscribe'> = {
  hard_bounce: 'bounce',
  invalid_email: 'bounce',
  blocked: 'bounce',
  spam: 'complaint',
  unsubscribed: 'unsubscribe',
}

// Brevo posts a flat JSON object (no envelope). Only the fields we use.
interface BrevoEventPayload {
  event: string
  email: string
  'message-id'?: string
  reason?: string
  tags?: string[]
  sending_ip?: string
}

// Constant-time comparison via SHA-256 digests, so neither the length nor the
// content of the configured secret leaks through comparison timing. Mirrors
// the helper in preview-transactional-email.
async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
  const viewA = new Uint8Array(digestA)
  const viewB = new Uint8Array(digestB)
  let diff = 0
  for (let i = 0; i < viewA.length; i++) diff |= viewA[i] ^ viewB[i]
  return diff === 0
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function redactEmail(email: string): string {
  const [local, domain] = email.split('@')
  return (local?.[0] ?? '') + '***@' + (domain ?? '')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('BREVO_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Authenticate the caller via the shared-secret header (constant-time).
  const presentedSecret = req.headers.get(SECRET_HEADER) ?? ''
  if (!presentedSecret || !(await constantTimeEqual(presentedSecret, webhookSecret))) {
    console.error('Invalid or missing webhook secret')
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  // Parse the Brevo event payload.
  let payload: BrevoEventPayload
  try {
    const parsed = await req.json()
    if (!parsed?.event || !parsed?.email) {
      return jsonResponse({ error: 'Missing required fields: event, email' }, 400)
    }
    payload = parsed as BrevoEventPayload
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const reason = SUPPRESSING_EVENTS[payload.event]

  // Not a suppression-worthy event: acknowledge so Brevo doesn't retry, no-op.
  if (!reason) {
    return jsonResponse({ success: true, ignored: payload.event })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = payload.email.toLowerCase()
  const messageId = payload['message-id'] ?? null
  const metadata = {
    event: payload.event,
    brevo_reason: payload.reason ?? null,
    tags: payload.tags ?? null,
    sending_ip: payload.sending_ip ?? null,
  }

  // 1. Upsert to suppressed_emails (idempotent — safe for retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      { email: normalizedEmail, reason, metadata },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: redactEmail(normalizedEmail),
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // 2. Append a new log entry for the suppression event (never update existing rows)
  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: messageId,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: mapReasonToStatus(reason),
      error_message: mapReasonToMessage(reason),
      metadata,
    })

  if (insertError) {
    // Non-fatal — the suppression was already recorded.
    console.warn('Failed to insert email_send_log', { error: insertError })
  }

  console.log('Suppression processed', {
    email_redacted: redactEmail(normalizedEmail),
    event: payload.event,
    reason,
    has_message_id: !!messageId,
  })

  return jsonResponse({ success: true })
})

function mapReasonToStatus(
  reason: string,
): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    case 'unsubscribe':
      return 'Recipient unsubscribed'
    default:
      return 'Email suppressed'
  }
}
