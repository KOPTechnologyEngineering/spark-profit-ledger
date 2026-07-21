-- Recurring transactions were never actually processed automatically: the
-- process-recurring-transactions edge function supports being triggered by a
-- cron job (it accepts the service-role key as an alternative to a user
-- session, see its own auth-guard comment), but no such job was ever created.
-- The only real caller in the app is the manual "Run now" button in
-- RecurringTransactionsTab.tsx. This adds the missing daily trigger, using
-- the same pg_cron + pg_net + supabase_vault pattern already proven by the
-- process-email-queue job (20260602012622_email_infra.sql).
--
-- pg_net / pg_cron / supabase_vault are already enabled by
-- 20260602012622_email_infra.sql, so they are not re-created here.
--
-- REQUIRED MANUAL STEP (not committed here, since it's a live secret):
-- before this job can succeed, run once in the Supabase SQL editor:
--   select vault.create_secret(
--     '<your service_role key from Project Settings > API>',
--     'recurring_transactions_service_role_key',
--     'Service role key used by the process-recurring-transactions cron trigger'
--   );
-- To revert this migration's schedule: select cron.unschedule('process-recurring-transactions-daily');

DO $$
BEGIN
  PERFORM cron.unschedule('process-recurring-transactions-daily');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet, nothing to remove
END $$;

SELECT cron.schedule(
  'process-recurring-transactions-daily',
  '15 1 * * *', -- 01:15 UTC daily, after midnight has rolled over everywhere the app is used
  $$
  SELECT net.http_post(
    url := 'https://cublznofafajedpswsmd.supabase.co/functions/v1/process-recurring-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'recurring_transactions_service_role_key'
      )
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $$
);
