import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

// Renders all registered templates with their previewData.
// Gated by LOVABLE_API_KEY — only the Go API calls this.

// Compares two secrets via their SHA-256 digests rather than the raw
// strings, so the comparison always operates on two fixed-length (32-byte)
// buffers -- neither the early-exit-on-mismatch nor the length of `token`
// itself leaks any timing signal about `apiKey`.
async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
  const bytesA = new Uint8Array(digestA)
  const bytesB = new Uint8Array(digestB)
  let diff = 0
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i]
  }
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Verify the caller is authorized with LOVABLE_API_KEY
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token || !(await constantTimeEqual(token, apiKey))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const templateNames = Object.keys(TEMPLATES)
  const results: Array<{
    templateName: string
    displayName: string
    subject: string
    html: string
    status: 'ready' | 'preview_data_required' | 'render_failed'
    errorMessage?: string
  }> = []

  for (const name of templateNames) {
    const entry = TEMPLATES[name]
    const displayName = entry.displayName || name

    if (!entry.previewData) {
      results.push({
        templateName: name,
        displayName,
        subject: '',
        html: '',
        status: 'preview_data_required',
      })
      continue
    }

    try {
      const html = await renderAsync(
        React.createElement(entry.component, entry.previewData)
      )
      const resolvedSubject =
        typeof entry.subject === 'function'
          ? entry.subject(entry.previewData)
          : entry.subject

      results.push({
        templateName: name,
        displayName,
        subject: resolvedSubject,
        html,
        status: 'ready',
      })
    } catch (err) {
      console.error('Failed to render template for preview', {
        template: name,
        error: err,
      })
      results.push({
        templateName: name,
        displayName,
        subject: '',
        html: '',
        status: 'render_failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return new Response(JSON.stringify({ templates: results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
