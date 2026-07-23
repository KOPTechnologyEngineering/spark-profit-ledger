import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODULES = ['invoices', 'transactions', 'pnl', 'vat', 'paye', 'reports', 'users'] as const
const ACCESS = ['none', 'view', 'edit', 'admin'] as const

// Admin-initiated user creation. The app's "Add User" screen used to call
// supabase.auth.signUp() directly from the browser, which triggers a
// confirmation email -- if SMTP isn't fully activated that send fails and
// GoTrue rejects the whole signup with a 500 ("Error sending confirmation
// email"), surfacing as an empty error in the UI. Admins creating a user
// with a chosen password don't need email verification (the app has its own
// approval workflow), so this does it server-side with email_confirm=true,
// no email required, and applies the chosen roles + approval in one step.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ success: false, error: 'Unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) return json({ success: false, error: 'Unauthorized' }, 401)
    const callerId = userData.user.id

    // AuthZ: caller must be an approved users-module admin -- the same role
    // that gates the Add User button in the UI and the delete-user function.
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
      return json({ success: false, error: 'Forbidden: requires users-module admin access' }, 403)
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const fullName = String(body.full_name || body.fullName || '').trim()
    const rolesInput = (body.roles && typeof body.roles === 'object')
      ? (body.roles as Record<string, string>)
      : {}

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ success: false, error: 'A valid email is required' })
    }
    if (password.length < 6) {
      return json({ success: false, error: 'Password must be at least 6 characters' })
    }

    // Create the user with the email pre-confirmed (no confirmation email sent).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createErr || !created?.user) {
      return json({ success: false, error: createErr?.message || 'Could not create user' })
    }
    const newUserId = created.user.id

    // The handle_new_user trigger has already created the profile (pending)
    // and default 'none' roles. Approve them (admin explicitly created them),
    // then apply the exact roles the admin chose -- set AFTER approval so the
    // grant_default_roles_on_approval trigger (which bumps 'none' -> 'view')
    // can't override the admin's deliberate choices.
    const { error: approveErr } = await admin
      .from('tbl_profiles')
      .update({ approval_status: 'approved', approved_at: new Date().toISOString(), approved_by: callerId })
      .eq('user_id', newUserId)
    if (approveErr) {
      return json({ success: false, error: `User created but approval failed: ${approveErr.message}` })
    }

    for (const mod of MODULES) {
      const access = rolesInput[mod]
      if (access && (ACCESS as readonly string[]).includes(access)) {
        await admin.from('tbl_user_roles').update({ access }).eq('user_id', newUserId).eq('module', mod)
      }
    }

    await admin.from('tbl_user_approval_audit').insert({
      target_user_id: newUserId,
      actor_user_id: callerId,
      action: 'approved',
      reason: 'Created and approved via User Management',
    })

    return json({ success: true, user_id: newUserId })
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500)
  }
})
