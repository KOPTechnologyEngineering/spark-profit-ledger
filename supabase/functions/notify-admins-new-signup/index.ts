import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // AuthZ: caller MUST present a valid user JWT and it must match newUserId.
    // This prevents anonymous callers (using anon key) from spamming admin
    // inboxes with fabricated signup notifications.
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const callerId = userData.user.id
    const callerEmail = userData.user.email || ''

    const { newUserId, appUrl } = await req.json()
    if (!newUserId) {
      return new Response(JSON.stringify({ error: 'newUserId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // The caller must be the newly-signed-up user themselves.
    if (callerId !== newUserId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch trusted user profile server-side; do NOT trust client-provided
    // name/email fields as they end up in the admin email body.
    const { data: newProfile } = await admin
      .from('tbl_profiles')
      .select('full_name, email')
      .eq('user_id', newUserId)
      .maybeSingle()

    const trustedNewUserEmail = newProfile?.email || callerEmail
    const trustedNewUserName = newProfile?.full_name || ''

    // Find admin user_ids
    const { data: adminRoles, error: rolesErr } = await admin
      .from('tbl_user_roles')
      .select('user_id')
      .eq('module', 'users')
      .eq('access', 'admin')
    if (rolesErr) throw rolesErr

    const adminIds = Array.from(new Set((adminRoles || []).map((r: any) => r.user_id)))
    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: 'no admins' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: admins, error: profErr } = await admin
      .from('tbl_profiles')
      .select('user_id, full_name, email, is_hidden, approval_status')
      .in('user_id', adminIds)
    if (profErr) throw profErr

    const recipients = (admins || []).filter(
      (a: any) =>
        !a.is_hidden &&
        a.approval_status === 'approved' &&
        a.email &&
        !a.email.endsWith('@ledgerflow.local') &&
        a.user_id !== newUserId,
    )

    const signedUpAt = new Date().toISOString()
    const results: any[] = []
    for (const adminUser of recipients) {
      const { error } = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'admin-approval-request',
          recipientEmail: adminUser.email,
          idempotencyKey: `admin-approval-${newUserId}-${adminUser.user_id}`,
          templateData: {
            adminName: adminUser.full_name || adminUser.email.split('@')[0],
            newUserName: trustedNewUserName,
            newUserEmail: trustedNewUserEmail,
            signedUpAt,
            appUrl: appUrl || '',
          },
        },
      })
      results.push({ to: adminUser.email, ok: !error, error: error?.message })
    }

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
