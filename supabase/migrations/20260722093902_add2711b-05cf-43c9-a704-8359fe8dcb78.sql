
-- Helper to seed/update the recurring cron shared secret in vault
CREATE OR REPLACE FUNCTION public.set_recurring_cron_secret(_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  sid uuid;
BEGIN
  SELECT id INTO sid FROM vault.secrets WHERE name = 'recurring_cron_secret';
  IF sid IS NULL THEN
    PERFORM vault.create_secret(_value, 'recurring_cron_secret');
  ELSE
    PERFORM vault.update_secret(sid, _value, 'recurring_cron_secret');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_recurring_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_recurring_cron_secret(text) TO service_role;

-- Remove the broken legacy cron job (anon key) and re-schedule the daily job
-- to send the shared X-Cron-Secret header pulled from vault.
DO $$ BEGIN
  PERFORM cron.unschedule('process-recurring-transactions');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('process-recurring-transactions-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-recurring-transactions-daily',
  '15 2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://cublznofafajedpswsmd.supabase.co/functions/v1/process-recurring-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'recurring_cron_secret')
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $cron$
);
