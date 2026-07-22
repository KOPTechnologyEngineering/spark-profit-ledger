# KOP Ledger — Migration Guide to a New Backend Project

This guide instructs an AI agent (Claude / Lovable) how to migrate the KOP Ledger app from its current backend project to a fresh one. The consolidated database schema lives in `consolidated_migration.sql` (all 52 historical migrations concatenated in chronological order).

---

## 1. Prerequisites

Before starting, confirm access to:
- The **new** backend project (Lovable Cloud or Supabase) — project ref, URL, anon key, service role key.
- The KOP Ledger frontend codebase.
- The following secrets from the old project (or freshly generated equivalents):
  - `LOVABLE_API_KEY` (AI Gateway)
  - `RECURRING_CRON_SECRET` (generate a new random 32+ char string is fine)
  - Any SMTP / Resend / notify domain keys used by the email pipeline.

---

## 2. Run the consolidated schema migration

Apply `consolidated_migration.sql` against the new database **in a single transaction/run**, in file order. It contains, in this order:

1. Enums (`app_module`, `access_level`, `app_role`, org types, approval statuses, etc.)
2. Core tables (all prefixed `tbl_`): `tbl_profiles`, `tbl_user_roles`, `tbl_organizations`, `tbl_invoices`, `tbl_transactions`, `tbl_recurring_transactions`, `tbl_recurring_run_log`, `tbl_recurring_run_details`, `tbl_vat_returns`, `tbl_paye_employees`, `tbl_notifications`, `tbl_user_approval_audit`, `tbl_password_reset_attempts`, all `tbl_collection_*` tables.
3. Email infrastructure: `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`, plus `pgmq` queues `q_auth_emails` and `q_transactional_emails`.
4. GRANTs on every public table (authenticated + service_role; anon only where intentional).
5. RLS enable + policies for every table.
6. SECURITY DEFINER helper functions: `has_module_access`, `is_user_admin`, `is_user_approved`, `handle_new_user`, `update_updated_at_column`, `protect_profile_privileges`, `restrict_invoice_approver_updates`, `restrict_transaction_approver_updates`, `grant_default_roles_on_approval`, email queue helpers, `set_recurring_cron_secret`.
7. Triggers: `on_auth_user_created` (auth.users → handle_new_user), update_updated_at triggers, approver-restriction triggers, self-approval prevention, profile privilege protection, email queue wake.
8. Unique constraints: e.g. `uniq_tbl_transactions_recurring_date` for idempotent recurring processing.
9. Realtime publication additions (do NOT add `tbl_profiles` — intentionally excluded for security).

**Commands (agent side):** use the `supabase--migration` tool and paste the file contents as the `query`. If it exceeds the size limit, split by the `-- Migration:` banner comments but keep the original order.

**Expected result:** ~25 tables in `public`, ~15 SECURITY DEFINER functions, all with RLS enabled.

---

## 3. Create storage buckets

Create both buckets as **private** (not public):

- `transaction-attachments`
- `signatures`

Add storage RLS policies so:
- Authenticated users can read/write objects under a path prefixed by their `auth.uid()`.
- `signatures` URLs are always resolved via short-lived signed URLs (5 min) — see `src/lib/signatures.ts` (`resolveSignatureUrl`).

---

## 4. Configure Auth

1. Disable anonymous sign-ups.
2. Enable email/password. Do NOT auto-confirm emails unless the user requests it.
3. Enable Google OAuth provider (project uses it by default).
4. Set the Site URL and redirect URLs to the app's preview + published + custom domain URLs.
5. Password reset uses the in-app `/reset-password` route — set the redirect accordingly.

---

## 5. Deploy Edge Functions

Deploy every function under `supabase/functions/`:

- `delete-user`
- `handle-email-suppression`
- `handle-email-unsubscribe`
- `notify-admins-new-signup`
- `preview-transactional-email`
- `process-email-queue`
- `process-recurring-transactions`
- `request-password-reset`
- `seed-cron-secret`
- `send-transactional-email`

`config.toml` controls `verify_jwt`. Cron-invoked functions (`process-email-queue`, `process-recurring-transactions`) rely on a custom `X-Cron-Secret` header instead of JWT — keep their `verify_jwt = false` and ensure they check the secret against `RECURRING_CRON_SECRET` (recurring) / the vault secret for email.

---

## 6. Set project secrets

In the new backend project's function/secret store, set:

| Secret | Purpose |
|---|---|
| `LOVABLE_API_KEY` | AI Gateway calls |
| `RECURRING_CRON_SECRET` | Auth header for recurring cron endpoint |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWKS`, `SUPABASE_DB_URL` | Auto-populated by Cloud; verify present |
| SMTP/Resend credentials | Transactional email delivery for `notify.kopledger.koptechnology.com` |

---

## 7. Seed the cron secret into Vault

Invoke the `seed-cron-secret` Edge Function once. It reads `RECURRING_CRON_SECRET` from the function env and calls `set_recurring_cron_secret(...)`, storing it in `vault.secrets` under name `recurring_cron_secret`.

Also seed `email_queue_service_role_key` in Vault (used by `email_queue_wake` / `email_queue_dispatch` to authorize the process-email-queue callback). Value = the new project's service role key:

```sql
select vault.create_secret('<service_role_key>', 'email_queue_service_role_key');
```

---

## 8. Schedule pg_cron jobs

Run in SQL (require `pg_cron` + `pg_net` extensions, both already enabled by the consolidated migration):

```sql
-- Recurring transactions (daily 02:15 UTC)
select cron.schedule(
  'process-recurring-transactions-daily',
  '15 2 * * *',
  $$
  select net.http_post(
    url := 'https://<NEW_PROJECT_REF>.supabase.co/functions/v1/process-recurring-transactions',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Cron-Secret',(select decrypted_secret from vault.decrypted_secrets where name='recurring_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The email queue cron (`process-email-queue`, every 5s) is scheduled dynamically by the `email_queue_wake` trigger — no manual scheduling needed. Verify it appears in `cron.job` after the first email is enqueued.

Verify both with `select * from cron.job;` and `select * from cron.job_run_details order by start_time desc limit 20;`.

---

## 9. Seed hidden admin accounts

Create a small script (or reuse the previous `seed-admin-users` function) that uses the service-role key to create three auth users and mark their profiles admin + hidden:

- `LFADMIN@kopledger.local`
- `LFROOT@kopledger.local`
- `LFMIG@kopledger.local`

All with password `123456`. After creation, for each user:

```sql
update public.tbl_profiles
   set approval_status='approved', approved_at=now(), is_hidden=true, is_approver=true
 where email in ('LFADMIN@kopledger.local','LFROOT@kopledger.local','LFMIG@kopledger.local');

update public.tbl_user_roles
   set access='admin'
 where user_id in (select user_id from public.tbl_profiles
                    where email in ('LFADMIN@kopledger.local','LFROOT@kopledger.local','LFMIG@kopledger.local'));
```

The `handle_new_user` trigger auto-creates a `tbl_profiles` row and `tbl_user_roles` rows on signup, so only the above status/role upgrade is needed after auth creation.

---

## 10. Update the frontend

1. Update `.env` with new `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (auto-managed by Lovable Cloud — do not hand-edit).
2. Regenerate `src/integrations/supabase/types.ts` against the new project.
3. Do NOT modify `src/integrations/supabase/client.ts`.

---

## 11. Verification checklist

Run these end-to-end before declaring migration complete:

- [ ] Sign up a new user → row appears in `tbl_profiles` with `approval_status='pending'`, all `tbl_user_roles.access='none'`.
- [ ] Admin approves user → `grant_default_roles_on_approval` upgrades roles to `view`.
- [ ] Create invoice / transaction → visible only to owner + approvers.
- [ ] Self-approval blocked (creator cannot approve their own invoice/transaction).
- [ ] Upload signature → stored private, rendered via 5-min signed URL.
- [ ] Trigger `process-recurring-transactions` manually → run row appears in `tbl_recurring_run_log`, transactions inserted, rerun is idempotent (no duplicates via `uniq_tbl_transactions_recurring_date`).
- [ ] Send a transactional email → row lands in `pgmq.q_transactional_emails`, cron `process-email-queue` scheduled, `email_send_log` records delivery, cron self-unschedules when queue empties.
- [ ] Password reset throttled at 3/email/hour and 10/IP/hour via `tbl_password_reset_attempts`.
- [ ] Hidden admins do NOT appear in User Management list but can still log in.
- [ ] Run `supabase--linter` and `security--run_security_scan`; resolve any RLS / SECURITY DEFINER findings.

---

## 12. Known gotchas

- **GRANTs are mandatory.** Every `public` table needs explicit GRANTs; the consolidated file includes them but if you ever add a table manually, PostgREST returns permission errors without them.
- **Never touch `auth`, `storage`, `realtime`, `supabase_functions`, or `vault` schemas** except via the provided helpers.
- **`tbl_profiles` is intentionally NOT in the realtime publication** — do not re-add it.
- **Delete is logical everywhere.** Rows use `deleted_at`; do not physically DELETE.
- **Cron auth uses `X-Cron-Secret`, not JWT.** Do not enable `verify_jwt` on the cron-invoked functions.
