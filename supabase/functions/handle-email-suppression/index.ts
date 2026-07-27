import { createClient } from 'npm:@supabase/supabase-js@2'

// Inbound webhook for Mailjet transactional email events (bounces, spam
// complaints, unsubscribes). Replaced the former Brevo-shaped version when
// the send path (process-email-queue) switched ESPs from Brevo to Mailjet.
//
// Mailjet doesn't sign webhooks either, so we authenticate with a shared
// secret sent as a custom header. Set the same value as the
// MAILJET_WEBHOOK_SECRET edge-function secret and as a custom header named
// X-Webhook-Secret on the event webhook configured in the Mailjet dashboard
// (Account Settings -> Event API / Webhooks).
const SECRET_HEADER = 'x-webhook-secret'

// Mailjet event names -> our internal suppression reason. Only permanent
// failures / complaints / opt-outs suppress; a soft bounce (hard_bounce:
// false) is transient and must not suppress the address.
type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe'

// Mailjet posts either a single event object or an array of event objects
// in one call (batched delivery), so both shapes must be handled.
interface MailjetEventPayload {
  event: string
  email: string
  MessageID?: number | string
  time?: number
  hard_bounce?: boolean
  blocked?: boolean
  error?: string
  error_related_to?: string
  comment?: string
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

// bounce: only a hard bounce or a bounce that got the address blocked is
// permanent; a soft bounce (hard_bounce: false, blocked: false) is transient
// (e.g. mailbox full, greylisted) and must not suppress the address.
function reasonForEvent(payload: MailjetEventPayload): SuppressionReason | null {
  switch (payload.event) {
    case 'bounce':
      return payload.hard_bounce || payload.blocked ? 'bounce' : null
    case 'blocked':
      return 'bounce'
    case 'spam':
      return 'complaint'
    case 'unsub':
      return 'unsubscribe'
    default:
      return null
  }
}

async function processEvent(
  supabase: ReturnType<typeof createClient>,
  payload: MailjetEventPayload,
): Promise<{ ignored?: string } | { suppressed: SuppressionReason }> {
  const reason = reasonForEvent(payload)

  if (!reason) {
    return { ignored: payload.event }
  }

  const normalizedEmail = payload.email.toLowerCase()
  const messageId = payload.MessageID != null ? String(payload.MessageID) : null
  const metadata = {
    event: payload.event,
    error: payload.error ?? null,
    error_related_to: payload.error_related_to ?? null,
    comment: payload.comment ?? null,
    hard_bounce: payload.hard_bounce ?? null,
    blocked: payload.blocked ?? null,
  }

  // 1. Upsert to suppressed_emails (idempotent -- safe for retries)
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
    throw new Error('Failed to write suppression')
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
    // Non-fatal -- the suppression was already recorded.
    console.warn('Failed to insert email_send_log', { error: insertError })
  }

  console.log('Suppression processed', {
    email_redacted: redactEmail(normalizedEmail),
    event: payload.event,
    reason,
    has_message_id: !!messageId,
  })

  return { suppressed: reason }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('MAILJET_WEBHOOK_SECRET')
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

  // Parse the Mailjet event payload -- either a single object or an array
  // of events delivered in one call.
  let events: MailjetEventPayload[]
  try {
    const parsed = await req.json()
    const list = Array.isArray(parsed) ? parsed : [parsed]
    if (list.some((e) => !e?.event || !e?.email)) {
      return jsonResponse({ error: 'Missing required fields: event, email' }, 400)
    }
    events = list as MailjetEventPayload[]
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const results = []
  for (const event of events) {
    try {
      results.push(await processEvent(supabase, event))
    } catch {
      return jsonResponse({ error: 'Failed to write suppression' }, 500)
    }
  }

  return jsonResponse({ success: true, results })
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
