# Supabase Auth (GoTrue) email templates

Source of truth for the six auth emails. **Editing a file here does not change
what Supabase sends** — the hosted project reads its templates from the
dashboard, not from this repo. After changing a file, paste it into:

**Supabase Dashboard → Authentication → Emails → Email Templates**

| File | Dashboard slot | Triggered by |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `signUp()` in [src/pages/Auth.tsx](../../../src/pages/Auth.tsx) — **in use** |
| `reset-password.html` | Reset password | `resetPasswordForEmail()` in [request-password-reset](../../functions/request-password-reset/index.ts) — **in use** |
| `magic-link.html` | Magic link | `signInWithOtp()` — not currently used |
| `invite-user.html` | Invite user | `inviteUserByEmail()` — not currently used (`create-user` sets `email_confirm: true` instead) |
| `change-email.html` | Change email address | `updateUser({ email })` — not currently used |
| `reauthentication.html` | Reauthentication | not currently used |

The four unused templates are here so that enabling any of those flows doesn't
silently send Supabase's unbranded default.

## Template variables

These are Go `text/template` placeholders GoTrue substitutes at send time.
Leave them exactly as written — a typo produces a dead link with no error.

- `{{ .ConfirmationURL }}` — the action link (all except reauthentication)
- `{{ .Token }}` — 6-digit code (reauthentication)
- `{{ .Email }}` / `{{ .NewEmail }}` — change-email only
- Also available: `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .RedirectTo }}`, `{{ .Data }}`

## Constraints these files work within

- **Tables, not flexbox.** Outlook on Windows renders with the Word engine and
  ignores flex/grid. Layout is nested `<table>` with inline styles only.
- **No `<style>` block or classes.** Several clients strip them.
- **CTA is a `<td bgcolor>` wrapping an `<a>`**, not a styled `<a>` — Outlook
  won't paint the background otherwise.
- **The logo SVG is expected to disappear in Gmail**, which strips inline SVG.
  The emerald square behind it is a table cell with its own `bgcolor`, so the
  mark degrades to a solid square rather than a broken image.
- **Web fonts don't load** in Gmail or Outlook. Space Grotesk and Inter are
  declared for the clients that support them; everyone else gets the
  Helvetica/Arial fallback. The design doesn't depend on them.
- **Light-only.** `color-scheme: light only` discourages clients from applying
  their own dark-mode inversion to the white body.

## Expiry wording

Each footer states how long the link lasts. Those durations must match the
project's actual settings (Authentication → Emails → expiry, and
`mailer_otp_exp`). If you change the expiry in Supabase, update the copy here
and re-paste — stale wording is worse than none.

## Design

Dark brand band over a white body, from the app's real theme tokens in
`src/index.css`: `#080C17` (`--background`), `#10B981` (`--primary`), `#F1F5F9`
(`--foreground`). CTA text is near-black `#080C17` (`--primary-foreground`) —
white on emerald is ~2.1:1 contrast and fails WCAG; near-black is ~9:1.

The transactional templates in
[`supabase/functions/_shared/transactional-email-templates/`](../../functions/_shared/transactional-email-templates/)
share this design via `styles.tsx`. Change one, change the other.
