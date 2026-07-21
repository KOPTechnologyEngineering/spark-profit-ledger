-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-recurring-transactions-daily') THEN
    PERFORM cron.unschedule('process-recurring-transactions-daily');
  END IF;
END $$;

-- Schedule the recurring transactions processor daily at 02:15 UTC
SELECT cron.schedule(
  'process-recurring-transactions-daily',
  '15 2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://cublznofafajedpswsmd.supabase.co/functions/v1/process-recurring-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $cron$
);