import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Tables whose user_id column REFERENCES auth.users(id) ON DELETE CASCADE
// and holds real financial/statutory records -- UK law requires these be
// kept for several years regardless of whether the creating account still
// exists (e.g. Companies Act 2006 accounting-record retention). If any of
// these have rows for the target user, deleting the auth user directly
// would silently cascade-delete years of invoices/payroll/etc alongside
// them, which is a worse outcome than the GDPR gap this function fixes.
const RETAINED_RECORD_TABLES = [
  'tbl_invoices',
  'tbl_transactions',
  'tbl_vat_returns',
  'tbl_paye_employees',
  'tbl_recurring_transactions',
  'tbl_organizations',
] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
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

    const { targetUserId } = await req.json()
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'targetUserId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Same rule the UI already enforces (the delete button is hidden for
    // your own row) -- enforced again here so a direct API call can't
    // bypass it and lock the caller out of their own account.
    if (targetUserId === callerId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // AuthZ: caller must be an approved users-module admin -- the same
    // role that already gates the Delete button in UserManagement.tsx and
    // the tbl_user_approval_audit insert policy.
    const { data: callerProfile } = await admin
      .from('tbl_profiles')
      .select('approval_status')
      .eq('user_id', callerId)
      .maybeSingle()
    const { data: callerRole } = await admin
      .from('tbl_user_roles')
      .select('access')
      .eq('user_id', callerId)
      .eq('module', 'users')
      .maybeSingle()
    if (callerProfile?.approval_status !== 'approved' || callerRole?.access !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check whether the target has any retained financial records.
    const counts = await Promise.all(
      RETAINED_RECORD_TABLES.map((table) =>
        admin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', targetUserId),
      ),
    )
    const hasRetainedRecords = counts.some((r) => (r.count ?? 0) > 0)

    if (!hasRetainedRecords) {
      // Safe to fully erase: no financial records depend on this user_id,
      // so the ON DELETE CASCADE from tbl_profiles/tbl_user_roles to
      // auth.users is the only thing that fires.
      const { error: deleteErr } = await admin.auth.admin.deleteUser(targetUserId)
      if (deleteErr) throw deleteErr

      await admin.from('tbl_user_approval_audit').insert({
        target_user_id: targetUserId,
        actor_user_id: callerId,
        action: 'deleted',
        reason: null,
      })

      return new Response(JSON.stringify({ mode: 'deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Has real financial/statutory records -- anonymize instead of
    // deleting, so those records survive under the same (now-anonymous)
    // user_id rather than being cascade-deleted. This satisfies GDPR's
    // right to erasure for the person's identifying data while respecting
    // the separate legal obligation to retain accounting records
    // (GDPR Art. 17(3)(b); UK Companies Act 2006 s.388 retention).
    const anonymizedEmail = `deleted-${targetUserId}@erased.invalid`
    const randomPassword = crypto.randomUUID() + crypto.randomUUID()

    const { error: updateAuthErr } = await admin.auth.admin.updateUserById(targetUserId, {
      email: anonymizedEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: {},
    })
    if (updateAuthErr) throw updateAuthErr

    const { error: profileErr } = await admin
      .from('tbl_profiles')
      .update({ full_name: 'Deleted user', email: anonymizedEmail, is_active: false, is_hidden: true })
      .eq('user_id', targetUserId)
    if (profileErr) throw profileErr

    const { error: rolesErr } = await admin.from('tbl_user_roles').delete().eq('user_id', targetUserId)
    if (rolesErr) throw rolesErr

    await admin.from('tbl_user_approval_audit').insert({
      target_user_id: targetUserId,
      actor_user_id: callerId,
      action: 'anonymized',
      reason: 'Has linked financial records that must be retained; identity scrubbed instead of deleted.',
    })

    return new Response(JSON.stringify({ mode: 'anonymized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
