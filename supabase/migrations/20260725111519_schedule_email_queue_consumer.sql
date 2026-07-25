-- The transactional-email queue (pgmq 'transactional_emails') had no consumer
-- on this project: the email_queue_wake / email_queue_dispatch helpers that
-- scheduled process-email-queue on the OLD project were created outside
-- migration tracking and never came across in the backend migration, so
-- enqueued emails (welcome, account-approved, etc.) piled up and were never
-- sent.
--
-- This schedules a simple every-minute pg_cron job that drains the queue by
-- calling the process-email-queue edge function. The function now accepts the
-- shared X-Cron-Secret (pulled from vault) instead of only a service-role JWT
-- -- the same mechanism the recurring-transactions cron already uses -- and
-- has verify_jwt = false so the secret-bearing call reaches its auth check.

DO $$ BEGIN
  PERFORM cron.unschedule('process-email-queue-every-min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-email-queue-every-min',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://zxlvqnqesmrockfpphzw.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'recurring_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
