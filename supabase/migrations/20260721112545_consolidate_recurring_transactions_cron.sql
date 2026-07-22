-- Two migrations both scheduled a 'process-recurring-transactions-daily'
-- pg_cron job within seconds of each other on 2026-07-21:
--   20260721070732_schedule_recurring_transactions_cron.sql (this session,
--     01:15 UTC, expected a dedicated 'recurring_transactions_service_role_key'
--     vault secret that was never actually created)
--   20260721071210_e06a5b6d-....sql (Lovable, 02:15 UTC, reuses the existing
--     'email_queue_service_role_key' vault secret from the email-queue cron job)
-- Since pg_cron's cron.schedule upserts by job name and migrations apply in
-- filename order, the second (Lovable's) migration is what actually ended up
-- live in production -- the first migration's manual "create this vault
-- secret" instructions were never acted on and are moot.
--
-- This migration is the single source of truth going forward: it re-applies
-- the working configuration (Lovable's schedule/secret) explicitly, so
-- there's no ambiguity for anyone reading the migrations folder about which
-- of the two prior migrations reflects reality. No new manual step is
-- required -- 'email_queue_service_role_key' already exists and is already
-- proven to work (it's what powers the working transactional-email cron job).
-- To revert: select cron.unschedule('process-recurring-transactions-daily');

DO $$
BEGIN
  PERFORM cron.unschedule('process-recurring-transactions-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'process-recurring-transactions-daily',
  '15 2 * * *', -- 02:15 UTC daily
  $$
  SELECT net.http_post(
    url := 'https://cublznofafajedpswsmd.supabase.co/functions/v1/process-recurring-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $$
);
