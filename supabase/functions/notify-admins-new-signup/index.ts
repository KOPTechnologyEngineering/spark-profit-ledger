import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { newUserId, newUserEmail, newUserName, appUrl } = await req.json()
    if (!newUserId || !newUserEmail) {
      return new Response(JSON.stringify({ error: 'newUserId and newUserEmail required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Find admin user_ids
    const { data: adminRoles, error: rolesErr } = await supabase
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

    const { data: admins, error: profErr } = await supabase
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
    for (const admin of recipients) {
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'admin-approval-request',
          recipientEmail: admin.email,
          idempotencyKey: `admin-approval-${newUserId}-${admin.user_id}`,
          templateData: {
            adminName: admin.full_name || admin.email.split('@')[0],
            newUserName: newUserName || '',
            newUserEmail,
            signedUpAt,
            appUrl: appUrl || '',
          },
        },
      })
      results.push({ to: admin.email, ok: !error, error: error?.message })
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
